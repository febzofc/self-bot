const { fetchJson, getBuffer } = require('../lib/fungsi.js');

module.exports = {
    CmD: ['instagram'],
    aliases: ['ig', 'igdl', 'igmp4', 'igphoto', 'igimage', 'igvideo', 'reel'],
    categori: 'downloader',
    exec: async (m, { prefix, command, text, bob }) => {
        if (!text) return m.reply(`*Format Salah!*\n\nContoh:\n*${prefix + command} https://www.instagram.com/p/DbgCO7hEn3a/*`);

        const igRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i;
        if (!igRegex.test(text)) {
            return m.reply('❌ *URL Instagram tidak valid!* Pastikan link merupakan postingan (P), Reel, atau IGTV.');
        }

        m.reply('_Sedang mengunduh media Instagram..._');

        try {
            const apiUrl = `https://api-faa.my.id/faa/igdl?url=${encodeURIComponent(text.trim())}`;
            const res = await fetchJson(apiUrl);

            if (!res || !res.status || !res.result || !res.result.url || res.result.url.length === 0) {
                return m.reply('❌ *Gagal mengunduh media!* Pastikan link postingan publik dan tidak di-private.');
            }

            const { url, metadata } = res.result;
            const captionText = metadata?.caption ? metadata.caption : '';
            let rawUsername = metadata?.username ? metadata.username : '-';
            // Bersihkan jika username berisi URL
            if (rawUsername.startsWith('http')) {
                rawUsername = '-';
            }
            const likes = metadata?.like ? metadata.like : '0';
            const comments = metadata?.comment ? metadata.comment : '0';
            const isVideo = metadata?.isVideo || false;

            let infoText = `📸 *INSTAGRAM DOWNLOADER* 📸\n\n`;
            if (rawUsername && rawUsername !== '-') infoText += `👤 *Account:* ${rawUsername}\n`;
            if (likes !== '0') infoText += `❤️ *Likes:* ${likes}\n`;
            if (comments !== '0') infoText += `💬 *Comments:* ${comments}\n`;
            if (captionText) infoText += `\n📝 *Caption:*\n${captionText.slice(0, 300)}${captionText.length > 300 ? '...' : ''}`;

            // Kirim setiap foto / video
            for (let i = 0; i < url.length; i++) {
                const mediaUrl = url[i];
                const cap = i === 0 ? infoText : ''; // Caption hanya di media pertama

                const checkIsVideo = isVideo || /\.mp4/i.test(mediaUrl);

                try {
                    if (checkIsVideo) {
                        await bob.sendMessage(m.chat, { video: { url: mediaUrl }, caption: cap }, { quoted: m });
                    } else {
                        await bob.sendMessage(m.chat, { image: { url: mediaUrl }, caption: cap }, { quoted: m });
                    }
                } catch (e) {
                    // Fallback menggunakan getBuffer jika URL langsung gagal
                    const buff = await getBuffer(mediaUrl);
                    if (Buffer.isBuffer(buff)) {
                        if (checkIsVideo) {
                            await bob.sendMessage(m.chat, { video: buff, caption: cap }, { quoted: m });
                        } else {
                            await bob.sendMessage(m.chat, { image: buff, caption: cap }, { quoted: m });
                        }
                    } else {
                        throw e;
                    }
                }
            }
        } catch (err) {
            console.error('Error IG Downloader:', err);
            return m.reply('❌ *Terjadi kesalahan saat mengunduh foto/video Instagram.*');
        }
    }
};