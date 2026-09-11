const {
    fetchJadwalBola,
    searchJadwalBola,
    formatJadwalList,
    formatJadwalDetail
} = require('../lib/scrapers/jadwalBola.js');

global.jadwalBolaSession = global.jadwalBolaSession || {};
const SESSION_TIMEOUT_MS = 2 * 60 * 1000; // 2 Menit

let generateWAMessageFromContent;
let proto;
async function getBaileys() {
    if (!generateWAMessageFromContent || !proto) {
        try {
            const baileys = await import('@whiskeysockets/baileys');
            generateWAMessageFromContent = baileys.generateWAMessageFromContent;
            proto = baileys.proto;
        } catch (e) {
            console.error('Failed to import @whiskeysockets/baileys:', e);
        }
    }
    return { generateWAMessageFromContent, proto };
}

/**
 * Mengirim daftar pertandingan sepak bola menggunakan format List Message interaktif Baileys (single_select)
 */
async function sendJadwalListInteractive(bob, m, { matches, query = '', prefix = '.' }) {
    const { generateWAMessageFromContent, proto } = await getBaileys();
    if (!generateWAMessageFromContent || !proto) return false;

    // Kelompokkan pertandingan berdasarkan kompetisi/liga
    const leagueMap = new Map();
    matches.forEach((item, index) => {
        const num = index + 1;
        const liga = (item.liga || 'Kompetisi Sepak Bola').trim();
        if (!leagueMap.has(liga)) {
            leagueMap.set(liga, []);
        }
        const waktu = item.waktu || '-';
        const skor = (item.skor && item.skor !== '-' && !item.skor.includes('- - -')) ? ` | 🎯 ${item.skor}` : '';
        const desc = `⏱️ ${waktu} | 📌 ${item.status || 'Jadwal'}${skor}`;
        leagueMap.get(liga).push({
            header: `Laga #${num}`,
            title: (item.pertandingan || 'Pertandingan').slice(0, 60),
            description: desc.slice(0, 72),
            id: `#${num}`
        });
    });

    // Batasi maksimum 10 section sesuai standar WhatsApp
    const sections = [];
    let otherRows = [];
    let sectionCount = 0;
    for (const [liga, rows] of leagueMap.entries()) {
        if (sectionCount < 9 || leagueMap.size <= 10) {
            sections.push({
                title: `🏆 ${liga.slice(0, 30)}`,
                rows: rows.slice(0, 10)
            });
            sectionCount++;
        } else {
            otherRows.push(...rows);
        }
    }
    if (otherRows.length > 0) {
        sections.push({
            title: '🏆 Kompetisi Lainnya',
            rows: otherRows.slice(0, 10)
        });
    }

    let bodyText = `⚽ *JADWAL PERTANDINGAN SEPAK BOLA* ⚽\n`;
    if (query) {
        bodyText += `🔍 *Hasil Pencarian:* "${query}"\n`;
    }
    bodyText += `📊 *Total Laga:* ${matches.length} Pertandingan\n\n`;
    bodyText += `Ketuk tombol *Pilih Pertandingan* di bawah untuk melihat susunan pemain (Starting XI), formasi, dan statistik laga secara langsung.\n\n`;
    bodyText += `_💡 Atau kamu juga bisa membalas langsung dengan nomor (#1 s/d #${matches.length})._`;

    const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: proto.Message.InteractiveMessage.Header.create({
            title: "⚽ JADWAL PERTANDINGAN SEPAK BOLA",
            hasMediaAttachment: false
        }),
        body: proto.Message.InteractiveMessage.Body.create({
            text: bodyText
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({
            text: "Self-Bot • Football Live Schedule"
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: [
                {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                        title: "📋 Pilih Pertandingan",
                        sections: sections
                    })
                }
            ],
            messageParamsJson: "{}"
        })
    });

    const waMsg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage
            }
        }
    }, {
        quoted: m
    });

    const relayOptions = {
        additionalNodes: [
            {
                tag: "biz",
                attrs: {},
                content: [
                    {
                        tag: "interactive",
                        attrs: {
                            type: "native_flow",
                            v: "1",
                        },
                        content: [
                            {
                                tag: "native_flow",
                                attrs: {
                                    v: "9",
                                    name: "mixed",
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };

    await bob.relayMessage(m.chat, waMsg.message, { ...relayOptions, messageId: waMsg.key.id });
    return true;
}

/**
 * Membersihkan sesi yang sudah kedaluwarsa
 */
function cleanExpiredSessions() {
    const now = Date.now();
    for (const key in global.jadwalBolaSession) {
        if (now - global.jadwalBolaSession[key].timestamp > SESSION_TIMEOUT_MS) {
            delete global.jadwalBolaSession[key];
        }
    }
}

module.exports = {
    CmD: ['jadwalbola'],
    aliases: [
        'jadwalbola',
        'jadwal-bola',
        'jadwal_bola',
        'jadwalsepakbola',
        'cekjadwalbola',
        'jadwalmatch',
        'infobola',
        'bola',
        'football',
        'soccer'
    ],
    categori: 'search',
    desc: 'Cek jadwal pertandingan sepak bola hari ini/mendatang, status, skor, dan susunan formasi pemain (Starting XI)',

    /**
     * Hook before: Menangani respon interaktif (pilih nomor laga 1..N atau keluar)
     */
    before: async (m, { bob, body, budy, isCmd, prefix }) => {
        if (!m || m.isBaileys || m.fromMe) return false;

        const text = (budy || body || '').trim();
        if (!text) return false;

        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        let session = global.jadwalBolaSession[sessionId];
        if (!session && m.isGroup && global.jadwalBolaSession[m.chat]) {
            session = global.jadwalBolaSession[m.chat];
        }

        // Cek apakah user meng-quote pesan jadwal bola bot
        const isQuotingBotSchedule = m.quoted && (
            (m.quoted.text && (
                m.quoted.text.includes('JADWAL PERTANDINGAN SEPAK BOLA') ||
                m.quoted.text.includes('DETAIL PERTANDINGAN SEPAK BOLA')
            ))
        );

        // Jika tidak ada sesi jadwal bola dan tidak sedang me-reply jadwal bola bot, abaikan
        if (!session && !isQuotingBotSchedule) return false;

        const cleanNumber = text.replace(/^[#.!❗\s]+/, '').trim();
        const isNumber = /^\d+$/.test(cleanNumber);
        const lower = text.toLowerCase().trim();
        const cleanLower = lower.replace(/^[#.!❗\s]+/, '').trim();
        const isExit = ['exit', 'keluar', 'stop', 'batal'].includes(cleanLower);

        // Jika ini adalah perintah bot lain ber-prefix (misal .menu, .play, .ai) dan BUKAN nomor / exit, biarkan handler lain memproses
        if (isCmd && !isNumber && !isExit) return false;

        // Cek apakah sesi sudah kedaluwarsa
        if (session && (Date.now() - session.timestamp > SESSION_TIMEOUT_MS)) {
            delete global.jadwalBolaSession[sessionId];
            if (m.isGroup) delete global.jadwalBolaSession[m.chat];
            session = null;
        }

        // Pengguna ingin keluar dari sesi interaktif
        if (isExit) {
            if (session) {
                delete global.jadwalBolaSession[sessionId];
                if (m.isGroup) delete global.jadwalBolaSession[m.chat];
            }
            await m.reply('⚽ *Sesi Jadwal Sepak Bola telah diakhiri. Terima kasih!*');
            return true;
        }

        // Cek apakah input berupa nomor (misal: "5", "#5", ".5", " 5 ")
        if (isNumber) {
            const choiceNum = parseInt(cleanNumber, 10);
            if (!session) {
                await m.reply('⚠️ *Sesi Jadwal Bola telah kedaluwarsa.*\nSilakan ketik *.jadwalbola* kembali untuk melihat jadwal terbaru.');
                return true;
            }

            if (choiceNum >= 1 && choiceNum <= session.matches.length) {
                session.timestamp = Date.now();
                const selectedMatch = session.matches[choiceNum - 1];
                const detailText = formatJadwalDetail(selectedMatch, choiceNum);
                await m.reply(detailText);
                return true;
            } else {
                await m.reply(`⚠️ Nomor laga tidak valid. Silakan pilih nomor antara *1* sampai *${session.matches.length}*.`);
                return true;
            }
        }

        // Jika pesan meng-quote pesan bot tentang jadwal bola dan mencari nama klub
        if (isQuotingBotSchedule && text.length >= 3) {
            try {
                const results = await searchJadwalBola(text);
                if (results.length === 0) {
                    await m.reply(`❌ Pertandingan dengan kata kunci *"${text}"* tidak ditemukan.`);
                    return true;
                }
                if (results.length === 1) {
                    if (session) {
                        session.matches = results;
                        session.timestamp = Date.now();
                    } else {
                        global.jadwalBolaSession[sessionId] = {
                            chat: m.chat,
                            sender: m.sender,
                            matches: results,
                            timestamp: Date.now()
                        };
                        if (m.isGroup) global.jadwalBolaSession[m.chat] = global.jadwalBolaSession[sessionId];
                    }
                    await m.reply(formatJadwalDetail(results[0], 1));
                    return true;
                }
                if (session) {
                    session.matches = results;
                    session.timestamp = Date.now();
                } else {
                    global.jadwalBolaSession[sessionId] = {
                        chat: m.chat,
                        sender: m.sender,
                        matches: results,
                        timestamp: Date.now()
                    };
                    if (m.isGroup) global.jadwalBolaSession[m.chat] = global.jadwalBolaSession[sessionId];
                }
                try {
                    const sent = await sendJadwalListInteractive(bob, m, { matches: results, query: text, prefix });
                    if (sent) return true;
                } catch (_) {}
                await m.reply(formatJadwalList(results, text));
                return true;
            } catch (err) {
                return false;
            }
        }

        return false;
    },

    /**
     * Handler eksekusi perintah bot
     */
    exec: async (m, { bob, args, text, prefix, command }) => {
        cleanExpiredSessions();

        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        const argText = (text || '').trim();

        // Opsi stop manual (.jadwalbola stop / exit)
        if (['stop', 'exit', 'keluar', 'batal'].includes(argText.toLowerCase())) {
            if (global.jadwalBolaSession[sessionId]) {
                delete global.jadwalBolaSession[sessionId];
                return m.reply('⚽ *Sesi Jadwal Bola telah ditutup.*');
            }
            return m.reply('ℹ️ Tidak ada sesi jadwal bola aktif.');
        }

        // Cek jika user langsung mengetik nomor (misal: .jadwalbola 1 atau .jadwalbola detail 2)
        let directNumber = null;
        if (/^(detail\s+)?\d+$/i.test(argText)) {
            const numStr = argText.replace(/^detail\s+/i, '').trim();
            directNumber = parseInt(numStr, 10);
        }

        // Cek jika ada sesi yang sudah tersimpan dan user mengetik nomor
        if (directNumber && global.jadwalBolaSession[sessionId]) {
            const session = global.jadwalBolaSession[sessionId];
            if (directNumber >= 1 && directNumber <= session.matches.length) {
                session.timestamp = Date.now();
                const match = session.matches[directNumber - 1];
                return m.reply(formatJadwalDetail(match, directNumber));
            }
        }

        // Ambil data jadwal dari API
        m.reply('⏳ _Mengambil data jadwal pertandingan sepak bola terbaru..._');

        try {
            const isRefresh = argText.toLowerCase() === '--refresh' || argText.toLowerCase() === 'refresh';
            const query = isRefresh ? '' : argText;

            let matches = [];
            if (query && !directNumber) {
                matches = await searchJadwalBola(query);
            } else {
                matches = await fetchJadwalBola(isRefresh);
            }

            if (!matches || matches.length === 0) {
                return m.reply(
                    query
                        ? `❌ Tidak ada pertandingan yang cocok dengan kata kunci: *"${query}"*\n\nCoba cari dengan nama klub lain (cth: *${prefix}${command} roma*, *${prefix}${command} bayern*).`
                        : `❌ Saat ini belum ada data jadwal pertandingan sepak bola yang tersedia.`
                );
            }

            // Jika user langsung mencari nomor pada jadwal umum
            if (directNumber) {
                if (directNumber >= 1 && directNumber <= matches.length) {
                    global.jadwalBolaSession[sessionId] = {
                        matches,
                        timestamp: Date.now()
                    };
                    return m.reply(formatJadwalDetail(matches[directNumber - 1], directNumber));
                } else {
                    return m.reply(`⚠️ Nomor pertandingan tidak valid. Pilih antara *1* sampai *${matches.length}*.`);
                }
            }

            // Jika hasil pencarian hanya 1 laga persis, langsung tampilkan detail
            if (query && matches.length === 1) {
                global.jadwalBolaSession[sessionId] = {
                    matches,
                    timestamp: Date.now()
                };
                return m.reply(formatJadwalDetail(matches[0], 1));
            }

            // Simpan ke sesi interaktif untuk pemilihan berikutnya
            global.jadwalBolaSession[sessionId] = {
                chat: m.chat,
                sender: m.sender,
                matches,
                query,
                timestamp: Date.now()
            };
            if (m.isGroup) {
                global.jadwalBolaSession[m.chat] = global.jadwalBolaSession[sessionId];
            }
            // Coba kirimkan via List Message interaktif Baileys (single_select)
            try {
                const sentInteractive = await sendJadwalListInteractive(bob, m, { matches, query, prefix });
                if (sentInteractive) return;
            } catch (interactiveErr) {
                console.warn('Fallback ke format teks untuk jadwal bola:', interactiveErr.message || interactiveErr);
            }

            const listMsg = formatJadwalList(matches, query);
            return m.reply(listMsg);
        } catch (err) {
            console.error('Error in search_jadwalbola:', err);
            return m.reply(`❌ *Gagal mengambil jadwal sepak bola.*\n\n*Penyebab:* ${err.message || err}`);
        }
    }
};
