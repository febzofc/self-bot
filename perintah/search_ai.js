'use strict';

const geminiAi = require('../lib/geminiAi.js');
const exprManager = require('../lib/expressionManager.js');

/**
 * Penyimpanan sesi percakapan AI umum di memori
 * Key: sessionId (chatId untuk personal chat, atau chatId_sender untuk grup)
 * Value: { isInteractive: boolean, lastActive: number, timer: Timeout, lastInteractionId: string|null, history: [] }
 */
const aiSessions = new Map();
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 Menit timeout tidak aktif

/**
 * Dapatkan atau inisialisasi sesi percakapan
 */
function getOrCreateSession(sessionId) {
    let session = aiSessions.get(sessionId);
    const now = Date.now();

    if (!session || (now - session.lastActive > SESSION_TIMEOUT)) {
        session = {
            isInteractive: false,
            lastActive: now,
            timer: null,
            lastInteractionId: null,
            history: []
        };
        aiSessions.set(sessionId, session);
    } else {
        session.lastActive = now;
    }

    return session;
}

/**
 * Reset timer auto-close untuk sesi interaktif
 */
function refreshSessionTimer(bob, chatId, sessionId) {
    const session = getOrCreateSession(sessionId);
    if (!session) return;

    if (session.timer) {
        clearTimeout(session.timer);
    }

    session.timer = setTimeout(async () => {
        session.isInteractive = false;
        try {
            await bob.sendMessage(chatId, {
                text: '⏱️ *Sesi Obrolan AI Ditutup Otomatis*\nSesi santai telah berakhir karena tidak ada aktivitas selama 10 menit.\nKetik `.ai --sesi` kapan pun jika ingin ngobrol santai lagi, wir!'
            });
        } catch (err) {}
    }, SESSION_TIMEOUT);
}

/**
 * Helper pengiriman balasan alami (1 pesan jika singkat, bertahap jika ada split, stiker & VN hook)
 */
