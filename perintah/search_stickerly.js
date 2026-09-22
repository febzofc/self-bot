const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { writeExif } = require('../lib/exif.js');

// Cache sesi pilihan per chat (chatId -> { query, results, timestamp })
global.stickerlySession = global.stickerlySession || new Map();
// Cache hasil pencarian query global untuk menghemat kuota dan mempercepat respon
global.stickerlySearchCache = global.stickerlySearchCache || new Map();

const SESSION_TTL = 15 * 60 * 1000; // 15 menit
const SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 jam

const STICKERLY_HEADERS = {
    'User-Agent': 'androidapp.stickerly/2.16.0 (Linux; U; Android 12; Pixel 6 Build/SD1A.210817.037)',
    'Content-Type': 'application/json'
};

const WEB_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://sticker.ly/'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mencari paket stiker langsung melalui API resmi Sticker.ly
 * dengan fallback ke API alternatif / scraper
 */
async function searchStickerPacks(keyword) {
    const cleanKey = keyword.trim().toLowerCase();
    const cached = global.stickerlySearchCache.get(cleanKey);
    if (cached && (Date.now() - cached.timestamp < SEARCH_CACHE_TTL)) {
        return cached.results;
    }

    // 1. Coba API internal Sticker.ly langsung (cepat, tanpa batasan Cloudflare pihak ketiga)
    try {
        const res = await axios.post('http://api.sticker.ly/v3.1/stickerPack/search', {
            keyword: cleanKey,
            size: 20
        }, {
            headers: STICKERLY_HEADERS,
            timeout: 10000
        });

        const packs = res.data?.result?.stickerPacks;
        if (Array.isArray(packs) && packs.length > 0) {
            const formatted = packs.map(p => ({
                title: (p.name || 'Tanpa Judul').trim(),
                creator: (p.authorName || p.user?.userName || '-').trim(),
                packId: p.packId,
                url: p.shareUrl || `https://sticker.ly/s/${p.packId}`,
                animated: !!(p.animated || p.isAnimated),
                resourceUrlPrefix: p.resourceUrlPrefix || '',
                resourceFiles: Array.isArray(p.resourceFiles) ? p.resourceFiles : []
            }));

            global.stickerlySearchCache.set(cleanKey, {
                results: formatted,
                timestamp: Date.now()
            });

            return formatted;
        }
    } catch (e) {
        console.warn('[Stickerly API Search]: Primary API failed:', e.message);
    }

    // 2. Fallback ke API sekunder jika API utama mengalami kendala
    try {
        const apiUrl = `https://api-faa.my.id/faa/stickerly?q=${encodeURIComponent(cleanKey)}`;
        const res = await axios.get(apiUrl, {
            headers: WEB_HEADERS,
            timeout: 12000
        });

        if (res.data && res.data.status && Array.isArray(res.data.results) && res.data.results.length > 0) {
            const formatted = res.data.results.map(p => {
                const match = (p.url || '').match(/sticker\.ly\/s\/([a-zA-Z0-9_-]+)/i);
                return {
                    title: (p.title || 'Tanpa Judul').trim(),
                    creator: (p.creator || '-').trim(),
                    packId: match ? match[1] : '',
                    url: p.url,
                    animated: false,
                    resourceUrlPrefix: '',
                    resourceFiles: []
                };
            });

            global.stickerlySearchCache.set(cleanKey, {
                results: formatted,
                timestamp: Date.now()
            });

            return formatted;
        }
    } catch (e) {
        console.warn('[Stickerly API Search]: Secondary API failed:', e.message);
    }

    return [];
}

/**
 * Mengambil detail stiker dari packId atau URL paket Sticker.ly
 */
