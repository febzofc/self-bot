const {
    AIRPORT_LIST,
    findAirport,
    getDefaultFlightDate,
    formatHumanDate,
    buildTripComUrl,
    searchFlights
} = require('../lib/scrapers/trip_flights.js');

global.tiketPesawatSession = global.tiketPesawatSession || {};
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 Menit

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
 * Mengirim pesan List Message interaktif Baileys (single_select nativeFlow)
 */
async function sendInteractiveList(bob, m, { titleHeader, bodyText, footerText, buttonTitle, sections, fallbackText }) {
    try {
        const { generateWAMessageFromContent, proto } = await getBaileys();
        if (!generateWAMessageFromContent || !proto) {
            return await m.reply(fallbackText || bodyText);
        }

        const interactiveMessage = proto.Message.InteractiveMessage.create({
            header: proto.Message.InteractiveMessage.Header.create({
                title: titleHeader || '🛫 CEK TIKET PESAWAT',
                hasMediaAttachment: false
            }),
            body: proto.Message.InteractiveMessage.Body.create({
                text: bodyText
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
                text: footerText || 'Self-Bot • Flight Ticket Checker'
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify({
                            title: buttonTitle || '📋 Buka Pilihan',
                            sections: sections
                        })
                    }
                ],
                messageParamsJson: '{}'
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
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: {
                                type: 'native_flow',
                                v: '1',
                            },
                            content: [
                                {
                                    tag: 'native_flow',
                                    attrs: {
                                        v: '9',
                                        name: 'mixed',
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
    } catch (e) {
        console.error('Error sending interactive list:', e.message);
        await m.reply(fallbackText || bodyText);
        return false;
    }
}

/**
 * Langkah 1: Kirim List Message Pilihan Tipe Perjalanan
 */
async function sendStepTripType(bob, m) {
    const sections = [
        {
            title: '🛫 Pilihan Tipe Perjalanan',
            rows: [
                {
                    title: '✈️ Sekali Jalan (One-way)',
                    description: 'Penerbangan satu arah ke kota tujuan',
                    id: '.tiket_tipe 0'
                },
                {
                    title: '🔄 Pulang Pergi (Round-trip)',
                    description: 'Penerbangan pergi dan kembali ke kota asal',
                    id: '.tiket_tipe 1'
                },
                {
                    title: '🌐 Multi Kota (Multi-city)',
                    description: 'Penerbangan rute singgah ke beberapa kota',
                    id: '.tiket_tipe 2'
                }
            ]
        }
    ];

    const bodyText = `🛫 *CEK HARGA TIKET PESAWAT* 🛫\n\n` +
        `Silakan pilih *Tipe Perjalanan* yang kamu inginkan melalui tombol menu di bawah:\n\n` +
        `1️⃣ *Sekali Jalan (One-way)*\n` +
        `2️⃣ *Pulang Pergi (Round-trip)*\n` +
        `3️⃣ *Multi Kota (Multi-city)*\n\n` +
        `💡 _Ketik nomor (#1, #2, #3) atau klik tombol menu._\n` +
        `Ketik *batal* untuk mengakhiri sesi.`;

    await sendInteractiveList(bob, m, {
        titleHeader: '🛫 TIPE PERJALANAN',
        bodyText,
        footerText: 'Langkah 1/4 • Tipe Perjalanan',
        buttonTitle: '✈️ Pilih Tipe Perjalanan',
        sections
    });
}

/**
 * Membangun section bandara untuk list message
 */
function buildAirportSections(commandPrefix, excludeCode = '') {
    const groups = ['🌟 Hub Utama', '🏝️ Pulau Jawa', '🌴 Kalimantan', '🌿 Sumatera', '🏔️ Wilayah Lainnya'];
    const sections = [];

    for (const grp of groups) {
        const airports = AIRPORT_LIST.filter(a => a.group === grp && a.code !== excludeCode);
        if (airports.length > 0) {
            sections.push({
                title: grp,
                rows: airports.map(a => ({
                    title: `${a.city} (${a.code})`,
                    description: `${a.name}`.slice(0, 68),
                    id: `${commandPrefix} ${a.code}`
                }))
            });
        }
    }
    return sections;
}

/**
 * Langkah 2: Kirim List Message Pilihan Kota Asal (Departure Area)
 */
async function sendStepOrigin(bob, m, session) {
    const sections = buildAirportSections('.tiket_asal');
    const typeNames = ['Sekali Jalan', 'Pulang Pergi', 'Multi Kota'];
    const typeLabel = typeNames[session.tripType] || 'Sekali Jalan';

    const bodyText = `🛫 *LANGKAH 2: PILIH KOTA ASAL (KEBERANGKATAN)* 🛫\n\n` +
        `📌 Tipe Perjalanan: *${typeLabel}*\n\n` +
        `Silakan ketuk tombol *Pilih Kota Asal* di bawah untuk memilih kota/bandara keberangkatan kamu.\n\n` +
        `🏙️ *Kota Populer:* Jakarta (CGK), Surabaya (SUB), Bali (DPS), Banjarmasin (BDJ), Medan (KNO), Makassar (UPG), dll.\n\n` +
        `💡 _Atau ketik langsung kode bandara / nama kota (misal: *BDJ*, *CGK*, *SUB*)._\n` +
        `Ketik *batal* untuk menghentikan sesi.`;

    await sendInteractiveList(bob, m, {
        titleHeader: '🛫 KOTA ASAL (DEPARTURE)',
        bodyText,
        footerText: 'Langkah 2/4 • Kota Asal',
        buttonTitle: '🛫 Pilih Kota Asal',
        sections
    });
}

/**
 * Langkah 3: Kirim List Message Pilihan Kota Tujuan (Destination Area)
 */
async function sendStepDestination(bob, m, session) {
    const sections = buildAirportSections('.tiket_tujuan', session.origin?.code);

    const bodyText = `🛬 *LANGKAH 3: PILIH KOTA TUJUAN (KEDATANGAN)* 🛬\n\n` +
        `📍 Kota Asal: *${session.origin?.city} (${session.origin?.code})*\n\n` +
        `Silakan ketuk tombol *Pilih Kota Tujuan* di bawah untuk memilih kota/bandara destinasi kamu.\n\n` +
        `💡 _Atau ketik langsung kode bandara / nama kota tujuan (misal: *DPS*, *SUB*, *CGK*)._\n` +
        `Ketik *batal* untuk menghentikan sesi.`;

    await sendInteractiveList(bob, m, {
        titleHeader: '🛬 KOTA TUJUAN (ARRIVAL)',
        bodyText,
        footerText: 'Langkah 3/4 • Kota Tujuan',
        buttonTitle: '🛬 Pilih Kota Tujuan',
        sections
    });
}

/**
 * Langkah 4: Kirim List Message Pilihan Kelas Penerbangan (Cabin Class)
 */
async function sendStepCabinClass(bob, m, session) {
    const sections = [
        {
            title: '💺 Pilihan Kelas Kabin',
            rows: [
                {
                    title: '🏷️ Ekonomi (Economy)',
                    description: 'Pilihan paling hemat & populer untuk semua penumpang',
                    id: '.tiket_kelas 0'
                },
                {
                    title: '✨ Premium Ekonomi',
                    description: 'Kenyamanan ekstra dengan ruang kaki lebih leluasa',
                    id: '.tiket_kelas 1'
                },
                {
                    title: '💼 Bisnis (Business Class)',
                    description: 'Layanan prioritas, lounge, makanan premium & kursi rebah',
                    id: '.tiket_kelas 2'
                },
                {
                    title: '👑 First Class',
                    description: 'Pengalaman termewah dengan privasi eksklusif tertinggi',
                    id: '.tiket_kelas 3'
                }
            ]
        }
    ];

    const bodyText = `💺 *LANGKAH 4: PILIH KELAS PENERBANGAN* 💺\n\n` +
        `📍 Rute: *${session.origin?.code}* ➔ *${session.destination?.code}*\n\n` +
        `Silakan tentukan kelas kabin penerbangan yang kamu inginkan:\n\n` +
        `1️⃣ *Ekonomi (Economy)*\n` +
        `2️⃣ *Premium Ekonomi*\n` +
        `3️⃣ *Bisnis (Business Class)*\n` +
        `4️⃣ *First Class*\n\n` +
        `💡 _Ketik nomor (#1 s/d #4) atau klik tombol menu di bawah._`;

    await sendInteractiveList(bob, m, {
        titleHeader: '💺 KELAS PENERBANGAN',
        bodyText,
        footerText: 'Langkah 4/4 • Kelas Kabin',
        buttonTitle: '💺 Pilih Kelas Penerbangan',
        sections
    });
}

/**
 * Langkah 5: Eksekusi Pencarian dan Tampilkan Hasil & Harga di List Message
 */
async function executeAndSendResults(bob, m, session) {
    await m.reply(`🔎 *Sedang mencari penerbangan dari ${session.origin?.code} ke ${session.destination?.code}...*\nMohon tunggu sebentar, data harga real-time sedang disiapkan.`);

    const searchRes = await searchFlights({
        origin: session.origin?.code,
        destination: session.destination?.code,
        date: session.date,
        tripType: session.tripType,
        cabinClass: session.cabinClass
    });

    session.results = searchRes.flights || [];
    session.tripUrl = searchRes.tripUrl;
    session.step = 'RESULTS';
    session.timestamp = Date.now();

    if (!searchRes.flights || searchRes.flights.length === 0) {
        return m.reply(`⚠️ Tidak ditemukan jadwal penerbangan aktif untuk rute *${session.origin?.code} ➔ ${session.destination?.code}* pada tanggal *${searchRes.dateFormatted}*.\n\nKamu bisa cek jadwal lengkap langsung di Trip.com:\n🔗 ${searchRes.tripUrl}`);
    }

    // Bangun sections untuk List Message Hasil Tiket
    const rows = searchRes.flights.slice(0, 10).map((f, idx) => {
        const num = idx + 1;
        const timeStr = `${f.depTime} - ${f.arrTime}`;
        return {
            title: `${num}. ${f.airline} • ${f.price}`,
            description: `${f.transit} | 🕒 ${timeStr} (${f.duration})`.slice(0, 72),
            id: `.tiket_detail ${num}`
        };
    });

    const sections = [
        {
            title: `Pilihan Penerbangan (${searchRes.flights.length} Opsi)`,
            rows
        }
    ];

    let bodyText = `🛫 *HASIL CEK TIKET PESAWAT* 🛫\n\n` +
        `📍 *Rute:* ${session.origin?.city} (${session.origin?.code}) ➔ ${session.destination?.city} (${session.destination?.code})\n` +
        `📅 *Tanggal:* ${searchRes.dateFormatted}\n` +
        `💺 *Kelas:* ${searchRes.className}\n` +
        `🔄 *Tipe:* ${searchRes.tripTypeName}\n` +
        `📊 *Total Ditemukan:* ${searchRes.flights.length} Opsi Penerbangan\n\n` +
        `Ketuk tombol *Pilih Tiket* di bawah untuk melihat rincian detail jadwal, waktu transit, dan link pemesanan tiap penerbangan.\n\n` +
        `🔗 *Booking Langsung di Trip.com:*\n${searchRes.tripUrl}\n\n` +
        `_💡 Atau balas dengan mengetik nomor (#1 s/d #${rows.length}) untuk melihat detail tiket._`;

    // Kirim list message
    await sendInteractiveList(bob, m, {
        titleHeader: `🛫 TIKET: ${session.origin?.code} ➔ ${session.destination?.code}`,
        bodyText,
        footerText: 'Hasil Pencarian Tiket • Trip.com & Airlines',
        buttonTitle: '🎫 Pilih Tiket & Lihat Detail',
        sections
    });

    // Kirim fallback teks ringkas agar pengguna tanpa native flow tetap dapat melihat rincian
    let summaryText = `📋 *DAFTAR PENERBANGAN & HARGA TIKET*\n` +
        `📍 ${session.origin?.code} ➔ ${session.destination?.code} | ${searchRes.dateFormatted}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n`;

    searchRes.flights.slice(0, 5).forEach((f, idx) => {
        summaryText += `*#${idx + 1}. ${f.airline}* - *${f.price}*\n` +
            `   🕒 ${f.depTime} ➔ ${f.arrTime} (${f.duration})\n` +
            `   🛑 ${f.transit}\n\n`;
    });

    summaryText += `🔗 *Pesan Tiket Resmi:* ${searchRes.tripUrl}\n` +
        `_Balas #${1} s/d #${Math.min(searchRes.flights.length, 10)} untuk rincian penerbangan._`;

    await m.reply(summaryText);
}

/**
 * Tampilkan Detail Tiket Pesawat Spesifik
 */
async function sendFlightDetail(m, session, index) {
    if (!session || !session.results || !session.results[index - 1]) {
        return m.reply('⚠️ Data penerbangan tidak ditemukan atau sesi telah kedaluwarsa. Silakan ketik *.hargatiketpesawat* kembali.');
    }

    const f = session.results[index - 1];
    const typeNames = ['Sekali Jalan', 'Pulang Pergi', 'Multi Kota'];
    const typeLabel = typeNames[session.tripType] || 'Sekali Jalan';
    const classNames = ['Ekonomi', 'Premium Ekonomi', 'Bisnis', 'First Class'];
    const classLabel = classNames[session.cabinClass] || 'Ekonomi';

    const detailText = `✈️ *DETAIL TIKET PENERBANGAN #${index}* ✈️\n\n` +
        `🏢 *Maskapai:* ${f.airline}\n` +
        `💰 *Estimasi Harga:* *${f.price}*\n` +
        `💺 *Kelas Kabin:* ${classLabel}\n` +
        `🔄 *Tipe Perjalanan:* ${typeLabel}\n\n` +
        `🛫 *Keberangkatan:*\n` +
        `• Kota/Bandara: ${f.depAirport}\n` +
        `• Jam: *${f.depTime}* WIB/WITA\n\n` +
        `🛬 *Kedatangan:*\n` +
        `• Kota/Bandara: ${f.arrAirport}\n` +
        `• Jam: *${f.arrTime}* WIB/WITA\n\n` +
        `⏱️ *Total Durasi:* ${f.duration}\n` +
        `🛑 *Status Penerbangan:* ${f.transit}\n` +
        (f.transitNote ? `📌 *Detail Transit:* ${f.transitNote}\n` : '') +
        `\n🔗 *Link Pemesanan Trip.com:*\n${f.tripUrl}\n\n` +
        `_Ketik nomor lain (#1 s/d #${session.results.length}) untuk cek opsi lainnya, atau *batal* untuk selesai._`;

    await m.reply(detailText);
}

module.exports = {
    CmD: ['tiketpesawat'],
    aliases: [
        'hargatiketpesawat',
        'tiketpesawat',
        'pesawat',
        'cektiket',
        'flight',
        'tiket_tipe',
        'tiket_asal',
        'tiket_tujuan',
        'tiket_kelas',
        'tiket_detail'
    ],
    categori: 'CEK CEK',
    desc: 'Cek jadwal & harga tiket pesawat bersesi interaktif dengan Baileys list messages (Sekali Jalan, PP, Multi Kota, Area Asal, Tujuan, Kelas, dan Hasil Harga)',

    /**
     * Hook before: Menangani interaksi tombol list message dan balasan teks bersesi
     */
    before: async (m, { bob, body, budy, isCmd, prefix }) => {
        if (!m || m.isBaileys || m.fromMe) return false;

        const text = (budy || body || '').trim();
        if (!text) return false;

        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;
        let session = global.tiketPesawatSession[sessionId];

        // Cek apakah aksi berupa ID respon tombol interaktif (.tiket_*)
        const isInteractiveAction = text.startsWith('.tiket_') || text.startsWith('!tiket_') || text.startsWith('#tiket_');

        // Jika tidak ada sesi dan bukan aksi tombol tiket, lewati
        if (!session && !isInteractiveAction) return false;

        // Bersihkan sesi kedaluwarsa jika sudah lewat 5 menit
        if (session && (Date.now() - session.timestamp > SESSION_TIMEOUT_MS)) {
            delete global.tiketPesawatSession[sessionId];
            session = null;
            if (!isInteractiveAction) return false;
        }

        const lower = text.toLowerCase().trim();
        const cleanLower = lower.replace(/^[#.!❗\s]+/, '').trim();

        // Perintah batal / keluar dari sesi
        if (['batal', 'exit', 'keluar', 'stop'].includes(cleanLower)) {
            if (session) {
                delete global.tiketPesawatSession[sessionId];
            }
            await m.reply('🛫 *Sesi Cek Tiket Pesawat telah dibatalkan.* Terima kasih!');
            return true;
        }

        // ==========================================
        // 1. PENANGANAN AKSI TOMBOL LIST MESSAGE
        // ==========================================

        // Aksi Tombol Tipe Perjalanan: .tiket_tipe <0|1|2>
        if (text.includes('tiket_tipe')) {
            const valMatch = text.match(/tiket_tipe\s+(\d+)/i);
            const tripType = valMatch ? parseInt(valMatch[1], 10) : 0;
            
            session = global.tiketPesawatSession[sessionId] = session || {
                date: getDefaultFlightDate(),
                timestamp: Date.now()
            };
            session.tripType = tripType;
            session.step = 'ORIGIN';
            session.timestamp = Date.now();

            await sendStepOrigin(bob, m, session);
            return true;
        }

        // Aksi Tombol Kota Asal: .tiket_asal <CODE>
        if (text.includes('tiket_asal')) {
            const codeMatch = text.match(/tiket_asal\s+([A-Za-z]+)/i);
            const airportCode = codeMatch ? codeMatch[1].toUpperCase() : 'BDJ';
            const airportObj = findAirport(airportCode) || { code: airportCode, city: airportCode, name: airportCode };

            session = global.tiketPesawatSession[sessionId] = session || {
                tripType: 0,
                date: getDefaultFlightDate(),
                timestamp: Date.now()
            };
            session.origin = airportObj;
            session.step = 'DESTINATION';
            session.timestamp = Date.now();

            await sendStepDestination(bob, m, session);
            return true;
        }

        // Aksi Tombol Kota Tujuan: .tiket_tujuan <CODE>
        if (text.includes('tiket_tujuan')) {
            const codeMatch = text.match(/tiket_tujuan\s+([A-Za-z]+)/i);
            const airportCode = codeMatch ? codeMatch[1].toUpperCase() : 'DPS';
            const airportObj = findAirport(airportCode) || { code: airportCode, city: airportCode, name: airportCode };

            session = global.tiketPesawatSession[sessionId] = session || {
                tripType: 0,
                origin: findAirport('BDJ'),
                date: getDefaultFlightDate(),
                timestamp: Date.now()
            };
            session.destination = airportObj;
            session.step = 'CABIN_CLASS';
            session.timestamp = Date.now();

            await sendStepCabinClass(bob, m, session);
            return true;
        }

        // Aksi Tombol Kelas Penerbangan: .tiket_kelas <0|1|2|3>
        if (text.includes('tiket_kelas')) {
            const classMatch = text.match(/tiket_kelas\s+(\d+)/i);
            const cabinClass = classMatch ? parseInt(classMatch[1], 10) : 0;

            session = global.tiketPesawatSession[sessionId] = session || {
                tripType: 0,
                origin: findAirport('BDJ'),
                destination: findAirport('DPS'),
                date: getDefaultFlightDate(),
                timestamp: Date.now()
            };
            session.cabinClass = cabinClass;
            session.timestamp = Date.now();

            await executeAndSendResults(bob, m, session);
            return true;
        }

        // Aksi Tombol Detail Tiket: .tiket_detail <INDEX>
        if (text.includes('tiket_detail')) {
            const detailMatch = text.match(/tiket_detail\s+(\d+)/i);
            const index = detailMatch ? parseInt(detailMatch[1], 10) : 1;
            await sendFlightDetail(m, session, index);
            return true;
        }

        // ==========================================
        // 2. PENANGANAN BALASAN TEKS MANUAL BERSESI
        // ==========================================
        if (!session) return false;

        const cleanNum = cleanLower.replace(/[^0-9]/g, '');
        const isPureNumber = /^\d+$/.test(cleanNum);

        // Jika user sedang di tahap STEP 1: TRIP_TYPE
        if (session.step === 'TRIP_TYPE') {
            let selectedType = null;
            if (isPureNumber) {
                const n = parseInt(cleanNum, 10);
                if (n >= 1 && n <= 3) selectedType = n - 1;
            } else if (cleanLower.includes('sekali') || cleanLower.includes('one')) {
                selectedType = 0;
            } else if (cleanLower.includes('pulang') || cleanLower.includes('round')) {
                selectedType = 1;
            } else if (cleanLower.includes('multi')) {
                selectedType = 2;
            }

            if (selectedType !== null) {
                session.tripType = selectedType;
                session.step = 'ORIGIN';
                session.timestamp = Date.now();
                await sendStepOrigin(bob, m, session);
                return true;
            }
        }

        // Jika user sedang di tahap STEP 2: ORIGIN
        if (session.step === 'ORIGIN') {
            const airport = findAirport(cleanLower);
            if (airport) {
                session.origin = airport;
                session.step = 'DESTINATION';
                session.timestamp = Date.now();
                await sendStepDestination(bob, m, session);
                return true;
            } else {
                await m.reply(`⚠️ Kota atau kode bandara "*${text}*" tidak dikenali.\nSilakan pilih dari menu tombol atau ketik kode bandara (misal: *BDJ*, *CGK*, *SUB*, *DPS*).`);
                return true;
            }
        }

        // Jika user sedang di tahap STEP 3: DESTINATION
        if (session.step === 'DESTINATION') {
            const airport = findAirport(cleanLower);
            if (airport) {
                if (session.origin && airport.code === session.origin.code) {
                    await m.reply(`⚠️ Kota tujuan tidak boleh sama dengan kota asal (*${session.origin.code}*). Silakan pilih kota tujuan yang berbeda.`);
                    return true;
                }
                session.destination = airport;
                session.step = 'CABIN_CLASS';
                session.timestamp = Date.now();
                await sendStepCabinClass(bob, m, session);
                return true;
            } else {
                await m.reply(`⚠️ Kota atau kode bandara tujuan "*${text}*" tidak dikenali.\nSilakan pilih dari menu tombol atau ketik kode bandara (misal: *DPS*, *SUB*, *CGK*).`);
                return true;
            }
        }

        // Jika user sedang di tahap STEP 4: CABIN_CLASS
        if (session.step === 'CABIN_CLASS') {
            let selectedClass = null;
            if (isPureNumber) {
                const n = parseInt(cleanNum, 10);
                if (n >= 1 && n <= 4) selectedClass = n - 1;
            } else if (cleanLower.includes('ekonomi premium') || cleanLower.includes('premium')) {
                selectedClass = 1;
            } else if (cleanLower.includes('ekonomi')) {
                selectedClass = 0;
            } else if (cleanLower.includes('bisnis') || cleanLower.includes('business')) {
                selectedClass = 2;
            } else if (cleanLower.includes('first')) {
                selectedClass = 3;
            }

            if (selectedClass !== null) {
                session.cabinClass = selectedClass;
                session.timestamp = Date.now();
                await executeAndSendResults(bob, m, session);
                return true;
            }
        }

        // Jika user sudah di tahap RESULTS dan membalas nomor (#1..N)
        if (session.step === 'RESULTS' && isPureNumber) {
            const idx = parseInt(cleanNum, 10);
            if (session.results && idx >= 1 && idx <= session.results.length) {
                await sendFlightDetail(m, session, idx);
                return true;
            }
        }

        return false;
    },

    /**
     * Handler eksekusi utama perintah .hargatiketpesawat
     */
    exec: async (m, { bob, args, text, prefix, command, isCreator, isOwner }) => {
        const sessionId = m.isGroup ? `${m.chat}_${m.sender}` : m.chat;

        // Jika user langsung memasukkan argumen rute (contoh: .hargatiketpesawat BDJ DPS)
        if (args && args.length >= 2) {
            const orig = findAirport(args[0]);
            const dest = findAirport(args[1]);

            if (orig && dest) {
                const session = global.tiketPesawatSession[sessionId] = {
                    tripType: 0,
                    origin: orig,
                    destination: dest,
                    cabinClass: 0,
                    date: getDefaultFlightDate(),
                    timestamp: Date.now()
                };
                return await executeAndSendResults(bob, m, session);
            }
        }

        // Inisialisasi sesi baru dan kirim Langkah 1 (Tipe Perjalanan)
        global.tiketPesawatSession[sessionId] = {
            step: 'TRIP_TYPE',
            tripType: null,
            origin: null,
            destination: null,
            cabinClass: null,
            date: getDefaultFlightDate(),
            timestamp: Date.now()
        };

        await sendStepTripType(bob, m);
    }
};
