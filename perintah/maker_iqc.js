const axios = require('axios');
const moment = require('moment-timezone');

module.exports = {
    CmD: ['iqc'],
    aliases: ['iqc', 'iqcv1', 'iqcv2', 'iphonequote'],
    categori: 'maker',
    exec: async (m, { prefix, command, bob, text }) => {
        if (!text) {
            let guide = `📱 *IPHONE QUOTE CHAT MAKER* 📱\n\n`;
            guide += `*1. IQC Version 1 (Teks saja):*\n`;
            guide += `• *${prefix}iqc <teks>*\n`;
            guide += `  _Contoh:_ *${prefix}iqc aku sayang kamu*\n\n`;
            guide += `*2. IQC Version 2 (Custom Jam & Baterai):*\n`;
            guide += `• *${prefix}iqcv2 <teks> | <jam> | <baterai>*\n`;
            guide += `  _Contoh:_ *${prefix}iqcv2 Aku cinta kamu | 10:09 | 80*\n`;
            guide += `  _Contoh (Default jam & batre):_ *${prefix}iqcv2 Aku cinta kamu*\n`;
            return m.reply(guide);
        }

        let isV2 = command === 'iqcv2' || text.startsWith('--v2');
        let inputText = text.replace(/^--v2\s*/i, '').trim();

        let prompt = '';
        let jam = moment().tz('Asia/Jakarta').format('HH:mm');
        let batre = '80';

        if (isV2) {
            const parts = inputText.split('|').map(p => p.trim());
            prompt = parts[0] || '';
            if (parts[1]) jam = parts[1];
            if (parts[2]) batre = parts[2].replace(/[^0-9]/g, '') || '80';
        } else {
            prompt = inputText;
        }

        if (!prompt) {
            return m.reply(`❌ *Teks quote tidak boleh kosong!*`);
        }

        m.reply('_Sedang membuat iPhone Quote Chat..._');

        try {
            let apiUrl = '';
            if (isV2) {
                apiUrl = `https://api-faa.my.id/faa/iqcv2?prompt=${encodeURIComponent(prompt)}&jam=${encodeURIComponent(jam)}&batre=${encodeURIComponent(batre)}`;
            } else {
                apiUrl = `https://api-faa.my.id/faa/iqc?prompt=${encodeURIComponent(prompt)}`;
            }

            const response = await axios.get(apiUrl, { 
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });

            const imageBuffer = Buffer.from(response.data);

            await bob.sendMessage(m.chat, {
                image: imageBuffer,
                caption: `📱 *iPhone Quote Chat (${isV2 ? 'V2' : 'V1'})*`
            }, { quoted: m });

        } catch (err) {
            console.error('Error IQC Plugin:', err);
            m.reply('❌ *Terjadi kesalahan saat membuat gambar IQC.*');
        }
    }
};
