const axios = require('axios');
const aiRouter = require('../lib/aiSwitchRouter.js');

// Sesi percakapan bersama
const aiSessions = aiRouter.sharedSessions;
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 Menit

/**
 * Fallback API Deep-AI jika QwQ sedang offline
 */
async function fetchDeepAi(promptText) {
    const res = await axios.get('https://api-faa.my.id/faa/deep-ai', {
        params: { text: promptText },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 35000
    });

    if (res.data && res.data.result) {
        return res.data.result.trim();
    }
    throw new Error('Respon dari API AI tidak valid.');
}

/**
 * Dapatkan respon AI dengan prioritas Casual AI Faa (tengil & joms jomok persona)
 */
async function getAiResponse(text, history = []) {
    try {
        const reply = await aiRouter.fetchCasualAi(text, history);
        if (reply) return reply;
    } catch (e) {
        console.error('[search_ai] Casual AI error, fallback to Deep-AI:', e.message);
    }

    // Fallback ke Deep-AI jika Casual AI mengalami kendala
    return await fetchDeepAi(text);
}

/**
 * Reset timer sesi percakapan
 */
function refreshSessionTimer(bob, chatId, sessionId) {
    const session = aiRouter.getOrCreateSession(sessionId);
    if (!session) return;

    if (session.timer) {
        clearTimeout(session.timer);
    }

    session.timer = setTimeout(async () => {
        aiRouter.stopInteractive(sessionId);
        try {
            await bob.sendMessage(chatId, {
                text: '⏱️ *Sesi AI Ditutup Otomatis*\nSesi interaktif AI telah berakhir karena tidak ada aktivitas selama 10 menit.\nKetik `.ai --sesi` jika ingin memulai obrolan baru.'
            });
        } catch (err) {}
    }, SESSION_TIMEOUT);
}

