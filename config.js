/**
   * Create By Dika Ardnt
   * Recode Febriansyah.
   * Contact Me on wa.me/6288292024190
   * Follow https://github.com/DikaArdnt
*/

const fs = require('fs');

// Other
global.owner = ['6285849261085']
global.ownerPassword = 'owner123'
global.pairing = '6285822578327' // Gunakan kode negara (cth: 628xxx)
global.author = 'WhatsApp Bot'
global.prefa = ['#','!','.','❗']
global.streamingUrl = 'http://localhost:2555'

// --- 9ROUTERS & GEMINI AI CONFIGURATION ---
global.geminiApiKey = process.env.GEMINI_API_KEY || '';
global.nineRoutersUrl = process.env.NINEROUTERS_URL || 'http://localhost:20128/v1'; // Endpoint 9routers

global.mess = {
    success: '✓ Success',
    admin: 'Fitur Khusus Admin Group!',
    botAdmin: 'Bot Harus Menjadi Admin Terlebih Dahulu!',
    owner: 'Fitur Khusus Owner Bot',
    group: 'Fitur Digunakan Hanya Untuk Group!',
    private: 'Fitur Digunakan Hanya Untuk Private Chat!',
    bot: 'Fitur Khusus Pengguna Nomor Bot',
    wait: 'Loading...',    
}

global.thumb = fs.readFileSync('./lib/bob.jpg')

