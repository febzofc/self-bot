const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.gsmarena.com';

// User-Agent & Cookie yang diberikan oleh pengguna
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';
const DEFAULT_COOKIE = 'sLoginCookie=1244265.6aa37769db01d';

function getHeaders() {
    const ua = global.gsmarenaUserAgent || process.env.GSMARENA_USER_AGENT || DEFAULT_USER_AGENT;
    const cookie = global.gsmarenaCookie || process.env.GSMARENA_COOKIE || DEFAULT_COOKIE;
    return {
        'User-Agent': ua,
        'Cookie': cookie,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': BASE_URL
    };
}

/**
 * Scrape dari Carisinyal (Database HP Indonesia terupdate, gambar HD, harga Rupiah)
 */
async function searchCarisinyal(query) {
    try {
        const res = await axios.get(`https://carisinyal.com/hp/?s=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 10000
        });

        const $ = cheerio.load(res.data);
        const resultsMap = new Map();

        $('a').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (href.startsWith('https://carisinyal.com/hp/') && !href.endsWith('/hp/') && !href.includes('?')) {
                const slug = href.replace('https://carisinyal.com/hp/', '').replace(/\/$/, '');
                if (!slug) return;

                let existing = resultsMap.get(slug) || { id: `cs_${slug}`, title: '', img: '', slug, href };

                // Ambil judul
                const text = $(el).text().trim();
                if (text && text !== 'Spesifikasi' && text.length > 2 && !existing.title) {
                    existing.title = text;
                }

                // Ambil gambar dari background-image
                const html = $(el).html() || '';
                const bgMatch = html.match(/background-image:\s*url\(([^)]+)\)/i);
                if (bgMatch && !existing.img) {
                    existing.img = bgMatch[1].replace(/["']/g, '').trim();
                }

                // Ambil gambar dari tag img
                const imgSrc = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
                if (imgSrc && !imgSrc.startsWith('data:') && !existing.img) {
                    existing.img = imgSrc;
                }

                // Cek H2 di parent
                if (!existing.title) {
                    const parentH2 = $(el).parents().filter((_, p) => $(p).find('h2').length > 0).first().find('h2').text().trim();
                    if (parentH2) existing.title = parentH2;
                }

                // Cek IMG di parent
                if (!existing.img) {
                    const parentImg = $(el).parents().filter((_, p) => $(p).find('img').length > 0).first().find('img');
                    const pSrc = parentImg.attr('data-src') || parentImg.attr('src');
                    if (pSrc && !pSrc.startsWith('data:')) existing.img = pSrc;
                }

                resultsMap.set(slug, existing);
            }
        });

        const list = Array.from(resultsMap.values()).map(item => {
            if (!item.title) {
                item.title = item.slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
            return item;
        });

        return list.slice(0, 10);
    } catch (err) {
        console.error('Carisinyal search error:', err.message);
        return [];
    }
}

/**
 * Ambil detail spesifikasi HP dari Carisinyal
 */
async function getCarisinyalDetail(slug) {
    try {
        const cleanSlug = slug.replace(/^cs_/, '');
        const targetUrl = `https://carisinyal.com/hp/${cleanSlug}/`;
        const res = await axios.get(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 10000
        });

        const $ = cheerio.load(res.data);
        const title = $('h1').first().text().trim() || cleanSlug.replace(/-/g, ' ').toUpperCase();

        // Ambil foto produk utama
        let img = '';
        $('img').each((_, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src') || '';
            if (src && (src.endsWith('.webp') || src.endsWith('.jpg') || src.endsWith('.png')) &&
                !src.includes('banner') && !src.includes('logo') && !src.includes('iklan')) {
                img = src;
                return false;
            }
        });

        // Parse tabel spesifikasi Carisinyal
        const rawSpecs = {};
        let currentCat = 'UMUM';

        $('.ct-text-block, .box-info').each((_, el) => {
            if ($(el).hasClass('ct-text-block')) {
                const cat = $(el).text().trim();
                if (cat && cat.length < 30 && cat === cat.toUpperCase()) {
                    currentCat = cat;
                    if (!rawSpecs[currentCat]) rawSpecs[currentCat] = {};
                }
            } else if ($(el).hasClass('box-info')) {
                $(el).find('.box-baris').each((_, baris) => {
                    const k = $(baris).find('.kolom-satu').text().trim();
                    const v = $(baris).find('.kolom-dua').text().trim();
                    if (k && v) {
                        if (!rawSpecs[currentCat]) rawSpecs[currentCat] = {};
                        rawSpecs[currentCat][k] = v;
                    }
                });
            }
        });

        // Format ke standar render bot
        const specs = {
            'Platform': {
                'OS': rawSpecs['FITUR']?.['OS (Saat Rilis)'] || rawSpecs['UMUM']?.['OS'] || '',
                'Chipset': rawSpecs['HARDWARE']?.['Chipset'] || '',
                'CPU': rawSpecs['HARDWARE']?.['CPU'] || '',
                'GPU': rawSpecs['HARDWARE']?.['GPU'] || ''
            },
            'Memory': {
                'Internal': rawSpecs['MEMORI']?.['Memori Internal'] ? `${rawSpecs['MEMORI']?.['RAM'] || ''} / ${rawSpecs['MEMORI']?.['Memori Internal']}` : (rawSpecs['MEMORI']?.['RAM'] || ''),
                'Card slot': rawSpecs['MEMORI']?.['Memori Eksternal'] || ''
            },
            'Display': {
                'Type': rawSpecs['LAYAR']?.['Jenis'] || '',
                'Size': rawSpecs['LAYAR']?.['Ukuran'] ? `${rawSpecs['LAYAR']?.['Ukuran']} (${rawSpecs['LAYAR']?.['Refresh Rate'] || ''})` : '',
                'Resolution': rawSpecs['LAYAR']?.['Resolusi'] || ''
            },
            'Main Camera': {
                'Triple': rawSpecs['KAMERA UTAMA']?.['Konfigurasi'] ? rawSpecs['KAMERA UTAMA']?.['Konfigurasi'].replace(/\s+/g, ' ') : (rawSpecs['KAMERA UTAMA']?.['Jumlah Kamera'] || ''),
                'Video': rawSpecs['KAMERA UTAMA']?.['Fitur'] || ''
            },
            'Selfie camera': {
                'Single': rawSpecs['KAMERA DEPAN']?.['Konfigurasi'] ? rawSpecs['KAMERA DEPAN']?.['Konfigurasi'].replace(/\s+/g, ' ') : '',
                'Video': rawSpecs['KAMERA DEPAN']?.['Fitur'] || ''
            },
            'Battery': {
                'Type': rawSpecs['BATERAI']?.['Kapasitas'] ? `${rawSpecs['BATERAI']?.['Kapasitas']} (${rawSpecs['BATERAI']?.['Jenis'] || ''})` : '',
                'Charging': rawSpecs['BATERAI']?.['Fitur Lainnya'] || ''
            },
            'Body': {
                'Dimensions': rawSpecs['BODY']?.['Dimensi'] || '',
                'Weight': rawSpecs['BODY']?.['Berat'] || '',
                'SIM': rawSpecs['UMUM']?.['SIM Card'] ? `${rawSpecs['UMUM']?.['SIM Card']} (eSIM: ${rawSpecs['UMUM']?.['eSIM'] || 'Tidak'})` : ''
            },
            'Misc': {
                'Price': '-'
            }
        };

        return {
            title,
            img,
            url: targetUrl,
            specs
        };
    } catch (err) {
        console.error('Carisinyal detail error:', err.message);
        throw err;
    }
}

