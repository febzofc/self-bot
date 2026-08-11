const { UploadZetnata } = require('../lib/scrapers/uploader.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    CmD: ['tourl'],
    aliases: ['tourl','cloud','upload','zetnata', 'tourlzet', 'zetcloud', 'cloudzet'],
    categori: 'maker',
    exec: async (m, { bob, quoted, mime, prefix, command }) => {
        if (!quoted || !mime) {
            return m.reply(`☁️ *ZETNATA CLOUD STORAGE UPLOADER* ☁️\n\n📌 *Cara Penggunaan:* Reply / kirim media (foto/video/audio/dokumen) dengan caption *${prefix + command}*`);
        }

        m.reply('_📤 Sedang mengunggah media ke Zetnata Cloud Storage..._');
        let mediaPath = null;

        try {
            mediaPath = await bob.downloadAndSaveMediaMessage(quoted);
            const res = await UploadZetnata(mediaPath);

            if (!res) {
                return m.reply('❌ Gagal mengunggah berkas ke Zetnata Cloud Storage.');
            }

            let txt = `☁️ *ZETNATA CLOUD STORAGE* ☁️\n\n`;
            txt += `📄 *Nama File:* ${res.fileName || 'file'}\n`;
            txt += `📊 *Ukuran:* ${res.fileSize || 'N/A'}\n`;
            txt += `🆔 *File ID:* \`${res.fileId || '-'}\`\n\n`;
            txt += `🔗 *Short Link:* ${res.shortUrl || '-'}\n`;
            txt += `🌐 *Raw Link:* ${res.rawUrl || '-'}\n`;
            txt += `📥 *Download Link:* ${res.downloadUrl || '-'}\n\n`;
            txt += `──────────────────────────\n`;
            txt += `💡 *Zetnata Pixel Art Cloud Storage*`;

            return m.reply(txt);
        } catch (err) {
            console.error('Zetnata Upload Error:', err);
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
