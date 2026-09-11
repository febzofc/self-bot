const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

module.exports = {
    CmD: ['toimage', 'toimg'],
    aliases: ['toimage', 'toimg', 'topng', 'tofoto'],
    categori: 'maker',
    desc: 'Konversi stiker WhatsApp ke gambar / foto',
    exec: async (m, { bob, prefix, command, quoted, mime }) => {
        const quotedMsg = quoted ? (quoted.msg || quoted) : null;
        const currentMime = (quotedMsg && quotedMsg.mimetype) || mime || (m.msg && m.msg.mimetype) || '';
        const isSticker = quoted?.mtype === 'stickerMessage' || m.mtype === 'stickerMessage' || /webp/.test(currentMime);

        if (!isSticker) {
            return m.reply(`📸 *STICKER TO IMAGE CONVERTER* 📸\n\n📌 *Cara Penggunaan:* Balas (reply) stiker dengan perintah *${prefix + command}*`);
        }

        // Cek jika stiker bergerak, arahkan ke tovideo
        const isAnimated = (quotedMsg && quotedMsg.isAnimated) || (m.msg && m.msg.isAnimated);
        if (isAnimated) {
            return m.reply(`⚠️ *Stiker ini adalah stiker bergerak (animasi)!*\nSilakan gunakan perintah *${prefix}tovideo* untuk mengubahnya menjadi video.`);
        }

        m.reply('_⏳ Sedang mengubah stiker ke gambar..._');

        let mediaBuffer = null;
        try {
            if (quoted && typeof quoted.download === 'function') {
                mediaBuffer = await quoted.download();
            } else {
                mediaBuffer = await bob.downloadMediaMessage(quoted || m);
            }
        } catch (errDl) {
            console.error('Error download media in toimage:', errDl);
        }

        if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
            return m.reply('❌ *Gagal mengunduh stiker!* Silakan coba reply ulang stikernya.');
        }

        const randId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const tmpIn = path.join('/tmp', `toimg_${randId}.webp`);
        const tmpOut = path.join('/tmp', `toimg_${randId}.png`);

        try {
            fs.writeFileSync(tmpIn, mediaBuffer);

            // Konversi webp ke png menggunakan ffmpeg
            await execPromise(`ffmpeg -y -i "${tmpIn}" "${tmpOut}"`);

            if (!fs.existsSync(tmpOut)) {
                throw new Error('File output PNG tidak ditemukan.');
            }

            const imgBuf = fs.readFileSync(tmpOut);

            await bob.sendMessage(m.chat, {
                image: imgBuf,
                caption: '✅ *Berhasil mengubah stiker ke gambar!*'
            }, { quoted: m });

        } catch (errConv) {
            console.error('Error converting sticker to image:', errConv);
            return m.reply(`❌ *Gagal mengonversi stiker ke gambar:* ${errConv.message || errConv}`);
        } finally {
            try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
            try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
        }
    }
};
