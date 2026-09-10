const axios = require('axios');

const API_URL = 'https://api-faa.my.id/faa/jadwal-bola';
const CACHE_TTL_MS = 60 * 1000; // 1 Menit Cache

let cacheData = null;
let cacheTime = 0;

/**
 * Mengambil jadwal pertandingan sepak bola dari API Faa (OneFootball)
 * @param {boolean} forceRefresh - Paksa ambil data baru tanpa memakai cache
 * @returns {Promise<Array>} Array daftar pertandingan
 */
async function fetchJadwalBola(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cacheData && (now - cacheTime < CACHE_TTL_MS)) {
        return cacheData;
    }

    try {
        const res = await axios.get(API_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });

        if (res.data && res.data.status && Array.isArray(res.data.data)) {
            cacheData = res.data.data;
            cacheTime = now;
            return cacheData;
        }

        if (Array.isArray(res.data)) {
            cacheData = res.data;
            cacheTime = now;
            return cacheData;
        }

        throw new Error('Format data jadwal bola tidak sesuai.');
    } catch (err) {
        // Jika cache lama masih ada, gunakan cache sebagai fallback saat API error
        if (cacheData && cacheData.length > 0) {
            return cacheData;
        }
        throw new Error(err.response?.data?.message || err.message || 'Gagal menghubungi API Jadwal Bola.');
    }
}

/**
 * Mencari pertandingan berdasarkan kata kunci (nama klub, liga, atau id)
 * @param {string} keyword - Kata kunci pencarian
 * @returns {Promise<Array>} Daftar pertandingan yang sesuai
 */
async function searchJadwalBola(keyword) {
    const allMatches = await fetchJadwalBola();
    if (!keyword || !keyword.trim()) return allMatches;

    const q = keyword.toLowerCase().trim();
    return allMatches.filter(item => {
        const matchName = (item.pertandingan || '').toLowerCase();
        const leagueName = (item.liga || '').toLowerCase();
        const matchId = (item.id || '').toString();
        const stadium = (item.stadion || '').toLowerCase();

        // Cek juga nama klub di susunan formasi jika ada
        let inFormasi = false;
        if (item.formasi && typeof item.formasi === 'object') {
            inFormasi = Object.keys(item.formasi).some(k => k.toLowerCase().includes(q));
        }

        return matchName.includes(q) || leagueName.includes(q) || matchId === q || stadium.includes(q) || inFormasi;
    });
}

/**
 * Format teks ringkas daftar jadwal pertandingan untuk pesan WhatsApp
 * @param {Array} matches - Daftar pertandingan
 * @param {string} query - Kata kunci pencarian jika ada
 * @returns {string} Pesan teks terformat
 */
function formatJadwalList(matches, query = '') {
    if (!matches || matches.length === 0) {
        return query
            ? `❌ Tidak ditemukan jadwal pertandingan dengan kata kunci: *"${query}"*`
            : `❌ Saat ini belum ada jadwal pertandingan yang tersedia.`;
    }

    let text = `⚽ *JADWAL PERTANDINGAN SEPAK BOLA* ⚽\n`;
    if (query) {
        text += `🔍 *Hasil Pencarian:* "${query}"\n`;
    }
    text += `📊 *Total Laga:* ${matches.length} Pertandingan\n`;
    text += `────────────────────────────\n\n`;

    matches.forEach((item, index) => {
        const num = index + 1;
        const liga = item.liga || 'Kompetisi';
        const match = item.pertandingan || 'Pertandingan';
        const waktu = item.waktu || '-';
        const skor = item.skor || '-';
        const status = item.status || 'Jadwal';
        const stadion = item.stadion && item.stadion !== '-' ? `\n   🏟️ *Stadion:* ${item.stadion}` : '';

        text += `*#${num}* 🏆 *${liga}*\n`;
        text += `   ⚔️ *${match}*\n`;
        text += `   ⏱️ *Waktu:* ${waktu}\n`;
        text += `   📌 *Status:* ${status}\n`;
        if (skor && skor !== '-' && !skor.includes('- - -')) {
            text += `   🎯 *Skor:* ${skor}\n`;
        }
        text += `${stadion}\n`;
        text += `────────────────────────────\n`;
    });

    text += `💡 *CARA MELIHAT DETAIL / LINE-UP:*\n`;
    text += `👉 Balas pesan ini dengan angka *1* s/d *${matches.length}* untuk melihat susunan pemain & info lengkap.\n`;
    text += `👉 Atau ketik *.jadwalbola <nama klub>* untuk mencari jadwal tim favoritmu.\n`;
    text += `👉 Ketik *exit* untuk menutup sesi.`;

    return text;
}

