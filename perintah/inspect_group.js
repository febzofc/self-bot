const moment = require('moment-timezone');

/**
 * Plugin Inspeksi & Cek Detail Grup WhatsApp
 * 
 * Penggunaan:
 * 1. .inspect (di dalam grup)
 * 2. .inspect https://chat.whatsapp.com/XXXXX
 * 3. .inspect 120363xxxxxx@g.us
 */

module.exports = {
    CmD: ['inspectgroup'],
    aliases: ['inspect', 'inspectgroup', 'cekgroup', 'inspectgc', 'gcinspect', 'gcinfo', 'infogrup', 'grupinfo'],
    categori: 'group',
    exec: async (m, { bob, text, prefix, command, quoted }) => {
        try {
            // Regex untuk mendeteksi link grup WhatsApp
            const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,26})/i;
            const inputMessage = (text || '') + ' ' + (quoted && quoted.text ? quoted.text : '');
            const match = inputMessage.match(linkRegex);

            let inviteCode = match ? match[1] : null;
            let groupJid = null;
            let targetJidInput = (text || '').trim();

            if (!inviteCode && targetJidInput.endsWith('@g.us')) {
                groupJid = targetJidInput;
            }

            // Jika tidak ada link, tidak ada JID, dan bukan dikirim di grup
            if (!inviteCode && !groupJid && !m.isGroup) {
                return m.reply(
                    `💡 *PETUNJUK PENGGUNAAN INSPEK GRUP* 💡\n\n` +
                    `Gunakan perintah ini untuk mengecek & menginspeksi detail grup WhatsApp.\n\n` +
                    `📌 *Cara Penggunaan:*\n` +
                    `1️⃣ *Di dalam grup:* Ketik \`${prefix + command}\`\n` +
                    `2️⃣ *Menggunakan Link Grup:* Ketik \`${prefix + command} https://chat.whatsapp.com/CodeGrup\`\n` +
                    `3️⃣ *Mengirim ID Grup (JID):* Ketik \`${prefix + command} 120363xxxxxxxx@g.us\`\n` +
                    `4️⃣ *Reply Pesan Link:* Reply pesan yang berisi link grup lalu ketik \`${prefix + command}\``
                );
            }

            await m.reply('⏳ *Sedang mengumpulkan & menganalisis informasi grup...*');

            let metadata = null;
            let inviteInfo = null;
            let isFromInvite = false;

            // Jika menginspeksi via Link Undangan Grup
            if (inviteCode) {
                isFromInvite = true;
                inviteInfo = await bob.groupGetInviteInfo(inviteCode).catch(() => null);

                if (!inviteInfo) {
                    return m.reply('❌ *Gagal mengambil data grup!* Link grup mungkin tidak valid, telah dikeluarkannya bot, atau tautan telah direset oleh admin.');
                }

                groupJid = inviteInfo.id;
                // Coba ambil metadata penuh jika bot merupakan anggota dari grup tersebut
                metadata = await bob.groupMetadata(groupJid).catch(() => null);
            } else {
                groupJid = groupJid || m.chat;
                metadata = await bob.groupMetadata(groupJid).catch(() => null);
            }

            // Jika metadata maupun inviteInfo tidak ditemukan
            if (!metadata && !inviteInfo) {
                return m.reply('❌ *Gagal mengambil metadata grup!* Pastikan ID grup valid dan bot memiliki akses ke grup tersebut.');
            }

            // Gabungkan data dari metadata (jika ada) dan inviteInfo
            const subject = metadata?.subject || inviteInfo?.subject || 'Tanpa Nama';
            const jid = metadata?.id || inviteInfo?.id || groupJid;
            const creationTimestamp = metadata?.creation || inviteInfo?.creation || null;

            // Format Tanggal Pembuatan
            let formattedCreation = 'Tidak Diketahui';
            let relativeCreation = '';
            if (creationTimestamp) {
                const momentDate = moment(creationTimestamp * 1000).tz('Asia/Jakarta');
                formattedCreation = momentDate.format('DD MMMM YYYY, HH:mm:ss [WIB]');
                relativeCreation = ` (${momentDate.fromNow()})`;
            }

            // Pembuat / Owner Grup
            const ownerJid = metadata?.owner || metadata?.subjectOwner || inviteInfo?.owner || null;
            const formattedOwner = ownerJid ? `@${ownerJid.split('@')[0]}` : 'Tidak Diketahui / Sistem';

            // Pesan Sementara / Ephemeral Duration
            const ephemeralSec = metadata?.ephemeralDuration || inviteInfo?.ephemeralDuration || 0;
            let ephemeralText = '❌ Nonaktif';
            if (ephemeralSec === 86400) ephemeralText = '⏳ 24 Jam (1 Hari)';
            else if (ephemeralSec === 604800) ephemeralText = '⏳ 7 Hari';
            else if (ephemeralSec === 7776000) ephemeralText = '⏳ 90 Hari';
            else if (ephemeralSec > 0) ephemeralText = `⏳ ${Math.round(ephemeralSec / 86400)} Hari`;

            // Rincian Anggota
            const participants = metadata?.participants || inviteInfo?.participants || [];
            const totalMembers = participants.length || inviteInfo?.size || 0;

            const superAdmins = participants.filter(p => p.admin === 'superadmin');
            const regularAdmins = participants.filter(p => p.admin === 'admin');
            const allAdmins = [...superAdmins, ...regularAdmins];
            const regularMembers = participants.filter(p => !p.admin);

            // Pengaturan Grup
            const restrictEditInfo = (metadata?.restrict !== undefined)
                ? (metadata.restrict ? '🔒 Hanya Admin' : '🌐 Semua Anggota')
                : (inviteInfo?.restrict !== undefined ? (inviteInfo.restrict ? '🔒 Hanya Admin' : '🌐 Semua Anggota') : 'Tidak Diketahui');

            const announceMessage = (metadata?.announce !== undefined)
                ? (metadata.announce ? '🔒 Hanya Admin' : '🌐 Semua Anggota')
                : (inviteInfo?.announce !== undefined ? (inviteInfo.announce ? '🔒 Hanya Admin' : '🌐 Semua Anggota') : 'Tidak Diketahui');

            const joinApproval = (metadata?.joinApprovalMode !== undefined)
                ? (metadata.joinApprovalMode ? '✅ Aktif (Perlu Persetujuan Admin)' : '❌ Nonaktif (Langsung Masuk)')
                : (inviteInfo?.joinApprovalMode !== undefined ? (inviteInfo.joinApprovalMode ? '✅ Aktif (Perlu Persetujuan Admin)' : '❌ Nonaktif (Langsung Masuk)') : 'Tidak Diketahui');

            let memberAddModeText = 'Tidak Diketahui';
            if (metadata?.memberAddMode !== undefined) {
                memberAddModeText = (metadata.memberAddMode === true || metadata.memberAddMode === 'all') ? '🌐 Semua Anggota' : '🔒 Hanya Admin';
            } else if (inviteInfo?.memberAddMode !== undefined) {
                memberAddModeText = (inviteInfo.memberAddMode === true || inviteInfo.memberAddMode === 'all') ? '🌐 Semua Anggota' : '🔒 Hanya Admin';
            }

            const isCommunity = metadata?.isCommunity || inviteInfo?.isCommunity
                ? '🏛️ Ya (Grup Komunitas)'
                : (metadata?.linkedParent ? `🔗 Terhubung ke Komunitas` : '❌ Bukan Komunitas');

            // Presensi Online
            // Subscribe presensi jika bot di dalam grup
            try {
                if (bob.presenceSubscribe) await bob.presenceSubscribe(jid);
            } catch (_) {}

            const presences = (bob.presences && bob.presences[jid]) ? bob.presences[jid] : {};
            const onlineList = [];

            for (const [userJid, state] of Object.entries(presences)) {
                if (state && (state.lastKnownPresence === 'available' || state.lastKnownPresence === 'composing' || state.lastKnownPresence === 'recording')) {
                    let statusLabel = '🟢 Online';
                    if (state.lastKnownPresence === 'composing') statusLabel = '✍️ Mengetik...';
                    if (state.lastKnownPresence === 'recording') statusLabel = '🎙️ Merekam Suara...';
                    onlineList.push({ jid: userJid, statusLabel });
                }
            }

            // Deskripsi Grup
            const description = metadata?.desc || inviteInfo?.desc || '(Tidak ada deskripsi)';
            const descOwnerJid = metadata?.descOwner || inviteInfo?.descOwner;
            const descOwnerText = descOwnerJid ? `@${descOwnerJid.split('@')[0]}` : null;

            // Kumpulkan Mention JID
            const mentions = [];
            if (ownerJid) mentions.push(ownerJid);
            if (descOwnerJid) mentions.push(descOwnerJid);

            allAdmins.forEach(a => {
                if (a.id && !mentions.includes(a.id)) mentions.push(a.id);
            });

            onlineList.forEach(o => {
                if (o.jid && !mentions.includes(o.jid)) mentions.push(o.jid);
            });

            // Susun Teks Output Inspeksi
            let caption = `📊 *INSPEKSI GRUP WHATSAPP* 📊\n\n`;

            caption += `───〔 📌 *INFORMASI UTAMA* 〕───\n`;
            caption += `🔹 *Nama Grup:* ${subject}\n`;
            caption += `🔹 *ID Grup (JID):* \`${jid}\`\n`;
            caption += `🔹 *Dibuat Pada:* ${formattedCreation}${relativeCreation}\n`;
            caption += `🔹 *Pembuat Grup:* ${formattedOwner}\n`;
            caption += `🔹 *Pesan Sementara:* ${ephemeralText}\n\n`;

            caption += `───〔 👥 *ANGGOTA & ADMIN* 〕───\n`;
            caption += `👥 *Total Anggota:* ${totalMembers} Anggota\n`;
            caption += `⭐ *Total Admin:* ${allAdmins.length} Admin\n`;
            caption += `👤 *Member Biasa:* ${regularMembers.length} Anggota\n\n`;

            if (allAdmins.length > 0) {
                caption += `📋 *Daftar Admin:* \n`;
                allAdmins.forEach(adm => {
                    const isSuper = adm.admin === 'superadmin';
                    caption += `  • @${adm.id.split('@')[0]} ${isSuper ? '👑 (Superadmin)' : '⭐ (Admin)'}\n`;
                });
                caption += `\n`;
            }

            caption += `───〔 🟢 *STATUS PRESENSI (ONLINE)* 〕───\n`;
            if (onlineList.length > 0) {
                caption += `🟢 *Member Aktif/Online:* ${onlineList.length} orang\n`;
                onlineList.forEach(onl => {
                    caption += `  • @${onl.jid.split('@')[0]} (${onl.statusLabel})\n`;
                });
            } else {
                caption += `ℹ️ *Status Online:* Belum ada presensi terdeteksi secara langsung.\n`;
                caption += `_(Presensi diperbarui secara realtime saat anggota berinteraksi/mengetik di grup)_\n`;
            }
            caption += `\n`;

            caption += `───〔 ⚙️ *PENGATURAN GRUP* 〕───\n`;
            caption += `🔒 *Edit Info Grup:* ${restrictEditInfo}\n`;
            caption += `💬 *Kirim Pesan:* ${announceMessage}\n`;
            caption += `🚪 *Persetujuan Masuk (Approval):* ${joinApproval}\n`;
            caption += `➕ *Tambah Member:* ${memberAddModeText}\n`;
            caption += `🏛️ *Status Komunitas:* ${isCommunity}\n\n`;

            caption += `───〔 📜 *DESKRIPSI GRUP* 〕───\n`;
            caption += `${description}\n`;
            if (descOwnerText) {
                caption += `\n_Diperbarui oleh: ${descOwnerText}_\n`;
            }

            // Ambil Foto Profil Grup jika ada
            let ppUrl = null;
            try {
                ppUrl = await bob.profilePictureUrl(jid, 'image');
            } catch (_) {
                ppUrl = null;
            }

            // Kirim balasan beserta Gambar Profil Grup jika tersedia
            if (ppUrl) {
                await bob.sendMessage(m.chat, {
                    image: { url: ppUrl },
                    caption: caption,
                    mentions: mentions
                }, { quoted: m });
            } else {
                await bob.sendMessage(m.chat, {
                    text: caption,
                    mentions: mentions
                }, { quoted: m });
            }

        } catch (err) {
            console.error('Error in inspect_group plugin:', err);
            m.reply(`❌ *Terjadi kesalahan saat menginspeksi grup:* ${err.message || err}`);
        }
    }
};
