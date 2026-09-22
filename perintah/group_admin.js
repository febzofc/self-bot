/**
 * Plugin Administrasi Grup WhatsApp
 * 
 * Fitur:
 * - add: Menambahkan member ke grup
 * - kick: Mengeluarkan member dari grup
 * - promote: Mengangkat member menjadi admin
 * - demote: Menurunkan admin menjadi member biasa
 * - mute: Menutup grup (hanya admin yang dapat mengirim pesan)
 * - unmute: Membuka grup (semua anggota dapat mengirim pesan)
 * - renamegc: Mengubah nama atau subjek grup
 */

function extractTarget(m, text) {
    if (m.quoted && m.quoted.sender) {
        return m.quoted.sender;
    }
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        return m.mentionedJid[0];
    }
    if (text) {
        const clean = text.replace(/[^0-9]/g, '');
        if (clean.length >= 10) {
            return `${clean}@s.whatsapp.net`;
        }
    }
    return null;
}

module.exports = {
    CmD: ['kick', 'add', 'promote', 'demote', 'mute', 'unmute', 'renamegc'],
    aliases: [
        'kick', 'tendang', 'dor',
        'add', 'tambah',
        'promote', 'admin', 'jadikanadmin',
        'demote', 'unadmin', 'turunkan',
        'mute', 'tutup', 'closgc',
        'unmute', 'buka', 'opengc',
        'renamegc', 'setname', 'namagc'
    ],
    categori: 'group',

    exec: async (m, { bob, args, text, prefix, command, isCreator, isOwner }) => {
        if (!m.isGroup) {
            return m.reply('[Gagal] Perintah ini hanya dapat digunakan di dalam grup WhatsApp.');
        }

        // Ambil metadata grup & daftar admin
        let groupMetadata = null;
        try {
            groupMetadata = await bob.groupMetadata(m.chat);
        } catch (e) {
            return m.reply('[Error] Gagal mengambil informasi grup.');
        }

        const participants = groupMetadata.participants || [];
        const admins = participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id);

        const botNumber = await bob.decodeJid(bob.user.id);
        const isBotAdmin = admins.includes(botNumber);
        const isAdmin = admins.includes(m.sender) || isCreator || isOwner;

        if (!isBotAdmin) {
            return m.reply('[Akses Ditolak] Bot harus menjadi admin grup untuk dapat menjalankan perintah ini.');
        }

        if (!isAdmin) {
            return m.reply('[Akses Ditolak] Hanya admin grup yang memiliki wewenang menggunakan perintah ini.');
        }

        const cmd = command.toLowerCase();

        // 1. KICK (Mengeluarkan Member)
        if (['kick', 'tendang', 'dor'].includes(cmd)) {
            const targetJid = extractTarget(m, text);
            if (!targetJid) {
                return m.reply(
                    `*Format Perintah Kick:*\n` +
                    `1. Reply pesan member yang ingin dikeluarkan, lalu ketik: *${prefix + command}*\n` +
                    `2. Tag member: *${prefix + command} @user*\n` +
                    `3. Masukkan nomor: *${prefix + command} 628xxx*`
                );
            }

            if (targetJid === botNumber) {
                return m.reply('[Peringatan] Bot tidak dapat mengeluarkan dirinya sendiri.');
            }

            if (admins.includes(targetJid) && !isCreator && !isOwner) {
                return m.reply('[Gagal] Tidak dapat mengeluarkan sesama admin grup.');
            }

            try {
                await bob.groupParticipantsUpdate(m.chat, [targetJid], 'remove');
                return m.reply(`[Sukses] Berhasil mengeluarkan @${targetJid.split('@')[0]} dari grup.`, {
                    mentions: [targetJid]
                });
            } catch (err) {
                return m.reply(`[Error] Gagal mengeluarkan member: ${err.message || err}`);
            }
        }

        // 2. ADD (Menambahkan Member)
        if (['add', 'tambah'].includes(cmd)) {
            const targetJid = extractTarget(m, text);
            if (!targetJid) {
                return m.reply(
                    `*Format Perintah Add:*\n` +
                    `Ketik: *${prefix + command} 628xxxxxxxxxx*\n` +
                    `_Contoh: ${prefix + command} 6281234567890_`
                );
            }

            try {
                const res = await bob.groupParticipantsUpdate(m.chat, [targetJid], 'add');
                const status = res && res[0] ? res[0].status : null;

                if (status === '403') {
                    return m.reply(`[Info] Gagal menambahkan secara langsung karena privasi target. Tautan undangan telah dikirimkan secara pribadi ke @${targetJid.split('@')[0]}.`, {
                        mentions: [targetJid]
                    });
                } else if (status === '408') {
                    return m.reply(`[Gagal] Pengguna @${targetJid.split('@')[0]} baru saja keluar dari grup ini. Coba lagi beberapa saat lagi.`, {
                        mentions: [targetJid]
                    });
                } else if (status === '409') {
                    return m.reply(`[Info] Pengguna @${targetJid.split('@')[0]} sudah menjadi anggota grup.`, {
                        mentions: [targetJid]
                    });
                } else {
                    return m.reply(`[Sukses] Berhasil menambahkan @${targetJid.split('@')[0]} ke dalam grup.`, {
                        mentions: [targetJid]
                    });
                }
            } catch (err) {
                return m.reply(`[Error] Gagal menambahkan member: ${err.message || err}`);
            }
        }

        // 3. PROMOTE (Mengangkat Jadi Admin)
        if (['promote', 'admin', 'jadikanadmin'].includes(cmd)) {
            const targetJid = extractTarget(m, text);
            if (!targetJid) {
                return m.reply(
                    `*Format Perintah Promote:*\n` +
                    `1. Reply pesan member yang ingin dijadikan admin, lalu ketik: *${prefix + command}*\n` +
                    `2. Tag member: *${prefix + command} @user*`
                );
            }

            if (admins.includes(targetJid)) {
                return m.reply(`[Info] @${targetJid.split('@')[0]} sudah menjadi admin grup.`, {
                    mentions: [targetJid]
                });
            }

            try {
                await bob.groupParticipantsUpdate(m.chat, [targetJid], 'promote');
                return m.reply(`[Sukses] Berhasil mengangkat @${targetJid.split('@')[0]} menjadi admin grup.`, {
                    mentions: [targetJid]
                });
            } catch (err) {
                return m.reply(`[Error] Gagal mengangkat admin: ${err.message || err}`);
            }
        }

        // 4. DEMOTE (Menurunkan Admin Jadi Member)
        if (['demote', 'unadmin', 'turunkan'].includes(cmd)) {
            const targetJid = extractTarget(m, text);
            if (!targetJid) {
                return m.reply(
                    `*Format Perintah Demote:*\n` +
                    `1. Reply pesan admin yang ingin diturunkan, lalu ketik: *${prefix + command}*\n` +
                    `2. Tag admin: *${prefix + command} @user*`
                );
            }

            if (!admins.includes(targetJid)) {
                return m.reply(`[Info] @${targetJid.split('@')[0]} bukan admin grup.`, {
                    mentions: [targetJid]
                });
            }

            if (targetJid === botNumber) {
                return m.reply('[Peringatan] Bot tidak dapat menurunkan jabatannya sendiri.');
            }

            try {
                await bob.groupParticipantsUpdate(m.chat, [targetJid], 'demote');
                return m.reply(`[Sukses] Berhasil menurunkan @${targetJid.split('@')[0]} menjadi anggota biasa.`, {
                    mentions: [targetJid]
                });
            } catch (err) {
                return m.reply(`[Error] Gagal menurunkan admin: ${err.message || err}`);
            }
        }

        // 5. MUTE (Tutup Grup: Hanya Admin yang Dapat Chat)
        if (['mute', 'tutup', 'closgc'].includes(cmd)) {
            if (groupMetadata.announce) {
                return m.reply('[Info] Grup sudah dalam keadaan tertutup (hanya admin).');
            }

            try {
                await bob.groupSettingUpdate(m.chat, 'announcement');
                return m.reply('[Sukses] Grup telah ditutup. Sekarang hanya admin yang dapat mengirim pesan.');
            } catch (err) {
                return m.reply(`[Error] Gagal menutup grup: ${err.message || err}`);
            }
        }

        // 6. UNMUTE (Buka Grup: Semua Member Dapat Chat)
        if (['unmute', 'buka', 'opengc'].includes(cmd)) {
            if (!groupMetadata.announce) {
                return m.reply('[Info] Grup sudah dalam keadaan terbuka (semua anggota dapat chat).');
            }

            try {
                await bob.groupSettingUpdate(m.chat, 'not_announcement');
                return m.reply('[Sukses] Grup telah dibuka. Semua anggota sekarang dapat mengirim pesan.');
            } catch (err) {
                return m.reply(`[Error] Gagal membuka grup: ${err.message || err}`);
            }
        }

        // 7. RENAMEGC (Mengubah Nama / Subjek Grup)
        if (['renamegc', 'setname', 'namagc'].includes(cmd)) {
            const newName = (text || '').trim();
            if (!newName) {
                return m.reply(
                    `*Format Perintah Ubah Nama Grup:*\n` +
                    `Ketik: *${prefix + command} <nama grup baru>*\n` +
                    `_Contoh: ${prefix + command} Diskusi Proyek Coding_`
                );
            }

            if (newName.length > 100) {
                return m.reply('[Gagal] Nama grup maksimal 100 karakter.');
            }

            try {
                await bob.groupUpdateSubject(m.chat, newName);
                return m.reply(`[Sukses] Nama grup berhasil diubah menjadi:\n*"${newName}"*`);
            } catch (err) {
                return m.reply(`[Error] Gagal mengubah nama grup: ${err.message || err}`);
            }
        }
    }
};