/**
 * Format detail lengkap 1 pertandingan (info laga, formasi kedua tim, link)
 * @param {Object} item - Data pertandingan
 * @param {number|null} index - Nomor urut pada list
 * @returns {string} Pesan detail terformat
 */
function formatJadwalDetail(item, index = null) {
    if (!item) return '❌ Data pertandingan tidak ditemukan.';

    const liga = item.liga || '-';
    const match = item.pertandingan || 'Pertandingan';
    const waktu = item.waktu || '-';
    const status = item.status || '-';
    const skor = item.skor || '-';
    const stadion = item.stadion && item.stadion !== '-' ? item.stadion : '-';
    const url = item.url || '';

    let text = `⚽ *DETAIL PERTANDINGAN SEPAK BOLA* ⚽\n`;
    if (index) text += `📌 *Nomor:* #${index}\n`;
    text += `────────────────────────────\n`;
    text += `🏆 *Kompetisi:* ${liga}\n`;
    text += `⚔️ *Pertandingan:* *${match}*\n`;
    text += `⏱️ *Waktu Kickoff:* ${waktu}\n`;
    text += `📌 *Status:* ${status}\n`;
    text += `🎯 *Skor:* ${skor}\n`;
    text += `🏟️ *Stadion:* ${stadion}\n`;
    if (url) {
        text += `🔗 *OneFootball Link:* ${url}\n`;
    }
    text += `────────────────────────────\n\n`;

    // Susunan Pemain / Formasi
    text += `👥 *SUSUNAN PEMAIN (STARTING XI):*\n\n`;

    if (item.formasi && typeof item.formasi === 'object' && Object.keys(item.formasi).length > 0) {
        const teams = Object.keys(item.formasi);
        let hasAnyPlayer = false;

        for (const team of teams) {
            const players = item.formasi[team];
            text += `🚩 *${team.toUpperCase()}*\n`;
            if (Array.isArray(players) && players.length > 0) {
                hasAnyPlayer = true;
                players.forEach((p, i) => {
                    text += `  ${i + 1}. ${p}\n`;
                });
            } else {
                text += `  _(Susunan pemain belum diumumkan / dirilis)_\n`;
            }
            text += `\n`;
        }

        if (!hasAnyPlayer) {
            text += `ℹ️ *Catatan:* Susunan pemain kedua tim saat ini belum dirilis resmi oleh panitia/klub.\n\n`;
        }
    } else {
        text += `ℹ️ _(Susunan pemain belum tersedia untuk pertandingan ini)_\n\n`;
    }

    // Statistik pertandingan jika ada
    if (Array.isArray(item.statistik) && item.statistik.length > 0) {
        text += `📊 *STATISTIK PERTANDINGAN:*\n`;
        item.statistik.forEach(st => {
            if (typeof st === 'string') {
                text += `• ${st}\n`;
            } else if (typeof st === 'object') {
                const name = st.name || st.stat || Object.keys(st)[0];
                const val = st.value || st.val || Object.values(st)[0];
                text += `• *${name}:* ${val}\n`;
            }
        });
        text += `\n`;
    }

    // Kejadian penting (gol, kartu) jika ada
    if (Array.isArray(item.kejadian) && item.kejadian.length > 0) {
        text += `⚡ *KEJADIAN PENTING:*\n`;
        item.kejadian.forEach(ev => {
            if (typeof ev === 'string') {
                text += `• ${ev}\n`;
            } else if (typeof ev === 'object') {
                const menit = ev.menit || ev.time ? `[${ev.menit || ev.time}'] ` : '';
                const desc = ev.desc || ev.kejadian || ev.event || JSON.stringify(ev);
                text += `• ${menit}${desc}\n`;
            }
        });
        text += `\n`;
    }

    text += `────────────────────────────\n`;
    text += `💡 *Ketik 'exit' untuk menutup sesi atau balas nomor lain untuk melihat laga berikutnya.*`;

    return text;
}

module.exports = {
    fetchJadwalBola,
    searchJadwalBola,
    formatJadwalList,
    formatJadwalDetail
};
