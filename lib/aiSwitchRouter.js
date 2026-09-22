const axios = require('axios');

/**
 * AI Switch Router & Context Manager
 * 
 * Sistem Auto-Switch cerdas antara Antigravity CLI (agy) dan Casual AI API (Faa AI-Promt):
 * - Tugas Berat (Coding, Edit File, List/Cek Package, Search Web, Realtime News, VPS/Terminal): Antigravity CLI (agy)
 * - Obrolan Santai / Chit-chat / Banter: Casual AI API (hemat token Antigravity)
 * - Riwayat obrolan (session history) tersinkronisasi 1 sesi secara seamless
 * - Karakter persona: Tengil, santai, ceplas-ceplos, bahasa gaul tongkrongan + meme jomok/ngawi
 */

// Sesi bersama (Multi-turn context per chat)
// Map(chatId => { conversationId, isInteractive, lastActive, history: [] })
const sharedSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 Menit tidak aktif -> sesi di-refresh
const MAX_HISTORY_TURNS = 6; // Simpan 6 pasang percakapan terakhir (12 pesan)

// User-Agent Browser untuk mencegah block
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
function recordTurn(chatId, userText, assistantText, engine = 'casual') {
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
 * Mengembalikan true jika butuh Antigravity (coding, edit file, cek npm/package, search web, vps tools)
 * Mengembalikan false jika obrolan santai/chitchat (cukup pakai Casual AI)
 */
function needsAntigravity(promptText, history = []) {
    const t = (promptText || '').toLowerCase().trim();
    if (!t) return false;

    // 1. Explicit Flags / Perintah langsung untuk agy
    if (/(^|\s)(--agy|--code|--search|--force-agy|\/plan|\/goal|\/boost|\/btw)($|\s)/i.test(t)) {
        return true;
    }

    // 2. URL atau permintaan browsing / cari di internet
    if (/https?:\/\/|www\./i.test(t)) return true;
    if (/(cari|searching|browsing|googling|search)\s+(di\s+)?(internet|web|google|online)/i.test(t)) return true;
    if (/(berita|kabar|harga|kurs|cuaca|jadwal|skor)\s+(terkini|terbaru|hari ini|saat ini)/i.test(t)) return true;

    // 3. Istilah teknis spesifik Developer / Package / VPS / System
    // (Pasti tugas teknis di sistem VPS / workspace)
    const devKeywords = /\b(npm|npx|pnpm|yarn|package\.json|node_modules|dependencies|dependensi|pm2|vps|terminal|bash|shell|curl|wget|chmod|grep|htop)\b/i;
    if (devKeywords.test(t)) return true;
    if (/\bgit\s+(status|add|commit|push|pull|diff|log|branch)/i.test(t)) return true;

    // 4. Perintah inspeksi atau eksekusi pada workspace / file / folder / kode
    const inspectAction = /(cek|lihat|tampilkan|list|daftar|periksa|baca|tinjau|analisis|cari|temukan|buka|inspeksi)/i;
    const inspectTarget = /(package|paket|library|libraries|lib\b|modul|module|file|berkas|folder|direktori|koding|kodingan|kode|code|script|skrip|plugin|fitur|fungsi|function|repo|repository|source\s*code|struktur|database|db|log|error|spek|ram|cpu|disk|server|port|proses)/i;
    if (inspectAction.test(t) && inspectTarget.test(t)) return true;

    // 5. Permintaan pembuatan kode, script, plugin, modifikasi, file, debug, instalasi
    const codeAction = /(bikin|buat|buatkan|ciptakan|generate|tulis|tuliskan|koding|coding|program|modifikasi|edit|ubah|ganti|perbaiki|fix|debug|refactor|hapus|delete|tambah|tambahkan|install|pasang|uninstall|update)/i;
    const codeTarget = /(kode|kodingan|code|script|skrip|plugin|fitur|fungsi|function|perintah|command|file|berkas|folder|direktori|repo|repository|bot|sc|source\s*code|module|modul|paket|package|library|lib\b|dependensi|dependency|api|tombol|button)/i;
    if (codeAction.test(t) && codeTarget.test(t)) return true;

    // Potongan sintaks pemrograman nyata di dalam prompt
    if (/```|function\s*\(|const\s+[a-zA-Z0-9_$]+\s*=|let\s+[a-zA-Z0-9_$]+\s*=|var\s+[a-zA-Z0-9_$]+\s*=|import\s+.*from|class\s+[a-zA-Z0-9_$]+/i.test(promptText)) {
        return true;
    }

    // 6. Eksekusi terminal, manajemen VPS, status server
    if (/(jalankan|eksekusi|run|exec)\s+(command|perintah|terminal|bash|sh|script)/i.test(t)) return true;
    if (/(restart\s+bot|cek\s+ram|cek\s+cpu|cek\s+disk|cek\s+spek|status\s+server|status\s+vps)/i.test(t)) return true;

    // 7. Follow-up kelanjutan instruksi coding jika turn sebelumnya adalah Antigravity
    const lastTurn = history && history.length > 0 ? history[history.length - 1] : null;
    if (lastTurn && lastTurn.engine === 'agy') {
        if (/(tambahin|tambahkan|ganti|perbaiki|ubah|hapus|fix|benerin|lanjutin|lanjutkan|masih\s+error|belum\s+bisa|bisa\s+gak\s+dibikin)/i.test(t)) {
            return true;
        }
    }

    return false;
}

/**
 * Panggil API AI Casual (Faa AI-Promt) dengan kepribadian tengil & jokes jomok / ngawi
 * Endpoint: https://api-faa.my.id/faa/ai-promt?prompt=...&query=...
 */
async function fetchCasualAi(promptText, history = []) {
    const personaInstruction = 
        'Kamu adalah teman chat WhatsApp cowok yang tengil, kocak, santai, ceplas-ceplos, pake bahasa gaul tongkrongan Indonesia (lu, gua, wir, bjir, anjir, wkwk) dan lelucon meme jomok / ngawi (seperti mas amba, rusdi ngawi, ambalabu, santai wir). ' +
        'Jawab santai, singkat, padat 1-2 kalimat layaknya ketikan chat WA asli. JANGAN PERNAH kaku/formal dan JANGAN ngaku sebagai AI. Sambung topik obrolan secara natural.';

    let conversationText = '';
    // Ambil maksimal 4 pasang percakapan terakhir sebagai konteks riwayat
    const recentHistory = (history || []).slice(-8);
    if (recentHistory.length > 0) {
        for (const turn of recentHistory) {
            const shortContent = turn.content.length > 150 ? turn.content.slice(0, 150) + '...' : turn.content;
            conversationText += (turn.role === 'user' ? 'User: ' : 'Kamu: ') + shortContent + '\n';
        }
    }
    conversationText += 'User: ' + promptText;

    // Panggil API Faa AI-Promt
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = await axios.get('https://api-faa.my.id/faa/ai-promt', {
                params: {
                    prompt: conversationText,
                    query: personaInstruction
                },
                headers: {
                    'User-Agent': BROWSER_UA
                },
                timeout: 25000
            });

            const reply = res.data?.result?.response || res.data?.result || res.data?.response;
            if (reply && typeof reply === 'string') {
                return reply.trim().replace(/^["']|["']$/g, '');
            }
            throw new Error('Respon kosong dari API AI Faa');
        } catch (err) {
            lastErr = err;
            if (attempt === 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    // Jika gagal, fallback ke Deep-AI
    try {
        const fallbackRes = await axios.get('https://api-faa.my.id/faa/deep-ai', {
            params: { text: promptText },
            headers: { 'User-Agent': BROWSER_UA },
            timeout: 20000
        });
        if (fallbackRes.data && fallbackRes.data.result) {
            return fallbackRes.data.result.trim();
        }
    } catch (e) {}

    throw lastErr || new Error('Gagal menghubungi server AI');
}

/**
 * Format riwayat obrolan sesi sebagai konteks awal untuk Antigravity CLI
 * Memastikan Antigravity tahu apa yang diobrolkan sebelumnya saat beralih ke agy
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
    fetchCasualAi,
    fetchQwQ: fetchCasualAi, // Alias untuk kompatibilitas
    buildContextForAntigravity
};
