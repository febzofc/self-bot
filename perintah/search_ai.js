const axios = require('axios');

// Penyimpanan sesi AI di memori
// Key: sessionId (string) -> Value: { history: Array, timer: Timeout, lastActive: number }
const aiSessions = new Map();
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 Menit (300.000 ms)

// Konfigurasi cache sesi agar tidak terlalu panjang
const MAX_HISTORY_TURNS = 3; // Maksimal 3 pasang percakapan terakhir (User & AI)
const MAX_AI_HISTORY_CHARS = 180; // Truncate jawaban AI lama di riwayat agar URL query tetap ringkas

/**
 * Panggil API Deep-AI
 * Endpoint: https://api-faa.my.id/faa/deep-ai?text=...
 */
async function fetchDeepAi(promptText) {
    const res = await axios.get('https://api-faa.my.id/faa/deep-ai', {
        params: { text: promptText },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 45000
    });

    if (res.data && res.data.result) {
        return res.data.result.trim();
    }
    throw new Error('Respon dari API AI tidak valid.');
}

/**
 * Membentuk string prompt dengan cache konteks percakapan yang ringkas
 */
function buildContextPrompt(history, newQuestion) {
    if (!history || history.length === 0) {
        return newQuestion;
    }

    let context = 'Gunakan ringkasan konteks percakapan sebelumnya jika relevan:\n';
    for (const turn of history) {
        if (turn.role === 'user') {
            context += `User: ${turn.content}\n`;
        } else if (turn.role === 'assistant') {
            const shortAi = turn.content.length > MAX_AI_HISTORY_CHARS
                ? turn.content.slice(0, MAX_AI_HISTORY_CHARS) + '...'
                : turn.content;
            context += `AI: ${shortAi}\n`;
        }
    }
    context += `\nPertanyaan user sekarang:\n${newQuestion}`;
    return context;
}

/**
 * Mengatur atau memperbarui timer 5 menit auto-close
 */
function refreshSessionTimer(bob, chatId, sessionId) {
    const session = aiSessions.get(sessionId);
    if (!session) return;

    if (session.timer) {
        clearTimeout(session.timer);
    }

    session.timer = setTimeout(async () => {
        aiSessions.delete(sessionId);
        try {
            await bob.sendMessage(chatId, {
                text: '⏱️ *Sesi AI Ditutup Otomatis*\nSesi interaktif AI telah berakhir karena tidak ada aktivitas selama 5 menit.\nKetik `.ai --sesi` jika ingin memulai sesi baru.'
            });
        } catch (err) {
            console.error('Error saat mengirim notifikasi auto-close AI session:', err);
        }
    }, SESSION_TIMEOUT);
}

