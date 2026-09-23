const fs = require('fs');
const path = require('path');
const axios = require('axios');

const EXPRESSIONS_DIR = path.join(__dirname, '../src/expressions');
const DB_FILE = path.join(__dirname, '../src/database.json');

// Pastikan folder penyimpanan stiker ekspresi tersedia
if (!fs.existsSync(EXPRESSIONS_DIR)) {
    fs.mkdirSync(EXPRESSIONS_DIR, { recursive: true });
}

/**
 * Mendapatkan daftar stiker ekspresi dari database
 */
function getExpressions() {
    if (!global.db) global.db = {};
    if (!global.db.data) {
        try {
            if (fs.existsSync(DB_FILE)) {
                global.db.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            } else {
                global.db.data = {};
            }
        } catch (e) {
            global.db.data = {};
        }
    }

    if (!Array.isArray(global.db.data.expressions)) {
        global.db.data.expressions = [];
    }

    return global.db.data.expressions;
}

/**
 * Menyimpan perubahan ke file database.json
 */
async function saveDb() {
    try {
        if (global.db && typeof global.db.write === 'function') {
            await global.db.write();
        } else {
            fs.writeFileSync(DB_FILE, JSON.stringify(global.db.data || {}, null, 2), 'utf8');
        }
    } catch (e) {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(global.db.data || {}, null, 2), 'utf8');
        } catch (err) {
            console.error('[expressionManager] Gagal menyimpan database.json:', err);
        }
    }
}

/**
 * Menambahkan stiker ekspresi baru ke database & penyimpanan lokal
 */
