const {
    fetchJadwalBola,
    searchJadwalBola,
    formatJadwalList,
    formatJadwalDetail
} = require('../lib/scrapers/jadwalBola.js');

global.jadwalBolaSession = global.jadwalBolaSession || {};
const SESSION_TIMEOUT_MS = 2 * 60 * 1000; // 2 Menit

/**
 * Membersihkan sesi yang sudah kedaluwarsa
 */
function cleanExpiredSessions() {
    const now = Date.now();
    for (const key in global.jadwalBolaSession) {
        if (now - global.jadwalBolaSession[key].timestamp > SESSION_TIMEOUT_MS) {
            delete global.jadwalBolaSession[key];
        }
    }
}

module.exports = {
    CmD: ['jadwalbola'],
    aliases: [
        'jadwalbola',
        'jadwal-bola',
        'jadwal_bola',
        'jadwalsepakbola',
        'cekjadwalbola',
        'jadwalmatch',
        'infobola',
        'bola',
        'football',
        'soccer'
    ],
    categori: 'search',
    desc: 'Cek jadwal pertandingan sepak bola hari ini/mendatang, status, skor, dan susunan formasi pemain (Starting XI)',

    /**
     * Hook before: Menangani respon interaktif (pilih nomor laga 1..N atau keluar)
     */
    before: async (m, { bob, body, budy, isCmd, prefix }) => {
        if (isCmd) return false;
        if (!m || m.isBaileys || m.fromMe) return false;

        const text = (budy || body || '').trim();
        if (!text) return false;

        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        const session = global.jadwalBolaSession[sessionId];
        if (!session) return false;

        // Cek apakah sesi sudah kedaluwarsa
        if (Date.now() - session.timestamp > SESSION_TIMEOUT_MS) {
            delete global.jadwalBolaSession[sessionId];
            return false;
        }

        const lower = text.toLowerCase();

        // Pengguna ingin keluar dari sesi interaktif
        if (['exit', 'keluar', 'stop', 'batal', '#exit', '#keluar'].includes(lower)) {
            delete global.jadwalBolaSession[sessionId];
            await m.reply('⚽ *Sesi Jadwal Sepak Bola telah diakhiri. Terima kasih!*');
            return true;
        }

        // Cek apakah input berupa nomor (misal: "1", "#1", " 2 ")
        const cleanNumber = text.replace(/^[#.\s]+/, '');
        const choiceNum = parseInt(cleanNumber, 10);

        if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= session.matches.length) {
            session.timestamp = Date.now();
            const selectedMatch = session.matches[choiceNum - 1];
            const detailText = formatJadwalDetail(selectedMatch, choiceNum);
            await m.reply(detailText);
            return true;
        }

        // Jika pesan meng-quote pesan bot tentang jadwal bola dan mencari nama klub
        const isQuotingBotSchedule = m.quoted && (
            (m.quoted.text && m.quoted.text.includes('JADWAL PERTANDINGAN SEPAK BOLA')) ||
            (m.quoted.text && m.quoted.text.includes('DETAIL PERTANDINGAN SEPAK BOLA'))
        );

        if (isQuotingBotSchedule && text.length >= 3) {
            try {
                const results = await searchJadwalBola(text);
                if (results.length === 0) {
                    await m.reply(`❌ Pertandingan dengan kata kunci *"${text}"* tidak ditemukan.`);
                    return true;
                }
                if (results.length === 1) {
                    session.matches = results;
                    session.timestamp = Date.now();
                    await m.reply(formatJadwalDetail(results[0], 1));
                    return true;
                }
                session.matches = results;
                session.timestamp = Date.now();
                await m.reply(formatJadwalList(results, text));
                return true;
            } catch (err) {
                // Jangan cegah jika gagal
                return false;
            }
        }

        return false;
    },

    /**
     * Handler eksekusi perintah bot
     */
    exec: async (m, { bob, args, text, prefix, command }) => {
        cleanExpiredSessions();

        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        const argText = (text || '').trim();

        // Opsi stop manual (.jadwalbola stop / exit)
        if (['stop', 'exit', 'keluar', 'batal'].includes(argText.toLowerCase())) {
            if (global.jadwalBolaSession[sessionId]) {
                delete global.jadwalBolaSession[sessionId];
                return m.reply('⚽ *Sesi Jadwal Bola telah ditutup.*');
            }
            return m.reply('ℹ️ Tidak ada sesi jadwal bola aktif.');
        }

        // Cek jika user langsung mengetik nomor (misal: .jadwalbola 1 atau .jadwalbola detail 2)
        let directNumber = null;
        if (/^(detail\s+)?\d+$/i.test(argText)) {
            const numStr = argText.replace(/^detail\s+/i, '').trim();
            directNumber = parseInt(numStr, 10);
        }

        // Cek jika ada sesi yang sudah tersimpan dan user mengetik nomor
        if (directNumber && global.jadwalBolaSession[sessionId]) {
            const session = global.jadwalBolaSession[sessionId];
            if (directNumber >= 1 && directNumber <= session.matches.length) {
                session.timestamp = Date.now();
                const match = session.matches[directNumber - 1];
                return m.reply(formatJadwalDetail(match, directNumber));
            }
        }

        // Ambil data jadwal dari API
        m.reply('⏳ _Mengambil data jadwal pertandingan sepak bola terbaru..._');

        try {
            const isRefresh = argText.toLowerCase() === '--refresh' || argText.toLowerCase() === 'refresh';
            const query = isRefresh ? '' : argText;

            let matches = [];
            if (query && !directNumber) {
                matches = await searchJadwalBola(query);
            } else {
                matches = await fetchJadwalBola(isRefresh);
            }

            if (!matches || matches.length === 0) {
                return m.reply(
                    query
                        ? `❌ Tidak ada pertandingan yang cocok dengan kata kunci: *"${query}"*\n\nCoba cari dengan nama klub lain (cth: *${prefix}${command} roma*, *${prefix}${command} bayern*).`
                        : `❌ Saat ini belum ada data jadwal pertandingan sepak bola yang tersedia.`
                );
            }

            // Jika user langsung mencari nomor pada jadwal umum
            if (directNumber) {
                if (directNumber >= 1 && directNumber <= matches.length) {
                    global.jadwalBolaSession[sessionId] = {
                        matches,
                        timestamp: Date.now()
                    };
                    return m.reply(formatJadwalDetail(matches[directNumber - 1], directNumber));
                } else {
                    return m.reply(`⚠️ Nomor pertandingan tidak valid. Pilih antara *1* sampai *${matches.length}*.`);
                }
            }

            // Jika hasil pencarian hanya 1 laga persis, langsung tampilkan detail
            if (query && matches.length === 1) {
                global.jadwalBolaSession[sessionId] = {
                    matches,
                    timestamp: Date.now()
                };
                return m.reply(formatJadwalDetail(matches[0], 1));
            }

            // Simpan ke sesi interaktif untuk pemilihan berikutnya
            global.jadwalBolaSession[sessionId] = {
                matches,
                query,
                timestamp: Date.now()
            };

            const listMsg = formatJadwalList(matches, query);
            return m.reply(listMsg);
        } catch (err) {
            console.error('Error in search_jadwalbola:', err);
            return m.reply(`❌ *Gagal mengambil jadwal sepak bola.*\n\n*Penyebab:* ${err.message || err}`);
        }
    }
};
