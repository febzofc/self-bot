const axios = require('axios');
const { fetchJson, getBuffer } = require('../lib/fungsi.js');

// Regex komprehensif untuk mendeteksi berbagai format URL Facebook
const fbRegex = /(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.gg|fb\.com)\/(?:share\/(?:[rvp]\/)?[\w-]+|watch\/?\S*|reel\/[\w-]+|reels\/[\w-]+|[\w.-]+\/videos\/\d+|story\.php\?\S+|groups\/\d+\/posts\/\d+|[\w.-]+)/i;

/**
 * Membersihkan URL Facebook dari query string pelacak (tracking params seperti mibextid, ref, rdid)
 * dan trailing slash yang menyebabkan error pada downstream API ssscdn.
 */
function cleanFbUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    try {
        const parsed = new URL(url);
        // Pertahankan query '?v=' jika berupa format watch
        if (parsed.pathname.includes('watch') && parsed.searchParams.has('v')) {
            const v = parsed.searchParams.get('v');
            return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}?v=${v}`;
        }
        // Untuk format /share/r/..., /reel/..., dll. bersihkan query params dan trailing slash
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch {
        return url.replace(/\/+$/, '');
    }
}

module.exports = {
    CmD: ['facebook'],
    aliases: ['fb', 'fbdl', 'facebook', 'fbvideo', 'fbreel', 'fbmp4'],
    categori: 'downloader',
    fbRegex,
    exec: async (m, { prefix, command, text, bob }) => {
        if (!text) {
            return m.reply(
                `*Format Salah!*\n\n` +
                `*Contoh:*\n` +
                `*${prefix + command} https://www.facebook.com/share/r/1FGDJaZrNR/*`
            );
        }

        // Validasi dan ekstraksi URL Facebook menggunakan Regex
        const match = text.match(fbRegex);
        if (!match) {
            return m.reply(
                `❌ *URL Facebook tidak valid!*\n\n` +
                `Pastikan link merupakan postingan Facebook yang valid (Reel, Video, Watch, atau Post).\n\n` +
                `*Contoh:*\n` +
                `*${prefix + command} https://www.facebook.com/share/r/1FGDJaZrNR/*`
            );
        }

        const rawUrl = match[0];
        const targetUrl = cleanFbUrl(rawUrl);

        m.reply('_Sedang mengunduh video Facebook..._');

        try {
            // Panggil API Facebook Downloader
            let apiUrl = `https://api-faa.my.id/faa/fbdownload?url=${encodeURIComponent(targetUrl)}`;
            let res = await fetchJson(apiUrl);

            // Fallback: coba dengan URL original jika targetUrl yang dibersihkan belum berhasil
            if (!res || !res.status || !res.result || !res.result.media) {
                apiUrl = `https://api-faa.my.id/faa/fbdownload?url=${encodeURIComponent(rawUrl)}`;
                res = await fetchJson(apiUrl);
            }

            if (!res || !res.status || !res.result || !res.result.media) {
                const errMsg = res?.error || res?.message || 'Pastikan postingan bersifat publik dan link tidak kedaluwarsa.';
                return m.reply(`❌ *Gagal mengunduh video Facebook!*\n${errMsg}`);
            }

            const { media: mediaUrl, thumbnail } = res.result;

            // Unduh buffer video dengan User-Agent untuk mencegah response 0-byte dari CDN
            let mediaBuffer = null;
            try {
                const mediaRes = await axios.get(mediaUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    responseType: 'arraybuffer',
                    timeout: 60000
                });
                if (mediaRes.data && mediaRes.data.length > 0) {
                    mediaBuffer = Buffer.from(mediaRes.data);
                }
            } catch (dlErr) {
                console.warn('Gagal unduh buffer video Facebook via axios:', dlErr.message);
            }

            // Dapatkan thumbnail jika ada
            let thumbBuffer = null;
            if (thumbnail) {
                try {
                    const tBuf = await getBuffer(thumbnail);
                    if (Buffer.isBuffer(tBuf)) {
                        thumbBuffer = tBuf;
                    }
                } catch (_) {}
            }

            const captionText = `🎬 *FACEBOOK DOWNLOADER* 🎬\n\n` +
                `🔗 *Source:* ${targetUrl}\n` +
                `✨ *Status:* Berhasil diunduh`;

            const videoPayload = {
                video: mediaBuffer || { url: mediaUrl },
                caption: captionText,
                mimetype: 'video/mp4'
            };

            if (thumbBuffer) {
                videoPayload.jpegThumbnail = thumbBuffer;
            }

            try {
                await bob.sendMessage(m.chat, videoPayload, { quoted: m });
            } catch (sendErr) {
                console.warn('Pengiriman video biasa gagal, mencoba kirim sebagai dokumen:', sendErr.message);
                // Fallback kirim sebagai dokumen jika payload video biasa gagal
                await bob.sendMessage(m.chat, {
                    document: mediaBuffer || { url: mediaUrl },
                    mimetype: 'video/mp4',
                    fileName: `facebook_video_${Date.now()}.mp4`,
                    caption: captionText
                }, { quoted: m });
            }

        } catch (err) {
            console.error('Error Facebook Downloader:', err);
            return m.reply('❌ *Terjadi kesalahan saat memproses unduhan Facebook.*');
        }
    }
};
