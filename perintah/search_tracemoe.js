const { getRandom, getBuffer, fetchJson } = require('../lib/fungsi.js');
const fs = require('fs');
const axios = require('axios');
const { UploadFileUgu } = require('../lib/scrapers/uploader.js');

module.exports = {
      CmD: ['tracemoe'],
      aliases: ['tracemoe','whatanime','what'],
      categori: "search",
      exec: async(m, { bob, quoted, mime, prefix, command }) => {
      
         if (!/image/.test(mime)) return m.reply(`*(⁠-⁠_⁠-⁠メ⁠)* Format nya salah tuh kak!\nsilahkan send/reply image cut scene anime dengan caption ${prefix + command}`)
         let media = await bob.downloadAndSaveMediaMessage(quoted)
         let upload = await UploadFileUgu(media)         
         let pp = await fetchJson(`https://api.trace.moe/search?anilistInfo&url=${upload.url}`)
         let { anilist, filename, episode, from, to, similarity, video, image } = pp.result[0]
         
         let { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${video}`)         

var cek = anilist.isAdult ? '「 ❗ 」porn detected\n\n🤚sorry Cannot display results smelling porn!!' : `「 ❗ 」What Anime

Akurasi : ${similarity < 0.89 ? 'not sure?\nmake sure the anime scene border has been cut' : 'certain'}

Hentai : ${anilist.isAdult}
Title romaji : ${anilist.title.romaji}
Title english : ${anilist.title.english}
Detail Episode : ${episode}
Scene anime : ${data}
`
       let send = {
          text: cek,                 
          contextInfo:{
           externalAdReply:{
             title: '🔎Anime Search',
             body: `result from tracemoe`,
             thumbnail: await getBuffer(image),
             //sourceUrl: image,
             mediaUrl: image,
             renderLargerThumbnail: true,
             showAdAttribution: false,
             mediaType: 1
            }
           }
         }
         bob.sendMessage(m.chat, send, { quoted : m }) 
         
//bob.sendMessage(m.chat, { image: { url: image }, caption: cek })
 /* var button = [
             { 
              buttonId: anilist.isAdult ? '#' : `#otakudesu search|${anilist.title.romanji}`, 
              buttonText: { 
               displayText: anilist.isAdult ? 'No Porn🤚' : 'Get Info'
               }, type: 1 
              }
             ]             
          bob.sendMessage(
         m.chat, 
         { 
         caption: cek, 
         image: { url: image },
         buttons: button, 
         footer: 'Made with api.trace.moe'}) */
         await fs.unlinkSync(media)      
     }
}