const { fetchJson } = require('../lib/fungsi.js')

module.exports = {
    CmD: ['instagram'],
    aliases: ['ig', 'igdl', 'igmp4', 'igmp3'],
    categori: 'downloader',
    exec: async (m, { prefix, command, text, bob }) => {
        if (!text) return m.reply(`Masukkan URL!\nContoh: ${prefix + command} https://www.instagram.com/p/Cxxxxx/`);
        const igRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i;
        const isIgUrl = igRegex.test(text);
        if (!isIgUrl) return m.reply('URL Instagram tidak valid. Pastikan itu adalah link post, reel, atau IGTV.');
        var meta = await fetchJson('https://api.siputzx.my.id/api/d/igram?url=' + text).catch(e => { m.reply('Telah terjadi kesalah silahkan coba lagi nanti') })
        bob.sendMessage(m.chat, { video: { url: meta.data.url[0].url }, caption: meta.data.meta.title }, { quoted: m })
        //console.log(meta.data.url[0].url)

        // Tambahkan kode untuk fetch/scraping/download media Instagram di sini
    }
}