module.exports = {
    CmD: ['ai'],
    aliases: ['ai', 'deepai'],
    categori: 'search',

    /**
     * Hook before: Dijalankan sebelum perintah utama.
     * Mengintercept pesan biasa saat user sedang dalam sesi AI aktif.
     */
    before: async (m, { bob, body, budy, isCmd, prefix }) => {
        // Jangan trigger jika pesan adalah perintah bot ber-prefix (agar tidak mengganggu perintah umum)
        if (isCmd) return false;
        if (!m || m.isBaileys || m.fromMe) return false;

        const text = (budy || body || '').trim();
        if (!text) return false;

        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        if (!aiSessions.has(sessionId)) return false;

        // User sedang berada dalam sesi AI aktif!
        const session = aiSessions.get(sessionId);

        // Reset timer 5 menit agar tidak kedaluwarsa
        refreshSessionTimer(bob, m.chat, sessionId);

        try {
            // Susun prompt dengan cache riwayat percakapan yang ringkas
            const contextualPrompt = buildContextPrompt(session.history, text);

            const replyText = await fetchDeepAi(contextualPrompt);

            // Simpan ke cache riwayat percakapan
            session.history.push({ role: 'user', content: text });
            session.history.push({ role: 'assistant', content: replyText });

            // Batasi panjang riwayat agar tidak melebihi kapasitas
            if (session.history.length > MAX_HISTORY_TURNS * 2) {
                session.history = session.history.slice(-MAX_HISTORY_TURNS * 2);
            }

            await m.reply(replyText);
            return true; // Pesan berhasil ditangani oleh sesi AI
        } catch (error) {
            console.error('Error handling AI session message:', error);
            await m.reply('❌ Maaf, terjadi kesalahan saat menghubungi server AI. Coba tanyakan lagi.');
            return true;
        }
    },

    /**
     * Exec: Dijalankan saat user mengetik perintah dengan prefix (misal: .ai)
     */
    exec: async (m, { bob, args, text, prefix, command }) => {
        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        const argText = (text || '').trim();

        // Sub-opsi: Menghentikan / menutup sesi secara manual (.ai --stop / .ai --keluar / .ai --end)
        if (argText === '--stop' || argText === '--keluar' || argText === '--end' || argText === '--close') {
            if (aiSessions.has(sessionId)) {
                const session = aiSessions.get(sessionId);
                if (session.timer) clearTimeout(session.timer);
                aiSessions.delete(sessionId);
                return m.reply('✅ *Sesi AI Telah Diakhiri*\nCache percakapan telah dibersihkan.');
            } else {
                return m.reply('ℹ️ Kamu saat ini tidak sedang berada dalam sesi AI.');
            }
        }

        // Opsi 2: .ai --sesi (Memulai mode percakapan interaktif)
        if (argText.startsWith('--sesi')) {
            const extraQuery = argText.replace(/^--sesi\s*/i, '').trim();

            // Bersihkan timer sesi lama jika ada
            if (aiSessions.has(sessionId)) {
                const existing = aiSessions.get(sessionId);
                if (existing.timer) clearTimeout(existing.timer);
            }

            // Buat sesi baru
            const newSession = {
                history: [],
                timer: null,
                startedAt: Date.now()
            };
            aiSessions.set(sessionId, newSession);
            refreshSessionTimer(bob, m.chat, sessionId);

            // Jika user langsung menyertakan pertanyaan pertama (contoh: .ai --sesi halo)
            if (extraQuery) {
                try {
                    await m.reply('🤖 *Sesi AI Dimulai!*\n_Sedang memproses pertanyaan pertama..._');
                    const replyText = await fetchDeepAi(extraQuery);

                    newSession.history.push({ role: 'user', content: extraQuery });
                    newSession.history.push({ role: 'assistant', content: replyText });

                    return m.reply(replyText);
                } catch (err) {
                    console.error('Error on initial AI session query:', err);
                    return m.reply('❌ Gagal memproses pertanyaan: ' + err.message);
                }
            } else {
                return m.reply(
                    `🤖 *Sesi AI Interaktif Dimulai!*\n\n` +
                    `Kamu sekarang berada dalam mode percakapan dengan AI:\n` +
                    `• Kirim pesan apa saja *(tanpa prefix)* untuk mengobrol.\n` +
                    `• Perintah umum bot ber-prefix (seperti *${prefix}menu*) tetap berfungsi normal.\n` +
                    `• Ketik *${prefix + command} --stop* untuk mengakhiri sesi.\n` +
                    `• Sesi akan otomatis ditutup jika tidak aktif selama *5 menit*.`
                );
            }
        }

        // Opsi 1: Tanya satu kali saja (.ai <pertanyaan>)
        if (argText.length > 0) {
            try {
                // Langsung jawab pertanyaan satu kali tanpa masuk atau menyimpan sesi
                const replyText = await fetchDeepAi(argText);
                return m.reply(replyText);
            } catch (err) {
                console.error('Error on single AI query:', err);
                return m.reply('❌ Terjadi kesalahan saat memproses permintaan AI: ' + err.message);
            }
        }

        // Tampilkan panduan penggunaan jika user hanya mengetik .ai
        return m.reply(
            `🤖 *Panduan Penggunaan DeepSeek AI*\n\n` +
            `1️⃣ *Tanya Satu Kali:*\n` +
            `• *${prefix + command} <pertanyaan>*\n` +
            `_Contoh: ${prefix + command} apa yang terjadi ketika dua atom bertabrakan?_\n\n` +
            `2️⃣ *Mode Sesi Percakapan:*\n` +
            `• *${prefix + command} --sesi*\n` +
            `_Masuk ke sesi interaktif. Kamu bisa langsung mengobrol tanpa prefix dan memiliki riwayat konteks percakapan._\n\n` +
            `3️⃣ *Keluar Dari Sesi:*\n` +
            `• *${prefix + command} --stop*\n\n` +
            `⏱️ _Catatan: Sesi percakapan akan otomatis berakhir jika tidak digunakan selama 5 menit._`
        );
    }
};
