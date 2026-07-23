/**
 * Updated by Gemini
 * Library: @adiwajshing/baileys (Legacy)
 */



const axios = require('axios');
const pino = require('pino');
const path = require('path');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const syntaxerror = require('syntax-error');
const FileType = require('file-type')
const PhoneNumber = require('awesome-phonenumber');
const readline = require('readline');
const NodeCache = require('node-cache');
const yargs = require('yargs/yargs');
const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');

const { smsg, getBuffer, fetchJson, sleep } = require('./lib/fungsi.js');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif.js');
const { Low, JSONFile } = require('./lib/lowdb')

//datasase
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.db = new Low(new JSONFile(`src/database.json`))

global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) return new Promise((resolve) => setInterval(function () { (!global.db.READ ? (clearInterval(this), resolve(global.db.data == null ? global.loadDatabase() : global.db.data)) : null) }, 1 * 1000))
    if (global.db.data !== null) return
    global.db.READ = true
    await global.db.read()
    global.db.READ = false
    global.db.data = {
        users: {},
        phising: {},
        ...(global.db.data || {})
    }
    global.db.chain = _.chain(global.db.data)
}
loadDatabase()

if (global.db) setInterval(async () => {
    if (global.db.data) await global.db.write()
}, 30 * 1000)

// --- START STREAMING SERVER (Express.js) ---
try {
    require('./server.js');
} catch (err) {
    console.error('Gagal menjalankan Streaming TV Server:', err);
}


const pluginManager = require('./lib/pluginManager.js');

pluginManager.loadAllPlugins();

global.reload = (_event, filename) => {
    if (filename) {
        pluginManager.reloadPlugin(filename);
    }
};
Object.freeze(global.reload);
fs.watch(pluginManager.pluginFolder, global.reload);

const makeInMemoryStore = () => {
    let messages = {};
    let contacts = {};

    const loadMessage = async (jir, id) => {
        return messages[jir]
            ? (messages[jir].array || []).find((a) => a.key.id == id)
            : null;
    };
    const bind = (ev) => {
        ev.on('messages.upsert', ({ messages: Messages }) => {
            const cht = {
                ...Messages[0],
                id: Messages[0].key.remoteJid,
            };
            let isMessage = cht?.message;
            let isStubType = cht?.messageStubType;
            if (!(isMessage || isStubType)) return;
            if (isStubType == '2') return;
            messages[cht.id] ||= {
                array: [],
            };
            messages[cht.id].array.push(cht);
        });
    };
    return {
        messages,
        contacts,
        bind,
        loadMessage,
    };
};

