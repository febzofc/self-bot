const gsmarena = require('../lib/scrapers/gsmarena.js');
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false, family: 4 });

async function getImageBuffer(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            httpsAgent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        return Buffer.from(res.data);
    } catch (e) {
        return null;
    }
}

global.gsmarenaSession = global.gsmarenaSession || {};

async function sendImageOrReply(bob, m, imageUrl, caption) {
    if (imageUrl) {
        const imageBuffer = await getImageBuffer(imageUrl);
        if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
            return bob.sendMessage(m.chat, { image: imageBuffer, caption }, { quoted: m });
        }
    }
    return m.reply(caption);
}

function renderSearchResults(session) {
    let txt = `📱 📱 *GSM ARENA SMARTPHONE SEARCH* 📱 📱\n`;
    txt += `📌 *[ STEP 1/2 ] Hasil Pencarian HP*\n\n`;
    txt += `🔍 *Kata Kunci:* "${session.query}"\n\n`;
    
    session.searchResults.slice(0, 10).forEach((item, index) => {
        txt += `*#${index + 1}. ${item.title}*\n`;
        txt += `   🆔 ID: \`${item.id}\`\n\n`;
    });
    
    txt += `──────────────────────────\n`;
    txt += `💡 *CARA PENGGUNAAN:* \n`;
    txt += `👉 *Balas / Reply pesan ini dengan:* \n`;
    txt += `• *#1* s/d *#${Math.min(10, session.searchResults.length)}* ➔ Pilih HP untuk melihat Spesifikasi Lengkap\n`;
    txt += `• *#exit* / *#keluar* ➔ Keluar dari Sesi Interaktif`;
    return txt;
}

function renderPhoneDetail(detail) {
    let txt = `📱 📱 *GSMARENA SPECIFICATIONS* 📱 📱\n\n`;
    txt += `🏆 *${detail.title}*\n`;
    txt += `🔗 ${detail.url}\n\n`;

    const specs = detail.specs || {};

    if (specs['Platform']) {
        txt += `⚙️ *PLATFORM / PERFORMA*\n`;
        if (specs['Platform']['OS']) txt += `• *OS:* ${specs['Platform']['OS']}\n`;
        if (specs['Platform']['Chipset']) txt += `• *Chipset:* ${specs['Platform']['Chipset']}\n`;
        if (specs['Platform']['CPU']) txt += `• *CPU:* ${specs['Platform']['CPU']}\n`;
        if (specs['Platform']['GPU']) txt += `• *GPU:* ${specs['Platform']['GPU']}\n`;
        txt += `\n`;
    }

    if (specs['Memory']) {
        txt += `💾 *MEMORI & RAM*\n`;
        if (specs['Memory']['Internal']) txt += `• *Internal:* ${specs['Memory']['Internal']}\n`;
        if (specs['Memory']['Card slot']) txt += `• *Card Slot:* ${specs['Memory']['Card slot']}\n`;
        txt += `\n`;
    }

    if (specs['Display']) {
        txt += `🖥️ *LAYAR*\n`;
        if (specs['Display']['Type']) txt += `• *Tipe:* ${specs['Display']['Type']}\n`;
        if (specs['Display']['Size']) txt += `• *Ukuran:* ${specs['Display']['Size']}\n`;
        if (specs['Display']['Resolution']) txt += `• *Resolusi:* ${specs['Display']['Resolution']}\n`;
        txt += `\n`;
    }

    if (specs['Main Camera']) {
        txt += `📸 *KAMERA UTAMA*\n`;
        if (specs['Main Camera']['Triple']) txt += `• *Kamera:* ${specs['Main Camera']['Triple'].replace(/\n/g, ' ')}\n`;
        else if (specs['Main Camera']['Single']) txt += `• *Kamera:* ${specs['Main Camera']['Single'].replace(/\n/g, ' ')}\n`;
        else if (specs['Main Camera']['Dual']) txt += `• *Kamera:* ${specs['Main Camera']['Dual'].replace(/\n/g, ' ')}\n`;
        else if (specs['Main Camera']['Quad']) txt += `• *Kamera:* ${specs['Main Camera']['Quad'].replace(/\n/g, ' ')}\n`;
        if (specs['Main Camera']['Video']) txt += `• *Video:* ${specs['Main Camera']['Video']}\n`;
        txt += `\n`;
    }

    if (specs['Selfie camera']) {
        txt += `🤳 *KAMERA DEPAN*\n`;
        if (specs['Selfie camera']['Single']) txt += `• *Kamera:* ${specs['Selfie camera']['Single'].replace(/\n/g, ' ')}\n`;
        if (specs['Selfie camera']['Video']) txt += `• *Video:* ${specs['Selfie camera']['Video']}\n`;
        txt += `\n`;
    }

    if (specs['Battery']) {
        txt += `🔋 *BATERAI & CHARGING*\n`;
        if (specs['Battery']['Type']) txt += `• *Kapasitas:* ${specs['Battery']['Type']}\n`;
        if (specs['Battery']['Charging']) txt += `• *Pengisian Daya:* ${specs['Battery']['Charging']}\n`;
        txt += `\n`;
    }

    if (specs['Body']) {
        txt += `📐 *BODI & SIM*\n`;
        if (specs['Body']['Dimensions']) txt += `• *Dimensi:* ${specs['Body']['Dimensions']}\n`;
        if (specs['Body']['Weight']) txt += `• *Berat:* ${specs['Body']['Weight']}\n`;
        if (specs['Body']['SIM']) txt += `• *SIM:* ${specs['Body']['SIM']}\n`;
        txt += `\n`;
    }

    if (specs['Misc'] && specs['Misc']['Price']) {
        txt += `💰 *ESTIMASI HARGA:* ${specs['Misc']['Price']}\n\n`;
    }

    txt += `──────────────────────────\n`;
    txt += `💡 *Ketik / Reply #exit atau #keluar untuk mengakhiri sesi interaktif.*`;
    return txt;
}

