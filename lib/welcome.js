/*
  * © Creator : @rifza.p.p
  * © Creator : @FebriansyahXd
*/

const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)
const fs = require('fs')
const path = require('path')
const moment = require("moment-timezone")
const { getBuffer } = require('./fungsi.js')

moment.tz.setDefault("Asia/Jakarta").locale("id")

let welcome = path.join(__dirname, 'asset/welcome.jpg')
let leave = path.join(__dirname, 'asset/leave.jpg')
let beam = path.join(__dirname, 'asset/font-gue.ttf')
let bobJpg = path.join(__dirname, 'bob.jpg')

const getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`
}

const parseJid = (num) => {
    if (typeof num === 'string') return num
    if (num && typeof num === 'object') return num.id || num.jid || String(num)
    return String(num || '')
}

const preparePp = async (bob, num, locate_pp) => {
    let jid = parseJid(num)
    let ppurl = null

    try {
        ppurl = await bob.profilePictureUrl(jid, 'image')
    } catch {
        ppurl = null
    }

    // Jika foto profil user tidak ada / gagal diambil, langsung alihkan ke lib/bob.jpg
    if (!ppurl || !ppurl.startsWith('http')) {
        if (fs.existsSync(bobJpg)) {
            fs.copyFileSync(bobJpg, locate_pp)
            return true
        }
    } else {
        try {
            let buf = await getBuffer(ppurl)
            if (Buffer.isBuffer(buf) && buf.length > 0) {
                fs.writeFileSync(locate_pp, buf)
                return true
            }
        } catch {
            // Jika gagal download, alihkan ke lib/bob.jpg
            if (fs.existsSync(bobJpg)) {
                fs.copyFileSync(bobJpg, locate_pp)
                return true
            }
        }
    }

    // Fallback jika bob.jpg ada
    if (fs.existsSync(bobJpg)) {
        fs.copyFileSync(bobJpg, locate_pp)
    } else {
        await execPromise(`convert -size 250x250 xc:'#777777' '${locate_pp}'`)
    }
    return true
}

exports.makeWelcome = async (bob, num, groupName) => {
    let locate_pp = path.join(__dirname, `asset/${getRandom('.jpeg')}`)
    let resImage = path.join(__dirname, `asset/${getRandom('.jpg')}`)
    try {
        let jid = parseJid(num)
        await preparePp(bob, jid, locate_pp)

        let numbr = jid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '')
        let time = moment(Date.now()).tz('Asia/Jakarta').locale('id').format('DD/MM/YY HH:mm:ss z')
        let fontOpt = fs.existsSync(beam) ? `-font '${beam}'` : ''
        let safeGroupName = String(groupName || 'Group').replace(/['"$`\\!&()]/g, '')

        let cmd = `convert '${locate_pp}' -resize 250x250! '${locate_pp}' && convert '${welcome}' -gravity west -fill '#FFFFFF' ${fontOpt} -size 1280x710 -pointsize 75 -annotate +460-45 '${numbr}' -pointsize 70 -annotate +460+83 '${time}' -pointsize 70 -annotate +460+200 'Welcome to ${safeGroupName}' '${locate_pp}' -gravity center -geometry -430+70 -composite '${resImage}'`
        
        await execPromise(cmd)

        let buffer = fs.readFileSync(resImage)

        if (fs.existsSync(resImage)) fs.unlinkSync(resImage)
        if (fs.existsSync(locate_pp)) fs.unlinkSync(locate_pp)

        return buffer
    } catch (e) {
        console.error('[ERROR makeWelcome]:', e)
        if (fs.existsSync(resImage)) fs.unlinkSync(resImage)
        if (fs.existsSync(locate_pp)) fs.unlinkSync(locate_pp)
        return null
    }
}

exports.makeGodbyee = async (bob, num, groupName) => {
    let locate_pp = path.join(__dirname, `asset/${getRandom('.jpeg')}`)
    let resImage = path.join(__dirname, `asset/${getRandom('.jpg')}`)
    try {
        let jid = parseJid(num)
        await preparePp(bob, jid, locate_pp)

        let numbr = jid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '')
        let time = moment(Date.now()).tz('Asia/Jakarta').locale('id').format('DD/MM/YY HH:mm:ss z')
        let fontOpt = fs.existsSync(beam) ? `-font '${beam}'` : ''
        let safeGroupName = String(groupName || 'Group').replace(/['"$`\\!&()]/g, '')

        let cmd = `convert '${locate_pp}' -resize 250x250! '${locate_pp}' && convert '${leave}' -gravity west -fill '#FFFFFF' ${fontOpt} -size 1280x710 -pointsize 75 -annotate +460-45 '${numbr}' -pointsize 70 -annotate +460+83 '${time}' -pointsize 70 -annotate +460+200 'Leave from ${safeGroupName}' '${locate_pp}' -gravity center -geometry -430+70 -composite '${resImage}'`
        
        await execPromise(cmd)

        let buffer = fs.readFileSync(resImage)

        if (fs.existsSync(resImage)) fs.unlinkSync(resImage)
        if (fs.existsSync(locate_pp)) fs.unlinkSync(locate_pp)

        return buffer
    } catch (e) {
        console.error('[ERROR makeGodbyee]:', e)
        if (fs.existsSync(resImage)) fs.unlinkSync(resImage)
        if (fs.existsSync(locate_pp)) fs.unlinkSync(locate_pp)
        return null
    }
}