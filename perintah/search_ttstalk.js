'use strict';

const tt = require('../lib/scrapers/tiktokStalk.js');

module.exports = {
    CmD: ['ttstalk', 'tiktokstalk'],
    aliases: [
        'ttstalk',
        'tiktokstalk',
        'stalktt',
        'stalktiktok',
        'ttprofile',
        'tiktokprofile',
        'ttuser'
    ],
    categori: 'search',
    desc: 'Stalker Profil TikTok Lengkap Menggunakan API Faa (Informasi Akun, Bio, Likes, Followers, dan Statistik)',
    exec: async (m, { bob, prefix, command, args, text }) => {
        const input = (text || args.join(' ')).trim();

        if (!input) {
            let help = `📱 *TIKTOK PROFILE STALKER* 📱\n\n`;
            help += `Perintah ini digunakan untuk melihat detail informasi profil TikTok secara lengkap menggunakan API Faa.\n\n`;
            help += `📌 *Format Penggunaan:*\n`;
            help += `• *${prefix + command} <username>*\n`;
            help += `• *${prefix + command} <link profil tiktok>*\n\n`;
            help += `💡 *Contoh:*\n`;
            help += `• *${prefix + command} mrbeast*\n`;
            help += `• *${prefix + command} @khaby.lame*\n`;
            help += `• *${prefix + command} https://www.tiktok.com/@fuji_an*`;
            return m.reply(help);
        }

        const cleanUser = tt.cleanTikTokUsername(input);
        await m.reply(`_🔍 Sedang mencari dan menganalisis profil TikTok *@${cleanUser}*..._`);

        try {
            const data = await tt.stalkTikTok(input);

            let caption = `📱 *TIKTOK PROFILE STALKER* 📱\n`;
            caption += `━━━━━━━━━━━━━━━━━━━━━\n`;
            caption += `👤 *Username:* @${data.username} ${data.isVerified ? '☑️ (Verified)' : ''}\n`;
            caption += `📛 *Nama Lengkap:* ${data.name}\n`;
            if (data.id && data.id !== '-') caption += `🆔 *User ID:* \`${data.id}\`\n`;
            if (data.region) caption += `🌍 *Region:* ${data.region}\n`;
            caption += `🔒 *Status Privasi:* ${data.isPrivate ? 'Akun Privat 🔒' : 'Akun Publik 🌐'}\n`;
            if (data.isSeller) caption += `🛍️ *Akun Toko:* Ya (TikTok Shop Seller)\n`;
            caption += `📅 *Bergabung:* ${data.createdDate}\n\n`;

            caption += `📊 *STATISTIK AKUN:*\n`;
            caption += `👥 *Followers:* ${data.followers}\n`;
            caption += `👣 *Following:* ${data.following}\n`;
            caption += `❤️ *Total Likes:* ${data.likes}\n`;
            caption += `🎥 *Total Video:* ${data.videos}\n`;
            if (data.friends && data.friends !== '0') caption += `🤝 *Teman (Friends):* ${data.friends}\n`;

            if (data.bio) {
                caption += `\n📝 *BIO / DESKRIPSI:*\n${data.bio}\n`;
            }

            caption += `\n🌐 *Link Profil:* ${data.profileUrl}\n`;
            caption += `━━━━━━━━━━━━━━━━━━━━━`;

            // Kirim foto profil jika tersedia
            if (data.avatar && bob && typeof bob.sendMessage === 'function') {
                try {
                    const imgBuffer = await tt.getAvatarBuffer(data.avatar);
                    if (imgBuffer && Buffer.isBuffer(imgBuffer)) {
                        return await bob.sendMessage(m.chat, {
                            image: imgBuffer,
                            caption: caption
                        }, { quoted: m });
                    }
                } catch (imgErr) {
                    console.error('Gagal mengirim foto profil TikTok:', imgErr.message);
                }
            }

            // Fallback pesan teks jika gambar profil gagal dikirim
            return await m.reply(caption);

        } catch (err) {
            console.error('Error TikTok Stalker:', err.message);
            return m.reply(`❌ *Gagal Melakukan Stalking TikTok*\n\n_Pesan: ${err.message}_`);
        }
    }
};
