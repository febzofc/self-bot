const axios = require('axios');

/**
 * AI Switch Router & Context Manager
 * 
 * Sistem Auto-Switch cerdas antara Antigravity CLI (agy) dan QwQ-32B API:
 * - Tugas Berat (Coding, Edit File, Search Web, Realtime News, VPS/Terminal): Antigravity CLI (agy)
 * - Obrolan Santai / Chit-chat / Banter: QwQ-32B API (hemat token Antigravity)
 * - Riwayat obrolan (session history) tersinkronisasi 1 sesi secara seamless
 * - Karakter persona: Tengil, santai, ceplas-ceplos, bahasa gaul tongkrongan + meme jomok/ngawi
 */

// Sesi bersama (Multi-turn context per chat)
// Map(chatId => { conversationId, isInteractive, lastActive, history: [] })
const sharedSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 Menit tidak aktif -> sesi di-refresh
const MAX_HISTORY_TURNS = 6; // Simpan 6 pasang percakapan terakhir (12 pesan)

// User-Agent Browser untuk mencegah 403 Forbidden / WAF Signature Block
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * Ambil atau inisialisasi sesi percakapan
 */
function getOrCreateSession(chatId) {
    let session = sharedSessions.get(chatId);
    const now = Date.now();

    if (!session || (now - session.lastActive > SESSION_TTL_MS)) {
        session = {
            conversationId: null,
            isInteractive: false,
            lastActive: now,
            history: []
        };
        sharedSessions.set(chatId, session);
    } else {
        session.lastActive = now;
    }

    return session;
}

/**
 * Reset riwayat percakapan sesi
 */
function resetSession(chatId) {
    sharedSessions.delete(chatId);
    return true;
}

/**
 * Nonaktifkan mode interaktif tanpa menghapus riwayat
 */
function stopInteractive(chatId) {
    const session = sharedSessions.get(chatId);
    if (session) {
        session.isInteractive = false;
        session.lastActive = Date.now();
    }
}

/**
 * Catat satu turn (User + Assistant) ke dalam riwayat sesi
 */
function recordTurn(chatId, userText, assistantText, engine = 'qwq') {
    const session = getOrCreateSession(chatId);
    const now = Date.now();

    session.lastActive = now;
    session.history.push({
        role: 'user',
        content: (userText || '').trim(),
        engine,
        timestamp: now
    });
    session.history.push({
        role: 'assistant',
        content: (assistantText || '').trim(),
        engine,
        timestamp: now
    });

    // Batasi kapasitas riwayat agar URL query & prompt tetap efisien
    if (session.history.length > MAX_HISTORY_TURNS * 2) {
        session.history = session.history.slice(-MAX_HISTORY_TURNS * 2);
    }
}

/**
 * Classifier cerdas: Menentukan apakah instruksi memerlukan Antigravity CLI
 * Mengembalikan true jika butuh Antigravity (coding, edit file, search web, vps tools)
 * Mengembalikan false jika obrolan santai/chitchat (cukup pakai QwQ-32B)
 */
