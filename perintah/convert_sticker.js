const fs = require('fs');
module.exports = { 
      CmD: ['sticker'],
      aliases: ['sticker','s','stiker','setiker'],
      categori: "convert",
      exec: async(m, { quoted, qmsg, mime, bob, prefix, command }) => {
          if (/image/.test(mime)) {          
                let media = await quoted.download()
                let encmedia = await bob.sendImageAsSticker(m.chat, media, m, { packname: 'cilo', author: 'bot' })
                await fs.unlinkSync(encmedia)
            } else if (/video/.test(mime)) {           
                if (qmsg.seconds > 11) return m.reply('_Maksimal 10 detik!_')
                let media = await bob.downloadMediaMessage(quoted)
                let encmedia = await bob.sendVideoAsSticker(m.chat, media, m, { packname: 'cilo', author: 'bot' })
                await fs.unlinkSync(encmedia)
            } else {
                m.reply(`_Kirim/reply gambar/video/gif dengan caption ${prefix + command}*\n*Durasi Video/Gif 1-9 Detik_`)
         }
     }
}