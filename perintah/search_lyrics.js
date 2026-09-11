const axios = require('axios');
const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const { getBuffer } = require('../lib/fungsi.js');

module.exports = {
    CmD: ['lirik', 'lyrics'],
    aliases: ['lirik', 'lyrics', 'lyric', 'carilirik'],
    categori: 'search',
    exec: async (m, { bob, prefix, command, text }) => {
        if (!text || !text.trim()) {
            return m.reply(`🔍 *PENCARIAN LIRIK LAGU*\n\nPenggunaan:\n*${prefix + command} <judul lagu / potongan lirik>*\n\nContoh:\n*${prefix + command} tapi menurutku tuhan itu baik*`);
        }

        await m.reply('⏳ *Mencari lirik lagu...*\nMohon tunggu sebentar.');

        try {
            const query = encodeURIComponent(text.trim());
            const apiUrl = `https://api-faa.my.id/faa/lyrics?q=${query}`;
            const { data } = await axios.get(apiUrl, { timeout: 30000 });

            if (!data || !data.status || !data.result) {
                return m.reply(data?.error || '❌ Lirik lagu tidak ditemukan. Silakan gunakan kata kunci pencarian yang lain.');
            }

            const res = data.result;
            const title = res.title || text.trim();
            const artist = res.artist || 'Tidak diketahui';
            const album = res.album || '-';
            const genre = res.genre || '-';
            const releaseDate = res.release_date || '-';
            const rawLyrics = res.lyrics || 'Lirik tidak tersedia.';

            // Bersihkan format timestamp seperti [00:00.00] jika ada
            const cleanLyrics = rawLyrics
                .replace(/\[\d{2}:\d{2}(?:\.\d+)?\]/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            const targetUrl = res.share_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' ' + artist)}`;

            let teksLirik = `🎵 *LIRIK LAGU*\n\n` +
                `📌 *Judul:* ${title}\n` +
                `👤 *Artis:* ${artist}\n` +
                `💿 *Album:* ${album}\n` +
                `🎸 *Genre:* ${genre}\n` +
                (releaseDate && releaseDate !== '-' ? `📅 *Rilis:* ${releaseDate}\n` : '') +
                `\n────────── *LIRIK* ──────────\n\n` +
                `${cleanLyrics || rawLyrics}\n\n` +
                `─────────────────────────────`;

            // Siapkan cover image & native linkPreview dengan prepareWAMessageMedia & waUploadToServer
            let coverUrl = typeof res.cover === 'string'
                ? res.cover
                : (res.cover?.hd || res.cover?.large || res.cover?.medium || res.cover?.small);

            let rawBuf = null;
            if (coverUrl) {
                try {
                    let buf = await getBuffer(coverUrl);
                    if (Buffer.isBuffer(buf)) {
                        rawBuf = buf;
                    }
                } catch (e) {
                    console.error('Error fetching cover image buffer:', e);
                }
            }

            let imgMsg = null;
            if (rawBuf && bob?.waUploadToServer) {
                try {
                    let resMedia = await prepareWAMessageMedia(
                        { image: rawBuf },
                        { upload: bob.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
                    );
                    if (resMedia?.imageMessage) {
                        imgMsg = resMedia.imageMessage;
                    }
                } catch (e) {
                    console.error('Error prepareWAMessageMedia link preview for lyrics:', e);
                }
            }

            let linkPreview = {
                'matched-text': targetUrl,
                title: `${title} - ${artist}`,
                description: `Album: ${album} • Genre: ${genre}`,
                jpegThumbnail: imgMsg?.jpegThumbnail
                    ? Buffer.from(imgMsg.jpegThumbnail)
                    : (rawBuf || undefined),
                highQualityThumbnail: imgMsg
                    ? {
                        ...imgMsg,
                        width: 1280,
                        height: 720,
                    }
                    : undefined,
            };

            await bob.sendMessage(m.chat, {
                text: `${targetUrl}\n\n` + teksLirik.trim(),
                linkPreview
            }, {
                quoted: m
            });

        } catch (err) {
            console.error('Error in lyrics plugin:', err);
            return m.reply(`❌ Terjadi kesalahan saat mencari lirik lagu:\n${err.message || err}`);
        }
    }
};