module.exports = {
    CmD: ['gsmarena'],
    aliases: [
        'gsmarena', 'gsm', 'spec', 'spesifikasi', 'hp', 'searchhp',
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
        'exit', 'keluar', 'stop', 'batal'
    ],
    categori: 'search',
    exec: async (m, { prefix, command, text, bob }) => {
        const sender = m.sender;
        let args = text ? text.trim().split(/ +/) : [];
        let cmd = command.toLowerCase().replace(/^#/, '');

        // === CEK TIMEOUT SESI (Auto Reset jika > 1 Menit/60 Detik) ===
        if (global.gsmarenaSession[sender]) {
            if (Date.now() - global.gsmarenaSession[sender].timestamp > 60000) {
                delete global.gsmarenaSession[sender];
            }
        }

        // === PENANGANAN KELUAR SESI (#exit / #keluar / #stop / #batal) ===
        if (cmd === 'exit' || cmd === 'keluar' || cmd === 'stop' || cmd === 'batal') {
            if (global.gsmarenaSession[sender]) {
                delete global.gsmarenaSession[sender];
                return m.reply('📱 *Sesi GSMArena telah diakhiri. Terima kasih!*');
            } else if (['gsmarena', 'gsm', 'spec', 'spesifikasi', 'hp', 'searchhp'].includes(command.toLowerCase())) {
                return m.reply('❌ Kamu sedang tidak memiliki sesi pencarian HP yang aktif.');
            }
            return;
        }

        // === JIKA PENGGUNA MEMILIKI SESI AKTIF ===
        if (global.gsmarenaSession[sender]) {
            const session = global.gsmarenaSession[sender];
            session.timestamp = Date.now(); // Perbarui aktivitas terakhir

            if (session.step === 'SEARCH_RESULTS') {
                const choiceNum = parseInt(cmd);
                if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= session.searchResults.length) {
                    const selectedPhone = session.searchResults[choiceNum - 1];
                    m.reply(`_🔍 Mengambil spesifikasi lengkap *${selectedPhone.title}*..._`);
                    try {
                        const detail = await gsmarena.getSmartphoneDetail(selectedPhone.id);
                        session.step = 'PHONE_DETAIL';
                        session.selectedPhone = detail;

                        const caption = renderPhoneDetail(detail);
                        return sendImageOrReply(bob, m, detail.img || selectedPhone.img, caption);
                    } catch (err) {
                        console.error('Error fetching phone detail in session:', err);
                        return m.reply('❌ Gagal mengambil detail spesifikasi HP.');
                    }
                }
            }
        }

        // === PENCARIAN BARU ATAU DIRECT QUERY ===
        let q = args.join(' ');
        if (!q && (cmd === 'gsmarena' || cmd === 'gsm' || cmd === 'spec' || cmd === 'spesifikasi' || cmd === 'hp' || cmd === 'searchhp')) {
            return m.reply(`❌ *Masukkan nama HP yang ingin dicari!*\n\nContoh: *${prefix}spec infinix gt 10 pro*`);
        }

        if (cmd === 'gsmarena' || cmd === 'gsm' || cmd === 'spec' || cmd === 'spesifikasi' || cmd === 'hp' || cmd === 'searchhp') {
            m.reply(`_🔍 Sedang mencari spesifikasi HP *"${q}"* di GSMArena..._`);
            try {
                const res = await gsmarena.searchSmartphone(q);
                if (!res || res.length === 0) return m.reply(`❌ Smartphone *"${q}"* tidak ditemukan di GSMArena!`);

                // Jika hanya 1 hasil persis
                if (res.length === 1) {
                    const detail = await gsmarena.getSmartphoneDetail(res[0].id);
                    const caption = renderPhoneDetail(detail);
                    return sendImageOrReply(bob, m, detail.img || res[0].img, caption);
                }

                // Jika ada beberapa hasil, buat sesi interaktif
                global.gsmarenaSession[sender] = {
                    step: 'SEARCH_RESULTS',
                    query: q,
                    searchResults: res,
                    selectedPhone: null,
                    timestamp: Date.now()
                };

                const caption = renderSearchResults(global.gsmarenaSession[sender]);
                return sendImageOrReply(bob, m, res[0]?.img, caption);
            } catch (err) {
                console.error('GSMArena Search Error:', err);
                return m.reply('❌ Terjadi kesalahan saat mencari spesifikasi Smartphone.');
            }
        }
    }
};
