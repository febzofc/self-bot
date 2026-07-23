const express = require('express');
const path = require('path');
const fs = require('fs');

// Ensure config is loaded
require('./config.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Helper to load channels database dynamically
function getChannels() {
    const channelsPath = path.join(__dirname, 'src/channels.json');
    try {
        if (fs.existsSync(channelsPath)) {
            return JSON.parse(fs.readFileSync(channelsPath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading channels.json in server:', e);
    }
    return [];
}

const pluginManager = require('./lib/pluginManager.js');

const crypto = require('crypto');

// --- OWNER AUTHENTICATION SYSTEM (Stateless & Reverse-Proxy Safe) ---
function normalizePhone(num) {
    if (!num) return '';
    let digits = String(num).replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) {
        digits = '62' + digits.substring(1);
    }
    return digits;
}

function generateOwnerToken(phone) {
    const normPhone = normalizePhone(phone);
    const timestamp = Date.now();
    const secret = global.ownerPassword || 'owner123';
    const signature = crypto.createHmac('sha256', secret).update(`${normPhone}:${timestamp}`).digest('hex');
    return `${normPhone}.${timestamp}.${signature}`;
}

function verifyOwnerToken(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [phone, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return false;

    // Check token expiration (30 days)
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > thirtyDaysMs) return false;

    // Verify phone is in global.owner
    const ownerList = (global.owner || []).map(normalizePhone);
    if (!ownerList.includes(phone)) return false;

    // Verify signature
    const secret = global.ownerPassword || 'owner123';
    const expectedSig = crypto.createHmac('sha256', secret).update(`${phone}:${timestamp}`).digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    } catch (e) {
        return false;
    }
}

function parseCookieToken(cookieHeader) {
    if (!cookieHeader) return '';
    const match = cookieHeader.match(/(?:^|;\s*)owner_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

// CORS & Preflight Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-owner-token');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

function requireOwnerAuth(req, res, next) {
    if (req.method === 'OPTIONS') return next();

    const authHeader = req.headers.authorization || '';
    const tokenHeader = req.headers['x-owner-token'] || '';
    const queryToken = req.query.token || req.query.owner_token || '';
    const cookieToken = parseCookieToken(req.headers.cookie);

    let token = '';
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else if (tokenHeader) {
        token = tokenHeader.trim();
    } else if (queryToken) {
        token = queryToken.trim();
    } else if (cookieToken) {
        token = cookieToken.trim();
    }

    if (token && verifyOwnerToken(token)) {
        req.ownerToken = token;
        return next();
    }

    return res.status(401).json({ 
        success: false, 
        error: 'Akses ditolak. Silakan login sebagai Owner terlebih dahulu.' 
    });
}

// Owner Authentication Endpoints
app.post('/api/owner/login', (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ success: false, error: 'Nomor telepon dan password wajib diisi.' });
    }

    const inputPhoneNormalized = normalizePhone(phone);
    const ownerList = (global.owner || []).map(normalizePhone);

    const isPhoneValid = ownerList.includes(inputPhoneNormalized);
    const isPasswordValid = password === (global.ownerPassword || 'owner123');

    if (isPhoneValid && isPasswordValid) {
        const token = generateOwnerToken(inputPhoneNormalized);
        res.cookie('owner_token', token, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
        return res.json({ 
            success: true, 
            message: 'Login berhasil!', 
            token, 
            ownerPhone: inputPhoneNormalized 
        });
    }

    return res.status(401).json({ success: false, error: 'Nomor owner atau password salah!' });
});

app.post('/api/owner/logout', (req, res) => {
    res.clearCookie('owner_token', { path: '/' });
    res.json({ success: true, message: 'Logout berhasil.' });
});

app.get('/api/owner/verify', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const tokenHeader = req.headers['x-owner-token'] || '';
    const queryToken = req.query.token || req.query.owner_token || '';
    const cookieToken = parseCookieToken(req.headers.cookie);

    let token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7).trim() 
        : (tokenHeader || queryToken || cookieToken);

    const authenticated = verifyOwnerToken(token);
    res.json({ success: true, authenticated });
});

// Protect all plugin management endpoints with requireOwnerAuth
app.use('/api/plugins', requireOwnerAuth);

// API endpoints for Plugin Monitoring & Management
app.get('/api/plugins', (req, res) => {
    res.json(pluginManager.getStats());
});

app.get('/api/plugins/errors', (req, res) => {
    res.json(global.pluginErrors || {});
});

app.get('/api/plugins/code/:filename', (req, res) => {
    const filename = req.params.filename;
    try {
        const code = pluginManager.getPluginCode(filename);
        const errorInfo = global.pluginErrors[filename] || null;
        const isDisabled = Boolean(global.disabledPlugins && global.disabledPlugins[filename]);
        res.json({ success: true, filename, code, errorInfo, isDisabled });
    } catch (e) {
        res.status(404).json({ success: false, error: e.message });
    }
});

