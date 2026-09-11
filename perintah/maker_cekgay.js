const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const { getBuffer } = require('../lib/fungsi.js');
const { UploadFileUgu, UploadZetnata } = require('../lib/scrapers/uploader.js');

/**
 * Upload buffer ke server publik (Uguu / Zetnata) untuk mendapatkan image URL
 */
async function uploadToUrl(buffer, ext = 'png') {
    const tempFile = path.join('/tmp', `cekgay_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`);
    try {
        fs.writeFileSync(tempFile, buffer);
        let url = null;
        try {
            const resUgu = await UploadFileUgu(tempFile);
            if (resUgu?.url) url = resUgu.url;
        } catch (e) {
            console.warn('Uguu upload error in cekgay:', e?.message || e);
        }

        if (!url) {
            try {
                const resZet = await UploadZetnata(tempFile);
                if (resZet?.rawUrl || resZet?.downloadUrl) url = resZet.rawUrl || resZet.downloadUrl;
            } catch (e) {
                console.warn('Zetnata upload error in cekgay:', e?.message || e);
            }
        }
        return url;
    } finally {
        try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch (_) {}
    }
}

module.exports = {
    CmD: ['cekgay', 'gaycek', 'gay'],
    aliases: ['cekgay', 'gaycek', 'gay'],
    categori: 'maker',
    desc: 'Cek persentase gay seseorang dengan canvas',
    exec: async (m, { bob, prefix, command, text, mime, quoted, pushname }) => {
        const quotedMsg = quoted ? (quoted.msg || quoted) : null;
        const isQuotedImage = quotedMsg && (/image/.test(quotedMsg.mimetype || '') || quoted.mtype === 'imageMessage');
        const isDirectImage = /image/.test(m.mtype || m.msg?.mimetype || mime || '');

        if (!isQuotedImage && !isDirectImage) {
            return m.reply(`🏳️‍🌈 *CEK GAY CANVAS GENERATOR* 🏳️‍🌈\n\n📌 *Cara Penggunaan:* Kirim atau balas (reply) foto dengan caption *${prefix + command} <nama>*\n\nContoh:\n• *${prefix + command} Lendra* (sambil kirim/reply foto)`);
        }

        let targetName = (text || '').trim();
        if (!targetName) {
            return m.reply(`⚠️ *Nama belum dimasukkan!*\n\nSilakan masukkan nama orang tersebut.\nContoh:\n• *${prefix + command} Lendra* (sambil kirim/reply foto)`);
        }

        // Hapus karakter @ jika ada mention
        targetName = targetName.replace(/^@/, '');

        // Persentase acak antara 1 - 100
        const percentage = Math.floor(Math.random() * 100) + 1;

        await m.reply(`⏳ *Sedang menganalisis tingkat gay untuk ${targetName}...*\nPersentase terdeteksi: *${percentage}%*`);

        let mediaBuffer = null;
        try {
            if (isQuotedImage) {
                mediaBuffer = typeof quoted.download === 'function'
                    ? await quoted.download()
                    : await bob.downloadMediaMessage(quoted);
            } else {
                mediaBuffer = typeof m.download === 'function'
                    ? await m.download()
                    : await bob.downloadMediaMessage(m);
            }
        } catch (dlErr) {
            console.error('Error downloading media for cekgay:', dlErr);
        }

        if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
            return m.reply('❌ *Gagal mengunduh gambar!* Silakan coba kirim atau balas kembali gambarnya.');
        }

        try {
            // 1. Panggil API Canvas Gay
            const form = new FormData();
            form.append('nama', targetName);
            form.append('num', String(percentage));
            form.append('avatar', mediaBuffer, {
                filename: 'avatar.jpg',
                contentType: 'image/jpeg'
            });

            const res = await axios.post('https://api.siputzx.my.id/api/canvas/gay', form, {
                headers: form.getHeaders(),
                responseType: 'arraybuffer',
                timeout: 30000
            });

            if (!res.data || res.status !== 200) {
                return m.reply('❌ Gagal menghasilkan gambar dari API Canvas Gay.');
            }

            const canvasBuffer = Buffer.from(res.data);

            // 2. Upload media canvas ke URL hosting publik
            const uploadedUrl = await uploadToUrl(canvasBuffer, 'png');

            // 3. Ambil buffer dari URL online via getBuffer (persis seperti plugin lirik)
            let rawBuf = null;
            if (uploadedUrl) {
                try {
                    let buf = await getBuffer(uploadedUrl);
                    if (Buffer.isBuffer(buf)) {
                        rawBuf = buf;
                    }
                } catch (e) {
                    console.error('Error fetching buffer from uploaded URL:', e);
                }
            }
            if (!rawBuf) {
                rawBuf = canvasBuffer;
            }

            // 4. Siapkan native linkPreview dengan prepareWAMessageMedia & waUploadToServer
            // Target URL langsung mengarah ke tautan file foto hasil cek gay
            const targetUrl = uploadedUrl || global.sourceUrl || 'https://github.com/febzofc/self-bot';
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
                    console.error('Error prepareWAMessageMedia link preview for cekgay:', e);
                }
            }

            let statusKet = '';
            if (percentage >= 85) {
                statusKet = '🏳️‍🌈 Level Dewa! Sangat di luar nalar!';
            } else if (percentage >= 65) {
                statusKet = '🌈 Tingkat tinggi, sudah sangat mencurigakan!';
            } else if (percentage >= 40) {
                statusKet = '👀 50:50, berada di ambang batas!';
            } else if (percentage >= 15) {
                statusKet = '🤏 Masih ada sedikit bibit-bibit.';
            } else {
                statusKet = '✨ 100% Lurus dan aman!';
            }

            const captionText = `🏳️‍🌈 *HASIL CEK GAY RATE* 🏳️‍🌈\n\n` +
                `👤 *Nama:* ${targetName}\n` +
                `📊 *Persentase:* ${percentage}%\n` +
                `📝 *Status:* ${statusKet}\n\n` +
                `──────────────────────────\n` +
                `_Disclaimer: Fitur ini dibuat hanya untuk tujuan hiburan / bercanda semata._`;

            // 5. Susun linkPreview persis seperti search_lyrics.js
            const linkPreview = {
                'matched-text': targetUrl,
                title: `🏳️‍🌈 Cek Gay: ${targetName} (${percentage}%)`,
                description: `${targetName} terdeteksi ${percentage}% Gay. ${statusKet}`,
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

            // 6. Kirim pesan dengan linkPreview persis seperti search_lyrics.js
            await bob.sendMessage(m.chat, {
                text: `${targetUrl}\n\n` + captionText.trim(),
                linkPreview
            }, {
                quoted: m
            });

        } catch (apiErr) {
            console.error('Error generating canvas gay:', apiErr.response?.data || apiErr.message || apiErr);
            return m.reply(`❌ Gagal memproses gambar: ${apiErr.message || 'Terjadi kesalahan saat memanggil API.'}`);
        }
    }
};
