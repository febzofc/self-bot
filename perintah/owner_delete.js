/**
 * Plugin Hapus Pesan Bot & Pesan Member (Admin Delete)
 * Mendukung:
 * 1. Hapus pesan bot sendiri di private chat (DM) maupun di dalam grup.
 * 2. Hapus pesan member lain di dalam grup jika bot dan pemanggil perintah adalah admin.
 * 3. Deteksi akurat pesan bot berdasarkan fromMe, isBaileys, nomor JID, dan WhatsApp LID.
 */

module.exports = {
    CmD: ['delete'],
    aliases: ['delete', 'del', 'd', 'hapus'],
    categori: 'owner',
    exec: async (m, { bob, prefix, command, isCreator, isOwner }) => {
        if (!m.quoted) {
            return m.reply(`Balas/reply pesan yang ingin dihapus dengan *${prefix + command}*!`);
        }

        const botNumber = bob.decodeJid(bob.user.id);
        const botLid = bob.user?.lid ? bob.decodeJid(bob.user.lid) : '';

        // Deteksi apakah pesan yang di-reply adalah pesan yang dikirim oleh bot
        const isQuotedFromBot = Boolean(
            m.quoted.fromMe ||
            m.quoted.isBaileys ||
            m.quoted.sender === botNumber ||
            (botLid && m.quoted.sender === botLid)
        );

        if (isQuotedFromBot) {
            try {
                if (typeof m.quoted.delete === 'function') {
                    await m.quoted.delete();
                } else {
                    await bob.sendMessage(m.chat, {
                        delete: {
                            remoteJid: m.chat,
                            fromMe: true,
                            id: m.quoted.id,
                            ...(m.isGroup ? { participant: botNumber } : {})
                        }
                    });
                }
                return;
            } catch (err) {
                console.error('[Delete Bot Message Error]:', err?.message || err);
                return m.reply(`Gagal menghapus pesan bot: ${err?.message || 'Terjadi kesalahan sistem'}`);
            }
        }

        // Jika bukan pesan bot, cek apakah di grup untuk fitur Admin Delete
        if (m.isGroup) {
            try {
                const groupMetadata = await bob.groupMetadata(m.chat);
                const participants = groupMetadata.participants || [];
                const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
                const isBotAdmin = admins.includes(botNumber);
                const isAdmin = admins.includes(m.sender) || isCreator || isOwner;

                if (!isAdmin) {
                    return m.reply('Perintah hapus pesan member lain hanya dapat digunakan oleh admin grup!');
                }

                if (!isBotAdmin) {
                    return m.reply('Gagal menghapus pesan member lain karena bot bukan admin di grup ini!');
                }

                // Eksekusi Admin Delete pesan member lain
                await bob.sendMessage(m.chat, {
                    delete: {
                        remoteJid: m.chat,
                        fromMe: false,
                        id: m.quoted.id,
                        participant: m.quoted.sender
                    }
                });
                return;
            } catch (err) {
                console.error('[Admin Delete Error]:', err?.message || err);
                return m.reply(`Gagal menghapus pesan member: ${err?.message || 'Terjadi kesalahan'}`);
            }
        }

        return m.reply('Pesan tersebut bukan dikirim oleh bot!');
    }
};
