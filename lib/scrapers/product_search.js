const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * Deteksi visual barang dari URL gambar menggunakan Yandex Visual Search
 * @param {string} imageUrl 
 * @returns {Promise<string[]>}
 */
async function detectVisualTags(imageUrl) {
    if (!imageUrl) return [];
    try {
        const yandexUrl = 'https://yandex.com/images/search?rpt=imageview&url=' + encodeURIComponent(imageUrl);
        const res = await axios.get(yandexUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
            },
            timeout: 12000
        });

        const $ = cheerio.load(res.data);
        const rawTags = [];
        $('.Tags-Item, .CbirTags-Item, .Tags a, .CbirTags a, .Button2_view_tag').each((_, el) => {
            rawTags.push($(el).text().trim());
        });

        // Filter tag resolusi (500x500 dll) dan huruf Cyrillic/Rusia
        const cleanTags = rawTags.filter(t => t && !/^\d+×\d+$/.test(t) && !/[а-яА-Я]/.test(t));
        return cleanTags;
    } catch (err) {
        console.error('[detectVisualTags Error]:', err.message);
        return [];
    }
}

/**
 * Mencari pratinjau gambar produk e-commerce (Shopee, Tokopedia, Lazada)
 * @param {string} query 
 * @returns {Promise<string[]>}
 */
async function fetchProductPreviewImages(query) {
    if (!query) return [];
    try {
        const res = await axios.get('https://api.siputzx.my.id/api/s/bimg', {
            params: { query: `${query} shopee tokopedia lazada` },
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });

        const images = res.data?.data || [];
        if (Array.isArray(images) && images.length > 0) {
            return images.filter(url => typeof url === 'string' && url.startsWith('http'));
        }
    } catch (e) {
        console.error('[fetchProductPreviewImages bimg Error]:', e.message);
    }

    // Fallback pencarian gambar via Brave
    try {
        const braveRes = await axios.get('https://api.siputzx.my.id/api/s/brave', {
            params: { query: `${query} harga tokopedia shopee` },
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });
        const results = braveRes.data?.data?.results || [];
        const braveImgs = results.map(r => r.imageUrl).filter(Boolean);
        if (braveImgs.length > 0) return braveImgs;
    } catch (e) {}

    return [];
}

/**
 * Format string harga ke format Rupiah standar
 * @param {string|number} val 
 * @returns {string}
 */