/**
 * Search smartphones on GSMArena (dengan fallback otomatis ke Carisinyal)
 * @param {string} query 
 * @returns {Promise<Array<{id: string, title: string, img: string, slug: string}>>}
 */
async function searchSmartphone(query) {
    // 1. Coba GSMArena terlebih dahulu
    try {
        const res = await axios.get(`${BASE_URL}/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(query)}`, {
            headers: getHeaders(),
            timeout: 6000
        });

        if (res.data && !res.data.includes('turnstile') && !res.data.includes('Turnstile')) {
            const $ = cheerio.load(res.data);
            const results = [];
            $('.makers ul li').each((_, el) => {
                const link = $(el).find('a');
                const href = link.attr('href');
                const img = $(el).find('img').attr('src');
                const title = $(el).find('span').html() ? $(el).find('span').html().split('<br>').join(' ') : link.text().trim();
                if (href) {
                    const id = href.replace(/\.php$/, '');
                    results.push({
                        id: id,
                        title: title.trim(),
                        img: img || '',
                        slug: id
                    });
                }
            });

            if (results.length > 0) return results;
        }
    } catch (err) {
        // Lanjutkan ke fallback jika GSMArena diblokir / error
    }

    // 2. Fallback ke Carisinyal
    return await searchCarisinyal(query);
}

/**
 * Get detailed specifications of a smartphone
 * @param {string|number} urlOrId - Full URL or Phone ID/slug
 */
async function getSmartphoneDetail(urlOrId) {
    const idStr = String(urlOrId || '');
    if (idStr.startsWith('cs_') || idStr.includes('carisinyal.com')) {
        return await getCarisinyalDetail(idStr);
    }

    // Coba GSMArena
    try {
        let targetUrl = idStr;
        if (!targetUrl.startsWith('http')) {
            targetUrl = `${BASE_URL}/${targetUrl}.php`;
        }
        const res = await axios.get(targetUrl, {
            headers: getHeaders(),
            timeout: 6000
        });

        if (res.data && !res.data.includes('turnstile') && !res.data.includes('Turnstile')) {
            const $ = cheerio.load(res.data);
            const title = $('.specs-phone-name-title').text().trim() || $('h1.specs-phone-name-title').text().trim();
            const img = $('.specs-photo-main img').attr('src') || '';

            const specs = {};
            $('table').each((_, table) => {
                const category = $(table).find('th').text().trim();
                if (!category) return;
                specs[category] = {};
                $(table).find('tr').each((_, tr) => {
                    const key = $(tr).find('td.ttl').text().trim() || 'Details';
                    const val = $(tr).find('td.nfo').text().trim();
                    if (val) {
                        specs[category][key] = val;
                    }
                });
            });

            return {
                title,
                img,
                url: targetUrl,
                specs
            };
        }
    } catch (err) {
        // fallback
    }

    // Fallback ke Carisinyal
    return await getCarisinyalDetail(idStr);
}

module.exports = {
    searchSmartphone,
    getSmartphoneDetail
};