async function getPackDetails(packIdOrUrl) {
    let packId = packIdOrUrl;
    const match = packIdOrUrl.match(/sticker\.ly\/s\/([a-zA-Z0-9_-]+)/i);
    if (match) packId = match[1];

    // 1. Coba ambil detail melalui API resmi Sticker.ly
    if (packId && /^[a-zA-Z0-9_-]+$/.test(packId)) {
        try {
            const res = await axios.get(`http://api.sticker.ly/v3.1/stickerPack/${packId}`, {
                headers: STICKERLY_HEADERS,
                timeout: 10000
            });

            const pack = res.data?.result;
            if (pack && Array.isArray(pack.stickers) && pack.stickers.length > 0) {
                const prefix = pack.resourceUrlPrefix || '';
                return {
                    title: (pack.name || 'Sticker.ly Pack').trim(),
                    creator: (pack.authorName || '-').trim(),
                    packId: pack.packId || packId,
                    url: pack.shareUrl || `https://sticker.ly/s/${packId}`,
                    animated: !!(pack.animated || pack.isAnimated),
                    stickers: pack.stickers.map(s => ({
                        url: `${prefix}${s.fileName}`,
                        isWebp: s.fileName.endsWith('.webp')
                    }))
                };
            }
        } catch (e) {
            console.warn(`[Stickerly Pack Detail]: API error for ${packId}:`, e.message);
        }
    }

    // 2. Fallback web scraper halaman web Sticker.ly
    const targetUrl = packIdOrUrl.startsWith('http') ? packIdOrUrl : `https://sticker.ly/s/${packId}`;
    try {
        const res = await axios.get(targetUrl, {
            headers: WEB_HEADERS,
            timeout: 15000
        });

        const $ = cheerio.load(res.data);
        const title = $('meta[property="og:title"]').attr('content') || $('title').text().replace(' - Sticker.ly', '').trim();
        const creator = $('.sticker_author').text().trim() || '-';

        const stickers = [];
        $('img.sticker_img').each((_, el) => {
            const src = $(el).attr('src') || '';
            const onerror = $(el).attr('onerror') || '';
            let finalUrl = '';
            let isWebp = false;

            // Jika onerror memiliki fallback .png, prioritaskan karena webp static pada CDN stickerly mengembalikan 404
            const matchPng = onerror.match(/src=['"]([^'"]+\.png)['"]/i);
            if (matchPng && matchPng[1]) {
                finalUrl = matchPng[1];
                isWebp = false;
            } else if (src.endsWith('.webp')) {
                finalUrl = src;
                isWebp = true;
            } else if (src) {
                finalUrl = src;
                isWebp = src.endsWith('.webp');
            }

            if (finalUrl && !stickers.some(s => s.url === finalUrl)) {
                stickers.push({ url: finalUrl, isWebp });
            }
        });

        if (stickers.length > 0) {
            return {
                title: title || 'Sticker.ly Pack',
                creator,
                packId,
                url: targetUrl,
                animated: stickers.some(s => s.isWebp),
                stickers
            };
        }
    } catch (e) {
        console.warn(`[Stickerly Scraper]: Web scrape error for ${targetUrl}:`, e.message);
    }

    return null;
}

/**
 * Mengunduh buffer berkas stiker
 */
async function fetchStickerBuffer(stickerObj) {
    if (!stickerObj || !stickerObj.url) return null;
    try {
        const res = await axios.get(stickerObj.url, {
            responseType: 'arraybuffer',
            headers: WEB_HEADERS,
            timeout: 15000
        });

        if (res.status === 200 && res.data && res.data.length > 0) {
            return {
                buffer: Buffer.from(res.data),
                isWebp: stickerObj.isWebp
            };
        }
    } catch (_) {}
    return null;
}

/**
 * Mengonversi buffer stiker ke format WhatsApp dengan metadata EXIF
 */
async function createStickerWebp(rawBuffer, isWebp, packname, author) {
    const mediaObj = {
        data: rawBuffer,
        mimetype: isWebp ? 'image/webp' : 'image/png'
    };

    const tempFilePath = await writeExif(mediaObj, {
        packname: packname || 'Sticker.ly',
        author: author || 'WhatsApp Bot'
    });

    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
        throw new Error('Gagal menulis EXIF metadata stiker');
    }

    const stickerBuffer = fs.readFileSync(tempFilePath);
    try {
        fs.unlinkSync(tempFilePath);
    } catch (_) {}

    return stickerBuffer;
}