module.exports = {
    CmD: ['ai'],
    aliases: ['ai', 'deepai'],
    categori: 'search',

    /**
     * Hook before: Intercept obrolan saat sesi interaktif aktif
     */
    before: async (m, { bob, body, budy, isCmd, prefix, isCreator, isOwner }) => {
        if (isCmd) return false;
        if (!m || m.isBaileys || m.fromMe) return false;

        const text = (budy || body || '').trim();
        if (!text) return false;

        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        const session = aiSessions.get(sessionId) || aiSessions.get(m.chat);
        if (!session || !session.isInteractive) return false;

        // Reset timer sesi
        refreshSessionTimer(bob, m.chat, sessionId);

        // Jika user adalah owner dan permintaannya butuh Antigravity (coding/vps/search web)
        const ownerAuth = isCreator || isOwner;
        if (ownerAuth && aiRouter.needsAntigravity(text, session.history)) {
            try {
                const agyPlugin = require('./owner_antigravity.js');
                if (agyPlugin && typeof agyPlugin.executeTask === 'function') {
                    agyPlugin.executeTask(bob, m, text, { isCreator: true, prefix, session });
                    return true;
                }
            } catch (e) {
                console.error('Error forwarding to Antigravity:', e);
            }
        }

        try {
            if (bob?.sendPresenceUpdate) {
                await bob.sendPresenceUpdate('composing', m.chat).catch(() => {});
            }

            const replyText = await getAiResponse(text, session.history);

            // Simpan ke riwayat percakapan sesi
            aiRouter.recordTurn(m.chat, text, replyText, 'qwq');

            await m.reply(replyText);
            return true;
        } catch (error) {
            console.error('Error handling AI session message:', error);
            await m.reply('❌ Waduh wir lagi agak ngelag nih, coba kirim lagi pesan lu.');
            return true;
        }
    },

    /**
     * Exec: Dijalankan saat user mengetik .ai <pesan>
     */
    exec: async (m, { bob, args, text, prefix, command, isCreator, isOwner }) => {
        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        const argText = (text || '').trim();
        const ownerAuth = isCreator || isOwner;

        // Sub-opsi: Menghentikan / menutup sesi
        if (argText === '--stop' || argText === '--keluar' || argText === '--end' || argText === '--close') {
            const session = aiSessions.get(sessionId) || aiSessions.get(m.chat);
            if (session && session.isInteractive) {
                if (session.timer) clearTimeout(session.timer);
                aiRouter.stopInteractive(sessionId);
                aiRouter.stopInteractive(m.chat);
                return m.reply('✅ *Sesi AI Telah Dinonaktifkan*\nKetik prefix seperti biasa untuk menjalankan perintah.');
            } else {
                return m.reply('ℹ️ Kamu saat ini tidak sedang berada dalam sesi chat AI.');
            }
        }

        // Sub-opsi: Reset riwayat sesi
        if (argText === '--reset') {
            aiRouter.resetSession(sessionId);
            aiRouter.resetSession(m.chat);
            return m.reply('✅ *Konteks & Riwayat Sesi AI Direset.*');
        }

        // Sub-opsi: Memulai sesi interaktif
        if (argText.startsWith('--sesi')) {
            const extraQuery = argText.replace(/^--sesi\s*/i, '').trim();
            const session = aiRouter.getOrCreateSession(sessionId);
            session.isInteractive = true;
            refreshSessionTimer(bob, m.chat, sessionId);

            if (extraQuery) {
                // Jika owner meminta tugas coding/terminal via .ai
                if (ownerAuth && aiRouter.needsAntigravity(extraQuery, session.history)) {
                    const agyPlugin = require('./owner_antigravity.js');
                    if (agyPlugin && typeof agyPlugin.executeTask === 'function') {
                        return agyPlugin.executeTask(bob, m, extraQuery, { isCreator: true, prefix, session });
                    }
                }

                try {
                    if (bob?.sendPresenceUpdate) {
                        await bob.sendPresenceUpdate('composing', m.chat).catch(() => {});
                    }
                    const replyText = await getAiResponse(extraQuery, session.history);
                    aiRouter.recordTurn(m.chat, extraQuery, replyText, 'qwq');
                    return m.reply(replyText);
                } catch (err) {
                    return m.reply('❌ Gagal memproses pesan: ' + err.message);
                }
            } else {
                return m.reply(
                    `🤖 *Sesi Interaktif AI & Antigravity Dimulai!*\n\n` +
                    `Kamu sekarang berada dalam mode percakapan langsung *(tanpa prefix)*:\n` +
                    `• Obrolan santai otomatis menggunakan model alternatif (hemat token).\n` +
                    `• Coding & search web otomatis ditangani secara presisi.\n` +
                    `• Ketik *${prefix + command} --stop* untuk mengakhiri sesi.\n` +
                    `• Ketik *${prefix + command} --reset* untuk mereset riwayat sesi.\n` +
                    `• Sesi akan otomatis berakhir jika tidak aktif selama *10 menit*.`
                );
            }
        }

        // Tanya satu kali saja (.ai <pertanyaan>)
        if (argText.length > 0) {
            const session = aiRouter.getOrCreateSession(sessionId);

            // Jika owner meminta coding / search web melalui .ai
            if (ownerAuth && aiRouter.needsAntigravity(argText, session.history)) {
                const agyPlugin = require('./owner_antigravity.js');
                if (agyPlugin && typeof agyPlugin.executeTask === 'function') {
                    return agyPlugin.executeTask(bob, m, argText, { isCreator: true, prefix, session });
                }
            }

            try {
                if (bob?.sendPresenceUpdate) {
                    await bob.sendPresenceUpdate('composing', m.chat).catch(() => {});
                }
                const replyText = await getAiResponse(argText, session.history);
                aiRouter.recordTurn(m.chat, argText, replyText, 'qwq');
                return m.reply(replyText);
            } catch (err) {
                console.error('Error on single AI query:', err);
                return m.reply('❌ Terjadi kesalahan saat memproses permintaan: ' + err.message);
            }
        }

        // Panduan penggunaan
        const sess = aiSessions.get(sessionId) || aiSessions.get(m.chat);
        return m.reply(
            `🤖 *AI & Antigravity Smart Assistant*\n\n` +
            `1️⃣ *Tanya Langsung:*\n` +
            `• *${prefix + command} <pertanyaan / instruksi>*\n` +
            `_Contoh: ${prefix + command} halo wir lagi ngapain_\n` +
            `_Contoh: ${prefix + command} buatkan plugin kalkulator_\n\n` +
            `2️⃣ *Mode Sesi Percakapan:*\n` +
            `• *${prefix + command} --sesi*\n` +
            `_Mengobrol langsung tanpa prefix dengan riwayat obrolan tersambung._\n\n` +
            `3️⃣ *Kontrol Sesi:*\n` +
            `• *${prefix + command} --stop* (Keluar dari sesi interaktif)\n` +
            `• *${prefix + command} --reset* (Mulai sesi baru dari nol)\n\n` +
            `*Status Sesi:* ${sess?.isInteractive ? 'Aktif' : 'Nonaktif'}`
        );
    }
};
