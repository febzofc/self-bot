/**
   * Create By Dika Ardnt
   * Recode Febriansyah.
   * Contact Me on wa.me/6288292024190
   * Follow https://github.com/DikaArdnt
*/

const fs = require('fs')


// Other
global.owner = ['6285849261085']
global.author = 'WhatsApp Bot'
global.prefa = ['#','!','.','❗']
global.mess = {
    success: '✓ Success',
    admin: 'Fitur Khusus Admin Group!',
    botAdmin: 'Bot Harus Menjadi Admin Terlebih Dahulu!',
    owner: 'Fitur Khusus Owner Bot',
    group: 'Fitur Digunakan Hanya Untuk Group!',
    private: 'Fitur Digunakan Hanya Untuk Private Chat!',
    bot: 'Fitur Khusus Pengguna Nomor Bot',
    wait: 'Loading...',    
}

global.thumb = fs.readFileSync('./lib/bob.jpg')

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(`update ${__filename}`)
	delete require.cache[file]
	require(file)
})
