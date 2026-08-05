const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.gsmarena.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Search smartphones on GSMArena
 * @param {string} query 
 * @returns {Promise<Array<{id: number, title: string, img: string, slug: string}>>}
 */
async function searchSmartphone(query) {
    try {
        const { data } = await axios.get(`${BASE_URL}/quicksearch-82682.jpg`, {
            headers: { 'User-Agent': USER_AGENT }
        });

        if (!Array.isArray(data) || data.length < 2) return [];

        const brands = data[0] || {};
        const phones = data[1] || [];
        const q = query.toLowerCase().trim();

        const results = [];
        for (const p of phones) {
            const brandName = brands[p[0]] || '';
            const modelName = p[5] || p[2] || '';
            const fullName = `${brandName} ${modelName}`.trim();
            const searchTag = (p[3] || '').toString();

            if (fullName.toLowerCase().includes(q) || searchTag.toLowerCase().includes(q)) {
                const img = p[4] ? `https://fdn2.gsmarena.com/vv/bigpic/${p[4]}` : '';
                results.push({
                    id: p[1],
                    title: fullName,
                    img: img,
                    slug: p[4] ? p[4].replace(/\.jpg$/, '') : ''
                });
            }
            if (results.length >= 10) break;
        }

        return results;
    } catch (err) {
        console.error('Error searching smartphone GSMArena:', err.message);
        return [];
    }
}

/**
 * Get detailed specifications of a smartphone
 * @param {string|number} urlOrId - Full URL or Phone ID/slug
 */
async function getSmartphoneDetail(urlOrId) {
    try {
        let targetUrl = String(urlOrId || '');
        if (!targetUrl.startsWith('http')) {
            if (/^\d+$/.test(targetUrl)) {
                const searchRes = await axios.get(`${BASE_URL}/results.php3?sQuickSearch=yes&sName=${targetUrl}`, {
                    headers: { 'User-Agent': USER_AGENT }
                });
                const $s = cheerio.load(searchRes.data);
                const firstLink = $s('.makers li a').attr('href');
                if (firstLink) {
                    targetUrl = `${BASE_URL}/${firstLink}`;
                } else {
                    // Fallback to quicksearch match for ID
                    const qs = await axios.get(`${BASE_URL}/quicksearch-82682.jpg`, {
                        headers: { 'User-Agent': USER_AGENT }
                    });
                    const phones = qs.data[1] || [];
                    const found = phones.find(p => String(p[1]) === String(targetUrl));
                    if (found && found[4]) {
                        const brand = qs.data[0][found[0]] || '';
                        const model = (found[5] || found[2]).toLowerCase().replace(/[^a-z0-9]+/g, '_');
                        targetUrl = `${BASE_URL}/${brand.toLowerCase()}_${model}-${found[1]}.php`;
                    } else {
                        throw new Error('Phone page not found for ID: ' + targetUrl);
                    }
                }
            } else if (!targetUrl.endsWith('.php')) {
                targetUrl = `${BASE_URL}/${targetUrl}.php`;
            } else {
                targetUrl = `${BASE_URL}/${targetUrl}`;
            }
        }

        const { data } = await axios.get(targetUrl, {
            headers: { 'User-Agent': USER_AGENT }
        });

        const $ = cheerio.load(data);
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
    } catch (err) {
        console.error('Error getting smartphone detail:', err.message);
        throw err;
    }
}

module.exports = {
    searchSmartphone,
    getSmartphoneDetail
};
