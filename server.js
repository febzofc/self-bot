const express = require('express');
const path = require('path');
const fs = require('fs');

// Ensure config is loaded
require('./config.js');

const app = express();
const PORT = process.env.PORT || 2505;
const { exec } = require('child_process');

app.use(express.json());

// --- SYSTEM LOG CAPTURE (Real-time Logs for Owner Dashboard) ---
const systemLogs = [];
const MAX_LOG_ENTRIES = 500;
const logSSEClients = [];
let _isLogging = false;

function addSystemLog(level, args) {
    const message = args.map(a => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.stack || a.message;
        try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    }).join(' ');

    const entry = {
        id: Date.now() + '-' + Math.floor(Math.random() * 10000),
        timestamp: new Date().toISOString(),
        level,
        message
    };

    systemLogs.push(entry);
    if (systemLogs.length > MAX_LOG_ENTRIES) systemLogs.shift();

    // Broadcast to SSE clients
    const eventData = JSON.stringify({ type: 'log', data: entry });
    for (let i = logSSEClients.length - 1; i >= 0; i--) {
        try {
            logSSEClients[i].write(`data: ${eventData}\n\n`);
        } catch (e) {
            logSSEClients.splice(i, 1);
        }
    }
}

// Intercept console methods to capture all bot logs
const _origLog = console.log.bind(console);
const _origError = console.error.bind(console);
const _origWarn = console.warn.bind(console);

console.log = (...args) => {
    _origLog(...args);
    if (_isLogging) return;
    _isLogging = true;
    try { addSystemLog('info', args); } finally { _isLogging = false; }
};
console.error = (...args) => {
    _origError(...args);
    if (_isLogging) return;
    _isLogging = true;
    try { addSystemLog('error', args); } finally { _isLogging = false; }
};
console.warn = (...args) => {
    _origWarn(...args);
    if (_isLogging) return;
    _isLogging = true;
    try { addSystemLog('warn', args); } finally { _isLogging = false; }
};

// Capture uncaught exceptions & unhandled rejections
process.on('uncaughtException', (err) => {
    addSystemLog('error', [`[UncaughtException] ${err.stack || err.message || err}`]);
});
process.on('unhandledRejection', (reason) => {
    addSystemLog('error', [`[UnhandledRejection] ${reason?.stack || reason?.message || reason}`]);
});

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

// System Logs Endpoints
app.get('/api/plugins/syslog-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(': connected\n\n');

    res.write(`data: ${JSON.stringify({ type: 'history', data: systemLogs })}\n\n`);
    logSSEClients.push(res);

    req.on('close', () => {
        const idx = logSSEClients.indexOf(res);
        if (idx > -1) logSSEClients.splice(idx, 1);
    });
});

app.get('/api/plugins/syslog-list', (req, res) => {
    const level = req.query.level;
    const limit = parseInt(req.query.limit) || 200;
    let filteredLogs = [...systemLogs];
    if (level && ['info', 'warn', 'error'].includes(level)) {
        filteredLogs = filteredLogs.filter(l => l.level === level);
    }
    res.json({ success: true, count: filteredLogs.length, logs: filteredLogs.slice(-limit) });
});

app.post('/api/plugins/syslog-clear', (req, res) => {
    systemLogs.length = 0;
    const eventData = JSON.stringify({ type: 'clear' });
    logSSEClients.forEach(client => {
        try { client.write(`data: ${eventData}\n\n`); } catch {}
    });
    res.json({ success: true, message: 'Semua log berhasil dihapus.' });
});

// --- TERMINAL & BOT RESTART CONTROL ENDPOINTS ---
function detectBotRunner() {
    return new Promise((resolve) => {
        exec('npx pm2 jlist', (err, stdout) => {
            if (!err && stdout) {
                try {
                    const list = JSON.parse(stdout);
                    const mainProc = list.find(p => p.name === 'main' || (p.pm2_env && p.pm2_env.pm_exec_path && p.pm2_env.pm_exec_path.includes('main.js')));
                    if (mainProc) {
                        return resolve({
                            type: 'pm2',
                            id: mainProc.pm_id,
                            name: mainProc.name,
                            status: mainProc.pm2_env?.status || 'unknown',
                            uptime: mainProc.pm2_env?.pm_uptime || 0,
                            restarts: mainProc.pm2_env?.restart_time || 0
                        });
                    }
                } catch (e) {}
            }
            return resolve({
                type: 'manual',
                name: 'npm start / node main.js',
                status: 'online'
            });
        });
    });
}

app.get('/api/plugins/terminal-info', (req, res) => {
    detectBotRunner().then(info => {
        res.json({ success: true, info });
    });
});

