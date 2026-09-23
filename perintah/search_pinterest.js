const axios = require('axios');

/**
 * Download buffer gambar dengan timeout & fallback
 */
async function getImageBuffer(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        if (res.data && res.data.length > 0) {
            return Buffer.from(res.data);
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Acak urutan array (Fisher-Yates shuffle) agar variatif
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    CmD: ['pinterest'],
    aliases: ['pinterest', 'pin', 'pint', 'pinsearch'],
    categori: 'search',
    exec: async (m, { bob, args, text, prefix, command }) => {
        const rawInput = (text || '').trim();

        if (!rawInput) {
            let guide = `*PENCARIAN PINTEREST*\n\n`;
            guide += `Format penggunaan:\n`;
            guide += `• *${prefix + command} <kata kunci>*\n`;
            guide += `• *${prefix + command} <kata kunci> <jumlah (1-5)>*\n`;
            guide += `• *${prefix + command} <kata kunci> --count=<jumlah>*\n\n`;
            guide += `Contoh:\n`;
            guide += `• *${prefix + command} kucing lucu*\n`;
            guide += `• *${prefix + command} anime aesthetic 3*\n`;
            guide += `• *${prefix + command} cyberpunk city wallpaper*`;
            return m.reply(guide);
        }

        let query = rawInput;
        let count = 1;

        // Cek opsi flag --count=X atau --jumlah=X
        const countFlagMatch = query.match(/--(?:count|jumlah|total)=(\d+)/i);
        if (countFlagMatch) {
            count = parseInt(countFlagMatch[1], 10) || 1;
            query = query.replace(/--(?:count|jumlah|total)=\d+/i, '').trim();
        } else if (args && args.length > 1) {
            // Cek jika argumen terakhir adalah angka jumlah (1 sampai 5)
            const lastArg = args[args.length - 1];
            if (/^[1-5]$/.test(lastArg)) {
                count = parseInt(lastArg, 10);
                query = args.slice(0, -1).join(' ').trim();
            }
        }

        // Batasi jumlah agar tidak spam di chat
        if (count < 1) count = 1;
        if (count > 5) count = 5;

        if (!query) {
            return m.reply(`*Kata kunci pencarian tidak boleh kosong!* Masukkan teks setelah perintah.`);
        }

        try {
            const apiUrl = `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}&type=image`;
            const { data } = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 20000
            });

            if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
                return m.reply(`*Pencarian tidak ditemukan.* Tidak ada hasil Pinterest untuk kata kunci: "${query}".`);
            }

            // Filter item yang punya image_url valid
            const validItems = data.data.filter(item => item && item.image_url && typeof item.image_url === 'string');

            if (validItems.length === 0) {
                return m.reply(`*Gambar tidak ditemukan.* Tidak ada gambar yang dapat dimuat untuk kata kunci: "${query}".`);
            }

            // Acak hasil agar selalu variatif setiap pencarian
            const selectedItems = shuffleArray(validItems).slice(0, count);

            for (let i = 0; i < selectedItems.length; i++) {
                const item = selectedItems[i];
                const rawTitle = (item.grid_title || item.seo_alt_text || item.description || query || '').trim();
                const title = rawTitle.length > 120 ? rawTitle.slice(0, 117) + '...' : rawTitle;
                const author = item.pinner ? (item.pinner.full_name || item.pinner.username || '-') : '-';
                const board = item.board ? (item.board.name || '-') : '-';
                const pinUrl = item.pin || '-';

                let caption = `*HASIL PINTEREST*`;
                if (count > 1) caption += ` [${i + 1}/${selectedItems.length}]`;
                caption += `\n\n`;
                caption += `• *Judul:* ${title || '-'}\n`;
                caption += `• *Pengunggah:* ${author}\n`;
                caption += `• *Papan:* ${board}\n`;
                caption += `• *Sumber:* ${pinUrl}`;

                const imgBuffer = await getImageBuffer(item.image_url);

                if (imgBuffer) {
                    await bob.sendMessage(m.chat, { image: imgBuffer, caption }, { quoted: m });
                } else {
                    // Fallback kirim via URL langsung jika buffer gagal diambil
                    await bob.sendMessage(m.chat, { image: { url: item.image_url }, caption }, { quoted: m });
                }

                // Jeda 600ms jika kirim lebih dari 1 gambar agar teratur
                if (count > 1 && i < selectedItems.length - 1) {
                    await sleep(600);
                }
            }
        } catch (err) {
            console.error('[Pinterest Search Error]:', err?.message || err);
            return m.reply(`*Gagal memproses pencarian Pinterest.* Terjadi kendala saat menghubungi server API: ${err?.message || 'Unknown error'}`);
        }
    }
};
