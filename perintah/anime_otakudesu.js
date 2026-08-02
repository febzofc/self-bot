try {
    delete require.cache[require.resolve('../lib/scrapers/otakudesu.js')];
} catch (e) {}
const otakudesu = require('../lib/scrapers/otakudesu.js');
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false, family: 4 });

async function getImageBuffer(url) {
    if (!url || typeof url !== 'string') return null;
    if (typeof otakudesu.getImageBuffer === 'function') {
        return await otakudesu.getImageBuffer(url);
    }
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            httpsAgent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        return Buffer.from(res.data);
    } catch (e) {
        console.error('getImageBuffer fallback error:', e.message);
        return null;
    }
}

global.otakudesuSession = global.otakudesuSession || {};

async function sendImageOrReply(bob, m, imageUrl, caption) {
    if (imageUrl) {
        const imageBuffer = await getImageBuffer(imageUrl);
        if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
            return bob.sendMessage(m.chat, { image: imageBuffer, caption }, { quoted: m });
        }
    }
    return m.reply(caption);
}

function renderSearchResults(session) {
    let txt = `🌸 ⛩️ *OTAKUDESU ANIME SEARCH* ⛩️ 🌸\n`;
    txt += `📌 *[ STEP 1/3 ] Hasil Pencarian Anime*\n\n`;
    txt += `🔍 *Kata Kunci:* "${session.query}"\n\n`;
    
    session.searchResults.slice(0, 10).forEach((item, index) => {
        txt += `*#${index + 1}. ${item.title}*\n`;
        txt += `   🈁 ID: \`${item.id}\` | ⭐ Rating: ${item.rating || 'N/A'}\n`;
        txt += `   📌 Status: ${item.status || '-'} | 🏷️ ${item.genre ? item.genre.map(g => g.name).join(', ') : '-'}\n\n`;
    });
    
    txt += `──────────────────────────\n`;
    txt += `💡 *CARA PENGGUNAAN:* \n`;
    txt += `👉 *Balas / Reply pesan ini dengan:* \n`;
    txt += `• *#1* s/d *#${Math.min(10, session.searchResults.length)}* ➔ Pilih Anime yang diinginkan\n`;
    txt += `• *#exit* / *#keluar* ➔ Keluar dari Sesi Interaktif`;
    return txt;
}

function renderAnimeDetail(session) {
    const detail = session.selectedAnime;
    const info = detail.info || {};
    let txt = `⛩️ 🌸 *OTAKUDESU ANIME DETAIL* 🌸 ⛩️\n`;
    txt += `📌 *[ STEP 2/3 ] Detail & Daftar Episode*\n\n`;
    txt += `🏮 *Judul:* ${info.judul || '-'}\n`;
    txt += `🎌 *Judul Jepang:* ${info.judul_jepang || '-'}\n`;
    txt += `⭐ *Skor:* ${info.skor || '-'} | 🎬 *Studio:* ${info.studio || '-'}\n`;
    txt += `📺 *Total Episode:* ${info.episode || '-'}\n`;
    txt += `🏷️ *Genre:* ${info.genre ? info.genre.join(', ') : '-'}\n\n`;
    
    if (detail.sinopsis) {
        txt += `📝 *Sinopsis:*\n${detail.sinopsis.slice(0, 250)}${detail.sinopsis.length > 250 ? '...' : ''}\n\n`;
    }
    
    txt += `📜 *DAFTAR EPISODE / BATCH:* (${detail.episode?.length || 0} Pilihan)\n`;
    if (detail.episode && detail.episode.length > 0) {
        detail.episode.slice(0, 15).forEach((ep, idx) => {
            const isBatch = ep.id.includes('batch');
            const badge = isBatch ? '📦 [BATCH ALL EPISODE]' : '📺 Episode';
            txt += `*#${idx + 1}.* ${badge} ${ep.episode.replace(/^Boruto:\s*/i, '').replace(/^Naruto:\s*/i, '')}\n`;
        });
        if (detail.episode.length > 15) {
            txt += `_... dan ${detail.episode.length - 15} episode lainnya._\n`;
        }
    }
    
    txt += `\n──────────────────────────\n`;
    txt += `💡 *CARA PENGGUNAAN:* \n`;
    txt += `👉 *Balas / Reply pesan ini dengan:* \n`;
    txt += `• *#1* s/d *#${Math.min(15, detail.episode ? detail.episode.length : 0)}* ➔ Pilih Nomor Episode / Batch\n`;
    txt += `• *#search* ➔ Kembali ke Hasil Pencarian Anime\n`;
    txt += `• *#exit* / *#keluar* ➔ Keluar dari Sesi Interaktif`;
    return txt;
}

