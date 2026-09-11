const fs = require('fs');
const path = require('path');
const { webp2mp4File } = require('../lib/scrapers/uploader.js');

module.exports = {
    CmD: ['tovideo', 'tomp4'],
    aliases: ['tovideo', 'tomp4'],
    categori: 'maker',
    desc: 'Konversi stiker bergerak ke video MP4',
    exec: async (m, { bob, prefix, command, quoted, mime }) => {
        const quotedMsg = quoted ? (quoted.msg || quoted) : null;
        const currentMime = (quotedMsg && quotedMsg.mimetype) || mime || (m.msg && m.msg.mimetype) || '';
        const isSticker = quoted?.mtype === 'stickerMessage' || m.mtype === 'stickerMessage' || /webp/.test(currentMime);

        if (!isSticker) {
            return m.reply(`🎬 *STICKER TO VIDEO CONVERTER* 🎬\n\n📌 *Cara Penggunaan:* Balas (reply) stiker bergerak dengan perintah *${prefix + command}*`);
        }

        m.reply('_⏳ Sedang mengonversi stiker bergerak ke video..._');

        let mediaBuffer = null;
        try {
            if (quoted && typeof quoted.download === 'function') {
                mediaBuffer = await quoted.download();
            } else {
                mediaBuffer = await bob.downloadMediaMessage(quoted || m);
            }
        } catch (errDl) {
            console.error('Error download media in tovideo:', errDl);
        }

        if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
            return m.reply('❌ *Gagal mengunduh stiker!* Silakan coba reply ulang stikernya.');
        }

        const randId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const tmpIn = path.join('/tmp', `tovid_${randId}.webp`);

        try {
            fs.writeFileSync(tmpIn, mediaBuffer);

            // Konversi stiker bergerak webp ke mp4 via uploader (ezgif)
            const res = await webp2mp4File(tmpIn);

            if (!res || !res.result) {
                throw new Error('Gagal mendapatkan URL video dari layanan konverter.');
            }

            await bob.sendMessage(m.chat, {
                video: { url: res.result },
                caption: '✅ *Berhasil mengubah stiker bergerak ke video!*'
            }, { quoted: m });

        } catch (errConv) {
            console.error('Error converting sticker to video:', errConv);
            return m.reply(`❌ *Gagal mengonversi stiker ke video:* ${errConv.message || errConv}`);
        } finally {
            try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
        }
    }
};
