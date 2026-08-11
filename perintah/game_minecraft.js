const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Konfigurasi ServerTap API Minecraft Server
const SERVERTAP_URL = process.env.SERVERTAP_URL || 'http://82.41.42.190:8113/v1';
const SERVERTAP_KEY = process.env.SERVERTAP_KEY || 'my-server-gwh';

const api = axios.create({
    baseURL: SERVERTAP_URL,
    headers: {
        'Key': SERVERTAP_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 10000
});

// Path file database JSON
const dbPath = path.join(__dirname, '../src/database.json');

// Helper Database Koordinat Minecraft
function getSavedCoords() {
    try {
        if (global.db && global.db.data) {
            if (!global.db.data.minecraft_coords) {
                global.db.data.minecraft_coords = {};
            }
            return global.db.data.minecraft_coords;
        }
        if (!fs.existsSync(dbPath)) return {};
        const raw = fs.readFileSync(dbPath, 'utf8');
        const db = JSON.parse(raw);
        return db.minecraft_coords || {};
    } catch (e) {
        console.error('Error reading minecraft_coords:', e);
        return {};
    }
}

function saveCoordsDB(coordsData) {
    try {
        if (global.db && global.db.data) {
            global.db.data.minecraft_coords = coordsData;
            if (typeof global.db.write === 'function') {
                global.db.write().catch(err => console.error('Error saving global.db.data.minecraft_coords:', err));
            }
        }
        const srcDir = path.join(__dirname, '../src');
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
        let db = {};
        if (fs.existsSync(dbPath)) {
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
        }
        db.minecraft_coords = coordsData;
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing minecraft_coords:', e);
    }
}

// Helper Database Sethome Claim
function getSethomeData() {
    try {
        if (global.db && global.db.data) {
            if (!global.db.data.minecraft_sethome) {
                global.db.data.minecraft_sethome = {};
            }
            return global.db.data.minecraft_sethome;
        }
        if (!fs.existsSync(dbPath)) return {};
        const raw = fs.readFileSync(dbPath, 'utf8');
        const db = JSON.parse(raw);
        return db.minecraft_sethome || {};
    } catch (e) {
        console.error('Error reading minecraft_sethome:', e);
        return {};
    }
}

function saveSethomeData(sethomeData) {
    try {
        if (global.db && global.db.data) {
            global.db.data.minecraft_sethome = sethomeData;
            if (typeof global.db.write === 'function') {
                global.db.write().catch(err => console.error('Error saving global.db.data.minecraft_sethome:', err));
            }
        }
        const srcDir = path.join(__dirname, '../src');
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
        let db = {};
        if (fs.existsSync(dbPath)) {
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
        }
        db.minecraft_sethome = sethomeData;
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing minecraft_sethome:', e);
    }
}

// Helper Function: Ambil nama player yang valid
function getPlayerName(p) {
    if (!p) return 'Player';
    return p.displayName || p.name || 'Player';
}

// Helper Function: Format bytes ke Megabytes (MB) / Gigabytes (GB)
function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
        return (mb / 1024).toFixed(2) + ' GB';
    }
    return Math.round(mb) + ' MB';
}

// Helper Database Claim Bansos Minecraft
function getBansosData() {
    try {
        if (global.db && global.db.data) {
            if (!global.db.data.minecraft_bansos) {
                global.db.data.minecraft_bansos = {};
            }
            return global.db.data.minecraft_bansos;
        }
        if (!fs.existsSync(dbPath)) return {};
        const raw = fs.readFileSync(dbPath, 'utf8');
        const db = JSON.parse(raw);
        return db.minecraft_bansos || {};
    } catch (e) {
        console.error('Error reading minecraft_bansos:', e);
        return {};
    }
}

function saveBansosData(bansosData) {
    try {
        if (global.db && global.db.data) {
            global.db.data.minecraft_bansos = bansosData;
            if (typeof global.db.write === 'function') {
                global.db.write().catch(err => console.error('Error saving global.db.data.minecraft_bansos:', err));
            }
        }
        const srcDir = path.join(__dirname, '../src');
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
        let db = {};
        if (fs.existsSync(dbPath)) {
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
        }
        db.minecraft_bansos = bansosData;
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing minecraft_bansos:', e);
    }
}

