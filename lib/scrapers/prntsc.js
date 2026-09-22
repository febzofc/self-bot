const axios = require('axios');
const FormData = require('form-data');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Konversi buffer WebP ke PNG menggunakan ffmpeg
 * @param {Buffer} buffer 
 * @returns {Promise<Buffer>}
 */
async function webpToPng(buffer) {
    const randId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const tmpIn = path.join(os.tmpdir(), `prnt_${randId}.webp`);
    const tmpOut = path.join(os.tmpdir(), `prnt_${randId}.png`);

    try {
        fs.writeFileSync(tmpIn, buffer);
        await execPromise(`ffmpeg -y -i "${tmpIn}" "${tmpOut}"`);
        if (!fs.existsSync(tmpOut)) {
            throw new Error('Konversi ffmpeg gagal menghasilkan file PNG');
        }
        return fs.readFileSync(tmpOut);
    } finally {
        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
    }
}

/**
 * Upload gambar (Buffer / File Path) ke Lightshot (https://prnt.sc)
 * Mengembalikan objek link halaman prnt.sc dan link raw direct image
 *
 * @param {Buffer|string} input - Buffer gambar atau path file lokal
 * @param {Object} options - Opsi tambahan { filename, contentType }
 * @returns {Promise<{ status: boolean, pageUrl: string, rawImageUrl: string, directUrl: string, id: string, size: number }>}
 */
async function uploadToPrntsc(input, options = {}) {
    let fileBuffer;
    let filename = options.filename || 'screenshot.png';
    let contentType = options.contentType || 'image/png';

    if (Buffer.isBuffer(input)) {
        fileBuffer = input;
    } else if (typeof input === 'string') {
        if (!fs.existsSync(input)) {
            throw new Error(`Berkas tidak ditemukan: ${input}`);
        }
        fileBuffer = fs.readFileSync(input);
        filename = options.filename || path.basename(input);
    } else {
        throw new Error('Input harus berupa Buffer atau file path yang valid');
    }

    // Jika gambar bertipe WebP, konversi otomatis ke PNG karena prnt.sc hanya menerima JPG, PNG, GIF
    if (/webp/i.test(contentType) || (fileBuffer.length > 12 && fileBuffer.toString('utf8', 8, 12) === 'WEBP')) {
        fileBuffer = await webpToPng(fileBuffer);
        filename = filename.replace(/\.webp$/i, '') + '.png';
        contentType = 'image/png';
    }

    // Pastikan nama file memiliki ekstensi yang valid
    if (!/\.(png|jpe?g|gif)$/i.test(filename)) {
        if (/jpe?g/i.test(contentType)) filename += '.jpg';
        else if (/gif/i.test(contentType)) filename += '.gif';
        else filename += '.png';
    }

    const form = new FormData();
    form.append('image', fileBuffer, {
        filename,
        contentType
    });

    // 1. Kirim multipart form ke endpoint resmi web prnt.sc/upload.php
    const uploadRes = await axios.post('https://prnt.sc/upload.php', form, {
        headers: {
            ...form.getHeaders(),
            'User-Agent': USER_AGENT,
            'Origin': 'https://prnt.sc',
            'Referer': 'https://prnt.sc/'
        },
        timeout: 30000
    });

    if (!uploadRes.data || uploadRes.data.status !== 'success' || !uploadRes.data.data) {
        const errMsg = uploadRes.data?.data || 'Gagal mengunggah gambar ke prnt.sc';
        throw new Error(errMsg);
    }

    const pageUrl = uploadRes.data.data;
    const imageId = pageUrl.split('/').pop();

    // 2. Scrape halaman prnt.sc untuk mengekstrak direct/raw image URL (CDN img.lightshot.app)
    let rawImageUrl = null;
    try {
        const pageRes = await axios.get(pageUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://prnt.sc/'
            },
            timeout: 15000
        });

        const $ = cheerio.load(pageRes.data);
        rawImageUrl = $('#screenshot-image').attr('src') || $('.screenshot-image').attr('src');
    } catch (scrapeErr) {
        console.warn('[Prnt.sc Scraper Warning] Gagal mengekstrak direct raw image:', scrapeErr.message);
    }

    return {
        status: true,
        pageUrl: pageUrl,
        rawImageUrl: rawImageUrl || pageUrl,
        directUrl: rawImageUrl || pageUrl,
        id: imageId,
        size: fileBuffer.length
    };
}

module.exports = {
    uploadToPrntsc,
    webpToPng
};
