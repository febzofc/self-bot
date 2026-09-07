const axios = require('axios');

module.exports = {
    CmD: ['sendotp', 'otpapi'],
    aliases: ['kirimotp', 'setotpsecret'],
    categori: 'tools',
    exec: async (m, { bob, prefix, command, args, isOwner }) => {
        if (command === 'setotpsecret') {
            if (!isOwner) return m.reply('Fitur ini hanya untuk Owner bot.');
            const newSecret = args[0];
            if (!newSecret) {
                global.otpSecret = null;
                return m.reply('Secret key OTP telah dihapus (API sekarang terbuka tanpa autentikasi).');
            }
            global.otpSecret = newSecret;
            return m.reply(`Secret key OTP berhasil diatur ke: *${newSecret}*`);
        }

        if (args.length < 2) {
            return m.reply(
                `*[ OTP API SENDER PLUGIN ]*\n\n` +
                `*Penggunaan via WhatsApp:* \n` +
                `• \`${prefix + command} <nomor_user> <kode_otp>\`\n\n` +
                `*Penggunaan via Web (HTTP POST Endpoint):*\n` +
                `• **URL:** \`http://<IP_atau_Domain_Bot>:2505/api/send-otp\`\n` +
                `• **Method:** \`POST\`\n` +
                `• **Header:** \`Content-Type: application/json\`\n` +
                `• **Body JSON:**\n` +
                `\`\`\`json\n` +
                `{\n` +
                `  "target": "081234567890",\n` +
                `  "otp": "123456"\n` +
                `}\n` +
                `\`\`\``
            );
        }

        const target = args[0];
        const otpCode = args[1];

        // Format nomor telepon
        let formattedNum = target.replace(/[^0-9]/g, '');
        if (formattedNum.startsWith('0')) {
            formattedNum = '62' + formattedNum.slice(1);
        }
        if (!formattedNum.endsWith('@s.whatsapp.net')) {
            formattedNum += '@s.whatsapp.net';
        }

        try {
            const pesan = `*[ VERIFIKASI OTP ]*\n\nKode OTP Anda adalah: *${otpCode}*\n\n_Jangan berikan kode ini kepada siapapun._`;
            await bob.sendMessage(formattedNum, { text: pesan });
            return m.reply(`✅ Kode OTP *${otpCode}* berhasil dikirim ke *${formattedNum.split('@')[0]}*`);
        } catch (err) {
            return m.reply(`❌ Gagal mengirim OTP: ${err.message}`);
        }
    }
};
