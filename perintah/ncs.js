const fs = require('fs');
const path = require('path');

module.exports = {
    CmD: ['ncs'],
    aliases: ['ncs'],
    categori: 'streaming',
    exec: async (m, { args, prefix, command, bob }) => {
        // Load channels database
        let channelsPath = path.join(__dirname, '../src/channels.json');
        let channels = [];
        try {
            if (fs.existsSync(channelsPath)) {
                channels = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));
            }
        } catch (e) {
            console.error('Error loading channels.json:', e);
        }

        const subCommand = args[0] ? args[0].toLowerCase() : '';

        // If no subcommand or subcommand is not "streaming"
        if (subCommand !== 'streaming') {
            return m.reply(`📺 *TV Indonesia Streaming*

Cara Penggunaan:
*${prefix + command} streaming <nama_channel>*

Contoh:
*${prefix + command} streaming transtv*
*${prefix + command} streaming rcti*`);
        }

        const channelQuery = args[1] ? args[1].toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') : '';

        // If no channel name specified
        if (!channelQuery) {
            let channelList = channels.map(c => `• *${c.id}* - ${c.name}`).join('\n');
            return m.reply(`📺 *Daftar Channel TV Indonesia*

Silakan pilih channel berikut:
${channelList}

Ketik *${prefix + command} streaming <nama_channel>* untuk mulai menonton.`);
        }

        // Search channel by ID (exact or contains)
        const channel = channels.find(c => c.id === channelQuery);

        if (channel) {
            const streamUrl = `${global.streamingUrl || 'http://localhost:3000'}/watch/${channel.id}`;
            const replyMessage = `📺 *TV Indonesia Streaming*

Channel : *${channel.name}*
Kategori: _${channel.category}_
Resolusi: _${channel.resolution}_
Status  : 🔴 *LIVE*

Klik link berikut untuk mulai menonton:
${streamUrl}`;

            // Optional: send preview if fake preview is available
            if (bob.sendFakePreviewImg && channel.logo) {
                try {
                    await bob.sendFakePreviewImg(
                        replyMessage,
                        `Streaming ${channel.name} LIVE`,
                        `Nonton streaming ${channel.name} gratis dengan kualitas ${channel.resolution}`,
                        channel.logo
                    );
                    return;
                } catch (err) {
                    console.error('Failed to send fake preview:', err);
                }
            }

            // Fallback to normal reply
            return m.reply(replyMessage);
        } else {
            // Channel not found, show suggestions
            let channelList = channels.map(c => `• *${c.id}* - ${c.name}`).join('\n');
            return m.reply(`❌ Channel *"${args[1]}"* tidak ditemukan.

📺 *Daftar Channel TV yang Tersedia:*
${channelList}

Ketik *${prefix + command} streaming <nama_channel>* untuk menonton.`);
        }
    }
};
