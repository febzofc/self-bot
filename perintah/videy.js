const { Videy } = require('../lib/scrapers/videy.js');

module.exports = {
    CmD: ['videy'],
    aliases: ['videy', 'videydl', 'videyup', 'videyuploader', 'vdl'],
    categori: 'downloader',
    exec: async (m, { prefix, command, text, mime, quoted, bob }) => {
        const isUploadCmd = ['videyup', 'videyuploader'].includes(command);
        const isDownloadCmd = ['videydl', 'vdl'].includes(command);

        // Kasus 1: Mengunggah Video (Reply atau kirim video)
        const isVideoMedia = /video/.test(mime);

        if (isVideoMedia && !isDownloadCmd) {
            m.reply('_📤 Sedang mengunggah video ke Videy..._');
            try {
                let buffer;
                if (quoted && typeof quoted.download === 'function') {
                    buffer = await quoted.download();
                } else {
                    buffer = await bob.downloadMediaMessage(quoted || m);
                }

                if (!buffer || !Buffer.isBuffer(buffer)) {
                    return m.reply('❌ Gagal mengunduh media dari pesan.');
                }

                // Cek ukuran file (Videy umumnya membatasi hingga ~50MB - 100MB)
                const sizeInMB = (buffer.length / (1024 * 1024)).toFixed(2);
                if (buffer.length > 100 * 1024 * 1024) {
                    return m.reply(`❌ Ukuran video terlalu besar (${sizeInMB} MB). Maksimal ukuran file adalah 100 MB.`);
                }

                const res = await Videy.upload(buffer);

                let txt = `🎥 *VIDEY VIDEO UPLOADER* 🎥\n\n`;
                txt += `✅ *Status:* Berhasil diunggah\n`;
                txt += `📊 *Ukuran:* ${sizeInMB} MB\n`;
                txt += `🆔 *Video ID:* \`${res.id}\`\n\n`;
                txt += `🔗 *Videy Link:* ${res.url}\n`;
                txt += `📥 *Direct CDN:* ${res.directUrl}\n\n`;
                txt += `💡 _Untuk mengunduh kembali, gunakan *${prefix}videy ${res.url}*_`;

                return m.reply(txt);
            } catch (err) {
                console.error('Videy Upload Error:', err);
                return m.reply(`❌ Gagal mengunggah video ke Videy: ${err.message || err}`);
            }
        }

        // Kasus 2: Mengunduh Video jika ada teks / URL / ID
        if (text) {
            const videyId = Videy.extractId(text);
            if (!videyId) {
                return m.reply(
                    `❌ *Format URL/ID tidak valid!*\n\n` +
                    `Gunakan link Videy yang valid, contoh:\n` +
                    `• *${prefix + command} https://videy.co/v?id=ABC123*\n` +
                    `• *${prefix + command} https://cdn.videy.co/ABC123.mp4*\n` +
                    `• *${prefix + command} ABC123*`
                );
            }

            m.reply('_📥 Sedang mengambil video dari Videy..._');

            try {
                const res = await Videy.download(text);
                const caption = `🎥 *VIDEY DOWNLOADER*\n\n` +
                                `🆔 *ID:* \`${res.id}\`\n` +
                                `🔗 *Link:* https://videy.co/v?id=${res.id}\n` +
                                `📥 *Direct CDN:* ${res.directUrl}`;

                try {
                    // Coba kirim via buffer terlebih dahulu agar stabil
                    await bob.sendMessage(m.chat, {
                        video: res.buffer,
                        caption: caption,
                        mimetype: 'video/mp4'
                    }, { quoted: m });
                } catch (sendErr) {
                    // Fallback kirim via direct URL
                    await bob.sendMessage(m.chat, {
                        video: { url: res.directUrl },
                        caption: caption,
                        mimetype: 'video/mp4'
                    }, { quoted: m });
                }
                return;
            } catch (err) {
                console.error('Videy Download Error:', err);
                if (err?.response?.status === 404) {
                    return m.reply('❌ Video tidak ditemukan atau telah dihapus dari Videy.');
                }
                return m.reply(`❌ Gagal mengunduh video: ${err.message || err}`);
            }
        }

        // Kasus 3: Bantuan / Panduan Penggunaan
        return m.reply(
            `🎥 *VIDEY UPLOADER & DOWNLOADER* 🎥\n\n` +
            `Fitur untuk mengunggah dan mengunduh video dari platform Videy.\n\n` +
            `*1. Mengunduh Video:*` + `\n` +
            `• *${prefix}videy <link / id>*\n` +
            `Contoh: *${prefix}videy https://videy.co/v?id=xArgil6l1*\n\n` +
            `*2. Mengunggah Video:*` + `\n` +
            `• Balas (reply) atau kirim video dengan caption: *${prefix}videy* atau *${prefix}videyup*`
        );
    }
};
