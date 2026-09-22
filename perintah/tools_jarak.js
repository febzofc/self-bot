const axios = require('axios');

module.exports = {
    CmD: ['jarak', 'jarakkota', 'distance'],
    aliases: ['jarak', 'jarakkota', 'distance', 'cekjarak', 'rute'],
    categori: 'tools',
    exec: async (m, { bob, args, text, prefix, command }) => {
        const input = (text || '').trim();

        if (!input) {
            let guide = `📍 *FITUR CEK JARAK ANTAR KOTA*\n\n`;
            guide += `Format penggunaan:\n`;
            guide += `• *${prefix + command} <kota asal> ke <kota tujuan>*\n`;
            guide += `• *${prefix + command} <kota asal> | <kota tujuan>*\n\n`;
            guide += `Contoh:\n`;
            guide += `• *${prefix + command} satui tanah bumbu ke Banjarmasin*\n`;
            guide += `• *${prefix + command} Jakarta | Bandung*\n`;
            guide += `• *${prefix + command} Surabaya - Malang*\n`;
            guide += `• *${prefix + command} Yogyakarta, Solo*`;
            return m.reply(guide);
        }

        let dari = '';
        let ke = '';

        if (input.includes('|')) {
            const parts = input.split('|');
            dari = parts[0]?.trim();
            ke = parts.slice(1).join('|').trim();
        } else if (/\s+ke\s+/i.test(input)) {
            const clean = input.replace(/^dari\s+/i, '');
            const parts = clean.split(/\s+ke\s+/i);
            dari = parts[0]?.trim();
            ke = parts.slice(1).join(' ke ').trim();
        } else if (input.includes(' - ')) {
            const parts = input.split(' - ');
            dari = parts[0]?.trim();
            ke = parts.slice(1).join(' - ').trim();
        } else if (input.includes(',')) {
            const parts = input.split(',');
            dari = parts[0]?.trim();
            ke = parts.slice(1).join(',').trim();
        } else {
            return m.reply(
                `⚠️ *Format kurang tepat, wir!*\n\n` +
                `Gunakan pemisah kata *ke*, garis tegak *|*, strip *-*, atau tanda koma *,*.\n\n` +
                `Contoh:\n` +
                `• *${prefix + command} satui tanah bumbu ke Banjarmasin*\n` +
                `• *${prefix + command} Jakarta | Surabaya*`
            );
        }

        if (!dari || !ke) {
            return m.reply(`⚠️ Kota asal dan kota tujuan harus diisi ya, wir!\n\nContoh: *${prefix + command} Jakarta ke Surabaya*`);
        }

        try {
            await m.reply('⏳ _Bentar wir, lagi ngitung jarak & cek rutenya..._');

            const apiUrl = `https://api-faa.my.id/faa/jarakkota?dari=${encodeURIComponent(dari)}&ke=${encodeURIComponent(ke)}`;
            const response = await axios.get(apiUrl, {
                timeout: 30000,
                validateStatus: () => true
            });

            const data = response.data;

            if (!data || !data.status || !data.result) {
                const errMsg = data?.error || 'Gagal mengecek jarak. Coba periksa kembali ejaan nama kotanya ya, wir!';
                return m.reply(`❌ *Gagal Cek Jarak*\n\n${errMsg}`);
            }

            const res = data.result;
            const asal = res.dari || {};
            const tujuan = res.ke || {};
            const estimasi = res.estimasi_waktu || {};
            const jarakInfo = res.jarak || (res.jarak_km ? `${res.jarak_km} km` : '-');

            const originParam = asal.lokasi || asal.nama || dari;
            const destParam = tujuan.lokasi || tujuan.nama || ke;
            const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}`;

            let replyText = `📍 *HASIL CEK JARAK KOTA*\n\n` +
                `🛫 *Dari:* ${asal.nama || dari}\n` +
                (asal.lokasi ? `📌 *Lokasi:* ${asal.lokasi}\n` : '') +
                (asal.koordinat?.lat && asal.koordinat?.lon ? `🌐 *Koordinat:* \`${asal.koordinat.lat}, ${asal.koordinat.lon}\`\n` : '') +
                `\n` +
                `🛬 *Ke:* ${tujuan.nama || ke}\n` +
                (tujuan.lokasi ? `📌 *Lokasi:* ${tujuan.lokasi}\n` : '') +
                (tujuan.koordinat?.lat && tujuan.koordinat?.lon ? `🌐 *Koordinat:* \`${tujuan.koordinat.lat}, ${tujuan.koordinat.lon}\`\n` : '') +
                `\n` +
                `📏 *Jarak:* *${jarakInfo}*\n\n` +
                `⏱️ *Estimasi Waktu Tempuh:*\n` +
                `🛵 *Motor:* ${estimasi.motor || '-'}\n` +
                `🚗 *Mobil:* ${estimasi.mobil || '-'}\n` +
                `🚶 *Jalan Kaki:* ${estimasi.jalan_kaki || '-'}\n\n` +
                `🗺️ *Rute Google Maps:*\n` +
                `${gmapsUrl}`;

            await m.reply(replyText.trim());

        } catch (err) {
            console.error('[tools_jarak] Error:', err);
            return m.reply(`❌ *Terjadi Kesalahan*\n\n${err.message || 'Gagal menghubungi server API.'}`);
        }
    }
};