function needsAntigravity(promptText, history = []) {
    const t = (promptText || '').toLowerCase().trim();
    if (!t) return false;

    // 1. Explicit Flags / Perintah langsung untuk agy
    if (/(^|\s)(--agy|--code|--search|--force-agy|\/plan|\/goal|\/boost|\/btw)($|\s)/i.test(t)) {
        return true;
    }

    // 2. URL atau permintaan browsing / cari di internet
    if (/https?:\/\/|www\./i.test(t)) {
        return true;
    }
    if (/(cari|searching|browsing|googling|search)\s+(di\s+)?(internet|web|google|online)/i.test(t)) {
        return true;
    }
    if (/(berita|kabar|harga|kurs|cuaca|jadwal|skor)\s+(terkini|terbaru|hari ini|saat ini)/i.test(t)) {
        return true;
    }

    // 3. Permintaan pembuatan kode, script, plugin, modifikasi, file, debug
    const codeAction = /(bikin|buat|buatkan|ciptakan|generate|tulis|tuliskan|koding|coding|program|modifikasi|edit|ubah|ganti|perbaiki|fix|debug|refactor|hapus|tambah|tambahkan|install|pasang)/i;
    const codeTarget = /(kode|kodingan|code|script|skrip|plugin|fitur|fungsi|function|perintah|command|file|berkas|folder|direktori|repo|repository|bot|sc|source\s*code|module|modul|paket|library|dependensi|dependency|api|tombol|button)/i;

    if (codeAction.test(t) && codeTarget.test(t)) {
        return true;
    }

    // Potongan sintaks pemrograman nyata di dalam prompt
    if (/```|function\s*\(|const\s+[a-zA-Z0-9_$]+\s*=|let\s+[a-zA-Z0-9_$]+\s*=|var\s+[a-zA-Z0-9_$]+\s*=|import\s+.*from|class\s+[a-zA-Z0-9_$]+/i.test(promptText)) {
        return true;
    }

    // 4. Eksekusi terminal, manajemen VPS, status server
    if (/(jalankan|eksekusi|run|exec)\s+(command|perintah|terminal|bash|sh|script)/i.test(t)) {
        return true;
    }
    if (/(pm2|restart\s+bot|cek\s+ram|cek\s+cpu|cek\s+disk|cek\s+spek|status\s+server|status\s+vps)/i.test(t)) {
        return true;
    }

    // 5. Inspeksi / analisis kode dalam workspace
    if (/(periksa|cek|lihat|tinjau|analisis|baca)\s+(kode|kodingan|script|plugin|file|isi\s+folder|repo|source\s*code)/i.test(t)) {
        return true;
    }

    // 6. Follow-up kelanjutan instruksi coding jika turn sebelumnya adalah Antigravity
    const lastTurn = history && history.length > 0 ? history[history.length - 1] : null;
    if (lastTurn && lastTurn.engine === 'agy') {
        if (/(tambahin|tambahkan|ganti|perbaiki|ubah|hapus|fix|benerin|lanjutin|lanjutkan|masih\s+error|belum\s+bisa|bisa\s+gak\s+dibikin)/i.test(t)) {
            return true;
        }
    }

    return false;
}

/**
 * Bersihkan teks respon dari QwQ-32B (hilangkan token reasoning, think tags, dan format)
 */
function cleanQwQResponse(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    let text = rawText;

    // 1. Ekstrak setelah tag penutup </think> jika ada
    if (text.includes('</think>')) {
        text = text.split('</think>').pop().trim();
    } else if (text.includes('Possible response:')) {
        text = text.split('Possible response:').pop().trim();
    } else {
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        // Jika ada jejak reasoning internal tanpa </think> (misal "Okay, the user...")
        if (/^Okay,\s+the\s+user/i.test(text) || /^First,\s+I\s+should/i.test(text)) {
            const quoteMatch = text.match(/"([^"]{3,180})"/g);
            if (quoteMatch && quoteMatch.length > 0) {
                text = quoteMatch[quoteMatch.length - 1].replace(/^"|"$/g, '');
            } else {
                const paragraphs = text.split('\n\n');
                if (paragraphs.length > 1) {
                    text = paragraphs[paragraphs.length - 1].trim();
                }
            }
        }
    }

    // 2. Bersihkan tanda kutip pembungkus jika ada
    text = text.replace(/^["']|["']$/g, '').trim();

    // 3. Bersihkan sisa-sisa awalan seperti "Kamu: " atau "Bot: "
    text = text.replace(/^(Kamu|Bot|AI|Lu)\s*:\s*/i, '').trim();

    return text;
}

/**
 * Panggil API AI QwQ-32B (Siputzx API) dengan persona tengil & santai
 * Endpoint: https://api.siputzx.my.id/api/ai/qwq32b
 */
async function fetchQwQ(promptText, history = []) {
    // Susun prompt dengan instruksi karakter dan riwayat obrolan
    const personaHeader = 
        `/no_think [Karakter: Teman cowok WhatsApp yang tengil, kocak, santai, suka ngeledek tapi asik. ` +
        `Gaya bahasa gaul tongkrongan Indonesia (lu, gua, wir, bjir, anjir, wkwk, santai). ` +
        `Sisipkan jokes meme jomok / ngawi / ambalabu (seperti mas amba, rusdi ngawi, ambalabu, santai wir, aduh mas) secara natural dan pas. ` +
        `PANTANGAN: JANGAN PERNAH formal/kaku, JANGAN bicara seperti AI/robot/customer service, JANGAN ngaku sebagai model AI. ` +
        `Jawab santai, singkat, padat maksimal 2-3 kalimat layaknya ketikan chat WA asli.]\n\n`;

    let conversationContext = '';
    // Ambil maksimal 4 turn terakhir agar URL query tetap ringkas
    const recentHistory = history.slice(-8);
    if (recentHistory.length > 0) {
        conversationContext += 'Riwayat obrolan:\n';
        for (const turn of recentHistory) {
            const shortContent = turn.content.length > 150 ? turn.content.slice(0, 150) + '...' : turn.content;
            conversationContext += (turn.role === 'user' ? 'User: ' : 'Kamu: ') + shortContent + '\n';
        }
        conversationContext += '\n';
    }

    const fullPrompt = `${personaHeader}${conversationContext}User: ${promptText}\nKamu:`;

    // System instruction dibuat satu baris tanpa baris baru agar tidak memicu 403 WAF Signature
    const singleLineSystem = '/no_think Kamu adalah teman WhatsApp santai dan tengil. Balas singkat dan natural.';

    // Panggil API dengan timeout 35 detik dan 1x retry jika diperlukan
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = await axios.get('https://api.siputzx.my.id/api/ai/qwq32b', {
                params: {
                    prompt: fullPrompt,
                    system: singleLineSystem,
                    temperature: 0.7
                },
                headers: {
                    'User-Agent': BROWSER_UA
                },
                timeout: 35000
            });

            const rawResp = res.data?.data?.response || res.data?.result || res.data?.response || '';
            const cleaned = cleanQwQResponse(rawResp);

            if (cleaned) {
                return cleaned;
            }
            throw new Error('Respon kosong dari API QwQ');
        } catch (err) {
            lastErr = err;
            if (attempt === 1) {
                await new Promise(r => setTimeout(r, 1200));
            }
        }
    }

    throw lastErr || new Error('Gagal menghubungi API QwQ setelah percobaan ulang');
}


/**
 * Format riwayat obrolan sesi sebagai konteks awal untuk Antigravity CLI
 * Memastikan Antigravity tahu apa yang diobrolkan sebelumnya saat beralih dari QwQ ke agy
 */
function buildContextForAntigravity(history, currentPrompt) {
    if (!history || history.length === 0) {
        return currentPrompt;
    }

    // Ambil 6 turn percakapan terakhir
    const recent = history.slice(-6);
    let contextBlock = `[RIWAYAT PERCAKAPAN SEBELUMNYA DALAM SESI INI]:\n`;
    for (const turn of recent) {
        const shortContent = turn.content.length > 200 ? turn.content.slice(0, 200) + '...' : turn.content;
        contextBlock += (turn.role === 'user' ? 'User: ' : 'Asisten: ') + shortContent + '\n';
    }
    contextBlock += `\n[INSTRUKSI TERKINI DARI PENGGUNA]:\n${currentPrompt}`;

    return contextBlock;
}

module.exports = {
    sharedSessions,
    getOrCreateSession,
    resetSession,
    stopInteractive,
    recordTurn,
    needsAntigravity,
    fetchQwQ,
    cleanQwQResponse,
    buildContextForAntigravity
};
