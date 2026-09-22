const fs = require('fs');
const path = require('path');
const expressionManager = require('../lib/expressionManager.js');
const { imageToWebp, videoToWebp } = require('../lib/exif.js');

module.exports = {
    CmD: ['addekpresi', 'listekpresi', 'tesekpresi', 'delekpresi'],
    aliases: [
        'addekpresi', 'addekpresion', 'addakpresi', 'addekspresi', 'addexpression',
        'listekpresi', 'listekspresi', 'listexpression', 'daftarekpresi', 'daftarekspresi',
        'tesekpresi', 'tesekspresi', 'getekpresi', 'getekspresi',
        'delekpresi', 'delekspresi', 'rmekpresi', 'rmekspresi', 'hapusekpresi', 'hapusekspresi'
    ],
    categori: 'maker',
    desc: 'Fitur simpan & kelola stiker ekspresi otomatis untuk respon obrolan bot',

    exec: async (m, { bob, args, text, prefix, command, isCreator, isOwner, quoted, mime }) => {
        const cmd = (command || '').toLowerCase();
        const isAuthorized = isCreator || isOwner || m.key.fromMe || m.fromMe;

        // ==========================================
        // 1. TAMBAH EKSPRESI (.addekpresi)
        // ==========================================
        if (['addekpresi', 'addekpresion', 'addakpresi', 'addekspresi', 'addexpression'].includes(cmd)) {
            if (!isAuthorized) {
                return m.reply('❌ Perintah ini khusus untuk Owner / Pembuat Bot!');
            }

            const rawText = (text || '').trim();
            if (!rawText) {
                return m.reply(
                    `🎭 *PANDUAN TAMBAH STIKER EKSPRESI* 🎭\n\n` +
                    `Simpan stiker favoritmu sebagai bahan balasan ekspresif bot saat mengobrol biasa (peluang kirim 35%).\n\n` +
                    `📌 *Format Penggunaan:*\n` +
                    `Balas (reply) stiker dengan perintah:\n` +
                    `*${prefix + command} <nama_ekspresi> | <deskripsi_penggunaan>*\n\n` +
                    `💡 *Contoh:*\n` +
                    `• *${prefix + command} sedih | gunakan saat menangis terharu atau terluka terhina dll*\n` +
                    `• *${prefix + command} lucu | gunakan saat ada lelucon ngakak kocak tertawa*\n` +
                    `• *${prefix + command} jomok | gunakan saat mas amba rusdi ngawi pria berotot*\n` +
                    `• *${prefix + command} marah | gunakan saat kesal jengkel atau mengumpat*\n\n` +
                    `ℹ️ _Tanda batasan "|" digunakan agar bot paham betul situasi & emosi yang tepat sebelum mengirim stiker!_`
                );
            }

            if (!rawText.includes('|')) {
                return m.reply(
                    `⚠️ *Format Kurang Tepat!*\n\n` +
                    `Harap sertakan tanda pemisah vertikal *|* antara nama ekspresi dan deskripsinya.\n\n` +
                    `*Format:* ${prefix + command} <nama_ekspresi> | <deskripsi_penggunaan>\n` +
                    `*Contoh:* ${prefix + command} sedih | gunakan saat menangis terharu atau terluka terhina dll`
                );
            }

            const parts = rawText.split('|');
            const name = parts[0].trim();
            const description = parts.slice(1).join('|').trim();

            if (!name || !description) {
                return m.reply(
                    `⚠️ *Nama atau deskripsi tidak boleh kosong!*\n\n` +
                    `*Contoh:* ${prefix + command} sedih | gunakan saat menangis terharu atau terluka terhina dll`
                );
            }

            // Deteksi media dari quoted atau pesan langsung
            const quotedMsg = quoted ? (quoted.msg || quoted) : null;
            const currentMime = (quotedMsg && quotedMsg.mimetype) || mime || (m.msg && m.msg.mimetype) || '';
            const isSticker = quoted?.mtype === 'stickerMessage' || m.mtype === 'stickerMessage' || /webp/.test(currentMime);
            const isImage = quoted?.mtype === 'imageMessage' || m.mtype === 'imageMessage' || /image/.test(currentMime);
            const isVideo = quoted?.mtype === 'videoMessage' || m.mtype === 'videoMessage' || /video/.test(currentMime);

            if (!isSticker && !isImage && !isVideo) {
                return m.reply(
                    `⚠️ *Media Tidak Ditemukan!*\n\n` +
                    `Silakan balas (reply) pesan stiker yang ingin disimpan dengan format:\n` +
                    `*${prefix + command} ${name} | ${description}*`
                );
            }

            m.reply('_⏳ Sedang memproses dan menyimpan stiker ekspresi..._');

            let mediaBuffer = null;
            try {
                if (quoted && typeof quoted.download === 'function') {
                    mediaBuffer = await quoted.download();
                } else if (m && typeof m.download === 'function') {
                    mediaBuffer = await m.download();
                } else {
                    mediaBuffer = await bob.downloadMediaMessage(quoted || m);
                }
            } catch (dlErr) {
                console.error('[addekpresi] Error download media:', dlErr);
            }

            if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
                return m.reply('❌ Gagal mengunduh stiker dari WhatsApp. Silakan coba reply ulang stikernya.');
            }

            // Konversi ke webp stiker jika input adalah foto atau video pendek
            let finalWebpBuffer = mediaBuffer;
            try {
                if (isImage && !isSticker) {
                    finalWebpBuffer = await imageToWebp(mediaBuffer);
                } else if (isVideo && !isSticker) {
                    finalWebpBuffer = await videoToWebp(mediaBuffer);
                }
            } catch (convErr) {
                console.error('[addekpresi] Error konversi media ke webp:', convErr);
                return m.reply('❌ Gagal mengonversi media ke format stiker webp.');
            }

            try {
                const saved = await expressionManager.addExpression({
                    name,
                    description,
                    buffer: finalWebpBuffer,
                    sender: m.sender
                });

                return m.reply(
                    `✅ *Stiker Ekspresi Berhasil Disimpan!*\n\n` +
                    `🏷️ *Kategori Ekspresi:* ${saved.name}\n` +
                    `📝 *Deskripsi Penggunaan:* ${saved.description}\n` +
                    `🆔 *ID Stiker:* \`${saved.id}\`\n\n` +
                    `🤖 *Mekanisme Kerja:* Saat kamu atau lawan bicara mengobrol biasa dengan bot, bot akan memiliki peluang *35%* mengekspresikan diri dengan stiker ini jika suasananya pas!\n\n` +
                    `_Ketik *${prefix}listekpresi* untuk melihat semua daftar ekspresi._`
                );
            } catch (errSave) {
                console.error('[addekpresi] Gagal menyimpan ekspresi:', errSave);
                return m.reply(`❌ Gagal menyimpan ke database: ${errSave.message || errSave}`);
            }
        }

        // ==========================================
        // 2. DAFTAR EKSPRESI (.listekpresi)
        // ==========================================
        if (['listekpresi', 'listekspresi', 'listexpression', 'daftarekpresi', 'daftarekspresi'].includes(cmd)) {
            const grouped = expressionManager.getGroupedExpressions();
            const keys = Object.keys(grouped);

            if (keys.length === 0) {
                return m.reply(
                    `ℹ️ *Belum ada stiker ekspresi yang tersimpan.*\n\n` +
                    `Kirim atau reply stiker lalu ketik:\n` +
                    `*${prefix}addekpresi <nama> | <deskripsi>*\n\n` +
                    `_Contoh:_ *${prefix}addekpresi sedih | gunakan saat menangis terharu atau terluka terhina dll*`
                );
            }

            let totalStickers = 0;
            let listText = `🎭 *DAFTAR EKSPRESI STIKER BOT* 🎭\n`;
            let index = 1;

            for (const key of keys) {
                const item = grouped[key];
                totalStickers += item.count;
                const descStr = item.descriptions.length > 0
                    ? item.descriptions.map(d => `"${d}"`).join(', ')
                    : '-';

                listText += `\n${index++}. *${item.name.toUpperCase()}* (${item.count} stiker)\n`;
                listText += `   📝 _Deskripsi: ${descStr}_\n`;
            }

            listText += `\n📊 *Statistik:* ${totalStickers} stiker terdaftar di ${keys.length} ekspresi emosi.`;
            listText += `\n🎲 *Peluang Kirim:* 35% setelah respon teks obrolan bot.`;
            listText += `\n\n🛠️ *Perintah Terkait:*`;
            listText += `\n• *${prefix}tesekpresi <nama>* (Cek contoh stiker)`;
            listText += `\n• *${prefix}delekpresi <nama/id>* (Hapus stiker ekspresi)`;

            return m.reply(listText);
        }

        // ==========================================
        // 3. TES / CEK EKSPRESI (.tesekpresi)
        // ==========================================
        if (['tesekpresi', 'tesekspresi', 'getekpresi', 'getekspresi'].includes(cmd)) {
            const query = (text || '').trim().toLowerCase();
            if (!query) {
                return m.reply(`Gunakan: *${prefix + command} <nama_ekspresi>*\nContoh: *${prefix + command} sedih*`);
            }

            const grouped = expressionManager.getGroupedExpressions();
            if (!grouped[query] || grouped[query].items.length === 0) {
                return m.reply(`❌ Kategori ekspresi *${query}* tidak ditemukan. Ketik *${prefix}listekpresi* untuk melihat daftar.`);
            }

            const items = grouped[query].items;
            m.reply(`Mengirim ${items.length} stiker untuk ekspresi *${query}*...`);

            for (const item of items) {
                const fullPath = path.isAbsolute(item.file)
                    ? item.file
                    : path.join(__dirname, '..', item.file);

                if (fs.existsSync(fullPath)) {
                    const buf = fs.readFileSync(fullPath);
                    await bob.sendMessage(m.chat, { sticker: buf }, { quoted: m });
                }
            }
            return;
        }

        // ==========================================
        // 4. HAPUS EKSPRESI (.delekpresi)
        // ==========================================
        if (['delekpresi', 'delekspresi', 'rmekpresi', 'rmekspresi', 'hapusekpresi', 'hapusekspresi'].includes(cmd)) {
            if (!isAuthorized) {
                return m.reply('❌ Perintah ini khusus untuk Owner / Pembuat Bot!');
            }

            const query = (text || '').trim();
            if (!query) {
                return m.reply(`Gunakan: *${prefix + command} <nama_ekspresi atau ID_stiker>*\nContoh: *${prefix + command} sedih*`);
            }

            const res = await expressionManager.deleteExpression(query);
            if (res.deletedCount === 0) {
                return m.reply(`❌ Tidak ditemukan stiker ekspresi dengan nama atau ID "${query}".`);
            }

            return m.reply(`✅ Berhasil menghapus *${res.deletedCount}* stiker ekspresi untuk "${query}".`);
        }
    }
};
