const exifr = require('exifr');
const axios = require('axios');

/**
 * Format decimal coordinates to Degrees, Minutes, Seconds (DMS)
 */
function toDms(val, isLat) {
    if (val === undefined || val === null || isNaN(val)) return '-';
    const ref = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    const absVal = Math.abs(val);
    const d = Math.floor(absVal);
    const m = Math.floor((absVal - d) * 60);
    const s = (((absVal - d) * 60 - m) * 60).toFixed(2);
    return `${d}° ${m}' ${s}" ${ref}`;
}

/**
 * Format date object or string into readable Indonesian time format
 */
function formatDate(dateVal, offset) {
    if (!dateVal) return '-';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const offsetStr = offset ? ` (UTC${offset})` : '';
        return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}${offsetStr}`;
    } catch (_) {
        return String(dateVal);
    }
}

module.exports = {
    CmD: ['trackfoto', 'trakfoto'],
    aliases: ['trackfoto', 'trakfoto', 'trackimg', 'exiffoto', 'cekexif', 'locfoto'],
    categori: 'tools',
    desc: 'Melacak metadata EXIF foto (device, lokasi GPS, waktu, kamera)',
    exec: async (m, { bob, prefix, command, args, text, quoted, mime, isCreator, isOwner }) => {
        const quotedMsg = quoted ? (quoted.msg || quoted) : null;
        const currentMime = (quotedMsg && quotedMsg.mimetype) || mime || (m.msg && m.msg.mimetype) || '';
        const isQuotedImage = quoted?.mtype === 'imageMessage' || /image\/(jpeg|jpg|png|webp|heic)/i.test(currentMime);
        const isQuotedDoc = quoted?.mtype === 'documentMessage' && (/image/i.test(currentMime) || /\.(jpg|jpeg|png|heic)$/i.test(quotedMsg?.fileName || ''));
        const isSelfImage = m.mtype === 'imageMessage' || /image\/(jpeg|jpg|png|webp|heic)/i.test(currentMime);
        const isSelfDoc = m.mtype === 'documentMessage' && (/image/i.test(currentMime) || /\.(jpg|jpeg|png|heic)$/i.test(m.msg?.fileName || ''));

        // Cek URL dari argumen
        const urlMatch = (text || '').match(/https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.webp|\.heic|[^\s]*)/i);
        const inputUrl = urlMatch ? urlMatch[0] : null;

        if (!isQuotedImage && !isQuotedDoc && !isSelfImage && !isSelfDoc && !inputUrl) {
            return m.reply(
                `📸 *PHOTO TRACKER & EXIF ANALYZER* 📸\n` +
                `_Kategori: Tools_\n\n` +
                `📌 *Cara Penggunaan:*\n` +
                `1. *Reply Foto/Dokumen:* Balas gambar/foto dengan caption *${prefix + command}*\n` +
                `2. *Kirim Langsung:* Kirim foto dengan caption *${prefix + command}*\n` +
                `3. *Via URL:* Ketik *${prefix + command} <URL Foto>*\n\n` +
                `💡 *Catatan:* Untuk hasil paling akurat, kirimkan foto asli sebagai *Dokumen (Document)* tanpa kompresi WhatsApp agar metadata EXIF & GPS tidak terhapus.`
            );
        }

        await m.reply('🔍 _Sedang mengunduh dan menganalisis metadata EXIF foto..._');

        let imageBuffer = null;

        try {
            if (inputUrl) {
                const response = await axios.get(inputUrl, {
                    responseType: 'arraybuffer',
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                imageBuffer = Buffer.from(response.data);
            } else if (isQuotedImage || isQuotedDoc) {
                // Prioritaskan bob.downloadMediaMessage untuk quoted (didukung fallback type)
                try {
                    imageBuffer = await bob.downloadMediaMessage(quoted);
                } catch (e1) {
                    console.warn('[owner_trackfoto] downloadMediaMessage(quoted) failed:', e1?.message);
                    if (quoted && typeof quoted.download === 'function') {
                        try {
                            imageBuffer = await quoted.download();
                        } catch (e2) {
                            console.warn('[owner_trackfoto] quoted.download failed:', e2?.message);
                        }
                    }
                    if (!imageBuffer && typeof m.getQuotedObj === 'function') {
                        try {
                            const originalMsg = await m.getQuotedObj();
                            if (originalMsg) {
                                imageBuffer = await bob.downloadMediaMessage(originalMsg);
                            }
                        } catch (e3) {
                            console.warn('[owner_trackfoto] getQuotedObj failed:', e3?.message);
                        }
                    }
                    if (!imageBuffer) throw e1;
                }
            } else if (isSelfImage || isSelfDoc) {
                imageBuffer = await bob.downloadMediaMessage(m);
            }
        } catch (errDl) {
            console.error('Error downloading image in owner_trackfoto:', errDl);
            const errStr = String(errDl?.message || errDl);
            if (/bad decrypt/i.test(errStr)) {
                return m.reply(
                    `❌ *Gagal Mengunduh Foto: Kunci Enkripsi Kedaluwarsa (Bad Decrypt)*\n\n` +
                    `WhatsApp tidak dapat mendekripsi file foto ini. Penyebab umumnya:\n` +
                    `1. *Media Kedaluwarsa:* Foto yang di-reply dikirim sudah cukup lama atau merupakan pesan terusan (forward), sehingga kunci/token unduhan dari server WhatsApp telah kedaluwarsa.\n` +
                    `2. *Sesi Quote Tidak Lengkap:* WhatsApp tidak menyertakan kunci dekripsi penuh pada balasan pesan.\n\n` +
                    `💡 *Solusi:*\n` +
                    `• Kirim foto secara langsung dengan caption *${prefix + command}* (bukan mereply foto lama).\n` +
                    `• Kirim ulang fotonya sebagai file *Dokumen* tanpa kompresi.\n` +
                    `• Atau gunakan tautan/URL foto: *${prefix + command} <URL Foto>*`
                );
            }
            return m.reply(`❌ *Gagal mengunduh gambar:* ${errStr}`);
        }

        if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
            return m.reply('❌ *Gagal mengunduh data gambar!* Pastikan file atau tautan valid.');
        }

        let meta = null;
        try {
            meta = await exifr.parse(imageBuffer, {
                tiff: true,
                xmp: true,
                icc: true,
                iptc: true,
                jfif: true,
                exif: true,
                gps: true
            });
        } catch (errExif) {
            console.error('Error parsing EXIF with exifr:', errExif);
            return m.reply(`❌ *Gagal mengekstrak EXIF:* ${errExif.message || errExif}`);
        }

        if (!meta || Object.keys(meta).length === 0) {
            return m.reply(
                `⚠️ *METADATA TIDAK DITEMUKAN!*\n\n` +
                `Gambar ini tidak memiliki informasi EXIF/Metadata.\n\n` +
                `*Penyebab Umum:*\n` +
                `• Foto dikirim lewat WhatsApp sebagai foto biasa (WhatsApp secara otomatis menghapus EXIF demi privasi).\n` +
                `• Foto merupakan tangkapan layar (screenshot).\n` +
                `• Metadata telah dibersihkan oleh aplikasi pengedit foto / media sosial.\n\n` +
                `💡 *Solusi:* Minta pengirim mengirimkan foto dalam format *Dokumen* agar data asli tetap utuh.`
            );
        }

        // Ekstraksi data
        const make = meta.Make || '-';
        const model = meta.Model || '-';
        const software = meta.Software || meta.HostComputer || '-';
        const lens = meta.LensModel || meta.LensInfo || '-';
        const dateOriginal = meta.DateTimeOriginal || meta.CreateDate || meta.ModifyDate;
        const offsetTime = meta.OffsetTimeOriginal || meta.OffsetTime || '';
        const formattedDate = formatDate(dateOriginal, offsetTime);

        // Spesifikasi Teknis Kamera
        const iso = meta.ISO || meta.ISOSpeedRatings || '-';
        const fNumber = meta.FNumber ? `f/${meta.FNumber}` : (meta.ApertureValue ? `f/${meta.ApertureValue.toFixed(1)}` : '-');
        const focalLength = meta.FocalLength ? `${meta.FocalLength} mm` : '-';
        const focalLength35 = meta.FocalLengthIn35mmFormat ? `${meta.FocalLengthIn35mmFormat} mm` : '-';
        const exposureTime = meta.ExposureTime ? (meta.ExposureTime < 1 ? `1/${Math.round(1 / meta.ExposureTime)}s` : `${meta.ExposureTime}s`) : '-';
        const width = meta.ExifImageWidth || meta.ImageWidth || '-';
        const height = meta.ExifImageHeight || meta.ImageHeight || '-';

        // GPS data
        const lat = typeof meta.latitude === 'number' ? meta.latitude : (meta.GPSLatitude ? (meta.GPSLatitudeRef === 'S' ? -Math.abs(meta.GPSLatitude) : Math.abs(meta.GPSLatitude)) : null);
        const lon = typeof meta.longitude === 'number' ? meta.longitude : (meta.GPSLongitude ? (meta.GPSLongitudeRef === 'W' ? -Math.abs(meta.GPSLongitude) : Math.abs(meta.GPSLongitude)) : null);
        const altitude = meta.GPSAltitude !== undefined ? `${Number(meta.GPSAltitude).toFixed(1)} m dpl` : '-';
        const hasGps = lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon);

        let locationName = 'Lokasi GPS Foto';
        let addressText = 'Tidak ada koordinat GPS';
        let mapsUrl = '';

        if (hasGps) {
            mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
            try {
                const geoRes = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
                    headers: { 'User-Agent': 'SelfBot-WhatsApp/1.0' },
                    timeout: 6000
                });
                if (geoRes.data && geoRes.data.display_name) {
                    addressText = geoRes.data.display_name;
                    locationName = geoRes.data.name || (geoRes.data.address && (geoRes.data.address.road || geoRes.data.address.city || geoRes.data.address.town)) || 'Lokasi Terlacak';
                }
            } catch (errGeo) {
                console.warn('Gagal reverse geocode OSM:', errGeo.message || errGeo);
                addressText = 'Gagal memuat alamat detail (OpenStreetMap timeout). Silakan cek via Google Maps.';
            }
        }

        // Susun Laporan Hasil Tracking
        let report = `🛰️ *HASIL TRACKING METADATA FOTO* 🛰️\n`;
        report += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        report += `📱 *INFORMASI PERANGKAT*\n`;
        report += `• *Pabrikan :* ${make}\n`;
        report += `• *Model HP :* ${model}\n`;
        report += `• *Software :* ${software}\n`;
        report += `• *Lensa :* ${lens}\n\n`;

        report += `📸 *PARAMETER KAMERA*\n`;
        report += `• *Resolusi :* ${width} x ${height}\n`;
        report += `• *Aperture :* ${fNumber}\n`;
        report += `• *Focal Length :* ${focalLength} (35mm: ${focalLength35})\n`;
        report += `• *ISO :* ${iso}\n`;
        report += `• *Shutter Speed :* ${exposureTime}\n\n`;

        report += `🕒 *WAKTU PENGAMBILAN*\n`;
        report += `• *Waktu Asli :* ${formattedDate}\n\n`;

        report += `📍 *LOKASI & GPS*\n`;
        if (hasGps) {
            report += `• *Status :* ✅ Koordinat Ditemukan\n`;
            report += `• *Latitude :* ${lat} (${toDms(lat, true)})\n`;
            report += `• *Longitude :* ${lon} (${toDms(lon, false)})\n`;
            report += `• *Ketinggian :* ${altitude}\n`;
            report += `• *Alamat :* ${addressText}\n\n`;
            report += `🔗 *Google Maps:*\n${mapsUrl}\n`;
        } else {
            report += `• *Status :* ❌ Tidak Ada Tag GPS\n`;
            report += `_(Foto memiliki EXIF kamera tetapi fitur geotagging/GPS dinonaktifkan saat memotret)_\n`;
        }

        report += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `_Tools • Self-Bot v1.4.0_`;

        // Kirim laporan teks
        await bob.sendMessage(m.chat, { text: report }, { quoted: m });

        // Jika terdapat GPS, kirimkan juga pesan Pin Lokasi WhatsApp interaktif
        if (hasGps) {
            try {
                await bob.sendMessage(m.chat, {
                    location: {
                        degreesLatitude: lat,
                        degreesLongitude: lon,
                        name: locationName,
                        address: addressText
                    }
                }, { quoted: m });
            } catch (errLoc) {
                console.error('Error sending location pin:', errLoc);
            }
        }
    }
};
