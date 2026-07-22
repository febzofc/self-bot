/**
   * Create By Dika Ardnt
   * Recode Febriansyah.
   * Contact Me on wa.me/6288292024190
   * Follow https://github.com/DikaArdnt
*/

import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Other
global.owner = ['6285849261085']
global.pairing = '085822578327'
global.author = 'WhatsApp Bot'
global.prefa = ['#','!','.','❗']
global.streamingUrl = 'http://localhost:3000'
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

const __filename = fileURLToPath(import.meta.url);
let file = __filename;
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(`update ${__filename}`)
	// Di ESM, Anda tidak bisa menggunakan "delete require.cache" secara langsung.
})
