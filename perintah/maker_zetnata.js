const { UploadZetnata, UploadFileUgu } = require('../lib/scrapers/uploader.js');
const fs = require('fs');
const path = require('path');

function formatSize(bytes) {
    if (!bytes || isNaN(bytes)) return 'N/A';
    if (bytes === 0) return '0 Byte';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

module.exports = {
    CmD: ['tourl'],
    aliases: ['tourl', 'tourl2', 'cloud', 'upload', 'zetnata', 'tourlzet', 'zetcloud', 'cloudzet', 'uguu', 'ugu'],
    categori: 'maker',
    desc: 'Upload media ke URL (Zetnata Cloud & Uguu.se)',
    exec: async (m, { bob, quoted, mime, prefix, command }) => {
        if (!quoted || !mime) {
            return m.reply(`☁️ *MEDIA TO URL UPLOADER* ☁️\n\n📌 *Cara Penggunaan:* Reply / kirim media (foto/video/audio/dokumen) dengan caption:\n• *${prefix}tourl* : Zetnata Cloud Storage (auto-fallback ke Uguu jika server down)\n• *${prefix}tourl2* : Langsung upload ke Uguu.se`);
        }

        const isDirectUguu = ['tourl2', 'uguu', 'ugu'].includes((command || '').toLowerCase());
        m.reply(`_📤 Sedang mengunggah media ke ${isDirectUguu ? 'Uguu.se' : 'Zetnata Cloud Storage'}..._`);
        let mediaPath = null;

        try {
            mediaPath = await bob.downloadAndSaveMediaMessage(quoted);

            // Jika perintah adalah tourl2 / uguu, langsung arahkan ke UploadFileUgu
            if (isDirectUguu) {
                const resUgu = await UploadFileUgu(mediaPath);
                if (!resUgu || !resUgu.url) {
                    return m.reply('❌ Gagal mengunggah berkas ke Uguu.se');
                }

                let txt = `💜 *UGUU FILE STORAGE (TOURL 2)* 💜\n\n`;
                txt += `📄 *Nama File:* ${resUgu.filename || path.basename(mediaPath)}\n`;
                txt += `📊 *Ukuran:* ${formatSize(resUgu.size)}\n`;
                txt += `🆔 *Hash:* \`${resUgu.hash || '-'}\`\n\n`;
                txt += `🔗 *Link URL:* ${resUgu.url}\n\n`;
                txt += `──────────────────────────\n`;
                txt += `💡 *Uguu.se File Uploader*`;
                return m.reply(txt);
            }

            // Coba upload ke Zetnata terlebih dahulu
            try {
                const res = await UploadZetnata(mediaPath);
                if (res && (res.shortUrl || res.rawUrl || res.downloadUrl)) {
                    let txt = `☁️ *ZETNATA CLOUD STORAGE* ☁️\n\n`;
                    txt += `📄 *Nama File:* ${res.fileName || path.basename(mediaPath)}\n`;
                    txt += `📊 *Ukuran:* ${res.fileSize || 'N/A'}\n`;
                    txt += `🆔 *File ID:* \`${res.fileId || '-'}\`\n\n`;
                    txt += `🔗 *Short Link:* ${res.shortUrl || '-'}\n`;
                    txt += `🌐 *Raw Link:* ${res.rawUrl || '-'}\n`;
                    txt += `📥 *Download Link:* ${res.downloadUrl || '-'}\n\n`;
                    txt += `──────────────────────────\n`;
                    txt += `💡 *Zetnata Pixel Art Cloud Storage*`;
                    return m.reply(txt);
                }
                throw new Error('Respons Zetnata tidak valid');
            } catch (zetErr) {
                console.warn('⚠️ Server Zetnata bermasalah, mengalihkan ke Uguu:', zetErr.message || zetErr);

                // Fallback otomatis ke UploadFileUgu
                const resUgu = await UploadFileUgu(mediaPath);
                if (!resUgu || !resUgu.url) {
                    throw new Error('Zetnata gagal dan Uguu juga gagal: ' + (zetErr.message || zetErr));
                }

                let txt = `☁️ *UGUU STORAGE (FALLBACK DARI ZETNATA)* ☁️\n`;
                txt += `⚠️ _Server Zetnata offline/gangguan, media otomatis dialihkan ke Uguu._\n\n`;
                txt += `📄 *Nama File:* ${resUgu.filename || path.basename(mediaPath)}\n`;
                txt += `📊 *Ukuran:* ${formatSize(resUgu.size)}\n`;
                txt += `🆔 *Hash:* \`${resUgu.hash || '-'}\`\n\n`;
                txt += `🔗 *Link URL:* ${resUgu.url}\n\n`;
                txt += `──────────────────────────\n`;
                txt += `💡 *Uguu.se File Uploader*`;
                return m.reply(txt);
            }

        } catch (err) {
            console.error('Upload Error:', err);
            return m.reply(`❌ Terjadi kesalahan saat mengunggah: ${err.message || err}`);
        } finally {
            if (mediaPath && fs.existsSync(mediaPath)) {
                try {
                    fs.unlinkSync(mediaPath);
                } catch (e) {}
            }
        }
    }
};