app.post('/api/plugins/code/:filename', (req, res) => {
    const filename = req.params.filename;
    const { code } = req.body;
    if (typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'String konten kode diperlukan.' });
    }
    try {
        const result = pluginManager.savePluginCode(filename, code);
        res.json({ success: true, filename, result, stats: pluginManager.getStats() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/plugins/create', (req, res) => {
    const { filename, code } = req.body;
    if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ success: false, error: 'Nama file plugin wajib diisi.' });
    }
    try {
        const defaultCode = code || `const { fetchJson } = require('../lib/fungsi.js');\n\nmodule.exports = {\n    CmD: ['${filename.replace('.js', '')}'],\n    aliases: [],\n    categori: 'general',\n    exec: async (m, { bob, prefix, command, text }) => {\n        if (!text) return m.reply(\`Gunakan \${prefix + command} <teks>\`);\n        m.reply(\`Hasil: \${text}\`);\n    }\n};\n`;
        const result = pluginManager.createPlugin(filename, defaultCode);
        res.json({ success: true, result, stats: pluginManager.getStats() });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.post('/api/plugins/toggle', (req, res) => {
    const { filename, action } = req.body;
    if (!filename || !action) {
        return res.status(400).json({ success: false, error: 'Filename dan action (enable/disable) diperlukan.' });
    }
    try {
        let result;
        if (action === 'disable') {
            result = pluginManager.disablePlugin(filename);
        } else if (action === 'enable') {
            result = pluginManager.enablePlugin(filename);
        } else {
            return res.status(400).json({ success: false, error: 'Action harus "enable" atau "disable".' });
        }
        res.json({ success: true, result, stats: pluginManager.getStats() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// API endpoint to get list of channels
app.get('/api/channels', (req, res) => {
    res.json(getChannels());
});

// API endpoint to get a single channel's details
app.get('/api/channels/:id', (req, res) => {
    const channels = getChannels();
    const channel = channels.find(c => c.id === req.params.id.toLowerCase());
    if (channel) {
        res.json(channel);
    } else {
        res.status(404).json({ error: 'Channel tidak ditemukan' });
    }
});

// Live Chat SSE State & Endpoints
const chatClients = {};
const chatHistory = {};
const USER_COLORS = [
    '#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#9b59b6',
    '#1abc9c', '#fd79a8', '#e84393', '#eccc68', '#78e08f'
];

function getUserColor(nickname) {
    let hash = 0;
    for (let i = 0; i < nickname.length; i++) {
        hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % USER_COLORS.length;
    return USER_COLORS[index];
}

app.get('/api/chat/stream', (req, res) => {
    const channelId = (req.query.channel || 'general').toLowerCase();
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    res.write(': ok\n\n');
    
    if (!chatClients[channelId]) {
        chatClients[channelId] = [];
    }
    chatClients[channelId].push(res);
    
    const history = chatHistory[channelId] || [];
    res.write(`data: ${JSON.stringify({ type: 'history', data: history })}\n\n`);
    
    req.on('close', () => {
        chatClients[channelId] = chatClients[channelId].filter(client => client !== res);
    });
});

app.post('/api/chat/message', (req, res) => {
    const { nickname, message, channel } = req.body;
    
    if (!nickname || !message || !channel) {
        return res.status(400).json({ success: false, error: 'Nickname, message, and channel are required.' });
    }
    
    const channelId = channel.toLowerCase();
    const cleanNickname = nickname.trim().substring(0, 20);
    const cleanMessage = message.trim().substring(0, 200);
    
    if (!cleanNickname || !cleanMessage) {
        return res.status(400).json({ success: false, error: 'Message and nickname cannot be empty.' });
    }
    
    const msgObj = {
        id: Date.now() + '-' + Math.floor(Math.random() * 1000),
        nickname: cleanNickname,
        message: cleanMessage,
        timestamp: new Date().toISOString(),
        color: getUserColor(cleanNickname)
    };
    
    if (!chatHistory[channelId]) {
        chatHistory[channelId] = [];
    }
    chatHistory[channelId].push(msgObj);
    if (chatHistory[channelId].length > 50) {
        chatHistory[channelId].shift();
    }
    
    const eventData = { type: 'message', data: msgObj };
    const clients = chatClients[channelId] || [];
    clients.forEach(client => {
        try {
            client.write(`data: ${JSON.stringify(eventData)}\n\n`);
        } catch (e) {
            console.error('Error writing to client:', e);
        }
    });
    
    res.json({ success: true, message: msgObj });
});

// Owner Monitoring Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Watch route (SPA style: serves index.html which handles routing client-side)
app.get('/watch/:channel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Redirect old query format (?channel=transtv) to clean path route (/watch/transtv)
app.get('/', (req, res, next) => {
    if (req.query.channel) {
        const channelId = req.query.channel.toLowerCase().replace(/[^a-z0-9]/g, '');
        return res.redirect(`/watch/${channelId}`);
    }
    next();
});

// Start the server
const server = app.listen(PORT, () => {
    console.log(`\n============================================`);
    console.log(`|  Web Streaming TV Server is running at:   |`);
    console.log(`|  http://localhost:${PORT}                    |`);
    console.log(`============================================\n`);
});

module.exports = server;
