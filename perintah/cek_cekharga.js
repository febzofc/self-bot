const { searchProductByImage } = require('../lib/scrapers/product_search.js');
const { uploadToPrntsc } = require('../lib/scrapers/prntsc.js');

/**
 * Handler utama pencarian harga produk dari foto
 */
async function handleCekHarga(m, { bob, text, prefix = '.', command = 'cekharga' }) {
    const quoted = m.quoted;
    const quotedMsg = quoted ? (quoted.msg || quoted) : null;
    const currentMime = (quotedMsg && quotedMsg.mimetype) || (m.msg && m.msg.mimetype) || (m.mimetype) || '';
    const isImage = /image\/(png|jpe?g|webp|gif)/i.test(currentMime) || 
        quoted?.mtype === 'imageMessage' || 
        m.mtype === 'imageMessage' ||
        quoted?.mtype === 'stickerMessage' ||
        m.mtype === 'stickerMessage';

    if (!isImage) {
        let guide = `🛍️ *FITUR CEK HARGA BARANG (VISUAL SEARCH)* 🛍️\n\n`;
        guide += `Cara Penggunaan:\n`;
        guide += `1️⃣ *Kirim foto barang* dengan caption: *${prefix}cekharga*\n`;
        guide += `2️⃣ *Atau balas (reply) foto barang* yang sudah ada dengan: *${prefix}cekharga*\n`;
        guide += `3️⃣ Bisa ditambah kata kunci opsional, contoh: *${prefix}cekharga original*\n\n`;
        guide += `💡 Bot akan otomatis mendeteksi objek barang dan mencari perbandingan harga serupa di *Shopee*, *Tokopedia*, dan *Lazada* lengkap beserta pratinjau gambarnya.`;
        return m.reply(guide);
    }

    await m.reply('🔎 _Sedang mendeteksi barang dari foto & memindai harga di Shopee, Tokopedia, Lazada..._');

    // 1. Download buffer media dari WhatsApp
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
        console.error('[Download Error CekHarga]:', errDl.message);
    }

    if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
        return m.reply('⚠️ Gagal mengunduh foto barang. Silakan kirim atau reply ulang fotonya.');
    }

    // 2. Upload foto ke prnt.sc agar memiliki direct raw URL publik untuk pemindaian visual
    let publicImageUrl = '';
    try {
        const uploadResult = await uploadToPrntsc(mediaBuffer, {
            filename: 'product_scan.png',
            contentType: 'image/png'
        });
        publicImageUrl = uploadResult.rawImageUrl || uploadResult.pageUrl || '';
    } catch (errUp) {
        console.error('[Upload Error CekHarga]:', errUp.message);
    }

    // 3. Eksekusi pencarian visual dan komparasi marketplace
    const searchResult = await searchProductByImage({
        imageUrl: publicImageUrl,
        extraQuery: text || ''
    });

    // 4. Susun teks hasil perbandingan harga
    let caption = `🛍️ *HASIL CEK HARGA BARANG* 🛍️\n\n`;
    caption += `🏷️ *Barang Terdeteksi:* *${searchResult.productName.toUpperCase()}*\n`;
    if (searchResult.detectedTags && searchResult.detectedTags.length > 1) {
        caption += `🔍 *Kategori/Tag:* _${searchResult.detectedTags.slice(0, 3).join(', ')}_\n`;
    }
    caption += `💰 *Kisaran Pasar:* *${searchResult.priceRange}*\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    caption += `📦 *PERBANDINGAN DI MARKETPLACE:*\n\n`;

    // Shopee
    caption += `🟠 *SHOPEE*\n`;
    caption += `• Estimasi: *${searchResult.shopee.price}*\n`;
    caption += `• Cari di Shopee: ${searchResult.shopee.url}\n\n`;

    // Tokopedia
    caption += `🟢 *TOKOPEDIA*\n`;
    caption += `• Estimasi: *${searchResult.tokopedia.price}*\n`;
    caption += `• Cari di Tokopedia: ${searchResult.tokopedia.url}\n\n`;

    // Lazada
    caption += `🔵 *LAZADA*\n`;
    caption += `• Estimasi: *${searchResult.lazada.price}*\n`;
    caption += `• Cari di Lazada: ${searchResult.lazada.url}\n\n`;

    // Blibli
    caption += `🌐 *BLIBLI*\n`;
    caption += `• Cari di Blibli: ${searchResult.blibli.url}\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (searchResult.marketplaceItems && searchResult.marketplaceItems.length > 0) {
        caption += `📋 *Rekomendasi Produk Serupa:*\n`;
        searchResult.marketplaceItems.slice(0, 3).forEach((item, idx) => {
            caption += `*${idx + 1}. [${item.market}]* ${item.title}\n`;
            if (item.price) caption += `   💵 ${item.price}\n`;
            if (item.url) caption += `   🔗 ${item.url}\n`;
        });
        caption += `\n`;
    }

    caption += `💡 _Ketuk link marketplace di atas untuk melihat katalog lengkap, promo diskon, dan gratis ongkir._`;

    // 5. Kirimkan pesan dengan pratinjau gambar produk
    const previewUrl = searchResult.previewImage;
    if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('http')) {
        try {
            return await bob.sendMessage(m.chat, {
                image: { url: previewUrl },
                caption: caption
            }, { quoted: m });
        } catch (errSendImg) {
            console.error('[Send Preview Image Error]:', errSendImg.message);
        }
    }

    // Fallback jika pengiriman gambar pratinjau terkendala: kirim kembali dengan foto asli atau teks
    try {
        await bob.sendMessage(m.chat, {
            image: mediaBuffer,
            caption: caption
        }, { quoted: m });
    } catch (e) {
        await m.reply(caption);
    }
}

module.exports = {
    CmD: ['cekharga'],
    aliases: [
        'cekharga',
        'cek-harga',
        'hargabarang',
        'caribarang',
        'cekproduk',
        'hargaproduk'
    ],
    categori: 'CEK CEK',
    desc: 'Cek harga barang/produk serupa dari foto menggunakan visual search (Shopee, Tokopedia, Lazada, dll) beserta pratinjau gambar',

    /**
     * Hook before: Menangani kiriman foto dengan caption langsung 'cekharga' tanpa prefix
     */
    before: async (m, { bob, body, budy, prefix = '.' }) => {
        if (!m || m.isBaileys || m.fromMe) return false;

        const text = (budy || body || '').trim();
        if (!text) return false;

        const lower = text.toLowerCase();
        // Cek jika pesan berupa gambar dengan caption yang mengandung cekharga tanpa prefix
        const isCaptionCekHarga = (lower === 'cekharga' || lower.startsWith('cekharga '));

        if (m.mtype === 'imageMessage' && isCaptionCekHarga) {
            const extraText = text.replace(/^cekharga\s*/i, '').trim();
            await handleCekHarga(m, { bob, text: extraText, prefix, command: 'cekharga' });
            return true;
        }

        return false;
    },

    /**
     * Eksekusi perintah ber-prefix (.cekharga, !cekharga, dll)
     */
    exec: async (m, { bob, args, text, prefix, command }) => {
        await handleCekHarga(m, { bob, text: text || '', prefix, command });
    }
};
