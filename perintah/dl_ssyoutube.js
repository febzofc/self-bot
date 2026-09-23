const { 
    scrapeSSYouTube, 
    convertStreamToMp3, 
    downloadMp4Buffer,
    extractVideoId 
} = require('../lib/scrapers/ssyoutube.js');

/**
 * Membersihkan nama file dari karakter terlarang sistem operasi
 */
function sanitizeFileName(name) {
    return (name || 'YouTube_Media')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
}

module.exports = {
    CmD: ['ssyoutube'],
    aliases: ['ssyt', 'ssyoutube', 'ssmp3', 'ssmp4', 'ssyta', 'ssytv', 'ss128k'],
    categori: 'downloader',
    desc: 'Scraper YouTube MP3 (128kbps) & MP4 (All Resolusi) via ssyoutube.com.mx',
    exec: async (m, { bob, prefix, command, text, args }) => {
        const cmd = (command || '').toLowerCase();

        // Panduan penggunaan jika tidak ada input URL
        if (!text) {
            return m.reply(
                `*SSYOUTUBE SCRAPER & DOWNLOADER*\n` +
                `_Sumber: https://ssyoutube.com.mx/id/_\n\n` +
                `*Pilihan Perintah:*\n` +
                `• *${prefix}ssyt <url>* : Scrape data lengkap video, all resolusi MP4 & audio 128kbps\n` +
                `• *${prefix}ssmp3 <url>* : Download audio MP3 resolusi 128kbps\n` +
                `• *${prefix}ssmp4 <url>* : Download video MP4 (resolusi terbaik)\n\n` +
                `*Contoh:*\n` +
                `• ${prefix}ssyt https://youtu.be/145Qd0aVTEk\n` +
                `• ${prefix}ssmp3 https://youtu.be/145Qd0aVTEk\n` +
                `• ${prefix}ssmp4 https://youtu.be/145Qd0aVTEk`
            );
        }

        const videoId = extractVideoId(text);
        if (!videoId) {
            return m.reply(
                `❌ *URL YouTube tidak valid!*\n\n` +
                `Pastikan link merupakan URL YouTube yang valid (watch, shorts, atau youtu.be).\n\n` +
                `Contoh:\n` +
                `• ${prefix + command} https://youtu.be/145Qd0aVTEk`
            );
        }

        const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const isMp3 = ['ssmp3', 'ssyta', 'ss128k'].includes(cmd) || /--mp3|--audio|-a/i.test(text);
        const isMp4 = ['ssmp4', 'ssytv'].includes(cmd) || /--mp4|--video|-v/i.test(text);

        // ========================================================
        // 1. DOWNLOAD AUDIO MP3 128KBPS
        // ========================================================
        if (isMp3) {
            m.reply('_⏳ Sedang mengekstrak audio MP3 128kbps via ssyoutube.com.mx..._');

            try {
                const scraped = await scrapeSSYouTube(targetUrl);
                const { title, duration, mp3 } = scraped.data;
                const safeName = sanitizeFileName(title);

                // Ekstraksi audio ke 128kbps menggunakan ffmpeg
                const mp3Buffer = await convertStreamToMp3(mp3.streamSourceUrl);

                const caption = 
                    `🎵 *YOUTUBE MP3 DOWNLOADER*\n\n` +
                    `📌 *Judul:* ${title}\n` +
                    `⏱️ *Durasi:* ${duration}\n` +
                    `🎧 *Kualitas:* 128kbps (Stereo 44.1kHz)\n` +
                    `📦 *Ukuran:* ${(mp3Buffer.length / (1024 * 1024)).toFixed(2)} MB\n` +
                    `🌐 *Source:* ssyoutube.com.mx/id/`;

                // Kirim sebagai dokumen audio MP3 agar kualitas 128kbps tetap jernih
                await bob.sendMessage(m.chat, {
                    document: mp3Buffer,
                    mimetype: 'audio/mpeg',
                    fileName: `${safeName} [128kbps].mp3`,
                    caption: caption
                }, { quoted: m });

                return;
            } catch (err) {
                console.error('Error SSYouTube MP3:', err);
                return m.reply(`❌ *Gagal mengunduh MP3 128kbps:*\n${err.message}`);
            }
        }

        // ========================================================
        // 2. DOWNLOAD VIDEO MP4
        // ========================================================
        if (isMp4) {
            m.reply('_⏳ Sedang mengunduh video MP4 via ssyoutube.com.mx..._');

            try {
                const scraped = await scrapeSSYouTube(targetUrl);
                const { title, duration, mp4 } = scraped.data;
                const bestStream = mp4.bestDirectResolution;

                if (!bestStream || !bestStream.url) {
                    return m.reply('❌ Link video MP4 tidak tersedia dari server.');
                }

                const caption = 
                    `🎬 *YOUTUBE MP4 DOWNLOADER*\n\n` +
                    `📌 *Judul:* ${title}\n` +
                    `⏱️ *Durasi:* ${duration}\n` +
                    `📐 *Resolusi:* ${bestStream.resolution} (${bestStream.width}x${bestStream.height})\n` +
                    `📦 *Ukuran:* ${bestStream.formattedSize}\n` +
                    `🌐 *Source:* ssyoutube.com.mx/id/`;

                // Kirim video langsung ke chat
                await bob.sendMessage(m.chat, {
                    video: { url: bestStream.url },
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: m });

                return;
            } catch (err) {
                console.error('Error SSYouTube MP4:', err);
                return m.reply(`❌ *Gagal mengunduh MP4:*\n${err.message}`);
            }
        }

        // ========================================================
        // 3. SCRAPE DATA LENGKAP & ALL RESOLUSI (DEFAULT)
        // ========================================================
        m.reply('_🔍 Mengambil data lengkap & resolusi dari ssyoutube.com.mx..._');

        try {
            const scraped = await scrapeSSYouTube(targetUrl);
            const { title, duration, thumbnail, viewCount, mp3, mp4 } = scraped.data;

            // Buat daftar resolusi MP4 secara rapi
            let resListText = '';
            mp4.allResolutions.forEach((res, index) => {
                const statusBadge = res.isAvailableDirect ? '✅ Direct Stream' : '⚡ Stream Available';
                const dimen = res.width && res.height ? `(${res.width}x${res.height})` : '';
                resListText += `*${index + 1}. Resolusi:* ${res.resolution} ${dimen}\n`;
                resListText += `   • Format: ${res.format} (${res.mimeType})\n`;
                resListText += `   • Ukuran: ${res.formattedSize}\n`;
                resListText += `   • Status: ${statusBadge}\n\n`;
            });

            const resultMessage = 
                `*🎥 SSYOUTUBE SCRAPER RESULT 🎥*\n` +
                `_Sumber: https://ssyoutube.com.mx/id/_\n\n` +
                `📌 *Judul:* ${title}\n` +
                `⏱️ *Durasi:* ${duration}\n` +
                `👁️ *Views:* ${viewCount}\n` +
                `🆔 *ID Video:* ${videoId}\n\n` +
                `────────────────────\n` +
                `🎵 *AUDIO MP3 (128 KBPS)*\n` +
                `• Kualitas: *${mp3.resolution}*\n` +
                `• Sample Rate: ${mp3.sampleRate} (${mp3.channels})\n` +
                `• Estimasi Ukuran: ${mp3.formattedSize}\n` +
                `• Perintah Unduh: *${prefix}ssmp3 ${targetUrl}*\n` +
                `────────────────────\n` +
                `🎬 *ALL RESOLUSI MP4 (${mp4.totalResolutions} Pilihan)*\n\n` +
                resListText +
                `────────────────────\n` +
                `💡 *Cara Cepat Mengunduh:*\n` +
                `• Ketik *${prefix}ssmp3 ${targetUrl}* untuk MP3 128kbps\n` +
                `• Ketik *${prefix}ssmp4 ${targetUrl}* untuk MP4 Video`;

            // Kirim pesan hasil scraper dengan thumbnail video
            await bob.sendMessage(m.chat, {
                image: { url: thumbnail },
                caption: resultMessage
            }, { quoted: m });

        } catch (err) {
            console.error('Error SSYouTube Scrape:', err);
            return m.reply(`❌ *Gagal melakukan scrape data YouTube:*\n${err.message}`);
        }
    }
};
