const { fetchJson, getBuffer } = require('../lib/fungsi.js');

module.exports = {
    CmD: ['soundcloud'],
    aliases: ['soundcloud', 'sc', 'scdl', 'soundcloudplay', 'scplay'],
    categori: 'downloader',
    exec: async (m, { prefix, command, text, bob }) => {
        if (!text) {
            return m.reply(`🎵 *SOUNDCLOUD DOWNLOADER* 🎵\n\n*Penggunaan:*\n• *${prefix + command} <judul/query>*\n• *${prefix + command} <judul/query> --doc*\n\n*Contoh:*\n• ${prefix + command} baby angel\n• ${prefix + command} baby angel --doc`);
        }

        let isDoc = false;
        let query = text;

        if (text.includes('--doc')) {
            isDoc = true;
            query = text.replace(/--doc/gi, '').trim();
        }

        if (!query) {
            return m.reply(`❌ *Format Salah!* Masukkan kata kunci atau judul lagu yang ingin dicari.\nContoh: *${prefix + command} baby angel*`);
        }

        m.reply('_Sedang mencari dan mengunduh lagu dari SoundCloud..._');

        try {
            const apiUrl = `https://api-faa.my.id/faa/soundcloud-play?query=${encodeURIComponent(query)}`;
            const res = await fetchJson(apiUrl);

            if (!res || !res.status || !res.result) {
                return m.reply(`❌ *Lagu tidak ditemukan!* ${res?.error ? res.error : ''}`);
            }

            const { title, download_url, thumbnail, duration, user: artist, source_url } = res.result;

            if (!download_url) {
                return m.reply('❌ *Gagal mendapatkan link unduhan lagu.*');
            }

            // Format durasi ms ke mm:ss
            let formattedDuration = '-';
            if (duration && typeof duration === 'number') {
                const totalSeconds = Math.floor(duration / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                formattedDuration = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            }

            const captionText = `🎵 *SOUNDCLOUD DOWNLOADER* 🎵\n\n` +
                `📌 *Judul:* ${title || '-'}\n` +
                `👤 *Artis:* ${artist || '-'}\n` +
                `⏱️ *Durasi:* ${formattedDuration}\n` +
                `🔗 *Source:* ${source_url || '-'}`;

            if (isDoc) {
                // Unduh sebagai dokumen MP3
                await bob.sendMessage(m.chat, {
                    document: { url: download_url },
                    mimetype: 'audio/mpeg',
                    fileName: `${title || 'SoundCloud'}.mp3`,
                    caption: captionText
                }, { quoted: m });
            } else {
                // Unduh sebagai audio WhatsApp biasa (default)
                let audioOptions = {
                    audio: { url: download_url },
                    mimetype: 'audio/mpeg'
                };

                if (thumbnail) {
                    try {
                        const thumbBuf = await getBuffer(thumbnail);
                        if (Buffer.isBuffer(thumbBuf)) {
                            audioOptions.contextInfo = {
                                externalAdReply: {
                                    title: title || 'SoundCloud Music',
                                    body: `Artis: ${artist || '-'} | Durasi: ${formattedDuration}`,
                                    mediaType: 1,
                                    thumbnail: thumbBuf,
                                    sourceUrl: source_url || ''
                                }
                            };
                        }
                    } catch (e) {
                        // Abaikan jika thumbnail gagal didapatkan
                    }
                }

                await bob.sendMessage(m.chat, audioOptions, { quoted: m });
            }
        } catch (err) {
            console.error('Error SoundCloud Downloader:', err);
            return m.reply('❌ *Terjadi kesalahan saat memproses permintaan SoundCloud.*');
        }
    }
};
