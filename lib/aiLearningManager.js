const fs = require('fs');
const path = require('path');

const PATTERNS_FILE = path.join(__dirname, '..', 'src', 'ai_learned_patterns.json');

// Seed pola bawaan yang teliti & peka untuk Developer, Git, GitHub, Repo, dan Workspace
const DEFAULT_PATTERNS = {
    version: 1,
    learnedPatterns: [
        {
            id: 'github_vcs_workflow',
            regex: '(?i)(upload|unggah|push|kirim|tarik|pull|sync|sinkron|sinkronkan|clone|branch|commit|komit).*?(github|gitlab|repo|repository)|(github|gitlab|repo|repository).*?(upload|unggah|push|kirim|sync|sinkron|sinkronkan|commit|komit|pembaruan|update|perubahan)',
            target: 'agy',
            reason: 'Alur kerja Git/GitHub dan sinkronisasi repositori',
            learnedAt: Date.now(),
            hitCount: 0
        },
        {
            id: 'project_updates_changelog',
            regex: '(?i)(cek|buatkan|buat|bikin|lihat|tampilkan|rangkum|ringkas|daftar|siapkan|tulis).*?(pembaruan|perubahan|changelog|catatan\\s*rilis|release\\s*note|riwayat\\s*commit|log\\s*commit|diff)',
            target: 'agy',
            reason: 'Pemeriksaan dan pembuatan changelog/pembaruan repositori',
            learnedAt: Date.now(),
            hitCount: 0
        },
        {
            id: 'updates_already_happened',
            regex: '(?i)(pembaruan|perubahan|update).*?(sudah|telah|barusan).*?(terjadi|dibuat|diupdate|dilakukan|ditambahkan)',
            target: 'agy',
            reason: 'Pemeriksaan riwayat perubahan kode yang sudah terjadi',
            learnedAt: Date.now(),
            hitCount: 0
        },
        {
            id: 'github_destination_upload',
            regex: '(?i)untuk\\s+(di\\s*)?(upload|unggah|push|kirim|rilis|sync)\\s+(ke\\s+)?(github|repo|repository)',
            target: 'agy',
            reason: 'Instruksi persiapan pembaruan untuk diupload ke GitHub',
            learnedAt: Date.now(),
            hitCount: 0
        },
        {
            id: 'codebase_inspection',
            regex: '(?i)(apa\\s+(saja|aja|an\\s+aja)|gimana)\\s+(yang\\s+)?(baru|diupdate|diubah|diganti|diperbarui|ditambahkan|sudah\\s+terjadi|terjadi)\\s+(di|pada)?\\s*(bot|repo|sc|skrip|script|kodingan|kode)?',
            target: 'agy',
            reason: 'Pertanyaan seputar perubahan kode dan status terkini codebase bot',
            learnedAt: Date.now(),
            hitCount: 0
        }
    ],
    learnedPhrases: [
        'cek pembaruan yang sudah terjadi untuk di upload ke github saya',
        'buatkan pembaruan yang sudah terjadi untuk di upload ke github saya',
        'upload ke github',
        'push ke github',
        'upload ke repo',
        'sinkron ke github',
        'sinkronkan github saya',
        'bantu upload project ke github',
        'cek apa saja yang baru di bot',
        'apa aja update terbaru',
        'tampilkan changelog update',
        'bikin release note untuk github',
        'rangkum pembaruan terakhir',
        'push update ke github saya',
        'cek commit terbaru',
        'komit perubahan tadi',
        'apa saja yang sudah diubah',
        'cek perubahan kodingan',
        'update ke repo github',
        'tolong push ke github',
        'cek riwayat commit terakhir',
        'bikin commit message untuk update ini'
    ],
    corrections: []
};

/**
 * Muat data pembelajaran dari penyimpanan JSON
 */
function loadData() {
    try {
        if (!fs.existsSync(PATTERNS_FILE)) {
            saveData(DEFAULT_PATTERNS);
            return JSON.parse(JSON.stringify(DEFAULT_PATTERNS));
        }
        const raw = fs.readFileSync(PATTERNS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed.learnedPatterns || !parsed.learnedPhrases) {
            saveData(DEFAULT_PATTERNS);
            return JSON.parse(JSON.stringify(DEFAULT_PATTERNS));
        }
        return parsed;
    } catch (e) {
        console.error('[aiLearningManager] Gagal membaca data pembelajaran:', e);
        return JSON.parse(JSON.stringify(DEFAULT_PATTERNS));
    }
}

