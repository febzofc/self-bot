const { fetchJson } = require('../lib/fungsi.js');

module.exports = {
      CmD: ['tiktok'],
      aliases: ['tt','tiktok','ttmp4','ttmp3','tiktokmp4','tiktokmp3'],
      categori: "downloader",
      exec: async(m, { prefix, command, bob, text }) => {
      if (!text) return m.reply('masukan url')
      m.reply('mohon bersabar sedang mendownload...')
      const [ link, opsi ]= text.split`--`        
            switch(command) {
                case 'tt':
                case 'tiktok':
                case 'ttmp4':
                case 'tiktokmp4': {
        var { data } = await fetchJson('https://tikwm.com/api/?url=' + text)
        let txt = 'Tiktok Downloader\n\n'
        txt += 'Video Title: ' + data.title + '\n'
        //txt += 'Video Author: ' + data.author.name + '\n'
        //txt += 'Like: ' + data.stats.likeCount + '\n'
        //txt += 'Comment: ' + data.stats.commentCount + '\n'
        //txt += 'Share: ' + data.stats.shareCount + '\n'
        //txt += 'Play: ' + data.stats.playCount + '\n'
        //txt += 'Save: ' + data.stats.saveCount + '\n'
        //txt += 'Music Title: ' + data.music.title + '\n'
        //txt += 'Music Author: ' + data.music.author + '\n\n'*/ 
                    bob.sendMessage(m.chat, { video: { url: data.play }, caption: txt }, { quoted: m }).catch(err => m.reply('Terjadi kesalahan, silahkan coba lagi nanti'))
                 }
                 break
                 
                 case 'ttmp3':
                 case 'tiktokmp3': {
                   var data = await fetchJson('hhttps://tikwm.com/api/?url=' + text)
                     if (opsi === 'doc') {
                         await bob.sendMessage(m.chat, { document: { url: data.music }, fileName: data.music_info.title + '.mp3', mimetype: 'audio/mpeg' }, { quoted: m })
                     } if (opsi === 'vn') {
                        await bob.sendMessage(m.chat, { audio: { url: data.music }, mimetype: 'audio/mpeg', ptt:true }, { quoted: m })
                     } if (opsi == undefined) {                                           
                        await bob.sendMessage(m.chat, { audio: { url: data.music }, mimetype: 'audio/mpeg'}, { quoted: m })                       
                     }
                 }
                 break
            }
      }
}