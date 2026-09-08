'use strict';

const ig = require('../lib/scrapers/instagramStalk.js');

module.exports = {
    CmD: ['igstalk', 'stalkig'],
    aliases: [
        'igstalk',
        'stalkig',
        'igprofile',
        'instagramstalk',
        'stalkinstagram',
        'iguser',
        'iginfo'
    ],
    categori: 'search',
    desc: 'Stalker Profil Instagram Lengkap Tanpa Chromium (Informasi Akun, Bio, Followers, dan Postingan Terkini)',
    exec: async (m, { bob, prefix, command, args, text }) => {
        const input = (text || args.join(' ')).trim();

        if (!input) {
            let help = `📸 *INSTAGRAM PROFILE STALKER* 📸\n\n`;
            help += `Perintah ini digunakan untuk melihat detail informasi profil Instagram secara lengkap tanpa login.\n\n`;
            help += `📌 *Format Penggunaan:*\n`;
            help += `• *${prefix + command} <username>*\n`;
            help += `• *${prefix + command} <link profil instagram>*\n\n`;
            help += `💡 *Contoh:*\n`;
            help += `• *${prefix + command} jokowi*\n`;
            help += `• *${prefix + command} @cristiano*\n`;
            help += `• *${prefix + command} https://www.instagram.com/raffinagita1717/*`;
            return m.reply(help);
        }

        const cleanUser = ig.cleanUsername(input);
        await m.reply(`_🔍 Sedang mencari dan menganalisis profil Instagram *@${cleanUser}*..._`);

        try {
            const data = await ig.stalkInstagram(input);

            let caption = `📸 *INSTAGRAM PROFILE STALKER* 📸\n`;
            caption += `━━━━━━━━━━━━━━━━━━━━━\n`;
            caption += `👤 *Username:* @${data.username} ${data.isVerified ? '☑️ (Verified)' : ''}\n`;
            caption += `📛 *Nama Lengkap:* ${data.fullName}\n`;
            if (data.userId && data.userId !== '-') caption += `🆔 *User ID:* \`${data.userId}\`\n`;
            if (data.category) caption += `🏷️ *Kategori:* ${data.category}\n`;
            caption += `💼 *Tipe Akun:* ${data.accountType}\n`;
            caption += `🔒 *Status Privasi:* ${data.isPrivate ? 'Akun Privat 🔒' : 'Akun Publik 🌐'}\n\n`;

            caption += `📊 *STATISTIK AKUN:*\n`;
            caption += `👥 *Followers:* ${data.followersFormatted}\n`;
            caption += `👣 *Following:* ${data.followingFormatted}\n`;
            caption += `🖼️ *Total Postingan:* ${data.postsFormatted}\n`;
            if (data.reelsCount) caption += `🎬 *Total Reels:* ${data.reelsCount}\n`;

            if (data.bio) {
                caption += `\n📝 *BIO / DESKRIPSI:*\n${data.bio}\n`;
            }

            if (data.bioLink) {
                caption += `\n🔗 *Bio Link:* ${data.bioLink}\n`;
            }

            caption += `\n🌐 *Link Profil:* ${data.profileUrl}\n`;

            if (data.recentPosts && data.recentPosts.length > 0) {
                caption += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
                caption += `📸 *POSTINGAN TERBARU (HIGHLIGHT):*\n`;
                data.recentPosts.forEach((p, idx) => {
                    caption += `\n*${idx + 1}.* ${p.type}\n`;
                    if (p.caption) caption += `   📝 "${p.caption}"\n`;
                    caption += `   ❤️ ${p.likes} Suka | 💬 ${p.comments} Komentar\n`;
                    caption += `   🔗 ${p.url}\n`;
                });
            }
            caption += `━━━━━━━━━━━━━━━━━━━━━`;

            // Kirim foto profil HD jika tersedia
            if (data.profilePicUrl && bob && typeof bob.sendMessage === 'function') {
                try {
                    const imgBuffer = await ig.getProfileImageBuffer(data.profilePicUrl);
                    if (imgBuffer && Buffer.isBuffer(imgBuffer)) {
                        return await bob.sendMessage(m.chat, {
                            image: imgBuffer,
                            caption: caption
                        }, { quoted: m });
                    }
                } catch (imgErr) {
                    console.error('Gagal mengirim foto profil Instagram:', imgErr.message);
                }
            }

            // Fallback pesan teks jika foto profil gagal dikirim
            return await m.reply(caption);

        } catch (err) {
            console.error('Error Instagram Stalker:', err.message);
            return m.reply(`❌ *Gagal Melakukan Stalking Instagram*\n\n_Pesan: ${err.message}_`);
        }
    }
};
