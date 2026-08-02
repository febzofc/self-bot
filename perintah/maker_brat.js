const axios = require('axios');

module.exports = {
    CmD: ['brat'],
    aliases: ['brat', 'sbrat', 'bratimg'],
    categori: "maker",
    exec: async (m, { prefix, command, bob, text }) => {
        if (!text) {
            let guide = `*_Masukkan teksnya!_*\n\n`
            guide += `Contoh penggunaan:\n`
            guide += `• *${prefix + command} halo dunia* (Hasil: Stiker)\n`
            guide += `• *${prefix + command} --img halo dunia* (Hasil: Gambar)`
            return m.reply(guide);
        }

        let isImg = false;
        let inputText = text.trim();

        // Cek opsi --img di awal atau akhir teks
        if (inputText.startsWith('--img')) {
            isImg = true;
            inputText = inputText.replace(/^--img\s*/i, '').trim();
        } else if (inputText.endsWith('--img')) {
            isImg = true;
            inputText = inputText.replace(/\s*--img$/i, '').trim();
        }

        if (!inputText) {
            return m.reply(`*_Teks tidak boleh kosong!_*\n\nContoh: *${prefix + command} --img teks kamu*`);
        }

        try {
            m.reply('_Sedang membuat brat..._');

            const apiUrl = `https://api-faa.my.id/faa/brat?text=${encodeURIComponent(inputText)}`;
            const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data);

            if (isImg) {
                await bob.sendMessage(m.chat, { 
                    image: imageBuffer, 
                    caption: `*Brat Generator*` 
                }, { quoted: m });
            } else {
                await bob.sendImageAsSticker(m.chat, imageBuffer, m, { 
                    packname: global.packname || 'Self-Bot', 
                    author: global.author || 'Bot' 
                });
            }
        } catch (err) {
            console.error('Error Brat Plugin:', err);
            m.reply('_Terjadi kesalahan saat mengambil data dari API Brat. Silakan coba lagi nanti._');
        }
    }
};