async function sendNaturalAiResponse(bob, m, userText, geminiRes, pushname) {
    const bubbles = (geminiRes.bubbles && geminiRes.bubbles.length > 0)
        ? geminiRes.bubbles
        : [geminiRes.fullText];
    const chatId = m.chat;

    // 1. Kirim pesan teks
    if (bubbles.length === 1) {
        // Balasan tunggal (default untuk jawaban singkat/normal agar tidak boom chat)
        await m.reply(bubbles[0]);
    } else {
        // Balasan bertahap hanya jika ada pembagian topik yang jelas
        for (let i = 0; i < bubbles.length; i++) {
            const bubble = bubbles[i];
            if (!bubble) continue;

            if (i > 0) {
                // Tampilkan typing indicator sebelum balon pesan berikutnya
                try {
                    if (bob?.sendPresenceUpdate) {
                        await bob.sendPresenceUpdate('composing', chatId);
                    }
                } catch (_) {}

                const typingDelay = Math.min(1200, Math.max(400, bubble.length * 15));
                await new Promise(res => setTimeout(res, typingDelay));
            }

            if (i === 0) {
                await m.reply(bubble);
            } else {
                await bob.sendMessage(chatId, { text: bubble });
            }
        }
    }

    // 2. Reaksi stiker ekspresi (eksekusi di background agar tidak menahan proses pesan utama)
    (async () => {
        try {
            let stickerSent = false;
            if (geminiRes.expression) {
                stickerSent = await exprManager.sendExpressionByName(bob, m, geminiRes.expression);
            }

            if (!stickerSent) {
                await exprManager.maybeSendExpressionSticker(bob, m, userText, geminiRes.fullText, 0.35);
            }
        } catch (_) {}
    })().catch(() => {});

    // 3. Hook event Voice Note (VN) - Siap pakai saat API dari user disusulkan (non-blocking)
    if (geminiRes.vnEvent && geminiAi.isVoiceNoteEnabled(geminiRes.vnEvent)) {
        (async () => {
            try {
                const vnBuffer = await geminiAi.generateVoiceNoteBuffer(geminiRes.fullText, geminiRes.vnEvent);
                if (vnBuffer) {
                    await new Promise(res => setTimeout(res, 800));
                    await bob.sendMessage(chatId, { audio: vnBuffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' });
                }
            } catch (vnErr) {
                console.error('[search_ai] Gagal mengirim Voice Note event:', vnErr);
            }
        })().catch(() => {});
    }
}

module.exports = {
    CmD: ['ai'],
    aliases: ['ai', 'gemini', 'chat'],
    categori: 'search',
    desc: 'AI Dialog Santai & Cerdas Super Cepat via SDK Resmi @google/genai Interactions',

    /**
     * Hook before: Menangani obrolan saat mode sesi interaktif (.ai --sesi) sedang aktif
     * CATATAN: AI UMUM ini murni obrolan biasa dan TIDAK BOLEH mengakses fitur antigravity-cli.
     */
    before: async (m, { bob, body, budy, isCmd, prefix, pushname }) => {
        if (isCmd) return false;
        if (!m || m.isBaileys || m.fromMe) return false;

        const text = (budy || body || '').trim();
        if (!text) return false;

        // Abaikan perintah /btw, .btw, .agy, .antigravity agar ditangani oleh owner_antigravity
        if (/^(\/|\.)?(btw|agy|antigravity)(\s|$)/i.test(text)) return false;

        // Abaikan respon konfirmasi Y/N jika sedang ada persetujuan aktif di Antigravity
        if (/^(y|ya|yes|izinkan|setuju|ok|n|no|tidak|tolak|batal)$/i.test(text)) {
            try {
                const agyPlugin = require('./owner_antigravity.js');
                if (agyPlugin && typeof agyPlugin.hasPendingApproval === 'function' && agyPlugin.hasPendingApproval(m.chat)) {
                    return false;
                }
            } catch (e) {}
        }

        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        const session = aiSessions.get(sessionId) || aiSessions.get(m.chat);
        if (!session || !session.isInteractive) return false;

        // Reset timer sesi agar tidak kedaluwarsa selama aktif ngobrol
        refreshSessionTimer(bob, m.chat, sessionId);

        try {
            if (bob?.sendPresenceUpdate) {
                await bob.sendPresenceUpdate('composing', m.chat).catch(() => {});
            }

            // Dapatkan respon dari Google GenAI Interactions API (gemini-3.8-flash)
            const geminiRes = await geminiAi.generateChatResponse({
                prompt: text,
                previousInteractionId: session.lastInteractionId,
                pushname: pushname || m.pushName || 'Kawan'
            });

            // Simpan Interaction ID agar konteks tersinkronisasi otomatis di sisi server Gemini
            if (geminiRes.interactionId) {
                session.lastInteractionId = geminiRes.interactionId;
            }

            // Kirim balasan
            await sendNaturalAiResponse(bob, m, text, geminiRes, pushname);
            return true;
        } catch (error) {
            console.error('[search_ai] Error handling AI session message:', error);
            await m.reply('❌ Waduh wir, koneksi Gemini lagi agak tersendat. Coba kirim lagi pesan lu.');
            return true;
        }
    },

    /**
     * Exec: Dijalankan saat user mengetik perintah .ai <pesan>
     */
    exec: async (m, { bob, args, text, prefix, command, pushname }) => {
        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        const argText = (text || '').trim();

        // ── 1. SUB-OPSI: HENTIKAN / TUTUP SESI ──
        if (argText === '--stop' || argText === '--keluar' || argText === '--end' || argText === '--close') {
            const session = aiSessions.get(sessionId) || aiSessions.get(m.chat);
            if (session && session.isInteractive) {
                if (session.timer) clearTimeout(session.timer);
                session.isInteractive = false;
                return m.reply('✅ *Sesi Chat AI Dinonaktifkan*\nKetik prefix seperti biasa untuk menjalankan perintah bot lainnya.');
            } else {
                return m.reply('ℹ️ Kamu saat ini tidak sedang berada dalam sesi chat interaktif AI.');
            }
        }

        // ── 2. SUB-OPSI: RESET RIWAYAT SESI ──
        if (argText === '--reset' || argText === '--clear') {
            const session = aiSessions.get(sessionId) || aiSessions.get(m.chat);
            if (session) {
                session.lastInteractionId = null;
                session.history = [];
            }
            return m.reply('✅ *Riwayat & Konteks Obrolan AI Direset ke Awal.*');
        }

        // ── 3. SUB-OPSI: MEMULAI SESI INTERAKTIF (.ai --sesi) ──
        if (argText.startsWith('--sesi')) {
            const extraQuery = argText.replace(/^--sesi\s*/i, '').trim();
            const session = getOrCreateSession(sessionId);
            session.isInteractive = true;
            refreshSessionTimer(bob, m.chat, sessionId);

            if (extraQuery) {
                try {
                    if (bob?.sendPresenceUpdate) {
                        await bob.sendPresenceUpdate('composing', m.chat).catch(() => {});
                    }

                    const geminiRes = await geminiAi.generateChatResponse({
                        prompt: extraQuery,
                        previousInteractionId: session.lastInteractionId,
                        pushname: pushname || m.pushName || 'Kawan'
                    });

                    if (geminiRes.interactionId) {
                        session.lastInteractionId = geminiRes.interactionId;
                    }

                    await sendNaturalAiResponse(bob, m, extraQuery, geminiRes, pushname);
                    return;
                } catch (err) {
                    console.error('[search_ai] Error processing prompt with --sesi:', err);
                    return m.reply('❌ Terjadi kesalahan saat memproses pesan: ' + err.message);
                }
                return m.reply(
                    `🤖 *Sesi Percakapan AI Dimulai (Google GenAI Fast)*\n\n` +
                    `Kamu sekarang berada dalam mode santai *(tanpa prefix)*:\n` +
                    `• Didukung langsung oleh SDK Resmi \`@google/genai\` *(Fast Multi-Model Pool)*.\n` +
                    `• Respon super kilat (~2-3 detik), hemat kuota, dan hemat bubble.\n` +
                    `• Dilengkapi ekspresi stiker interaktif.\n` +
                    `• Ketik *${prefix + command} --stop* untuk mengakhiri sesi.\n` +
                    `• Ketik *${prefix + command} --reset* untuk memulai obrolan dari nol.\n` +
                    `• Sesi akan otomatis berakhir jika tidak aktif selama *10 menit*.`
                );
            }
        }

        // ── 4. TANYA LANGSUNG SATU KALI (.ai <pertanyaan>) ──
        if (argText.length > 0) {
            const session = getOrCreateSession(sessionId);

            try {
                if (bob?.sendPresenceUpdate) {
                    await bob.sendPresenceUpdate('composing', m.chat).catch(() => {});
                }

                const geminiRes = await geminiAi.generateChatResponse({
                    prompt: argText,
                    previousInteractionId: session.lastInteractionId,
                    pushname: pushname || m.pushName || 'Kawan'
                });

                if (geminiRes.interactionId) {
                    session.lastInteractionId = geminiRes.interactionId;
                }

                await sendNaturalAiResponse(bob, m, argText, geminiRes, pushname);
                return;
            } catch (err) {
                console.error('[search_ai] Error on direct AI query:', err);
                return m.reply('❌ Gagal memproses permintaan AI: ' + err.message);
            }
        }

        // ── 5. PANDUAN PENGGUNAAN ──
        const currentSession = aiSessions.get(sessionId) || aiSessions.get(m.chat);
        return m.reply(
            `🤖 *Google GenAI Assistant (Ultra-Fast Response)*\n\n` +
            `*Format Penggunaan:*\n` +
            `1️⃣ *Tanya Langsung:* \n` +
            `   • *${prefix + command} <pertanyaan / obrolan>*\n` +
            `   _Contoh: ${prefix + command} halo wir lagi sibuk apa nih_\n` +
            `   _Contoh: ${prefix + command} ceritain lelucon bapak-bapak yang kocak_\n\n` +
            `2️⃣ *Mode Sesi Santai (Tanpa Prefix):*\n` +
            `   • *${prefix + command} --sesi*\n` +
            `   _Bisa chat langsung terus-menerus tanpa perlu mengetik prefix lagi._\n\n` +
            `3️⃣ *Kontrol Sesi:*\n` +
            `   • *${prefix + command} --stop* (Keluar dari sesi chat)\n` +
            `   • *${prefix + command} --reset* (Hapus riwayat obrolan)\n\n` +
            `*Status Sesi Kamu:* ${currentSession?.isInteractive ? '🟢 Aktif' : '⚪ Nonaktif'}`
        );
    }
};