const store = makeInMemoryStore();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const startBot = async () => {
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        generateForwardMessageContent,
        generateWAMessageFromContent,
        downloadContentFromMessage,
        jidDecode,
        proto,
        getMessage,
        fetchLatestBaileysVersion,
        makeCacheableSignalKeyStore
    } = await import("@whiskeysockets/baileys");

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    // console.clear();
    console.log('Menghubungkan ke WhatsApp...');
    console.log(`Memakai WA v${version.join('.')}, isLatest: ${isLatest}`);

    let printQRInTerminal = true;
    let usePairingCode = false;

    if (!state.creds.registered) {
        console.log(`\n============================================`);
        console.log(`Pilih Metode Autentikasi:`);
        console.log(`1. QR Code (Pindai di terminal)`);
        console.log(`2. Pairing Code (Tulis nomor telepon)`);
        console.log(`============================================`);

        const choice = await question('Masukkan pilihan (1 atau 2): ');

        if (choice === '1') {
            printQRInTerminal = true;
            usePairingCode = false;
        } else if (choice === '2') {
            printQRInTerminal = false;
            usePairingCode = true;
        } else {
            console.log('Pilihan tidak valid. Menggunakan QR Code secara default.');
        }
    }

    const msgRetryCounterCache = new NodeCache();
    const bob = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        msgRetryCounterCache,
        syncFullHistory: true,
        generateHighQualityLinkPreview: true,
        getMessage: async key => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg?.message || undefined;
            }
            return proto.Message.create({ conversation: 'test' });
        }
    });

    // Simpan socket ke global variable agar bisa diakses oleh Express
    global.waSock = bob;

    if (!bob.authState.creds.registered && usePairingCode) {
        const phoneNumber = await question('Masukkan nomor telepon Anda (dengan kode negara, cth: 62812xxxxxx):\n');
        const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');

        console.log('Meminta kode pairing...');
        const code = await bob.requestPairingCode(formattedNumber);
        console.log(`\n============================================`);
        console.log(`|    KODE PAIRING ANDA: ${code}    |`);
        console.log(`============================================\n`);
    }

    store.bind(bob.ev);
    bob.public = true; // Status bot publik

    // --- START SERVER PHISING (Express.js) ---
    /*if (!global.phisingServer) {
        require('./testing.js')(bob);
        global.phisingServer = true;
    }*/



    // --- FITUR ANTI CALL ---
    bob.ev.on('call', async (calls) => {
        for (let call of calls) {
            if (call.status === "offer" && call.isGroup === false) {
                let teks = `*${bob.user.name}* tidak bisa menerima panggilan ${call.isVideo ? `video` : `suara`}.\nMaaf @${call.from.split('@')[0]} kamu akan diblokir. Hubungi owner jika tidak sengaja.`;
                let sent = await bob.sendMessage(call.from, { text: teks, mentions: [call.from] });
                // Jika ada global.owner, kirim kontak owner
                if (global.owner) bob.sendContact(call.from, global.owner, sent);
                await sleep(5000);
                await bob.updateBlockStatus(call.from, "block");
            }
        }
    });

    // --- MESSAGE HANDLER ---
    bob.ev.on('messages.upsert', async chatUpdate => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
            if (!bob.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

            let m = smsg(bob, mek, store);
            require("./control.js")(bob, m, chatUpdate, store);
        } catch (err) {
            console.log(err);
        }
    });

    // --- UTILITIES ---
    bob.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        } else return jid;
    };

    bob.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = bob.decodeJid(contact.id);
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
        }
    });
    bob.getName = (jid, withoutContact = false) => {
        id = bob.decodeJid(jid)
        withoutContact = bob.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = bob.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === bob.decodeJid(bob.user.id) ?
            bob.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    bob.sendContact = async (jid, kon, quoted = '', opts = {}) => {
        let list = []
        for (let i of kon) {
            list.push({
                displayName: await bob.getName(i + '@s.whatsapp.net'),
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await bob.getName(i + '@s.whatsapp.net')}\nFN:${await bob.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.EMAIL;type=INTERNET:okeae2410@gmail.com\nitem2.X-ABLabel:Email\nitem3.URL:https://instagram.com/cak_haho\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
            })
        }
        bob.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted })
    }


    bob.serializeM = (m) => smsg(bob, m, store)
    bob.ev.on('creds.update', saveCreds)

    bob.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log(`[QR CODE GENERATED] Harap pindai QR di terminal: ${qr}`);
        }
        if (connection === 'close') {
            global.waSock = null;
            const shouldRestart = new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, mencoba restart:', shouldRestart);
            if (shouldRestart) {
                // Berikan jeda sedikit agar proses sebelumnya benar-benar mati
                setTimeout(() => startBot(), 3000);
            }
            else {
                console.log('Connection closed. You are logged out.');
                rl.close();
            }
        } else if (connection === 'open') {
            console.log('\n✅ Bot berhasil terhubung ke WhatsApp!\n');
        }
    });



    /**
    *
    * @param {*} jid
    * @param {*} url
    * @param {*} caption
    * @param {*} quoted
    * @param {*} options
    */
    bob.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
        let mime = '';
        let res = await axios.head(url)
        mime = res.headers['content-type']
        if (mime.split("/")[1] === "gif") {
            return bob.sendMessage(jid, { video: await getBuffer(url), caption: caption, gifPlayback: true, ...options }, { quoted: quoted, ...options })
        }
        let type = mime.split("/")[0] + "Message"
        if (mime === "application/pdf") {
            return bob.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption: caption, ...options }, { quoted: quoted, ...options })
        }
        if (mime.split("/")[0] === "image") {
            return bob.sendMessage(jid, { image: await getBuffer(url), caption: caption, ...options }, { quoted: quoted, ...options })
        }
        if (mime.split("/")[0] === "video") {
            return bob.sendMessage(jid, { video: await getBuffer(url), caption: caption, mimetype: 'video/mp4', ...options }, { quoted: quoted, ...options })
        }
        if (mime.split("/")[0] === "audio") {
            return bob.sendMessage(jid, { audio: await getBuffer(url), caption: caption, mimetype: 'audio/mpeg', ...options }, { quoted: quoted, ...options })
        }
    }


    /**
     * 
     * @param {*} jid 
     * @param {*} text 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
    bob.sendText = (jid, text, quoted = '', options) => bob.sendMessage(jid, { text: text, ...options }, { quoted, ...options })


    /**
     * 
     * @param {*} jid 
     * @param {*} text 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
    bob.sendTextWithMentions = async (jid, text, quoted, options = {}) => bob.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'), ...options }, { quoted })

    /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
    bob.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        let buffer
        if (options && (options.packname || options.author)) {
            buffer = await writeExifImg(buff, options)
        } else {
            buffer = await imageToWebp(buff)
        }

        await bob.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
        return buffer
    }

    /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
    bob.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        let buffer
        if (options && (options.packname || options.author)) {
            buffer = await writeExifVid(buff, options)
        } else {
            buffer = await videoToWebp(buff)
        }

        await bob.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
        return buffer
    }

    /**
     * 
     * @param {*} message 
     * @param {*} filename 
     * @param {*} attachExtension 
     * @returns 
     */
    bob.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        let quoted = message.msg ? message.msg : message
        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
        const stream = await downloadContentFromMessage(quoted, messageType)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        let type = await FileType.fromBuffer(buffer)
        trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
        // save to file
        await fs.writeFileSync(trueFileName, buffer)
        return trueFileName
    }

    bob.downloadMediaMessage = async (message) => {
        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
        const stream = await downloadContentFromMessage(message, messageType)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }

        return buffer
    }



    /**
     * 
     * @param {*} jid 
     * @param {*} message 
     * @param {*} forceForward 
     * @param {*} options 
     * @returns 
     */
    bob.copyNForward = async (jid, message, forceForward = false, options = {}) => {
        let vtype
        if (options.readViewOnce) {
            message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
            vtype = Object.keys(message.message.viewOnceMessage.message)[0]
            delete (message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
            delete message.message.viewOnceMessage.message[vtype].viewOnce
            message.message = {
                ...message.message.viewOnceMessage.message
            }
        }

        let mtype = Object.keys(message.message)[0]
        let content = await generateForwardMessageContent(message, forceForward)
        let ctype = Object.keys(content)[0]
        let context = {}
        if (mtype != "conversation") context = message.message[mtype].contextInfo
        content[ctype].contextInfo = {
            ...context,
            ...content[ctype].contextInfo
        }
        const waMessage = await generateWAMessageFromContent(jid, content, options ? {
            ...content[ctype],
            ...options,
            ...(options.contextInfo ? {
                contextInfo: {
                    ...content[ctype].contextInfo,
                    ...options.contextInfo
                }
            } : {})
        } : {})
        await bob.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id })
        return waMessage
    }


    return bob;
};
startBot()