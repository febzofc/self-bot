const axios = require('axios');
const FormData = require('form-data');

async function uploadToUguu(buffer) {
    try {
        const form = new FormData();
        form.append('files[]', buffer, { filename: 'smeme.jpg' });
        const res = await axios.post('https://uguu.se/upload.php', form, { 
            headers: form.getHeaders(),
            timeout: 15000
        });
        if (res.data && res.data.files && res.data.files[0] && res.data.files[0].url) {
            return res.data.files[0].url;
        }
    } catch (e) {
        console.error('Uguu upload error:', e.message);
    }

    // Fallback: tmpfiles.org
    const form2 = new FormData();
    form2.append('file', buffer, { filename: 'smeme.jpg' });
    const res2 = await axios.post('https://tmpfiles.org/api/v1/upload', form2, { 
        headers: form2.getHeaders(),
        timeout: 15000
    });
    return res2.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

module.exports = {
    CmD: ['smeme'],
    aliases: ['smeme', 'smeme2', 'stickermeme', 'stikermeme'],
    categori: 'maker',
    exec: async (m, { prefix, command, quoted, mime, bob, text }) => {
        const isImage = /image/.test(mime);
        if (!isImage) {
            return m.reply(`❌ *Kirim/reply gambar dengan caption:* \n• *${prefix + command} teks atas | teks bawah*\n• *${prefix + command} teks bawah*`);
        }

        if (!text || !text.trim()) {
            return m.reply(`*_Masukkan teks meme!_*\n\nContoh:\n• *${prefix + command} Woy Lah | Admin Datang*\n• *${prefix + command} Admin Datang*`);
        }

        let textAtas = '-';
        let textBawah = '-';

        const trimmedText = text.trim();
        if (trimmedText.includes('|')) {
            const parts = trimmedText.split('|').map(p => p.trim());
            textAtas = parts[0] || '-';
            textBawah = parts[1] || '-';
        } else {
            // Satu kalimat: teks atas diisi '-' dan teks bawah diisi kalimat tersebut
            textAtas = '-';
            textBawah = trimmedText;
        }

        m.reply('_Sedang membuat stiker meme..._');

        try {
            // Download media dari pesan
            let mediaBuffer = await quoted.download().catch(async () => {
                return await bob.downloadMediaMessage(quoted);
            });

            if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer)) {
                return m.reply('❌ *Gagal mengunduh gambar!* Coba reply ulang gambar.');
            }

            // Upload gambar ke server publik agar bisa diakses oleh API SMeme
            const imageUrl = await uploadToUguu(mediaBuffer);
            if (!imageUrl) {
                return m.reply('❌ *Gagal mengupload gambar ke server temporary.*');
            }

            // Panggil API SMeme
            const apiUrl = `https://api-faa.my.id/faa/smeme?text_atas=${encodeURIComponent(textAtas)}&text_bawah=${encodeURIComponent(textBawah)}&background=${encodeURIComponent(imageUrl)}`;
            
            const response = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });

            const memeBuffer = Buffer.from(response.data);

            // Kirim sebagai stiker
            await bob.sendImageAsSticker(m.chat, memeBuffer, m, {
                packname: global.packname || 'Self-Bot',
                author: global.author || 'Bot'
            });

        } catch (err) {
            console.error('Error SMeme Plugin:', err);
            return m.reply('❌ *Terjadi kesalahan saat memproses stiker meme.*');
        }
    }
};