module.exports = {
    CmD: ['stickersearch', 'stickerly'],
    aliases: ['stickersearch', 'stickerly', 'stikersearch', 'caristiker', 'spack', 'ssearch'],
    categori: 'search',
    desc: 'Cari paket stiker di Sticker.ly dan kirim stiker langsung ke chat',
    exec: async (m, { bob, prefix, command, text }) => {
        const rawInput = (text || '').trim();

        if (!rawInput) {
            let guide = `🔍 *PENCARIAN STIKER (Sticker.ly)*\n\n`;
            guide += `Fitur ini memungkinkan Anda mencari dan mengambil stiker langsung dari platform Sticker.ly.\n\n`;
            guide += `*Cara Penggunaan:*\n`;
            guide += `• *${prefix + command} <kata kunci>*\n`;
            guide += `  Mencari paket stiker dan mengirimkan stiker contoh.\n`;
            guide += `• *${prefix + command} <kata kunci> | <jumlah>*\n`;
            guide += `  Mengambil jumlah stiker tertentu (maksimal 8 stiker).\n`;
            guide += `• *${prefix + command} <nomor paket>*\n`;
            guide += `  Mengambil stiker dari paket hasil pencarian sebelumnya di chat ini.\n`;
            guide += `• *${prefix + command} <url atau kode paket>*\n`;
            guide += `  Mengambil stiker langsung dari link atau kode paket Sticker.ly.\n\n`;
            guide += `*Contoh:*\n`;
            guide += `• *${prefix + command} jomok*\n`;
            guide += `• *${prefix + command} jomok | 5*\n`;
            guide += `• *${prefix + command} https://sticker.ly/s/20R2PO*\n`;
            guide += `• *${prefix + command} 20R2PO*\n`;
            guide += `• *${prefix + command} 2* (jika sudah ada hasil pencarian)`;
            return m.reply(guide);
        }

        // Parsing opsi pemisah jumlah |
        let inputTarget = rawInput;
        let requestedCount = 3;

        if (inputTarget.includes('|')) {
            const parts = inputTarget.split('|');
            inputTarget = parts[0].trim();
            const parsedCount = parseInt(parts[1].trim(), 10);
            if (!isNaN(parsedCount) && parsedCount > 0) {
                requestedCount = Math.min(Math.max(parsedCount, 1), 8);
            }
        }

        // Cek apakah input berupa tautan langsung Sticker.ly
        const isUrl = /^https?:\/\/(?:www\.)?sticker\.ly\/s\/[a-zA-Z0-9_-]+/i.test(inputTarget);

        // Cek apakah input berupa nomor pilihan dari sesi sebelumnya
        const isPureNumber = /^#?(\d+)$/.test(inputTarget);
        const session = global.stickerlySession.get(m.chat);
        const hasValidSession = session && (Date.now() - session.timestamp <= SESSION_TTL);

        let targetPackIdent = '';
        let targetPackTitle = '';
        let targetPackCreator = '';

        if (isUrl) {
            targetPackIdent = inputTarget;
            targetPackTitle = 'Sticker.ly Pack';
        } else if (isPureNumber && hasValidSession) {
            const choiceIndex = parseInt(inputTarget.replace(/^#/, ''), 10) - 1;
            if (choiceIndex < 0 || choiceIndex >= session.results.length) {
                return m.reply(`❌ Nomor pilihan tidak valid. Pilih nomor antara *1* sampai *${session.results.length}*.`);
            }

            const chosen = session.results[choiceIndex];
            targetPackIdent = chosen.packId || chosen.url;
            targetPackTitle = chosen.title;
            targetPackCreator = chosen.creator;
        } else if (/^[a-zA-Z0-9_-]{5,8}$/.test(inputTarget) && /[A-Z]/.test(inputTarget) && /[0-9]/.test(inputTarget)) {
            // Jika formatnya menyerupai kode paket (misal 20R2PO, KBP6QW, NF7AD1)
            targetPackIdent = inputTarget;
            targetPackTitle = `Sticker.ly [${inputTarget}]`;
        }

        // Jika belum ada target pack, jalankan pencarian
        if (!targetPackIdent) {
            await m.reply('⏳ *Mencari stiker di Sticker.ly...*\nMohon tunggu sebentar.');

            const results = await searchStickerPacks(inputTarget);
            if (!results || results.length === 0) {
                return m.reply(`❌ Paket stiker untuk kata kunci *"${inputTarget}"* tidak ditemukan.`);
            }

            // Simpan sesi pencarian per chat
            global.stickerlySession.set(m.chat, {
                query: inputTarget,
                results: results,
                timestamp: Date.now()
            });

            const topPacks = results.slice(0, 7);
            let replyText = `📦 *HASIL PENCARIAN STIKER*\n\n`;
            replyText += `🔍 *Kata Kunci:* "${inputTarget}"\n`;
            replyText += `📊 *Ditemukan:* ${results.length} paket stiker\n\n`;
            replyText += `*Daftar Paket Teratas:*\n`;

            topPacks.forEach((pack, index) => {
                const pTitle = (pack.title || 'Tanpa Judul').trim();
                const pCreator = pack.creator && pack.creator !== '-' ? `@${pack.creator}` : '-';
                const animBadge = pack.animated ? ' [Animasi]' : '';
                replyText += `*${index + 1}.* *${pTitle}*${animBadge}\n`;
                replyText += `   👤 Pembuat: ${pCreator}\n`;
                replyText += `   🔗 ${pack.url}\n\n`;
            });

            replyText += `─────────────────────────\n`;
            replyText += `💡 *Tips:*\n`;
            replyText += `• Ketik *${prefix + command} <nomor>* untuk mengambil stiker dari paket lain (cth: *${prefix + command} 2*).\n`;
            replyText += `• Kirim tautan paket langsung untuk download: *${prefix + command} <url>*.\n\n`;
            replyText += `⏳ _Sedang mengirimkan ${requestedCount} stiker contoh dari paket #1..._`;

            await m.reply(replyText);

            targetPackIdent = results[0].packId || results[0].url;
            targetPackTitle = results[0].title;
            targetPackCreator = results[0].creator;
        } else {
            await m.reply(`⏳ *Mengambil stiker dari paket:* ${targetPackTitle || targetPackIdent}\nMohon tunggu...`);
        }

        // Ambil data isi paket stiker
        try {
            const packData = await getPackDetails(targetPackIdent);
            if (!packData || !packData.stickers || packData.stickers.length === 0) {
                return m.reply('❌ Tidak dapat menemukan berkas stiker di dalam paket tersebut.');
            }

            const stickerList = packData.stickers;
            // Ambil acak stiker sesuai jumlah permintaan
            const shuffled = [...stickerList].sort(() => 0.5 - Math.random());
            const selectedStickers = shuffled.slice(0, requestedCount);

            const packname = (targetPackTitle || packData.title || 'Sticker.ly').trim();
            const author = (targetPackCreator || packData.creator) && (targetPackCreator || packData.creator) !== '-'
                ? `${targetPackCreator || packData.creator} • ${global.author || 'WhatsApp Bot'}`
                : (global.author || 'WhatsApp Bot');

            let sentCount = 0;
            for (const item of selectedStickers) {
                try {
                    const fetched = await fetchStickerBuffer(item);
                    if (!fetched || !fetched.buffer) continue;

                    const webpBuffer = await createStickerWebp(fetched.buffer, fetched.isWebp, packname, author);
                    await bob.sendMessage(m.chat, { sticker: webpBuffer }, { quoted: m });
                    sentCount++;

                    // Jeda sejenak antar stiker agar tidak flooding
                    if (sentCount < selectedStickers.length) {
                        await delay(800);
                    }
                } catch (sendErr) {
                    console.error('[Sticker Send Error]:', sendErr.message);
                }
            }

            if (sentCount === 0) {
                return m.reply('❌ Gagal mengunduh stiker dari paket tersebut. Silakan coba paket lainnya.');
            }
        } catch (err) {
            console.error('[Stickerly Exec Error]:', err.message);
            return m.reply('❌ Terjadi kesalahan saat memproses paket stiker. Silakan coba sesaat lagi.');
        }
    }
};
