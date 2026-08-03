const fs = require('fs')
const path = require('path')
const { makeWelcome, makeGodbyee } = require('./welcome.js')

const parseJid = (num) => {
    if (typeof num === 'string') return num
    if (num && typeof num === 'object') return num.id || num.jid || String(num)
    return String(num || '')
}

module.exports = async (bob, anu) => {
    try {
        console.log(`[GROUP UPDATE EVENT] Action: ${anu.action}, Group: ${anu.id}, Participants:`, anu.participants)
        
        let metadata
        try {
            metadata = await bob.groupMetadata(anu.id)
        } catch (e) {
            console.error(`[GROUP UPDATE] Gagal mengambil metadata grup (${anu.id}):`, e.message)
            metadata = { subject: 'Grup' }
        }

        let groupSubject = metadata?.subject || 'Grup'
        let rawParticipants = anu.participants || []

        for (let item of rawParticipants) {
            let num = parseJid(item)
            if (!num || typeof num !== 'string' || !num.includes('@')) continue

            if (anu.action === 'add') {
                console.log(`[GROUP] Member masuk: ${num} di ${groupSubject}`)
                let res = await makeWelcome(bob, num, groupSubject)
                let teks = `Halo @${num.split("@")[0]}, Selamat Datang di grup *${groupSubject}* 👋\n\nJangan lupa perkenalkan diri dan ikuti aturan di grup ini ya!`

                if (res && Buffer.isBuffer(res)) {
                    await bob.sendMessage(anu.id, {
                        image: res,
                        caption: teks,
                        mentions: [num]
                    })
                } else {
                    console.log(`[GROUP] Gambar welcome gagal dibuat, mengirim pesan teks biasa...`)
                    await bob.sendMessage(anu.id, {
                        text: teks,
                        mentions: [num]
                    })
                }
            } else if (anu.action === 'remove' || anu.action === 'leave' || anu.action === 'kick') {
                console.log(`[GROUP] Member keluar: ${num} dari ${groupSubject}`)
                let res = await makeGodbyee(bob, num, groupSubject)
                let teks = `@${num.split("@")[0]} telah meninggalkan grup *${groupSubject}* 👋\nTerima kasih pernah menjadi bagian dari kami.`

                if (res && Buffer.isBuffer(res)) {
                    await bob.sendMessage(anu.id, {
                        image: res,
                        caption: teks,
                        mentions: [num]
                    })
                } else {
                    console.log(`[GROUP] Gambar goodbye gagal dibuat, mengirim pesan teks biasa...`)
                    await bob.sendMessage(anu.id, {
                        text: teks,
                        mentions: [num]
                    })
                }
            }
        }
    } catch (e) {
        console.error('[ERROR Welcome Group]:', e)
    }
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(`Update ${__filename}`)
    delete require.cache[file]
    require(file)
})