async function addExpression({ name, description, buffer, sender }) {
    if (!name || !description || !buffer) {
        throw new Error('Nama ekspresi, deskripsi, dan buffer stiker wajib disediakan.');
    }

    const cleanName = name.toLowerCase().trim().replace(/[^a-zA-Z0-9_\-]/g, '');
    const cleanDesc = description.trim();

    if (!cleanName) {
        throw new Error('Nama ekspresi tidak valid.');
    }

    const id = `${cleanName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fileName = `${id}.webp`;
    const fullPath = path.join(EXPRESSIONS_DIR, fileName);
    const relPath = `src/expressions/${fileName}`;

    fs.writeFileSync(fullPath, buffer);

    const list = getExpressions();
    const newEntry = {
        id,
        name: cleanName,
        description: cleanDesc,
        file: relPath,
        createdAt: new Date().toISOString(),
        createdBy: sender || 'owner'
    };

    list.push(newEntry);
    await saveDb();

    const totalInGroup = list.filter(item => item.name === cleanName).length;

    return {
        ...newEntry,
        totalInGroup
    };
}

/**
 * Menghapus stiker ekspresi berdasarkan ID atau nama kategori
 */
async function deleteExpression(target) {
    const query = (target || '').toLowerCase().trim();
    if (!query) return { deletedCount: 0, deletedItems: [] };

    const list = getExpressions();
    const toDelete = [];
    const remaining = [];

    for (const item of list) {
        if (item.id.toLowerCase() === query || item.name.toLowerCase() === query) {
            toDelete.push(item);
        } else {
            remaining.push(item);
        }
    }

    if (toDelete.length === 0) {
        return { deletedCount: 0, deletedItems: [] };
    }

    // Hapus file fisik
    for (const item of toDelete) {
        try {
            const fullPath = path.isAbsolute(item.file)
                ? item.file
                : path.join(__dirname, '..', item.file);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        } catch (e) {
            console.error(`[expressionManager] Gagal menghapus file stiker ${item.file}:`, e);
        }
    }

    global.db.data.expressions = remaining;
    await saveDb();

    return {
        deletedCount: toDelete.length,
        deletedItems: toDelete
    };
}

/**
 * Mengelompokkan stiker berdasarkan nama ekspresi
 */
function getGroupedExpressions() {
    const list = getExpressions();
    const grouped = {};

    for (const item of list) {
        if (!grouped[item.name]) {
            grouped[item.name] = {
                name: item.name,
                count: 0,
                descriptions: new Set(),
                items: []
            };
        }
        grouped[item.name].count += 1;
        if (item.description) {
            grouped[item.name].descriptions.add(item.description);
        }
        grouped[item.name].items.push(item);
    }

    // Ubah Set descriptions menjadi array
    for (const key in grouped) {
        grouped[key].descriptions = Array.from(grouped[key].descriptions);
    }

    return grouped;
}

/**
 * Stopwords bahasa Indonesia untuk ekstraksi kata kunci
 */
const STOPWORDS = new Set([
    'gunakan', 'saat', 'atau', 'dan', 'dll', 'yang', 'di', 'ke', 'dari',
    'ini', 'itu', 'untuk', 'pada', 'dengan', 'kalo', 'kalau', 'jika',
    'bila', 'ketika', 'adalah', 'sebagai', 'buat', 'bisa', 'ada', 'lagi',
    'udah', 'sudah', 'oleh', 'agar', 'supaya', 'pas'
]);

/**
 * Sinonim & pemicu emosi umum bahasa Indonesia
 */
const EMOTION_SYNONYMS = {
    sedih: ['sedih', 'nangis', 'menangis', 'tangis', 'hiks', 'terharu', 'kecewa', 'galau', 'patah hati', 'terluka', 'pedih', 'nelangsa', 'terhina', 'depresi'],
    lucu: ['lucu', 'ngakak', 'wkwk', 'haha', 'lawak', 'kocak', 'humor', 'joke', 'anjir wkwk', 'gokil', 'receh', 'komedi', 'ketawa'],
    marah: ['marah', 'kesal', 'jengkel', 'ngambek', 'emosi', 'benci', 'bacot', 'kontol', 'bangsat', 'geram', 'sebal', 'naik pitam', 'ngamuk'],
    jomok: ['jomok', 'amba', 'ambalabu', 'rusdi', 'ngawi', 'imut', 'otot', 'homo', 'gay', 'faiz', 'mas amba', 'mas rusdi', 'desah', 'pria berotot'],
    kaget: ['kaget', 'syok', 'shock', 'astaga', 'anjir', 'demi apa', 'buset', 'waduh', 'terkejut', 'bused'],
    bingung: ['bingung', 'heran', 'pusing', 'gak paham', 'ha?', 'hah?', 'apasi', 'maksudnya', 'aneh', 'gajelas'],
    cinta: ['sayang', 'cinta', 'love', 'gemas', 'suka', 'lope', 'pacar', 'manis', 'muach', 'peluk'],
    senang: ['senang', 'bahagia', 'alhamdulillah', 'mantap', 'hore', 'asik', 'yeay', 'syukur', 'keren']
};

/**
 * Menilai kecocokan ekspresi menggunakan aturan kata kunci (keyword matching)
 */
function scoreByKeywords(text, grouped) {
    const t = text.toLowerCase();
    const scores = {};

    for (const name in grouped) {
        let score = 0;
        const entry = grouped[name];

        // 1. Cek kecocokan nama ekspresi langsung
        if (t.includes(name)) {
            score += 8;
        }

        // 2. Cek kecocokan sinonim emosi
        const synonyms = EMOTION_SYNONYMS[name] || [];
        for (const syn of synonyms) {
            if (t.includes(syn)) {
                score += 5;
            }
        }

        // 3. Cek kata kunci dari deskripsi stiker
        for (const desc of entry.descriptions) {
            const words = desc.toLowerCase().split(/[^a-zA-Z0-9]+/);
            for (const word of words) {
                if (word.length >= 3 && !STOPWORDS.has(word)) {
                    if (t.includes(word)) {
                        score += 3;
                    }
                }
            }
        }

        if (score > 0) {
            scores[name] = score;
        }
    }

    // Urutkan skor dari yang tertinggi
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] >= 5) {
        return sorted[0][0]; // Kembalikan nama ekspresi dengan skor tertinggi
    }

    return null;
}

/**
 * Klasifikasi AI jika kata kunci belum cukup jelas
 */
async function classifyWithAi(contextText, grouped) {
    const categories = Object.keys(grouped);
    if (categories.length === 0) return null;

    const listText = categories.map((cat, idx) => {
        const descs = grouped[cat].descriptions.join('; ');
        return `${idx + 1}. [${cat}]: ${descs || 'ekspresi ' + cat}`;
    }).join('\n');

    const prompt = 
        `Diberikan cuplikan obrolan berikut:\n` +
        `"${contextText}"\n\n` +
        `Pilih SATU nama ekspresi di dalam kurung siku yang paling cocok untuk merespon/mengekspresikan perasaan dalam situasi obrolan di atas:\n` +
        `${listText}\n\n` +
        `Instruksi: Jawab HANYA dengan SATU kata nama ekspresinya saja (contoh: ${categories[0]}). Jika sama sekali tidak ada yang relevan, jawab: NONE`;

    try {
        const res = await axios.get('https://api-faa.my.id/faa/deep-ai', {
            params: { text: prompt },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 2500
        });

        const raw = (res.data?.result || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
        if (raw && grouped[raw]) {
            return raw;
        }
    } catch (e) {
        // Fallback hening jika AI gagal / timeout
    }

    return null;
}

/**
 * Mencocokkan teks konteks percakapan dengan stiker ekspresi terbaik
 */
async function matchExpression(userText, botReplyText) {
    const grouped = getGroupedExpressions();
    const categories = Object.keys(grouped);
    if (categories.length === 0) return null;

    const combinedText = `${userText || ''} ${botReplyText || ''}`.trim();
    if (!combinedText) return null;

    // 1. Prioritas pertama: Keyword matching cepat & akurat
    const keywordMatch = scoreByKeywords(combinedText, grouped);
    if (keywordMatch) {
        return keywordMatch;
    }

    // 2. Prioritas kedua: AI semantic classifier jika tidak ada kecocokan kata kunci langsung
    const aiMatch = await classifyWithAi(combinedText, grouped);
    if (aiMatch) {
        return aiMatch;
    }

    return null;
}

/**
 * Menghitung peluang dan mengirimkan stiker ekspresi jika memenuhi kriteria
 * @param {object} bob - Baileys socket instance
 * @param {object} m - Message object
 * @param {string} userText - Pesan dari user
 * @param {string} botReplyText - Balasan teks dari bot
 * @param {number} chance - Peluang mengirim stiker (default: 0.35 alias 35%)
 */
async function maybeSendExpressionSticker(bob, m, userText, botReplyText, chance = 0.35) {
    // Cek probabilitas (35%)
    const roll = Math.random();
    if (roll > chance) {
        return false;
    }

    const grouped = getGroupedExpressions();
    const categories = Object.keys(grouped);
    if (categories.length === 0) {
        return false;
    }

    // Cari ekspresi yang cocok
    const matchedName = await matchExpression(userText, botReplyText);
    if (!matchedName || !grouped[matchedName] || grouped[matchedName].items.length === 0) {
        return false;
    }

    // Ambil stiker acak dari kategori ekspresi tersebut
    const items = grouped[matchedName].items;
    const chosen = items[Math.floor(Math.random() * items.length)];

    const fullPath = path.isAbsolute(chosen.file)
        ? chosen.file
        : path.join(__dirname, '..', chosen.file);

    if (!fs.existsSync(fullPath)) {
        console.error(`[expressionManager] File stiker tidak ditemukan: ${fullPath}`);
        return false;
    }

    const stickerBuffer = fs.readFileSync(fullPath);

    // Jeda alami sedikit (1.2 detik - 2.0 detik) agar stiker terkirim setelah teks seperti percakapan manusia
    const delayMs = 1200 + Math.floor(Math.random() * 800);
    await new Promise(r => setTimeout(r, delayMs));

    try {
        await bob.sendMessage(m.chat, { sticker: stickerBuffer });
        return true;
    } catch (err) {
        console.error('[expressionManager] Gagal mengirim stiker ekspresi:', err);
        return false;
    }
}

/**
 * Mengirim stiker ekspresi langsung berdasarkan nama kategori
 * @param {object} bob - Baileys socket instance
 * @param {object} m - Message object
 * @param {string} expressionName - Nama ekspresi (misal: 'sedih', 'sus', 'mabar', 'pujian', dll)
 */
async function sendExpressionByName(bob, m, expressionName) {
    if (!expressionName) return false;
    const cleanName = expressionName.toLowerCase().trim();

    const grouped = getGroupedExpressions();
    let targetCategory = null;

    if (grouped[cleanName] && grouped[cleanName].items.length > 0) {
        targetCategory = cleanName;
    } else {
        // Cek kecocokan parsial atau sinonim
        for (const cat in grouped) {
            if (cleanName.includes(cat) || cat.includes(cleanName)) {
                targetCategory = cat;
                break;
            }
        }
    }

    if (!targetCategory || !grouped[targetCategory] || grouped[targetCategory].items.length === 0) {
        return false;
    }

    const items = grouped[targetCategory].items;
    const chosen = items[Math.floor(Math.random() * items.length)];

    const fullPath = path.isAbsolute(chosen.file)
        ? chosen.file
        : path.join(__dirname, '..', chosen.file);

    if (!fs.existsSync(fullPath)) {
        console.error(`[expressionManager] File stiker tidak ditemukan: ${fullPath}`);
        return false;
    }

    const stickerBuffer = fs.readFileSync(fullPath);

    // Jeda alami sedikit (1.0 - 1.8 detik) sebelum mengirim stiker
    const delayMs = 1000 + Math.floor(Math.random() * 800);
    await new Promise(r => setTimeout(r, delayMs));

    try {
        await bob.sendMessage(m.chat, { sticker: stickerBuffer });
        return true;
    } catch (err) {
        console.error('[expressionManager] Gagal mengirim stiker ekspresi:', err);
        return false;
    }
}

module.exports = {
    getExpressions,
    addExpression,
    deleteExpression,
    getGroupedExpressions,
    matchExpression,
    maybeSendExpressionSticker,
    sendExpressionByName
};
