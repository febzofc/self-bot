const fs = require('fs');

module.exports = { 
    CmD: ['sticker'],
    aliases: ['sticker', 's', 'stiker', 'setiker'],
    categori: "maker",
    desc: "Konversi gambar atau video ke stiker WhatsApp",
    exec: async (m, { quoted, qmsg, mime, bob, prefix, command, pushname }) => {
        const botName = global.author || 'WhatsApp Bot';
        const userName = m.pushname || pushname || 'User';
        const stickerMeta = { packname: botName, author: userName };

        const quotedMsg = quoted ? (quoted.msg || quoted) : null;
        const currentMime = (quotedMsg && quotedMsg.mimetype) || mime || (m.msg && m.msg.mimetype) || '';
        const isImage = /image/.test(currentMime) || (quoted && quoted.mtype === 'imageMessage') || m.mtype === 'imageMessage';
        const isVideo = /video/.test(currentMime) || (quoted && quoted.mtype === 'videoMessage') || m.mtype === 'videoMessage';

        if (isImage) {          
            let media = null;
            if (quoted && typeof quoted.download === 'function') {
                media = await quoted.download();
            } else {
                media = await bob.downloadMediaMessage(quoted || m);
            }
            if (!media || !Buffer.isBuffer(media)) return m.reply('❌ Gagal mengunduh gambar.');
            
            let encmedia = await bob.sendImageAsSticker(m.chat, media, m, stickerMeta);
            try {
                if (typeof encmedia === 'string' && fs.existsSync(encmedia)) {
                    fs.unlinkSync(encmedia);
                }
            } catch (_) {}
        } else if (isVideo) {
            const seconds = (qmsg && qmsg.seconds) || (quotedMsg && quotedMsg.seconds) || (m.msg && m.msg.seconds) || 0;
            if (seconds > 11) return m.reply('_Maksimal durasi video adalah 10 detik!_');

            let media = null;
            if (quoted && typeof quoted.download === 'function') {
                media = await quoted.download();
            } else {
                media = await bob.downloadMediaMessage(quoted || m);
            }
            if (!media || !Buffer.isBuffer(media)) return m.reply('❌ Gagal mengunduh video.');

            let encmedia = await bob.sendVideoAsSticker(m.chat, media, m, stickerMeta);
            try {
                if (typeof encmedia === 'string' && fs.existsSync(encmedia)) {
                    fs.unlinkSync(encmedia);
                }
            } catch (_) {}
        } else {
            m.reply(`_Kirim/reply gambar/video/gif dengan caption *${prefix + command}*_\n_Durasi Video/Gif maksimal 10 detik._`);
        }
    }
};