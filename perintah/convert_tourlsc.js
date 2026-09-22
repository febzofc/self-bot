const { uploadToPrntsc } = require('../lib/scrapers/prntsc.js');
const path = require('path');

function formatSize(bytes) {
    if (!bytes || isNaN(bytes)) return 'N/A';
    if (bytes === 0) return '0 Byte';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

module.exports = {
    CmD: ['tourlsc', 'tourl3'],
    aliases: ['tourlsc', 'tourl3', 'tourlprnt', 'prntsc', 'prnt'],
    categori: 'maker',
    desc: 'Upload gambar ke Lightshot (https://prnt.sc) & ambil raw direct image URL',
    exec: async (m, { bob, quoted, mime, prefix, command }) => {
        const quotedMsg = quoted ? (quoted.msg || quoted) : null;
        const currentMime = (quotedMsg && quotedMsg.mimetype) || mime || (m.msg && m.msg.mimetype) || '';
        const isImage = /image\/(png|jpe?g|gif)/i.test(currentMime) || quoted?.mtype === 'imageMessage' || m.mtype === 'imageMessage';
        const isSticker = /webp/i.test(currentMime) || quoted?.mtype === 'stickerMessage' || m.mtype === 'stickerMessage';

        if (!isImage && !isSticker) {
            let guide = `*LIGHTSHOT IMAGE UPLOADER (prnt.sc)*\n\n`;
            guide += `Format penggunaan:\n`;
            guide += `• Kirim gambar/foto dengan caption *${prefix + command}*\n`;
            guide += `• Atau balas (reply) gambar/stiker dengan *${prefix + command}*\n\n`;
            guide += `*Pilihan Perintah:*\n`;
            guide += `• *${prefix}tourlsc* : Upload ke prnt.sc & ambil link direct raw image\n`;
            guide += `• *${prefix}tourl3* : Alias pendek dari tourlsc\n\n`;
            guide += `*Format didukung:* JPG, PNG, GIF, dan Stiker WhatsApp.`;
            return m.reply(guide);
        }

        await m.reply('_Mengunggah gambar ke prnt.sc..._');

        let mediaBuffer = null;
        try {
            if (quoted && typeof quoted.download === 'function') {
                mediaBuffer = await quoted.download();
            } else if (typeof m.download === 'function') {
                mediaBuffer = await m.download();
            } else {
                mediaBuffer = await bob.downloadMediaMessage(quoted || m);
            }
        } catch (errDl) {
            console.error('[Download Media Error]:', errDl);
        }

        if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
            return m.reply('Gagal mengunduh media dari pesan. Silakan coba reply ulang gambarnya.');
        }

        try {
            const isWebp = isSticker || /webp/i.test(currentMime);
            const uploadResult = await uploadToPrntsc(mediaBuffer, {
                filename: isWebp ? 'sticker.png' : 'image.png',
                contentType: isWebp ? 'image/png' : (currentMime || 'image/png')
            });

            let txt = `*HASIL UPLOAD LIGHTSHOT (prnt.sc)*\n\n`;
            txt += `• *Direct / Raw Image URL:*\n${uploadResult.rawImageUrl}\n\n`;
            txt += `• *Halaman Lightshot:*\n${uploadResult.pageUrl}\n\n`;
            txt += `• *Ukuran Berkas:* ${formatSize(uploadResult.size)}\n`;
            txt += `• *ID Screenshot:* \`${uploadResult.id}\`\n\n`;
            txt += `_Link direct image dapat langsung di-get / disematkan tanpa melewati halaman iklan web._`;

            return m.reply(txt);
        } catch (errUpload) {
            console.error('[Prnt.sc Upload Plugin Error]:', errUpload?.message || errUpload);
            return m.reply(`Gagal mengunggah gambar ke prnt.sc: ${errUpload?.message || 'Terjadi kesalahan pada server prnt.sc'}`);
        }
    }
};
