process.on('uncaughtException', console.error)

require('./config')
const fs = require('fs')
const util = require('util')
const path = require('path');
const axios = require('axios')
const moment = require("moment-timezone");

const {
    exec,
    spawn,
    execSync
} = require("child_process")
const {
    smsg,
    color,
    runtime,
    getTime,
    sleep,
    clockString,
    fetchJson,
    getBuffer,
    parseMention,
    getGroupAdmins
} = require('./lib/fungsi.js')


module.exports = bob = async (bob, m, chatUpdate, store) => {
    try {
        var body = (m.mtype === 'conversation') ? m.message.conversation : (m.mtype == 'imageMessage') ? m.message.imageMessage.caption : (m.mtype == 'videoMessage') ? m.message.videoMessage.caption : (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text : (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId : (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId : (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId : (m.mtype === 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text) : ''

        var budy = (typeof m.text == 'string' ? m.text : '')
        var prefix = /^[°•π÷×¶∆£¢€¥®™✓_=|~!?#$%^&.+-,\/\\©^]/.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?#$%^&.+-,\/\\©^]/gi) : '!'
        const time = moment(Date.now()).tz('Asia/Makassar').locale('id').format('DD/MM/YY HH:mm:ss z')
        const dt = moment(Date.now()).tz('Asia/Makassar').locale('id').format('a')
        const ucapanWaktu = "Selamat " + dt.charAt(0).toUpperCase() + dt.slice(1) + "👋"      
        const isCmd = body.startsWith(prefix)
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase()
        const CmD = aliases = body.slice(0).trim().split(/ +/).shift().toLowerCase()
        const args = body.trim().split(/ +/).slice(1)
        const pushname = m.pushName || "No Name"
        const botNumber = await bob.decodeJid(bob.user.id)
        const isCreator = [botNumber, ...global.owner].map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
        const itsMe = m.sender == botNumber ? true : false
        const text = q = args.join(" ")
        const fatkuns = (m.quoted || m)
        const quoted = (fatkuns.mtype == 'buttonsMessage') ? fatkuns[Object.keys(fatkuns)[1]] : (fatkuns.mtype == 'templateMessage') ? fatkuns.hydratedTemplate[Object.keys(fatkuns.hydratedTemplate)[1]] : (fatkuns.mtype == 'product') ? fatkuns[Object.keys(fatkuns)[0]] : m.quoted ? m.quoted : m
        const mime = (quoted.msg || quoted).mimetype || ''
        const qmsg = (quoted.msg || quoted)
        const isMedia = /image|video|sticker|audio/.test(mime)

        //** Group
        const groupMetadata = m.isGroup ? await bob.groupMetadata(m.chat).catch(e => {}) : ''
        const groupName = m.isGroup ? groupMetadata.subject : ''
        const participants = m.isGroup ? await groupMetadata.participants : ''
        const groupAdmins = m.isGroup ? await getGroupAdmins(participants) : ''
        const isBotAdmins = m.isGroup ? groupAdmins.includes(botNumber) : false
        const isAdmins = m.isGroup ? groupAdmins.includes(m.sender) : false

        bob.sendFakePreviewImg = async(txt, title_, desc, img_url ) => {
             let send = {
               text: txt,
               contexInfo: {
                 externalAdReply: {
                   title: title_,
                   body: desc,
                   thumbnail: await getBuffer(img_url),
                   mediaUrl: img_url,                   
                   //renderLargerThumbnail: true,
                   //showAdAttribution: false,
                   mediaType: 2
                 }
               }
             }
          await bob.sendMessage(m.chat, send, { quoted: m })
        }
               

        //** fake reply        
        const fake = {
            key: {
                fromMe: false,
                participant: `0@s.whatsapp.net`,
                ...(m.chat ? {
                    remoteJid: "status@broadcast" //status@broadcast
                } : {})
            },
            message: {
                "extendedTextMessage": {
                    "text": `Di buat dengan Java Script`,
                    "title": `Hmm`,
                    'jpegThumbnail': global.thumb
                }
            }
        }

        //** cmd
        const CmDPlugins = isCmd ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : null

        // ** plugins
        for (let name in plugins) {
            let plugin = plugins[name];
            let turn = plugin.aliases instanceof Array ?
                plugin.aliases.includes(CmDPlugins) :
                plugin.aliases instanceof String ?
                plugin.aliases == CmDPlugins :
                false;
            if (!turn) continue;
            try {
                await plugin.exec(m, {
                    bob,
                    qmsg,
                    budy,
                    quoted,
                    pushname,
                    args,
                    CmD,
                    aliases,
                    text,
                    prefix,
                    command,
                    mime
                });
            } catch (e) {
                bob.sendText(m.chat, `Upss... terjadi kesalahan\nLog kesalahan!\n\n${e}`, m);
                console.log(e);
            }         
        }


        // console logs pc        
        if (!m.isGroup && isCmd) console.log(color('├', 'white'), color('NAMA', 'red'), color(pushname, 'yellow'), color('MENGGUNAKAN', 'white'), color('FITUR :', 'red'), color(command, 'lime'), 'args :', color(args.length))

        // console logs gc
        if (isCmd && m.isGroup) console.log(color('├', 'white'), color('NAMA', 'red'), color(pushname, 'yellow'), color('MENGGUNAKAN', 'white'), color('FITUR :', 'red'), color(command, 'lime'), color(`Di Group ${groupName}`, 'yellow'), 'args :', color(args.length))


        switch (command) {
        

            case 'bob':
            case 'help':
            case 'menu': {
                const plugins = []              
                let pluginFolder = path.join(__dirname, 'perintah')
                let pluginFilter = filename => /\.js$/.test(filename)
                for (let filename of fs.readdirSync(pluginFolder).filter(pluginFilter)) {
                    try {
                        plugins.push(plugins[filename] = require(path.join(pluginFolder, filename)))
                    } catch (e) {
                        console.log(e)
                        delete plugins[filename]
                    }
                }
                const commandsByCategory = {}
                const uncategorizedCommands = []
                

                plugins.forEach(plugin => {
                    const {
                        CmD,
                        categori
                    } = plugin                    
                    if (!categori) {
                        uncategorizedCommands.push(...CmD)
                        return
                    }

                    if (!commandsByCategory[categori]) {
                        commandsByCategory[categori] = []
                    }

                    const commandsWithCategory = CmD.map(cmd => `${cmd}`)
                    commandsByCategory[categori].push(...commandsWithCategory)
                })
                                

                const commandList = []

                Object.entries(commandsByCategory).forEach(([category, commands]) => {
                    commandList.push(`_list fitur ${category.toLowerCase()}_`) 
                    commandList.push(...commands.map(cmd => `  ${prefix + cmd}`))
                    commandList.push('')                
                })

                if (uncategorizedCommands.length) {
                    commandList.push(`*NO CATEGORY*`)
                    commandList.push(...uncategorizedCommands.map(cmd => ` ${prefix + cmd}`))
                    commandList.push('')                  
                }

                const perintah = commandList.join('\n')
                let me = pushname       
                let totag = `Halo @${me.split('@')[0]} ${ucapanWaktu}\nberikut adalah menu yang tersedia!\n\n`          
                let desc = `\n\n_plugin:_ ${plugins.length}\n_error:_ 0`
                               
                /*bob.sendMessage(m.chat, {
                    text: totag + perintah + desc,
                    mentions: [me]
                }, {
                    quoted: m
                })*/
                let send = {
                    text: totag + perintah,               
                    contextInfo:{ 
                        externalAdReply:{
                        title: 'WhatsApp BOT',
                        body: `follow instagram: febriann_syh`,
                        thumbnail: global.thumb,
                        sourceUrl: 'instagram.com/febriann_syh ',
                        mediaUrl: 'https://something.com',
                        renderLargerThumbnail: true,
                        showAdAttribution: false,
                        mediaType: 1
                         }
                        }
                     }
                bob.sendMessage(m.chat, send, { quoted : fake }) 
            }
            break

            case 'runtime':
                console.log(runtime())
            break
            
            case 'delete': case 'del': {
                if (!m.quoted) throw false
                let { chat, fromMe, id, isBaileys } = m.quoted
                if (!isBaileys) throw 'Pesan tersebut bukan dikirim oleh bot!'
                bob.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: true, id: m.quoted.id, participant: m.quoted.sender } })
            }
            break

            
            case 'send': {
                if (!isCreator) return m.reply(mess.owner)
                if (!text) return m.reply('❎')
                await bob.sendFileUrl(m.chat, text, '', m)            
            }
            break
           
            default:       
                       
                if (body.startsWith('=>')) {
                   if (!isCreator) return 

                    function Return(sul) {
                        sat = JSON.stringify(sul, null, 2)
                        bang = util.format(sat)
                        if (sat == undefined) {
                            bang = util.format(sul)
                        }
                        return bob.sendText(m.chat, bang, m)
                    }
                    try {
                        bob.sendText(m.chat, util.format(eval(`(async () => { return ${body.slice(3)} })()`)), m)
                    } catch (e) {
                        bob.sendText(m.chat, String(e), m)
                    }
               }

                if (body.startsWith('>')) {
                    if(!isCreator) return 
                    try {
                        let evaled = await eval(body.slice(2))
                        if (typeof evaled !== 'string') evaled = require('util').inspect(evaled)
                        await bob.sendText(m.chat, util.format(evaled), m)
                    } catch (err) {
                        await bob.sendText(m.chat, String(err), m)
                        console.log(err)
                    }
                }

                if (body.startsWith('$')) {
                    if (!isCreator) return
                    exec(body.slice(2), (err, stdout) => {
                        if (err) return bob.sendText(m.chat, `${err}`, m)
                        if (stdout) return bob.sendText(m.chat, stdout, m)
                    })
                }


        }

    } catch (err) {
        bob.sendText(m.chat, util.format(err), m)
        console.log(err)
    }

}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(`update ${__filename}`)
    delete require.cache[file]
    require(file)
})
