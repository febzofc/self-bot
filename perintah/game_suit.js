module.exports = {
    CmD: ['suit'],
    aliases: ['suit', 'gbk', 'suitbot', 'guntingbatukertas'],
    categori: "game",
    exec: async (m, { prefix, command, text }) => {
        const pilihan = ['batu', 'gunting', 'kertas'];
        const emojiPilihan = {
            'batu': '✊ Batu',
            'gunting': '✌️ Gunting',
            'kertas': '🖐️ Kertas'
        };

        let userChoice = text ? text.trim().toLowerCase() : '';

        // Alias angka 1/2/3
        if (userChoice === '1') userChoice = 'gunting';
        else if (userChoice === '2') userChoice = 'batu';
        else if (userChoice === '3') userChoice = 'kertas';

        // Tampilkan petunjuk jika argumen kosong / tidak valid
        if (!pilihan.includes(userChoice)) {
            let guide = `🎮 *GAME GUNTING BATU KERTAS (Player vs Bot)* 🎮\n\n`
            guide += `Pilih salah satu taruhan Anda:\n`
            guide += `• *${prefix + command} gunting* (atau *${prefix + command} 1*)\n`
            guide += `• *${prefix + command} batu* (atau *${prefix + command} 2*)\n`
            guide += `• *${prefix + command} kertas* (atau *${prefix + command} 3*)\n\n`
            guide += `Contoh: *${prefix + command} batu*`
            return m.reply(guide)
        }

        // Bot memilih secara acak
        const botChoice = pilihan[Math.floor(Math.random() * pilihan.length)];

        let hasil = '';
        if (userChoice === botChoice) {
            hasil = '🤝 *SERI / DRAW!*';
        } else if (
            (userChoice === 'batu' && botChoice === 'gunting') ||
            (userChoice === 'gunting' && botChoice === 'kertas') ||
            (userChoice === 'kertas' && botChoice === 'batu')
        ) {
            hasil = '🎉 *KAMU MENANG!* 🏆';
        } else {
            hasil = '💻 *BOT MENANG!* 😜';
        }

        let res = `🎮 *HASIL SUIT BOT* 🎮\n\n`
        res += `👤 *Kamu:* ${emojiPilihan[userChoice]}\n`
        res += `🤖 *Bot:* ${emojiPilihan[botChoice]}\n\n`
        res += `${hasil}`

        return m.reply(res);
    }
};