app.post('/api/plugins/terminal-restart', (req, res) => {
    detectBotRunner().then(info => {
        if (info.type === 'pm2') {
            const pmId = info.id;
            exec(`npx pm2 restart ${pmId}`, (err, stdout, stderr) => {
                if (err) {
                    return res.status(500).json({ success: false, error: stderr || err.message });
                }
                res.json({ success: true, message: `Bot berhasil direstart via PM2 (ID ${pmId})!`, info });
            });
        } else {
            res.json({ success: true, message: `Instruksi restart dikirim. Bot berjalan secara manual (npm start).`, info });
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        }
    });
});

app.post('/api/plugins/terminal-exec', (req, res) => {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
        return res.status(400).json({ success: false, error: 'Perintah terminal wajib diisi!' });
    }

    const trimmedCmd = command.trim();
    console.log(`[TERMINAL EXEC] Owner menjalankan: ${trimmedCmd}`);

    exec(trimmedCmd, { cwd: __dirname, timeout: 60000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
        const output = (stdout || '') + (stderr ? `\n[STDERR]\n${stderr}` : '');
        if (err && !stdout && !stderr) {
            return res.json({
                success: false,
                command: trimmedCmd,
                error: err.message,
                output: err.message
            });
        }
        res.json({
            success: !err,
            command: trimmedCmd,
            output: output || '(Perintah selesai tanpa output teks)',
            exitCode: err ? (err.code || 1) : 0
        });
    });
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





// Root route: redirect to dashboard (with channel query fallback)
app.get('/', (req, res) => {
    if (req.query.channel) {
        const channelId = req.query.channel.toLowerCase().replace(/[^a-z0-9]/g, '');
        return res.redirect(`/watch/${channelId}`);
    }
    return res.redirect('/dashboard');
});

// Owner Monitoring Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Anime Streaming Web UI route (Otakudesu x Self-Bot)
app.get('/anime-stream', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'anime_stream.html'));
});

// Watch route (SPA style: serves index.html which handles routing client-side)
app.get('/watch/:channel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Endpoint untuk Kirim OTP via Web Post HTTP Request
app.post('/api/send-otp', async (req, res) => {
    try {
        const { target, number, otp, code, secret } = req.body;
        const recipient = target || number;
        const otpCode = otp || code;
        const reqSecret = secret || req.headers['x-api-secret'];

        // Verifikasi secret key jika diatur pada global.otpSecret
        if (global.otpSecret && reqSecret !== global.otpSecret) {
            return res.status(401).json({
                status: false,
                message: 'Unauthorized: Secret key/API key tidak valid.'
            });
        }

        if (!recipient || !otpCode) {
            return res.status(400).json({
                status: false,
                message: 'Parameter "target" (nomor hp) dan "otp" (kode OTP) wajib diisi.'
            });
        }

        // Format nomor HP ke standar WhatsApp JID (cth: 628xxx@s.whatsapp.net)
        let formattedNum = String(recipient).replace(/[^0-9]/g, '');
        if (formattedNum.startsWith('0')) {
            formattedNum = '62' + formattedNum.slice(1);
        }
        if (!formattedNum.endsWith('@s.whatsapp.net')) {
            formattedNum += '@s.whatsapp.net';
        }

        // Ambil instance WhatsApp socket (global.waSock atau global.bob)
        const wa = global.waSock || global.bob;
        if (!wa) {
            return res.status(503).json({
                status: false,
                message: 'WhatsApp bot belum terhubung atau belum siap.'
            });
        }

        const pesan = `*[ VERIFIKASI OTP ]*\n\nKode OTP Anda adalah: *${otpCode}*\n\n_Jangan berikan kode ini kepada siapapun. Kode berlaku singkat._`;

        await wa.sendMessage(formattedNum, { text: pesan });

        console.log(`[OTP SENT] Kode OTP ${otpCode} berhasil dikirim ke ${formattedNum}`);
        return res.json({
            status: true,
            message: `OTP berhasil dikirim ke ${formattedNum.split('@')[0]}`,
            target: formattedNum.split('@')[0],
            otp: otpCode
        });

    } catch (err) {
        console.error('[OTP ERROR]', err);
        return res.status(500).json({
            status: false,
            message: 'Gagal mengirim pesan OTP',
            error: err.message
        });
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
const server = app.listen(PORT, () => {
    console.log(`\n============================================`);
    console.log(`|  Web Streaming TV Server is running at:   |`);
    console.log(`|  http://localhost:${PORT}                    |`);
    console.log(`============================================\n`);
});

module.exports = server;