function renderEpisodeChoices(session) {
    const ep = session.selectedEpisode;
    const isBatch = ep.id.includes('batch');
    let txt = `🎬 🌸 *PILIH AKSI ${isBatch ? 'BATCH' : 'EPISODE'}* 🌸 🎬\n`;
    txt += `📌 *[ STEP 3/3 ] Opsi Aksi*\n\n`;
    txt += `📺 *${isBatch ? 'Batch' : 'Episode'}:* ${ep.episode}\n`;
    txt += `🈁 *ID:* \`${ep.id}\`\n\n`;
    txt += `──────────────────────────\n`;
    txt += `💡 *CARA PENGGUNAAN:* \n`;
    txt += `👉 *Balas / Reply pesan ini dengan:* \n`;
    txt += `• *#1* (atau *#dl*) ➔ 📥 Download ${isBatch ? 'Batch (Semua Ep)' : 'Episode (Semua Kualitas)'}\n`;
    if (!isBatch) {
        txt += `• *#2* (atau *#stream*) ➔ 🎬 Nonton Web Streaming Player TV (Aesthetic UI)\n`;
    }
    txt += `• *#back* ➔ 🔙 Kembali ke Daftar Episode\n`;
    txt += `• *#exit* / *#keluar* ➔ ❌ Keluar dari Sesi Interaktif`;
    return txt;
}

function formatDownloadLinks(resDl, epTitle, epId) {
    const isBatch = epId.includes('batch');
    let txt = `🌸 ⛩️ *LINK DOWNLOAD ${isBatch ? 'BATCH ANIME' : 'EPISODE'}* ⛩️ 🌸\n`;
    txt += `📌 *[ HASIL DOWNLOAD ]*\n\n`;
    txt += `📺 *Target:* ${epTitle}\n`;
    txt += `🈁 *ID:* \`${epId}\`\n\n`;
    txt += `──────────────────────────\n`;

    resDl.forEach((dl, i) => {
        txt += `🎬 *Kualitas ${i + 1}:* *${dl.quality}* ${dl.size ? `(${dl.size})` : ''}\n`;
        txt += `🔗 *Server Download:*\n`;
        for (let server in dl.url) {
            txt += `   ▫️ *${server}:* ${dl.url[server]}\n`;
        }
        txt += `\n`;
    });

    txt += `──────────────────────────\n`;
    txt += `💡 *PETUNJUK:* \n`;
    txt += `• Klik salah satu link server di atas untuk mengunduh.\n`;
    txt += `• Balas *#back* untuk kembali ke daftar episode.\n`;
    txt += `• Balas *#exit* atau *#keluar* untuk mengakhiri sesi.`;
    return txt;
}

function formatStreamLinks(iframeUrl, epTitle, epId) {
    const baseUrl = global.streamingUrl || 'http://localhost:3000';
    const webPlayerUrl = `${baseUrl}/anime-stream?url=${encodeURIComponent(iframeUrl)}&title=${encodeURIComponent(epTitle)}`;

    let txt = `🌸 ⛩️ *OTAKUDESU X SELF-BOT STREAMING TV* ⛩️ 🌸\n`;
    txt += `📌 *[ HASIL STREAMING TV ]*\n\n`;
    txt += `📺 *Episode:* ${epTitle}\n`;
    txt += `🈁 *ID:* \`${epId}\`\n\n`;
    txt += `🖥️ *WEB PLAYER STREAMING TV (Aesthetic UI):*\n`;
    txt += `${webPlayerUrl}\n\n`;
    txt += `🔗 *Direct Iframe Player:*\n`;
    txt += `${iframeUrl}\n\n`;
    txt += `──────────────────────────\n`;
    txt += `💡 *PETUNJUK:* \n`;
    txt += `• Buka link Web Player Streaming TV di atas untuk menonton di browser dengan tampilan jejepangan.\n`;
    txt += `• Balas *#back* untuk kembali ke daftar episode.\n`;
    txt += `• Balas *#exit* atau *#keluar* untuk mengakhiri sesi.`;
    return txt;
}

