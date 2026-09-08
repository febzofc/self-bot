const axios = require('axios');
const { fetchJson, getBuffer } = require('../lib/fungsi.js');

// Regex komprehensif untuk mendeteksi berbagai format URL YouTube
const ytRegex = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

/**
 * Membersihkan nama file dari karakter ilegal pada sistem file
 */
function sanitizeFileName(name) {
    return (name || 'YouTube_Audio')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
}

/**
 * Mendapatkan metadata video (title, author, thumbnail) melalui YouTube oEmbed
 */
async function getYouTubeMetadata(url) {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const res = await axios.get(oembedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        if (res.data) {
            return {
                title: res.data.title || '',
                author: res.data.author_name || '',
                thumbnail: res.data.thumbnail_url || ''
            };
        }
    } catch (e) {
        // Abaikan jika oEmbed gagal
    }
    return {};
}

module.exports = {
    CmD: ['ytmp3', 'ytmp4'],
    aliases: ['ytmp3', 'ytmp4', 'yta', 'ytv', 'ytaudio', 'ytvideo', 'youtube', 'yt', 'youtubemp3', 'youtubemp4'],
    categori: 'downloader',
    ytRegex,
    exec: async (m, { prefix, command, text, bob }) => {
        if (!text) {
            return m.reply(
                `*YOUTUBE DOWNLOADER*\n\n` +
                `*Penggunaan:*\n` +
                `• *${prefix}ytmp3 <url>* (Download Audio MP3 - Dokumen)\n` +
                `• *${prefix}ytmp4 <url>* (Download Video MP4 - Video Biasa)\n\n` +
                `*Contoh:*\n` +
                `• ${prefix}ytmp3 https://youtu.be/145Qd0aVTEk\n` +
                `• ${prefix}ytmp4 https://youtu.be/145Qd0aVTEk`
            );
        }

        const match = text.match(ytRegex);
        if (!match) {
            return m.reply(
                `❌ *URL YouTube tidak valid!*\n\n` +
                `Pastikan link merupakan URL video YouTube yang valid.\n\n` +
                `*Contoh:*\n` +
                `• *${prefix + command} https://youtu.be/145Qd0aVTEk*\n` +
                `• *${prefix + command} https://www.youtube.com/watch?v=145Qd0aVTEk*`
            );
        }

        const targetUrl = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;

        // Tentukan apakah unduhan berupa MP3 atau MP4
        const cmdLower = (command || '').toLowerCase();
        let isMp3 = ['ytmp3', 'yta', 'ytaudio', 'youtubemp3'].includes(cmdLower);
        let isMp4 = ['ytmp4', 'ytv', 'ytvideo', 'youtubemp4'].includes(cmdLower);

        if (!isMp3 && !isMp4) {
            if (/--mp3|--audio|-a/i.test(text)) {
                isMp3 = true;
            } else {
                isMp4 = true; // Default to MP4
            }
        }

        // ==========================================
        // 1. FITUR DOWNLOADER YOUTUBE MP3 (DOKUMEN)
        // ==========================================
        if (isMp3) {
            m.reply('_Sedang mengunduh audio YouTube (MP3 Document)..._');

            try {
                const apiUrl = `https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(targetUrl)}`;
                const res = await fetchJson(apiUrl);

                if (!res || !res.status || !res.result) {
                    const errMsg = res?.error || res?.message || 'Gagal memproses audio dari YouTube.';
                    return m.reply(`❌ *Gagal mengunduh audio!*\n${errMsg}`);
                }

                const audioData = res.result;
                const downloadUrl = audioData.mp3 || audioData.download_url || audioData.url || audioData.link;

                if (!downloadUrl) {
                    return m.reply('❌ *Link audio tidak ditemukan pada respon server.*');
                }

                const title = audioData.title || 'YouTube Audio';
                const duration = audioData.duration || '-';
                const safeName = sanitizeFileName(title);
                const fileName = `${safeName}.mp3`;

                const captionText = `🎵 *YOUTUBE AUDIO DOWNLOADER* 🎵\n\n` +
                    `📌 *Judul:* ${title}\n` +
                    `⏱️ *Durasi:* ${duration}\n` +
                    `🔗 *Source:* ${targetUrl}\n` +
                    `📄 *Format:* Dokumen MP3`;

                // Coba ambil buffer audio untuk kehandalan pengiriman dokumen
                let audioBuffer = null;
                try {
                    const dlRes = await axios.get(downloadUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        responseType: 'arraybuffer',
                        timeout: 60000,
                        maxRedirects: 5
                    });
                    if (dlRes.data && dlRes.data.length > 0) {
                        audioBuffer = Buffer.from(dlRes.data);
                    }
                } catch (dlErr) {
                    console.warn('Gagal unduh buffer audio via axios, menggunakan URL langsung:', dlErr.message);
                }

                // Kirim output sebagai DOCUMENT MP3 sesuai instruksi
                await bob.sendMessage(m.chat, {
                    document: audioBuffer || { url: downloadUrl },
                    mimetype: 'audio/mpeg',
                    fileName: fileName,
                    caption: captionText
                }, { quoted: m });

            } catch (err) {
                console.error('Error YouTube MP3 Downloader:', err);
                return m.reply('❌ *Terjadi kesalahan saat memproses unduhan YouTube MP3.*');
            }
            return;
        }

        // ==========================================
        // 2. FITUR DOWNLOADER YOUTUBE MP4 (VIDEO BIASA)
        // ==========================================
        if (isMp4) {
            m.reply('_Sedang mengunduh video YouTube (MP4 Video)..._');

            try {
                const apiUrl = `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(targetUrl)}`;
                const res = await fetchJson(apiUrl);

                if (!res || !res.status || !res.result) {
                    const errMsg = res?.error || res?.message || 'Gagal memproses video dari YouTube.';
                    return m.reply(`❌ *Gagal mengunduh video!*\n${errMsg}`);
                }

                const videoData = res.result;
                const downloadUrl = videoData.download_url || videoData.url || videoData.video || videoData.link;

                if (!downloadUrl) {
                    return m.reply('❌ *Link video tidak ditemukan pada respon server.*');
                }

                // Ambil metadata tambahan (title, author, thumbnail) via oEmbed
                const meta = await getYouTubeMetadata(targetUrl);
                const title = videoData.title || meta.title || 'YouTube Video';
                const author = meta.author || '-';
                const thumbUrl = videoData.thumbnail || meta.thumbnail;

                let thumbBuffer = null;
                if (thumbUrl) {
                    try {
                        const tBuf = await getBuffer(thumbUrl);
                        if (Buffer.isBuffer(tBuf)) {
                            thumbBuffer = tBuf;
                        }
                    } catch (_) {}
                }

                const captionText = `🎬 *YOUTUBE VIDEO DOWNLOADER* 🎬\n\n` +
                    `📌 *Judul:* ${title}\n` +
                    `👤 *Channel:* ${author}\n` +
                    `🔗 *Source:* ${targetUrl}\n` +
                    `✨ *Status:* Berhasil diunduh`;

                // Coba ambil buffer video jika ukuran wajar, atau gunakan direct url
                let videoBuffer = null;
                try {
                    const dlRes = await axios.get(downloadUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        responseType: 'arraybuffer',
                        timeout: 90000,
                        maxRedirects: 5
                    });
                    if (dlRes.data && dlRes.data.length > 0) {
                        videoBuffer = Buffer.from(dlRes.data);
                    }
                } catch (dlErr) {
                    console.warn('Gagal unduh buffer video via axios, menggunakan URL langsung:', dlErr.message);
                }

                const videoPayload = {
                    video: videoBuffer || { url: downloadUrl },
                    caption: captionText,
                    mimetype: 'video/mp4'
                };

                if (thumbBuffer) {
                    videoPayload.jpegThumbnail = thumbBuffer;
                }

                // Kirim output sebagai VIDEO BIASA sesuai instruksi
                try {
                    await bob.sendMessage(m.chat, videoPayload, { quoted: m });
                } catch (sendErr) {
                    console.warn('Gagal kirim video dengan payload utama, mencoba fallback url:', sendErr.message);
                    await bob.sendMessage(m.chat, {
                        video: { url: downloadUrl },
                        caption: captionText,
                        mimetype: 'video/mp4'
                    }, { quoted: m });
                }

            } catch (err) {
                console.error('Error YouTube MP4 Downloader:', err);
                return m.reply('❌ *Terjadi kesalahan saat memproses unduhan YouTube MP4.*');
            }
        }
    }
};