/**
 * Simpan data pembelajaran ke penyimpanan JSON
 */
function saveData(data) {
    try {
        const dir = path.dirname(PATTERNS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(PATTERNS_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[aiLearningManager] Gagal menyimpan data pembelajaran:', e);
        return false;
    }
}

/**
 * Cek apakah sebuah teks cocok dengan pola atau frasa yang telah dipelajari
 */
function matchLearned(promptText) {
    if (!promptText || typeof promptText !== 'string') return { matched: false };
    const t = promptText.trim().toLowerCase();
    if (!t) return { matched: false };

    const data = loadData();
    let hasUpdatedHits = false;

    // 1. Cek kecocokan frasa yang dipelajari (substring atau full match)
    for (const phrase of data.learnedPhrases) {
        const lp = phrase.trim().toLowerCase();
        if (!lp) continue;
        if (t.includes(lp) || lp.includes(t)) {
            return {
                matched: true,
                target: 'agy',
                source: 'phrase',
                pattern: lp,
                reason: 'Kecocokan frasa instruksi yang dipelajari'
            };
        }
    }

    // 2. Cek kecocokan regex pola yang dipelajari
    for (const p of data.learnedPatterns) {
        try {
            let patternStr = p.regex;
            let flags = 'i';
            if (patternStr.startsWith('(?i)')) {
                patternStr = patternStr.slice(4);
            }
            const reg = new RegExp(patternStr, flags);
            if (reg.test(t)) {
                p.hitCount = (p.hitCount || 0) + 1;
                hasUpdatedHits = true;
                if (hasUpdatedHits) {
                    // Simpan hitCount secara aman
                    setTimeout(() => saveData(data), 500);
                }
                return {
                    matched: true,
                    target: p.target || 'agy',
                    source: 'pattern',
                    id: p.id,
                    pattern: p.regex,
                    reason: p.reason || 'Kecocokan pola regex yang dipelajari'
                };
            }
        } catch (e) {
            console.error(`[aiLearningManager] Pola regex tidak valid (${p.id}):`, e.message);
        }
    }

    return { matched: false };
}

/**
 * Tambahkan frasa pembelajaran baru
 */
function learnPhrase(phrase, reason = 'manual') {
    if (!phrase || typeof phrase !== 'string') return false;
    const clean = phrase.trim().toLowerCase();
    if (clean.length < 3) return false;

    const data = loadData();
    if (!data.learnedPhrases.includes(clean)) {
        data.learnedPhrases.push(clean);
        saveData(data);
        console.log(`[aiLearningManager] Frasa baru dipelajari: "${clean}" (${reason})`);
        return true;
    }
    return false;
}

/**
 * Tambahkan pola regex pembelajaran baru
 */
function learnPattern(regexStr, id = null, reason = 'manual') {
    if (!regexStr || typeof regexStr !== 'string') return false;
    try {
        new RegExp(regexStr.replace(/^\(\?i\)/, ''), 'i');
    } catch (e) {
        throw new Error(`Sintaks regex tidak valid: ${e.message}`);
    }

    const data = loadData();
    const patternId = id || `custom_${Date.now()}`;
    const existing = data.learnedPatterns.find(p => p.id === patternId || p.regex === regexStr);
    if (existing) {
        existing.regex = regexStr;
        existing.reason = reason;
        saveData(data);
        return true;
    }

    data.learnedPatterns.push({
        id: patternId,
        regex: regexStr,
        target: 'agy',
        reason,
        learnedAt: Date.now(),
        hitCount: 0
    });
    saveData(data);
    console.log(`[aiLearningManager] Pola regex baru dipelajari: "${regexStr}" (${patternId})`);
    return true;
}

/**
 * Hapus pola atau frasa pembelajaran
 */
function unlearn(keyword) {
    if (!keyword) return false;
    const clean = keyword.trim().toLowerCase();
    const data = loadData();
    let removed = false;

    const initialPhrasesLen = data.learnedPhrases.length;
    data.learnedPhrases = data.learnedPhrases.filter(p => !p.toLowerCase().includes(clean));
    if (data.learnedPhrases.length !== initialPhrasesLen) removed = true;

    const initialPatternsLen = data.learnedPatterns.length;
    data.learnedPatterns = data.learnedPatterns.filter(p => p.id !== clean && !p.regex.toLowerCase().includes(clean));
    if (data.learnedPatterns.length !== initialPatternsLen) removed = true;

    if (removed) {
        saveData(data);
    }
    return removed;
}

/**
 * Deteksi apakah pesan pengguna adalah koreksi / keluhan bahwa bot salah memilih casual AI alih-alih agy
 */
function isCorrection(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim().toLowerCase();

    // 1. Perintah eksplisit belajar
    if (/^(\.|\/)?(agy|ai)\s+--(learn|pelajari|ingat)/i.test(t)) return true;
    if (/^(bot\s+)?(belajar|pelajari|ingat|catat)(\s+pola)?\s*:/i.test(t)) return true;

    // 2. Koreksi natural dari owner saat respon tidak sesuai
    const correctionPhrases = [
        /(itu|harusnya|pakai|pake|gunakan|maksudnya|maksud\s+gw|maksud\s+saya|ini)\s+(ke\s+)?(agy|antigravity)/i,
        /(kenapa|kok)\s+(malah\s+)?(ke\s+)?(ai\s*biasa|casual|faa|deepai|chatbot)/i,
        /(itu|ini)\s+(tugas|buat|untuk)\s+(agy|antigravity|coding|git|github|repo)/i,
        /(bukan|jangan)\s+(pake\s+)?(ai\s*biasa|casual|faa)/i,
        /(bot|kamu)\s+belajar\s+lagi/i,
        /(salah|bukan\s+itu|keliru).*?(harusnya|maksud).*?(agy|antigravity)/i
    ];

    return correctionPhrases.some(reg => reg.test(t));
}

/**
 * Pelajari secara otomatis dari koreksi pengguna berdasarkan riwayat sesi sebelumnya
 */
function learnFromCorrection(chatId, correctionText, history) {
    if (!history || history.length === 0) {
        return { learned: false, reason: 'Tidak ada riwayat obrolan sebelumnya.' };
    }

    // Cari giliran user terakhir yang dijawab oleh casual AI
    let lastUserPrompt = null;
    let foundCasual = false;

    for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        if (turn.role === 'assistant' && (turn.engine === 'casual' || turn.engine === 'qwq')) {
            foundCasual = true;
        } else if (turn.role === 'user' && foundCasual) {
            lastUserPrompt = turn.content;
            break;
        }
    }

    // Jika tidak ada giliran casual sebelumnya, ambil giliran user paling terakhir
    if (!lastUserPrompt) {
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'user') {
                lastUserPrompt = history[i].content;
                break;
            }
        }
    }

    if (!lastUserPrompt) {
        return { learned: false, reason: 'Gagal menemukan prompt user sebelumnya untuk dipelajari.' };
    }

    // Simpan prompt sebelumnya ke dalam daftar frasa pembelajaran
    learnPhrase(lastUserPrompt, `Koreksi Owner: "${correctionText}"`);

    // Catat ke log koreksi
    const data = loadData();
    data.corrections.push({
        prompt: lastUserPrompt,
        correction: correctionText,
        timestamp: Date.now()
    });
    if (data.corrections.length > 50) {
        data.corrections = data.corrections.slice(-50);
    }
    saveData(data);

    return {
        learned: true,
        previousPrompt: lastUserPrompt,
        learnedPhrase: lastUserPrompt
    };
}

/**
 * Dapatkan statistik dan daftar data pembelajaran
 */
function getStats() {
    const data = loadData();
    return {
        totalPatterns: data.learnedPatterns.length,
        totalPhrases: data.learnedPhrases.length,
        totalCorrections: data.corrections.length,
        patterns: data.learnedPatterns,
        phrases: data.learnedPhrases,
        recentCorrections: data.corrections.slice(-5)
    };
}

module.exports = {
    loadData,
    saveData,
    matchLearned,
    learnPhrase,
    learnPattern,
    unlearn,
    isCorrection,
    learnFromCorrection,
    getStats
};