module.exports = {
    CmD: ['otakudesu'],
    aliases: [
        'otakudesu', 'otaku', 'anime', 
        'otakusearch', 'otakudetail', 'otakudl', 
        'otakustream', 'otakujadwal', 'otakuongoing', 'otakugenre',
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
        '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
        'exit', 'keluar', 'stop', 'batal', 'dl', 'stream', 'back', 'kembali', 'nonton', 'download', 'search'
    ],
    categori: 'anime',
    exec: async (m, { prefix, command, text, bob }) => {
        const sender = m.sender;
        let args = text ? text.trim().split(/ +/) : [];
        let cmd = command.toLowerCase().replace(/^#/, '');

        // === PENANGANAN KELUAR SESI (#exit / #keluar / #stop / #batal) ===
        if (cmd === 'exit' || cmd === 'keluar' || cmd === 'stop' || cmd === 'batal') {
            if (global.otakudesuSession[sender]) {
                delete global.otakudesuSession[sender];
                return m.reply('🌸 *Sesi Otakudesu telah diakhiri. Terima kasih!* 🍡');
            } else {
                return m.reply('❌ Kamu sedang tidak memiliki sesi Otakudesu yang aktif.');
            }
        }

        // === JIKA PENGGUNA MEMILIKI SESI AKTIF ===
        if (global.otakudesuSession[sender]) {
            const session = global.otakudesuSession[sender];

            // ----------------------------------------------------
            // STEP 1: SESI HASIL PENCARIAN (Menunggu Pilihan Anime #1 - #10)
            // ----------------------------------------------------
            if (session.step === 'SEARCH_RESULTS') {
                const choiceNum = parseInt(cmd);
                if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= session.searchResults.length) {
                    const selectedAnime = session.searchResults[choiceNum - 1];
                    m.reply(`_📜 Mengambil detail anime *${selectedAnime.title}*..._`);
                    try {
                        const detail = await otakudesu.get(selectedAnime.id);
                        session.step = 'ANIME_DETAIL';
                        session.selectedAnime = detail;

                        const caption = renderAnimeDetail(session);
                        return sendImageOrReply(bob, m, detail.thumb, caption);
                    } catch (err) {
                        console.error('Error fetching detail in session:', err);
                        return m.reply('❌ Gagal mengambil detail anime.');
                    }
                }
            }

            // ----------------------------------------------------
            // STEP 2: SESI DETAIL ANIME (Menunggu Pilihan Episode / Batch #1 - #15)
            // ----------------------------------------------------
            if (session.step === 'ANIME_DETAIL') {
                if (cmd === 'search') {
                    session.step = 'SEARCH_RESULTS';
                    const caption = renderSearchResults(session);
                    return m.reply(caption);
                }

                const epNum = parseInt(cmd);
                const episodes = session.selectedAnime?.episode || [];
                if (!isNaN(epNum) && epNum >= 1 && epNum <= episodes.length) {
                    const selectedEp = episodes[epNum - 1];
                    session.step = 'EPISODE_CHOSEN';
                    session.selectedEpisode = selectedEp;

                    const caption = renderEpisodeChoices(session);
                    return m.reply(caption);
                }
            }

            // ----------------------------------------------------
            // STEP 3: SESI PILIHAN AKSI EPISODE / BATCH (Download / Stream / Back)
            // ----------------------------------------------------
            if (session.step === 'EPISODE_CHOSEN') {
                if (cmd === 'back' || cmd === 'kembali') {
                    session.step = 'ANIME_DETAIL';
                    const caption = renderAnimeDetail(session);
                    return m.reply(caption);
                }

                // Opsi Download (#1 atau #dl atau #download)
                if (cmd === '1' || cmd === 'dl' || cmd === 'download') {
                    m.reply('_📥 Mengambil link download (semua kualitas)..._');
                    try {
                        const isBatch = session.selectedEpisode.id.includes('batch');
                        const resDl = await otakudesu.download(session.selectedEpisode.id, isBatch);
                        if (!resDl || resDl.length === 0) {
                            return m.reply('❌ Link download tidak ditemukan untuk episode/batch ini.');
                        }

                        const txt = formatDownloadLinks(resDl, session.selectedEpisode.episode, session.selectedEpisode.id);
                        return m.reply(txt);
                    } catch (err) {
                        console.error('Error fetching download in session:', err);
                        return m.reply('❌ Gagal mengambil link download.');
                    }
                }

                // Opsi Streaming (#2 atau #stream atau #nonton)
                if (cmd === '2' || cmd === 'stream' || cmd === 'nonton') {
                    m.reply('_🎬 Mengambil link Web Player Streaming TV..._');
                    try {
                        const iframeUrl = await otakudesu.stream(session.selectedEpisode.id);
                        if (!iframeUrl) {
                            return m.reply('❌ Player streaming tidak ditemukan untuk episode ini.');
                        }

                        const txt = formatStreamLinks(iframeUrl, session.selectedEpisode.episode, session.selectedEpisode.id);
                        return m.reply(txt);
                    } catch (err) {
                        console.error('Error fetching stream in session:', err);
                        return m.reply('❌ Gagal mengambil link streaming.');
                    }
                }
            }
        }

        // === JIKA PENGGUNA MEMULAI PERINTAH BARU TERORGANISIR ===
        let subcmd = command.toLowerCase();
        if (subcmd === 'otakusearch') { subcmd = 'search'; }
        else if (subcmd === 'otakudetail') { subcmd = 'detail'; }
        else if (subcmd === 'otakudl') { subcmd = 'dl'; }
        else if (subcmd === 'otakustream') { subcmd = 'stream'; }
        else if (subcmd === 'otakujadwal') { subcmd = 'schedule'; }
        else if (subcmd === 'otakuongoing') { subcmd = 'ongoing'; }
        else if (subcmd === 'otakugenre') { subcmd = 'genre'; }
        else if (subcmd === 'otakudesu' || subcmd === 'otaku' || subcmd === 'anime') {
            subcmd = args[0] ? args[0].toLowerCase() : 'help';
            if (subcmd !== 'help') args = args.slice(1);
        }

        const q = args.join(' ');

        // --- PENCARIAN & INSIALISASI SESI INTERAKTIF ---
        if (subcmd === 'search') {
            if (!q) return m.reply(`❌ *Masukkan judul anime yang ingin dicari!*\n\nContoh: *${prefix}otakusearch naruto*`);
            m.reply('_🔍 Sedang mencari anime di Otakudesu..._');
            try {
                const res = await otakudesu.search(q);
                if (!res || res.length === 0) return m.reply(`❌ Anime *"${q}"* tidak ditemukan!`);

                // Inisialisasi Sesi Baru untuk User
                global.otakudesuSession[sender] = {
                    step: 'SEARCH_RESULTS',
                    query: q,
                    searchResults: res,
                    selectedAnime: null,
                    selectedEpisode: null,
                    timestamp: Date.now()
                };

                const caption = renderSearchResults(global.otakudesuSession[sender]);
                return sendImageOrReply(bob, m, res[0]?.thumbnail, caption);
            } catch (err) {
                console.error('Otakudesu Search Error:', err);
                return m.reply('❌ Terjadi kesalahan saat mencari anime.');
            }
        }

        // --- DETAIL MANUAL ---
        if (subcmd === 'detail') {
            if (!q) return m.reply(`❌ *Masukkan ID Anime!*\n\nContoh: *${prefix}otakudetail borot-sub-indo*`);
            m.reply('_📜 Mengambil detail anime..._');
            try {
                const res = await otakudesu.get(q);
                global.otakudesuSession[sender] = {
                    step: 'ANIME_DETAIL',
                    query: q,
                    searchResults: [],
                    selectedAnime: res,
                    selectedEpisode: null,
                    timestamp: Date.now()
                };
                const caption = renderAnimeDetail(global.otakudesuSession[sender]);
                return sendImageOrReply(bob, m, res.thumb, caption);
            } catch (err) {
                console.error('Otakudesu Detail Error:', err);
                return m.reply('❌ Anime tidak ditemukan.');
            }
        }

        // --- DOWNLOAD MANUAL ---
        if (subcmd === 'dl' || subcmd === 'download') {
            if (!q) return m.reply(`❌ *Masukkan ID Episode / Batch!*\n\nContoh: *${prefix}otakudl btr-nng-batch-sub-indo*`);
            m.reply('_📥 Mengambil link download..._');
            try {
                const isBatch = q.includes('batch');
                const res = await otakudesu.download(q, isBatch);
                if (!res || res.length === 0) return m.reply('❌ Link download tidak ditemukan.');

                const txt = formatDownloadLinks(res, q, q);
                return m.reply(txt);
            } catch (err) {
                console.error('Otakudesu DL Error:', err);
                return m.reply('❌ Terjadi kesalahan saat mengambil link download.');
            }
        }

        // --- STREAM MANUAL ---
        if (subcmd === 'stream') {
            if (!q) return m.reply(`❌ *Masukkan ID Episode!*\n\nContoh: *${prefix}otakustream mtihd-s3-episode-1-sub-indo*`);
            m.reply('_🎬 Mengambil link Web Player Streaming TV..._');
            try {
                const iframeUrl = await otakudesu.stream(q);
                if (!iframeUrl) return m.reply('❌ Player streaming tidak ditemukan untuk episode ini.');

                const txt = formatStreamLinks(iframeUrl, q, q);
                return m.reply(txt);
            } catch (err) {
                console.error('Otakudesu Stream Error:', err);
                return m.reply('❌ Terjadi kesalahan saat mengambil link streaming.');
            }
        }

        // --- JADWAL RILIS ---
        if (subcmd === 'schedule' || subcmd === 'jadwal') {
            m.reply('_📅 Mengambil jadwal rilis anime..._');
            try {
                const res = await otakudesu.schedule();
                let txt = `🗓️ ⛩️ *JADWAL RILIS ANIME MINGGUAN* ⛩️ 🗓️\n\n`;
                res.forEach((dayGroup) => {
                    txt += `🎏 *HARI: ${dayGroup.day.toUpperCase()}*\n`;
                    dayGroup.animeList.slice(0, 5).forEach((anime) => {
                        txt += `  • ${anime.animeName} (\`${anime.id}\`)\n`;
                    });
                    if (dayGroup.animeList.length > 5) {
                        txt += `  _... dan ${dayGroup.animeList.length - 5} anime lainnya_\n`;
                    }
                    txt += `\n`;
                });
                txt += `📌 *Cari Anime:* *${prefix}otakusearch <judul>*`;
                return m.reply(txt);
            } catch (err) {
                console.error('Otakudesu Schedule Error:', err);
                return m.reply('❌ Terjadi kesalahan saat mengambil jadwal rilis.');
            }
        }

        // --- ANIME ON-GOING ---
        if (subcmd === 'ongoing') {
            const page = parseInt(args[0]) || 1;
            m.reply(`_🔥 Mengambil daftar anime ongoing (Halaman ${page})..._`);
            try {
                const res = await otakudesu.ongoingAnime(page);
                if (!res || res.length === 0) return m.reply('❌ Tidak ada anime ongoing ditemukan.');

                let txt = `🔥 ⛩️ *ANIME ON-GOING TERBARU (Hal. ${page})* ⛩️ 🔥\n\n`;
                res.forEach((item, index) => {
                    txt += `🏮 *${index + 1}. ${item.title}*\n`;
                    txt += `📺 *Episode:* Ep ${item.eps || 'Terbaru'}\n`;
                    txt += `📅 *Hari/Tanggal:* ${item.day} (${item.date})\n`;
                    txt += `🈁 *ID Anime:* \`${item.id}\`\n\n`;
                });
                txt += `👉 *Next Page:* *${prefix}otakuongoing ${page + 1}*\n`;
                txt += `📜 *Lihat Detail:* *${prefix}otakudetail <id_anime>*`;

                return sendImageOrReply(bob, m, res[0]?.thumb, txt);
            } catch (err) {
                console.error('Otakudesu Ongoing Error:', err);
                return m.reply('❌ Terjadi kesalahan saat mengambil anime ongoing.');
            }
        }

        // --- GENRE ---
        if (subcmd === 'genre') {
            const genreSlug = args[0] && isNaN(parseInt(args[0])) ? args[0].toLowerCase() : '';
            const page = parseInt(args[0]) ? parseInt(args[0]) : (parseInt(args[1]) || 1);

            if (!genreSlug) {
                m.reply('_🏷️ Mengambil daftar genre anime..._');
                try {
                    const genres = await otakudesu.genreList();
                    let txt = `🏷️ ⛩️ *DAFTAR GENRE ANIME OTAKUDESU* ⛩️ 🏷️\n\n`;
                    genres.forEach((g) => {
                        txt += `• *${g.name}* ➔ \`${g.slug}\`\n`;
                    });
                    txt += `\n📌 *Cari Anime by Genre:* *${prefix}otakugenre <slug_genre>*\n`;
                    txt += `_Contoh:_ *${prefix}otakugenre action*`;
                    return m.reply(txt);
                } catch (err) {
                    console.error('Otakudesu GenreList Error:', err);
                    return m.reply('❌ Terjadi kesalahan saat mengambil daftar genre.');
                }
            } else {
                m.reply(`_⚔️ Mengambil anime genre "${genreSlug}" (Halaman ${page})..._`);
                try {
                    const res = await otakudesu.genre(genreSlug, page);
                    if (!res || res.length === 0) return m.reply(`❌ Anime dengan genre *"${genreSlug}"* tidak ditemukan.`);

                    let txt = `⚔️ ⛩️ *ANIME GENRE: ${genreSlug.toUpperCase()} (Hal. ${page})* ⛩️ ⚔️\n\n`;
                    res.forEach((item, index) => {
                        txt += `🏮 *${index + 1}. ${item.title}*\n`;
                        txt += `⭐ *Rating:* ${item.rating || 'N/A'} | 📺 *Ep:* ${item.eps || '-'}\n`;
                        txt += `🏷️ *Genre:* ${item.genre ? item.genre.join(', ') : '-'}\n`;
                        txt += `🈁 *ID Anime:* \`${item.id}\`\n\n`;
                    });
                    txt += `👉 *Next Page:* *${prefix}otakugenre ${genreSlug} ${page + 1}*\n`;
                    txt += `📜 *Lihat Detail:* *${prefix}otakudetail <id_anime>*`;

                    return sendImageOrReply(bob, m, res[0]?.pic, txt);
                } catch (err) {
                    console.error('Otakudesu Genre Error:', err);
                    return m.reply('❌ Genre tidak ditemukan atau terjadi kesalahan.');
                }
            }
        }

        // MENU HELP JIKA SUBCOMMAND TIDAK COCOK
        let helpMsg = `⛩️ 🌸 *OTAKUDESU ANIME HUB* 🌸 ⛩️\n\n`;
        helpMsg += `🎏 *Daftar Perintah & Fitur:* 🎐\n\n`;
        helpMsg += `🏮 *1. Cari Anime (Sesi Interaktif)*\n`;
        helpMsg += `• *${prefix}otakusearch <judul>*\n\n`;
        helpMsg += `📜 *2. Detail Anime*\n`;
        helpMsg += `• *${prefix}otakudetail <id_anime>*\n\n`;
        helpMsg += `📥 *3. Download Episode / Batch*\n`;
        helpMsg += `• *${prefix}otakudl <id_episode>*\n\n`;
        helpMsg += `🎬 *4. Streaming Episode*\n`;
        helpMsg += `• *${prefix}otakustream <id_episode>*\n\n`;
        helpMsg += `📅 *5. Jadwal Rilis*\n`;
        helpMsg += `• *${prefix}otakujadwal*\n\n`;
        helpMsg += `🔥 *6. Ongoing Anime*\n`;
        helpMsg += `• *${prefix}otakuongoing*\n\n`;
        helpMsg += `⚔️ *7. Genre Anime*\n`;
        helpMsg += `• *${prefix}otakugenre*\n\n`;
        helpMsg += `🍡 *Selamat Menonton Anime!* 🍥`;
        return m.reply(helpMsg);
    }
};
