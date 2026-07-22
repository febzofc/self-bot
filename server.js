const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

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

app.use(express.json());

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
        res.json({ success: true, filename, code, errorInfo });
    } catch (e) {
        res.status(404).json({ success: false, error: e.message });
    }
});

app.post('/api/plugins/code/:filename', (req, res) => {
    const filename = req.params.filename;
    const { code } = req.body;
    if (typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'Code content string required.' });
    }
    try {
        const result = pluginManager.savePluginCode(filename, code);
        res.json({ success: true, filename, result, stats: pluginManager.getStats() });
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
        res.status(404).json({ error: 'Channel not found' });
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