function formatRupiah(val) {
    if (!val) return '';
    if (typeof val === 'string' && val.includes('Rp')) return val.replace(/\s+/g, ' ');
    const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return '';
    return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Mencari harga barang serupa di berbagai marketplace (Shopee, Tokopedia, Lazada, dll)
 * @param {Object} params
 * @param {string} params.imageUrl URL gambar publik barang
 * @param {string} [params.extraQuery] Kata kunci tambahan dari caption user
 * @returns {Promise<Object>}
 */
async function searchProductByImage({ imageUrl, extraQuery = '' }) {
    let detectedTags = [];
    if (imageUrl) {
        detectedTags = await detectVisualTags(imageUrl);
    }

    // Tentukan kata kunci pencarian terbaik
    let bestProductTitle = '';
    const cleanExtra = (extraQuery || '').replace(/^[#.!/]+(cekharga|hargabarang|cek-harga|cekproduk)\s*/i, '').trim();

    if (cleanExtra && cleanExtra.length > 1) {
        bestProductTitle = cleanExtra;
    } else if (detectedTags.length > 0) {
        bestProductTitle = detectedTags[0];
    } else {
        bestProductTitle = 'Barang Serupa';
    }

    // Ambil gambar pratinjau produk dari marketplace
    const previewImages = await fetchProductPreviewImages(bestProductTitle);
    const primaryPreview = previewImages[0] || imageUrl || null;

    // Link pencarian langsung per marketplace
    const encodedQ = encodeURIComponent(bestProductTitle);
    const marketplaceLinks = {
        shopee: `https://shopee.co.id/search?keyword=${encodedQ}`,
        tokopedia: `https://www.tokopedia.com/search?st=product&q=${encodedQ}`,
        lazada: `https://www.lazada.co.id/tag/${encodedQ}/`,
        blibli: `https://www.blibli.com/cari/${encodedQ}`
    };

    // Ambil data harga dan listing dari DuckDuckGo
    let marketplaceItems = [];
    try {
        const ddgRes = await axios.get('https://api.siputzx.my.id/api/s/duckduckgo', {
            params: { query: `harga ${bestProductTitle} site:tokopedia.com OR site:shopee.co.id OR site:lazada.co.id` },
            headers: { 'User-Agent': USER_AGENT },
            timeout: 12000
        });

        const results = ddgRes.data?.data?.results || [];
        for (const item of results) {
            const title = (item.title || '').trim();
            const snippet = (item.snippet || '').trim();
            const url = item.url || '';
            const allText = `${title} ${snippet}`;

            // Ekstrak harga Rp
            const priceMatches = allText.match(/Rp\s?[\d\.\,]+/gi);
            let market = 'E-Commerce';
            if (/tokopedia/i.test(url) || /tokopedia/i.test(title)) market = 'Tokopedia';
            else if (/shopee/i.test(url) || /shopee/i.test(title)) market = 'Shopee';
            else if (/lazada/i.test(url) || /lazada/i.test(title)) market = 'Lazada';
            else if (/blibli/i.test(url) || /blibli/i.test(title)) market = 'Blibli';

            marketplaceItems.push({
                market,
                title: title.slice(0, 75),
                price: priceMatches ? priceMatches[0].replace(/\s+/g, ' ') : null,
                url,
                snippet: snippet.slice(0, 100)
            });
        }
    } catch (e) {
        console.error('[searchProductByImage DDG Error]:', e.message);
    }

    // Fallback pencarian marketplace via Brave jika DuckDuckGo kosong/error
    if (marketplaceItems.length === 0) {
        try {
            const braveRes = await axios.get('https://api.siputzx.my.id/api/s/brave', {
                params: { query: `harga ${bestProductTitle} tokopedia shopee lazada` },
                headers: { 'User-Agent': USER_AGENT },
                timeout: 10000
            });
            const bResults = braveRes.data?.data?.results || [];
            for (const item of bResults) {
                const title = (item.title || '').trim();
                const url = item.url || '';
                const allText = `${title} ${item.snippet || ''}`;
                const priceMatches = allText.match(/Rp\s?[\d\.\,]+/gi);
                let market = 'E-Commerce';
                if (/tokopedia/i.test(url) || /tokopedia/i.test(title)) market = 'Tokopedia';
                else if (/shopee/i.test(url) || /shopee/i.test(title)) market = 'Shopee';
                else if (/lazada/i.test(url) || /lazada/i.test(title)) market = 'Lazada';

                marketplaceItems.push({
                    market,
                    title: title.slice(0, 75),
                    price: priceMatches ? priceMatches[0].replace(/\s+/g, ' ') : null,
                    url: url || (market === 'Tokopedia' ? marketplaceLinks.tokopedia : marketplaceLinks.shopee),
                    snippet: item.snippet || ''
                });
            }
        } catch (e) {}
    }

    // Ambil harga yang terdeteksi
    const foundPrices = [];
    for (const it of marketplaceItems) {
        if (it.price) {
            const num = parseInt(it.price.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > 1000 && num < 500000000) {
                foundPrices.push(num);
            }
        }
    }

    let priceRangeStr = 'Tersedia di Marketplace';
    if (foundPrices.length > 0) {
        foundPrices.sort((a, b) => a - b);
        const minP = foundPrices[0];
        const maxP = foundPrices[foundPrices.length - 1];
        if (minP === maxP) {
            priceRangeStr = `Sekitar Rp ${minP.toLocaleString('id-ID')}`;
        } else {
            priceRangeStr = `Rp ${minP.toLocaleString('id-ID')} s/d Rp ${maxP.toLocaleString('id-ID')}`;
        }
    }

    // Estimasi harga per marketplace
    const shopeeItem = marketplaceItems.find(i => i.market === 'Shopee' && i.price);
    const tokopediaItem = marketplaceItems.find(i => i.market === 'Tokopedia' && i.price);
    const lazadaItem = marketplaceItems.find(i => i.market === 'Lazada' && i.price);

    return {
        success: true,
        productName: bestProductTitle,
        detectedTags,
        previewImage: primaryPreview,
        previewImages: previewImages.slice(0, 4),
        priceRange: priceRangeStr,
        shopee: {
            price: shopeeItem?.price || 'Cek di Aplikasi',
            url: shopeeItem?.url || marketplaceLinks.shopee
        },
        tokopedia: {
            price: tokopediaItem?.price || 'Cek di Aplikasi',
            url: tokopediaItem?.url || marketplaceLinks.tokopedia
        },
        lazada: {
            price: lazadaItem?.price || 'Cek di Aplikasi',
            url: lazadaItem?.url || marketplaceLinks.lazada
        },
        blibli: {
            url: marketplaceLinks.blibli
        },
        marketplaceItems: marketplaceItems.slice(0, 5)
    };
}

module.exports = {
    detectVisualTags,
    fetchProductPreviewImages,
    formatRupiah,
    searchProductByImage
};