module.exports = {
    name: 'minecraft',
    aliases: [
        'mc',
        'mchelp',
        'mcstatus',
        'mcinfo',
        'mcplayers',
        'mclist',
        'mcplayer',
        'mcpinfo',
        'mccek',
        'mcsave',
        'mcsv',
        'mccoords',
        'mclistcoords',
        'mclistc',
        'mcdelcoord',
        'mcdelc',
        'mcclaimbansos',
        'mcbansos',
        'mcclaim',
        'mcnotify',
        'mctitle',
        'mcbc',
        'mcbroadcast',
        'mcmsg',
        'mckick',
        'mcban',
        'mccmd',
        'mcsettime',
        'mctime',
        'mcdifficulty',
        'mcdiff',
        'mcsetdifficulty',
        'mcsethome',
        'sethome',
        // Fallback backward compatibility commands
        'minecraft',
        'mcserver',
        'bansos',
        'claimbansos'
    ],
    category: 'minecraft',
    desc: 'Kontrol Full & Manajemen Server Minecraft (Paper + Geyser Bedrock)',
    async exec(m, { bob, args, isCmd, prefix, command, isCreator, isOwner }) {
        let cmdClean = command.toLowerCase();
        let sub = args[0] ? args[0].toLowerCase() : 'help';

        // Direct sub-command mapping if command starts with 'mc'
        if (cmdClean === 'mcstatus' || cmdClean === 'mcinfo') sub = 'status';
        else if (cmdClean === 'mcplayers' || cmdClean === 'mclist') sub = 'players';
        else if (cmdClean === 'mcplayer' || cmdClean === 'mcpinfo' || cmdClean === 'mccek') sub = 'player';
        else if (cmdClean === 'mcsave' || cmdClean === 'mcsv') sub = 'save';
        else if (cmdClean === 'mccoords' || cmdClean === 'mclistcoords' || cmdClean === 'mclistc') sub = 'listcoords';
        else if (cmdClean === 'mcdelcoord' || cmdClean === 'mcdelc') sub = 'delcoord';
        else if (cmdClean === 'mcclaimbansos' || cmdClean === 'mcbansos' || cmdClean === 'mcclaim' || cmdClean === 'claimbansos' || cmdClean === 'bansos') sub = 'claimbansos';
        else if (cmdClean === 'mcsethome' || cmdClean === 'sethome') sub = 'sethome';
        else if (cmdClean === 'mcnotify' || cmdClean === 'mctitle' || cmdClean === 'mcbc' || cmdClean === 'mcbroadcast') sub = 'notify';
        else if (cmdClean === 'mcmsg') sub = 'msg';
        else if (cmdClean === 'mckick') sub = 'kick';
        else if (cmdClean === 'mcban') sub = 'ban';
        else if (cmdClean === 'mccmd') sub = 'cmd';
        else if (cmdClean === 'mcsettime' || cmdClean === 'mctime') sub = 'settime';
        else if (cmdClean === 'mcdifficulty' || cmdClean === 'mcdiff' || cmdClean === 'mcsetdifficulty') sub = 'difficulty';
        else if (cmdClean === 'mchelp') sub = 'help';
        else if (cmdClean === 'mc' || cmdClean === 'minecraft' || cmdClean === 'mcserver') {
            if (!args[0]) sub = 'help';
        }

        // Check Owner status (isCreator, isOwner, or sent from Me/Bot itself)
        const checkOwner = isCreator || isOwner || m.key.fromMe || m.fromMe;

        try {
            // 📌 FITUR SAVE KOORDINAT
            if (sub === 'save' || sub === 'sv') {
                let paramsArr = (cmdClean === 'mcsave' || cmdClean === 'mcsv') ? args : args.slice(1);
                if (paramsArr.length < 4) {
                    return m.reply(`⚠️ Harap masukkan koordinat X Y Z dan Nama Lokasi!\n\nContoh:\n• *${prefix}mcsave -123 80 123 villager*\n• *${prefix}mc sv -123 80 123 villager*`);
                }

                const x = parseFloat(paramsArr[0]);
                const y = parseFloat(paramsArr[1]);
                const z = parseFloat(paramsArr[2]);
                const locName = paramsArr.slice(3).join(' ').trim();

                if (isNaN(x) || isNaN(y) || isNaN(z)) {
                    return m.reply(`❌ Koordinat X, Y, dan Z harus berupa angka!\nContoh: *${prefix}mcsave -123 80 123 villager*`);
                }

                if (!locName) {
                    return m.reply(`⚠️ Harap masukkan nama lokasi/keterangan tempat!`);
                }

                const coordsDB = getSavedCoords();
                const key = locName.toLowerCase();

                coordsDB[key] = {
                    name: locName,
                    x,
                    y,
                    z,
                    savedBy: m.pushName || m.sender,
                    savedAt: new Date().toLocaleString('id-ID')
                };

                saveCoordsDB(coordsDB);

                let txt = `📍 *KOORDINAT BERHASIL DISIMPAN!* 📍\n\n`;
                txt += `🏷️ *Nama Lokasi:* ${locName}\n`;
                txt += `📌 *Koordinat:* X: ${x}, Y: ${y}, Z: ${z}\n`;
                txt += `👤 *Disimpan Oleh:* ${m.pushName || m.sender}\n\n`;
                txt += `✅ Koordinat telah tersimpan di database permainan! Gunakan *${prefix}mclistc* atau *${prefix}mc coords* untuk melihat daftar lokasi.`;

                return m.reply(txt);
            }

            // 📜 FITUR LIST KOORDINAT
            if (sub === 'listcoords' || sub === 'coords' || sub === 'listc') {
                const coordsDB = getSavedCoords();
                const keys = Object.keys(coordsDB);

                if (keys.length === 0) {
                    return m.reply(`ℹ️ Belum ada koordinat yang tersimpan di database.\nGunakan *${prefix}mcsave <X> <Y> <Z> <Nama Lokasi>* untuk menyimpan.`);
                }

                let txt = `🗺️ *DAFTAR KOORDINAT MINECRAFT TERSIMPAN* (${keys.length})\n\n`;
                let idx = 1;
                for (let k of keys) {
                    const item = coordsDB[k];
                    txt += `${idx++}. 📍 *${item.name}*\n`;
                    txt += `   └ 📌 X: \`${item.x}\`, Y: \`${item.y}\`, Z: \`${item.z}\`\n`;
                    txt += `   └ 👤 *Oleh:* ${item.savedBy}\n\n`;
                }
                txt += `📌 *Tips:* Gunakan *${prefix}mcdelc <Nama Lokasi>* untuk menghapus lokasi.`;
                return m.reply(txt);
            }

            // 🗑️ FITUR HAPUS KOORDINAT
            if (sub === 'delcoord' || sub === 'delc' || sub === 'deletecoord') {
                let paramsArr = (cmdClean === 'mcdelcoord' || cmdClean === 'mcdelc') ? args : args.slice(1);
                const targetLoc = paramsArr.join(' ').trim().toLowerCase();

                if (!targetLoc) {
                    return m.reply(`⚠️ Harap masukkan nama lokasi yang ingin dihapus!\nContoh: *${prefix}mcdelc villager*`);
                }

                const coordsDB = getSavedCoords();
                if (!coordsDB[targetLoc]) {
                    return m.reply(`❌ Lokasi *${targetLoc}* tidak ditemukan di database!\nGunakan *${prefix}mclistc* untuk melihat nama lokasi.`);
                }

                const firstName = coordsDB[targetLoc].name;
                delete coordsDB[targetLoc];
                saveCoordsDB(coordsDB);

                return m.reply(`🗑️ *KOORDINAT BERHASIL DIHAPUS!*\n\nLokasi *${firstName}* telah dihapus dari database.`);
            }

            // 🎁 FITUR CLAIM BANSOS
            if (sub === 'claimbansos' || sub === 'bansos' || sub === 'claim') {
                const targetName = (cmdClean === 'mcclaimbansos' || cmdClean === 'mcbansos' || cmdClean === 'mcclaim' || cmdClean === 'claimbansos' || cmdClean === 'bansos') ? args[0] : args[1];
                if (!targetName) {
                    return m.reply(`⚠️ Harap masukkan nama Username In-Game Anda!\nContoh: *${prefix}mcclaimbansos NamaPlayer* atau *${prefix}mc claimbansos NamaPlayer*`);
                }

                const playersRes = await api.get('/players');
                const players = playersRes.data || [];
                const player = players.find(p => {
                    const name = getPlayerName(p);
                    return name.toLowerCase().includes(targetName.toLowerCase());
                });

                if (!player) {
                    return m.reply(`❌ Player *${targetName}* tidak sedang online di server!\n\n📌 *Syarat Claim:* Anda harus berada di dalam game Minecraft terlebih dahulu.`);
                }

                const pName = getPlayerName(player);
                const pKey = pName.toLowerCase();
                const bansosDB = getBansosData();
                const now = Date.now();
                const COOLDOWN_24H = 24 * 60 * 60 * 1000;

                const userRecord = bansosDB[pKey];
                if (userRecord && userRecord.lastClaim) {
                    const timePassed = now - userRecord.lastClaim;
                    if (timePassed < COOLDOWN_24H) {
                        const timeLeft = COOLDOWN_24H - timePassed;
                        const totalSec = Math.floor(timeLeft / 1000);
                        const hours = Math.floor(totalSec / 3600);
                        const minutes = Math.floor((totalSec % 3600) / 60);
                        const seconds = totalSec % 60;
                        return m.reply(`⚠️ Player *${pName}* sudah mengambil Paket Bansos hari ini!\n\n⏳ Silakan tunggu *${hours} Jam ${minutes} Menit ${seconds} Detik* lagi.`);
                    }
                }

                const itemsToGive = [
                    'iron_helmet 1',
                    'iron_chestplate 1',
                    'iron_leggings 1',
                    'iron_boots 1',
                    'iron_sword 1',
                    'iron_pickaxe 1',
                    'iron_axe 1',
                    'iron_shovel 1',
                    'iron_hoe 1',
                    'bread 64',
                    'red_bed 1'
                ];

                for (const item of itemsToGive) {
                    const params = new URLSearchParams();
                    params.append('command', `give ${pName} ${item}`);
                    await api.post('/server/exec', params);
                }

                // Simpan klaim bansos ke database persistent (LowDB / database.json)
                const totalCount = (bansosDB[pKey]?.count || 0) + 1;
                bansosDB[pKey] = {
                    playerName: pName,
                    lastClaim: now,
                    claimedAt: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
                    claimedBySender: m.sender,
                    count: totalCount
                };
                saveBansosData(bansosDB);

                const msgParam = new URLSearchParams();
                msgParam.append('command', `say 🎁 [BANSOS CLAIM] Selamat! Player ${pName} telah mengambil Paket Starter Kit Bansos via WhatsApp!`);
                await api.post('/server/exec', msgParam);

                let txt = `🎁 *SUKSES CLAIM BANSOS STARTER KIT!* 🎁\n\n`;
                txt += `👤 *Penerima:* ${pName}\n`;
                txt += `📦 *Isi Paket Bansos:* \n`;
                txt += `  • 🪖 1x Full Set Iron Armor (Helmet, Chestplate, Leggings, Boots)\n`;
                txt += `  • ⚔️ 1x Full Set Iron Tools (Sword, Pickaxe, Axe, Shovel, Hoe)\n`;
                txt += `  • 🍞 64x Stack Roti (Bread)\n`;
                txt += `  • 🛏️ 1x Kasur Merah (Red Bed)\n\n`;
                txt += `✅ Item sudah dikirim langsung ke inventory Anda di game! Selamat bermain!`;

                return m.reply(txt);
            }

            // 🏠 FITUR CLAIM SETHOME (1 Recovery Compass / Batu Magnet + 1 Compass) - Max 2x Claim
            if (sub === 'sethome') {
                const targetName = (cmdClean === 'mcsethome' || cmdClean === 'sethome') ? args[0] : args[1];
                if (!targetName) {
                    return m.reply(`⚠️ Harap masukkan nama Username In-Game Anda!\nContoh: *${prefix}mcsethome NamaPlayer* atau *${prefix}mc sethome NamaPlayer*`);
                }

                const playersRes = await api.get('/players');
                const players = playersRes.data || [];
                const player = players.find(p => {
                    const name = getPlayerName(p);
                    return name.toLowerCase().includes(targetName.toLowerCase());
                });

                if (!player) {
                    return m.reply(`❌ Player *${targetName}* tidak sedang online di server!\n\n📌 *Syarat Claim:* Anda harus berada di dalam game Minecraft terlebih dahulu.`);
                }

                const pName = getPlayerName(player);
                const sethomeDB = getSethomeData();
                const playerKey = pName.toLowerCase();
                const currentClaims = sethomeDB[playerKey] || 0;

                if (currentClaims >= 2) {
                    return m.reply(`⚠️ Player *${pName}* sudah mencapai batas maksimum claim fitur SetHome! (Maksimal 2x claim per player).`);
                }

                // Give 1 recovery_compass (Batu Magnet) dan 1 compass
                const itemsToGive = [
                    'recovery_compass 1',
                    'compass 1'
                ];

                for (const item of itemsToGive) {
                    const params = new URLSearchParams();
                    params.append('command', `give ${pName} ${item}`);
                    await api.post('/server/exec', params);
                }

                sethomeDB[playerKey] = currentClaims + 1;
                saveSethomeData(sethomeDB);

                const msgParam = new URLSearchParams();
                msgParam.append('command', `say 🏠 [SETHOME CLAIM] Player ${pName} telah mengklaim Kit SetHome (${sethomeDB[playerKey]}/2) via WhatsApp!`);
                await api.post('/server/exec', msgParam);

                let txt = `🏠 *SUKSES CLAIM KIT SETHOME!* 🏠\n\n`;
                txt += `👤 *Penerima:* ${pName}\n`;
                txt += `📊 *Klaim Ke:* ${sethomeDB[playerKey]} dari 2x kesempatan\n`;
                txt += `📦 *Isi Item SetHome:* \n`;
                txt += `  • 🧲 1x Batu Magnet (Recovery Compass)\n`;
                txt += `  • 🧭 1x Kompas (Compass)\n\n`;
                txt += `💡 *Kegunaan:* Item ini berguna untuk menentukan dan menandai lokasi rumah/base yang ingin Anda tempati.\n`;
                txt += `✅ Item sudah dikirim langsung ke inventory Anda di game!`;

                return m.reply(txt);
            }

            // 1. CEK STATUS SERVER
            if (sub === 'status' || sub === 'info') {
                const res = await api.get('/server');
                const playersRes = await api.get('/players');
                let seedTxt = '-';
                try {
                    const worldsRes = await api.get('/worlds');
                    const mainWorld = (worldsRes.data || []).find(w => w.name === 'world' || w.environment === 'NORMAL') || worldsRes.data[0];
                    if (mainWorld && mainWorld.seed !== undefined) {
                        seedTxt = mainWorld.seed.toString();
                    }
                } catch (e) {
                    console.error('Failed to fetch worlds seed:', e.message);
                }

                const data = res.data;
                const health = data.health || {};
                const players = playersRes.data || [];

                // Kalkulasi Penggunaan Memori / RAM
                const totalMem = health.totalMemory || 0;
                const maxMem = health.maxMemory || 0;
                const freeMem = health.freeMemory || 0;
                const usedMem = totalMem - freeMem;
                const usedPercent = maxMem > 0 ? ((usedMem / maxMem) * 100).toFixed(1) : 0;

                // Format Uptime (Detik -> Jam/Menit)
                const uptimeSeconds = health.uptime || 0;
                const hours = Math.floor(uptimeSeconds / 3600);
                const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                const uptimeTxt = `${hours} Jam ${minutes} Menit`;

                let txt = `🎮 *MINECRAFT SERVER STATUS* 🎮\n\n`;
                txt += `📌 *Nama Server:* ${data.name}\n`;
                txt += `🏷️ *MOTD:* ${data.motd}\n`;
                txt += `📦 *Versi Core:* ${data.version}\n`;
                txt += `🌐 *IP Server:* 82.41.42.190\n`;
                txt += `☕ *Port Java:* 8102\n`;
                txt += `📱 *Port Bedrock:* 8109\n`;
                txt += `🌱 *World Seed:* \`${seedTxt}\`\n`;
                txt += `⚡ *TPS Server:* ${data.tps} / 20.0\n`;
                txt += `💻 *CPU Cores:* ${health.cpus || 2} Cores\n`;
                txt += `⏱️ *Server Uptime:* ${uptimeTxt}\n\n`;

                txt += `🧠 *RAM & MEMORI SERVER:* \n`;
                txt += `  • *RAM Terpakai:* ${formatBytes(usedMem)} / ${formatBytes(maxMem)} (${usedPercent}%)\n`;
                txt += `  • *RAM Bebas (Free):* ${formatBytes(freeMem)}\n`;
                txt += `  • *Alokasi Total (Heap):* ${formatBytes(totalMem)}\n\n`;

                txt += `👥 *Pemain Online:* ${data.onlinePlayers}/${data.maxPlayers}\n`;

                if (players.length > 0) {
                    txt += `📋 *Daftar Pemain Online:* \n`;
                    for (let idx = 0; idx < players.length; idx++) {
                        const p = players[idx];
                        const pName = getPlayerName(p);
                        const loc = p.location ? `[X:${Math.round(p.location[0])}, Y:${Math.round(p.location[1])}, Z:${Math.round(p.location[2])}]` : '';
                        txt += `${idx + 1}. *${pName}* ${loc}\n`;
                    }
                } else {
                    txt += `ℹ️ Belum ada pemain yang online saat ini.`;
                }

                return m.reply(txt);
            }

            // 2. KICK PLAYER (OWNER ONLY)
            if (sub === 'kick') {
                if (!checkOwner) {
                    return m.reply(global.mess?.owner || 'Fitur ini khusus Owner Bot!');
                }
                const targetPlayer = (cmdClean === 'mckick') ? args[0] : args[1];
                const reason = (cmdClean === 'mckick') ? args.slice(1).join(' ') || 'Dikeluarkan oleh Admin via WhatsApp Bot' : args.slice(2).join(' ') || 'Dikeluarkan oleh Admin via WhatsApp Bot';
                if (!targetPlayer) {
                    return m.reply(`⚠️ Harap masukkan nama player yang ingin di-kick!\nContoh: *${prefix}mckick Username Alasan* atau *${prefix}mc kick Username Alasan*`);
                }

                const params = new URLSearchParams();
                params.append('command', `kick ${targetPlayer} ${reason}`);
                const execRes = await api.post('/server/exec', params);

                return m.reply(`👞 *KICK PLAYER*\n\n👤 *Player:* ${targetPlayer}\n📝 *Alasan:* ${reason}\n💬 *Respon Server:* ${execRes.data?.out || 'Sukses'}`);
            }

            // 3. CEK DETAIL PLAYER & KOORDINAT
            if (sub === 'player' || sub === 'pinfo' || sub === 'cek') {
                const targetName = (cmdClean === 'mcplayer' || cmdClean === 'mcpinfo' || cmdClean === 'mccek') ? args[0] : args[1];
                if (!targetName) {
                    return m.reply(`⚠️ Harap masukkan nama player!\nContoh: *${prefix}mcplayer Username* atau *${prefix}mc player Username*`);
                }

                const playersRes = await api.get('/players');
                const players = playersRes.data || [];
                const player = players.find(p => {
                    const name = getPlayerName(p);
                    return name.toLowerCase().includes(targetName.toLowerCase());
                });

                if (!player) {
                    return m.reply(`❌ Player *${targetName}* tidak sedang online / tidak ditemukan.`);
                }

                const pName = getPlayerName(player);

                let txt = `👤 *DETAIL PEMAIN MINECRAFT* 👤\n\n`;
                txt += `• *Nama:* ${pName}\n`;
                txt += `• *UUID:* ${player.uuid}\n`;
                txt += `• *Health:* ❤️ ${player.health || 20}/20\n`;
                txt += `• *Food Level:* 🍖 ${player.hunger || 20}/20\n`;
                txt += `• *Gamemode:* 🎮 ${player.gamemode || 'SURVIVAL'}\n`;
                txt += `• *OP / Admin:* ${player.op ? '✅ Ya' : '❌ Tidak'}\n`;
                if (player.location) {
                    txt += `📍 *Koordinat (X, Y, Z):* X: ${player.location[0]?.toFixed(1)}, Y: ${player.location[1]?.toFixed(1)}, Z: ${player.location[2]?.toFixed(1)}\n`;
                    txt += `🌍 *Dimension:* ${player.dimension || 'world'}\n`;
                }

                return m.reply(txt);
            }

            // 4. BAN / UNBAN PLAYER (OWNER ONLY)
            if (sub === 'ban') {
                if (!checkOwner) {
                    return m.reply(global.mess?.owner || 'Fitur ini khusus Owner Bot!');
                }
                const targetPlayer = (cmdClean === 'mcban') ? args[0] : args[1];
                const reason = (cmdClean === 'mcban') ? args.slice(1).join(' ') || 'Banned by Admin via WhatsApp' : args.slice(2).join(' ') || 'Banned by Admin via WhatsApp';
                if (!targetPlayer) return m.reply(`⚠️ Gunakan: *${prefix}mcban Username Alasan* atau *${prefix}mc ban Username Alasan*`);

                const params = new URLSearchParams();
                params.append('command', `ban ${targetPlayer} ${reason}`);
                const execRes = await api.post('/server/exec', params);
                return m.reply(`⛔ *BAN PLAYER*\n\n👤 *Player:* ${targetPlayer}\n📝 *Respon Server:* ${execRes.data?.out || 'Sukses'}`);
            }

            // 5. EKSEKUSI CUSTOM COMMAND (OWNER ONLY)
            if (sub === 'cmd' || sub === 'command') {
                if (!checkOwner) {
                    return m.reply(global.mess?.owner || 'Fitur ini khusus Owner Bot!');
                }
                const commandText = (cmdClean === 'mccmd') ? args.join(' ') : args.slice(1).join(' ');
                if (!commandText) {
                    return m.reply(`⚠️ Harap masukkan perintah minecraft.\nContoh: *${prefix}mccmd say Halo Server!* atau *${prefix}mc cmd say Halo Server!*`);
                }

                const params = new URLSearchParams();
                params.append('command', commandText);

                const execRes = await api.post('/server/exec', params);
                return m.reply(`✅ *Perintah Dikirim ke Console!*\n\n📝 *Command:* \`${commandText}\` \n💬 *Respon:* ${execRes.data?.out || 'Sukses'}`);
            }

            // 5.5 KIRIM PESAN KE GAME / MSG (OWNER ONLY)
            if (sub === 'msg') {
                if (!checkOwner) {
                    return m.reply(global.mess?.owner || 'Fitur ini khusus Owner Bot!');
                }
                const messageText = (cmdClean === 'mcmsg') ? args.join(' ') : args.slice(1).join(' ');
                if (!messageText) {
                    return m.reply(`⚠️ Harap masukkan pesan yang ingin dikirim ke server!\nContoh: *${prefix}mcmsg Halo Semuanya!* atau *${prefix}mc msg Halo Semuanya!*`);
                }

                const params = new URLSearchParams();
                params.append('command', `say 💬 [ADMIN MESSAGE] ${messageText}`);
                const execRes = await api.post('/server/exec', params);
                return m.reply(`💬 *PESAN BERHASIL DIKIRIM KE IN-GAME!*\n\n📝 *Pesan:* ${messageText}\n💬 *Respon Server:* ${execRes.data?.out || 'Sukses'}`);
            }

            // 6. POPUP NOTIFIKASI / BROADCAST VISUAL KE LAYAR PEMAIN
            if (sub === 'notify' || sub === 'title' || sub === 'bc' || sub === 'broadcast') {
                const messageText = (cmdClean.startsWith('mc') && cmdClean !== 'mc') ? args.join(' ') : args.slice(1).join(' ');
                if (!messageText) {
                    return m.reply(`⚠️ Harap masukkan pesan notifikasi!\nContoh:\n• *${prefix}mcnotify Halo Semua!* (Pop-Up di Tengah Layar)\n• *${prefix}mctitle Judul | Subjudul* (Custom Title & Subtitle)`);
                }

                let titleText = '📢 PENGUMUMAN SERVER';
                let subtitleText = messageText;

                if (messageText.includes('|')) {
                    const parts = messageText.split('|');
                    titleText = parts[0].trim();
                    subtitleText = parts.slice(1).join('|').trim();
                }

                // Send Title (Pesan Besar di Tengah Layar)
                const titleParams = new URLSearchParams();
                titleParams.append('command', `title @a title {"text":"${titleText}","color":"gold","bold":true}`);
                await api.post('/server/exec', titleParams);

                // Send Subtitle (Pesan di Bawah Judul)
                const subParams = new URLSearchParams();
                subParams.append('command', `title @a subtitle {"text":"${subtitleText}","color":"yellow"}`);
                await api.post('/server/exec', subParams);

                // Send Actionbar (Teks di Atas Slot Item)
                const actionParams = new URLSearchParams();
                actionParams.append('command', `actionbar @a {"text":"📢 ${subtitleText}","color":"gold"}`);
                await api.post('/server/exec', actionParams);

                // Send In-Game Chat Broadcast
                const chatParams = new URLSearchParams();
                chatParams.append('command', `say 📢 [ANNOUNCEMENT] ${titleText}: ${subtitleText}`);
                await api.post('/server/exec', chatParams);

                return m.reply(`🔔 *NOTIFIKASI POP-UP BERHASIL DIKIRIM!* 🔔\n\n📌 *Judul:* ${titleText}\n💬 *Pesan:* ${subtitleText}\n\n✅ Pesan sudah muncul di tengah layar & chat seluruh pemain in-game!`);
            }

            // 7. SET TIME IN-GAME (KHUSUS OWNER)
            if (sub === 'settime' || sub === 'time') {
                const timeValue = (cmdClean === 'mcsettime' || cmdClean === 'mctime') ? (args[0] ? args[0].toLowerCase() : '') : (args[1] ? args[1].toLowerCase() : '');
                if (!timeValue) {
                    return m.reply(`⚠️ Harap masukkan opsi waktu in-game!\nContoh Opsi:\n• *${prefix}mcsettime day* (Siang - 1000)\n• *${prefix}mcsettime night* (Malam - 13000)\n• *${prefix}mcsettime noon* (Tengah Hari - 6000)\n• *${prefix}mcsettime midnight* (Tengah Malam - 18000)\n• *${prefix}mcsettime <angka>* (Custom ticks, contoh: 6000)`);
                }

                const params = new URLSearchParams();
                params.append('command', `time set ${timeValue}`);
                const execRes = await api.post('/server/exec', params);

                return m.reply(`☀️ *SET WAKTU SERVER MINECRAFT* 🌙\n\n🕒 *Waktu Diset:* \`${timeValue.toUpperCase()}\`\n💬 *Respon Server:* ${execRes.data?.out || 'Sukses'}`);
            }

            // 8. SET DIFFICULTY IN-GAME (KHUSUS OWNER)
            if (sub === 'difficulty' || sub === 'diff' || sub === 'setdifficulty') {
                if (!checkOwner) {
                    return m.reply(global.mess?.owner || 'Fitur ini khusus Owner Bot!');
                }

                const diffValue = (cmdClean === 'mcdifficulty' || cmdClean === 'mcdiff' || cmdClean === 'mcsetdifficulty') ? (args[0] ? args[0].toLowerCase() : '') : (args[1] ? args[1].toLowerCase() : '');
                const validDifficulties = ['peaceful', 'easy', 'normal', 'hard'];

                if (!diffValue || !validDifficulties.includes(diffValue)) {
                    return m.reply(`⚠️ Harap masukkan tingkat kesulitan yang valid!\nContoh Opsi:\n• *${prefix}mcdifficulty peaceful* (Damai / Tanpa Monster)\n• *${prefix}mcdifficulty easy* (Mudah)\n• *${prefix}mcdifficulty normal* (Normal)\n• *${prefix}mcdifficulty hard* (Sangat Sulit)`);
                }

                const params = new URLSearchParams();
                params.append('command', `difficulty ${diffValue}`);
                const execRes = await api.post('/server/exec', params);

                return m.reply(`⚔️ *SET DIFFICULTY SERVER MINECRAFT* ⚔️\n\n🎯 *Tingkat Kesulitan:* \`${diffValue.toUpperCase()}\`\n💬 *Respon Server:* ${execRes.data?.out || 'Sukses'}`);
            }

            // 9. DAFTAR PEMAIN ONLINE
            if (sub === 'players' || sub === 'list') {
                const playersRes = await api.get('/players');
                const players = playersRes.data || [];

                let txt = `👥 *DAFTAR PEMAIN MINECRAFT ONLINE* (${players.length})\n\n`;
                if (players.length === 0) {
                    txt += `Belum ada pemain yang online.`;
                } else {
                    for (let i = 0; i < players.length; i++) {
                        const p = players[i];
                        const pName = getPlayerName(p);
                        const loc = p.location ? `(X:${Math.round(p.location[0])}, Y:${Math.round(p.location[1])}, Z:${Math.round(p.location[2])})` : '';
                        txt += `${i + 1}. *${pName}* ${loc}\n`;
                    }
                }
                return m.reply(txt);
            }

            // MENU HELP LENGKAP
            let help = `🎮 *MINECRAFT SERVER CONTROL MENU* 🎮\n\n`;
            help += `🌐 *FITUR PUBLIK (Semua User)*\n`;
            help += `• *${prefix}mchelp* / *${prefix}mc help* ➔ Menampilkan daftar menu Minecraft\n`;
            help += `• *${prefix}mcsave <X> <Y> <Z> <Nama>* ➔ Simpan koordinat tempat/lokasi\n`;
            help += `• *${prefix}mclistc* / *${prefix}mc coords* ➔ Lihat daftar koordinat tersimpan\n`;
            help += `• *${prefix}mcdelc <Nama Lokasi>* ➔ Hapus koordinat tersimpan\n`;
            help += `• *${prefix}mcstatus* / *${prefix}mc status* ➔ Cek info, TPS, RAM & CPU server\n`;
            help += `• *${prefix}mcplayers* / *${prefix}mc players* ➔ Daftar pemain & posisi singkat\n`;
            help += `• *${prefix}mcplayer <nama>* ➔ Detail HP, Gamemode, Koordinat X Y Z\n`;
            help += `• *${prefix}mcclaimbansos <Username>* ➔ Claim Paket Starter Kit Bansos (1x/player)\n`;
            help += `• *${prefix}mcsethome <Username>* ➔ Claim Kit SetHome (1x Batu Magnet + 1x Kompas, Max 2x/player)\n`;
help += `• *${prefix}mcsettime <day/night/noon/midnight/ticks>* ➔ Set waktu server\n`;
            help += `• *${prefix}mcnotify <pesan>* ➔ Kirim notifikasi pop-up ke layar pemain\n\n`;

            help += `👑 *FITUR KHUSUS OWNER (Owner Only)*\n`;
            help += `• *${prefix}mcmsg <pesan>* ➔ Kirim pesan obrolan ke server in-game *(Owner Only)*\n`;
            help += `• *${prefix}mckick <nama> <alasan>* ➔ Kick player dari server *(Owner Only)*\n`;
            help += `• *${prefix}mcban <nama> <alasan>* ➔ Ban player dari server *(Owner Only)*\n`;
            help += `• *${prefix}mccmd <perintah>* ➔ Eksekusi perintah console *(Owner Only)*\n`;            
            help += `• *${prefix}mcdifficulty <peaceful/easy/normal/hard>* ➔ Set difficulty server *(Owner Only)*\n`;
            return m.reply(help);

        } catch (err) {
            console.error('Minecraft ServerTap Error:', err?.response?.data || err.message);
            return m.reply(`❌ *Gagal Terhubung ke Minecraft Server API*\nError: ${err?.response?.data?.message || err.message}`);
        }
    }
};


