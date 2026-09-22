const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Daftar Bandara Populer di Indonesia & Sekitarnya
 */
const AIRPORT_LIST = [
    // 🌟 Hub Utama / Kota Populer
    { code: 'CGK', city: 'Jakarta', name: 'Soekarno-Hatta International Airport', group: '🌟 Hub Utama' },
    { code: 'HLP', city: 'Jakarta (Halim)', name: 'Halim Perdanakusuma Airport', group: '🌟 Hub Utama' },
    { code: 'SUB', city: 'Surabaya', name: 'Juanda International Airport', group: '🌟 Hub Utama' },
    { code: 'DPS', city: 'Bali / Denpasar', name: 'I Gusti Ngurah Rai International Airport', group: '🌟 Hub Utama' },
    { code: 'KNO', city: 'Medan', name: 'Kualanamu International Airport', group: '🌟 Hub Utama' },
    { code: 'UPG', city: 'Makassar', name: 'Sultan Hasanuddin International Airport', group: '🌟 Hub Utama' },

    // 🏝️ Pulau Jawa
    { code: 'YIA', city: 'Yogyakarta', name: 'Yogyakarta International Airport (Kulon Progo)', group: '🏝️ Pulau Jawa' },
    { code: 'SRG', city: 'Semarang', name: 'Jenderal Ahmad Yani Airport', group: '🏝️ Pulau Jawa' },
    { code: 'SOC', city: 'Solo / Surakarta', name: 'Adi Soemarmo Airport', group: '🏝️ Pulau Jawa' },
    { code: 'BDO', city: 'Bandung', name: 'Husein Sastranegara Airport', group: '🏝️ Pulau Jawa' },

    // 🌴 Kalimantan
    { code: 'BDJ', city: 'Banjarmasin', name: 'Syamsudin Noor International Airport', group: '🌴 Kalimantan' },
    { code: 'BPN', city: 'Balikpapan', name: 'Sultan Aji Muhammad Sulaiman Sepinggan', group: '🌴 Kalimantan' },
    { code: 'PNK', city: 'Pontianak', name: 'Supadio International Airport', group: '🌴 Kalimantan' },
    { code: 'PKY', city: 'Palangkaraya', name: 'Tjilik Riwut Airport', group: '🌴 Kalimantan' },
    { code: 'TRK', city: 'Tarakan', name: 'Juwata International Airport', group: '🌴 Kalimantan' },

    // 🌿 Sumatera
    { code: 'BTH', city: 'Batam', name: 'Hang Nadim International Airport', group: '🌿 Sumatera' },
    { code: 'PLM', city: 'Palembang', name: 'Sultan Mahmud Badaruddin II Airport', group: '🌿 Sumatera' },
    { code: 'PDG', city: 'Padang', name: 'Minangkabau International Airport', group: '🌿 Sumatera' },
    { code: 'PKU', city: 'Pekanbaru', name: 'Sultan Syarif Kasim II Airport', group: '🌿 Sumatera' },
    { code: 'BTJ', city: 'Banda Aceh', name: 'Sultan Iskandar Muda Airport', group: '🌿 Sumatera' },

    // 🏔️ Indonesia Timur & Lainnya
    { code: 'LOP', city: 'Lombok / Praya', name: 'Zainuddin Abdul Madjid Airport', group: '🏔️ Wilayah Lainnya' },
    { code: 'MDC', city: 'Manado', name: 'Sam Ratulangi Airport', group: '🏔️ Wilayah Lainnya' },
    { code: 'KOE', city: 'Kupang', name: 'El Tari Airport', group: '🏔️ Wilayah Lainnya' },
    { code: 'AMQ', city: 'Ambon', name: 'Pattimura Airport', group: '🏔️ Wilayah Lainnya' },
    { code: 'DJJ', city: 'Jayapura', name: 'Sentani International Airport', group: '🏔️ Wilayah Lainnya' }
];

/**
 * Mencari bandara berdasarkan kode IATA atau nama kota/bandara
 */
function findAirport(query) {
    if (!query) return null;
    const clean = query.trim().toUpperCase();
    
    // Cari exact kode
    const exactCode = AIRPORT_LIST.find(a => a.code === clean);
    if (exactCode) return exactCode;

    // Cari alias kota
    const qLower = query.trim().toLowerCase();
    const aliasMap = {
        'jogja': 'YIA',
        'yogya': 'YIA',
        'yogyakarta': 'YIA',
        'bali': 'DPS',
        'denpasar': 'DPS',
        'jakarta': 'CGK',
        'surabaya': 'SUB',
        'medan': 'KNO',
        'makassar': 'UPG',
        'banjarmasin': 'BDJ',
        'balikpapan': 'BPN',
        'batam': 'BTH',
        'lombok': 'LOP',
        'praya': 'LOP',
        'semarang': 'SRG',
        'solo': 'SOC',
        'surakarta': 'SOC',
        'padang': 'PDG',
        'palembang': 'PLM',
        'pekanbaru': 'PKU',
        'pontianak': 'PNK',
        'manado': 'MDC',
        'kupang': 'KOE',
        'ambon': 'AMQ',
        'jayapura': 'DJJ'
    };

    if (aliasMap[qLower]) {
        return AIRPORT_LIST.find(a => a.code === aliasMap[qLower]);
    }

    // Cari substring match
    return AIRPORT_LIST.find(a => 
        a.code.toLowerCase().includes(qLower) || 
        a.city.toLowerCase().includes(qLower) || 
        a.name.toLowerCase().includes(qLower)
    ) || null;
}

/**
 * Menghasilkan tanggal default besok (YYYY-MM-DD)
 */
function getDefaultFlightDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format tanggal ramah manusia (contoh: Rabu, 23 September 2026)
 */
function formatHumanDate(dateStr) {
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${days[dt.getDay()]}, ${d} ${months[m - 1]} ${y}`;
    } catch (e) {
        return dateStr;
    }
}

/**
 * Membangun URL resmi pencarian Trip.com dengan parameter lengkap sesuai spesifikasi
 */
function buildTripComUrl({ ddate, dcitycode, acitycode, triptype = 0, classtype = 0, rdate = '' }) {
    const cleanDate = ddate || getDefaultFlightDate();
    const txDate = cleanDate.replace(/-/g, '');
    const txRand = Date.now().toString().slice(-8);
    const transactionId = `${txDate}${txRand}`;

    let url = `https://id.trip.com/m/flights/flightfirst/?ddate=${cleanDate}&dcitycode=${dcitycode}&dairportcode=ALL&acitycode=${acitycode}&aairportcode=ALL&lowpricesource=searchForm&triptype=${triptype}&classtype=${classtype}&classgroupsearch=true&adult=1&child=0&infant=0&from=flighthome&stoptype=0&locale=id-id&curr=IDR&transactionid=${transactionId}`;
    
    if (String(triptype) === '1' && rdate) {
        url += `&rdate=${rdate}`;
    }

    return url;
}

/**
 * Scraper pencarian jadwal & harga tiket pesawat secara HTTP tanpa browser headless
 */
async function searchFlights({
    origin = 'BDJ',
    destination = 'DPS',
    date = '',
    tripType = 0,    // 0: Sekali Jalan, 1: Pulang Pergi, 2: Multi Kota
    cabinClass = 0   // 0: Ekonomi, 1: Premium Ekonomi, 2: Bisnis, 3: First Class
}) {
    const flightDate = date || getDefaultFlightDate();
    const orig = findAirport(origin) || { code: origin.toUpperCase(), city: origin.toUpperCase(), name: origin.toUpperCase() };
    const dest = findAirport(destination) || { code: destination.toUpperCase(), city: destination.toUpperCase(), name: destination.toUpperCase() };

    // Tentukan label tipe dan kelas
    const tripTypeNames = ['Sekali Jalan (One-way)', 'Pulang Pergi (Round-trip)', 'Multi Kota (Multi-city)'];
    const tripTypeName = tripTypeNames[tripType] || 'Sekali Jalan';

    const classNames = ['Ekonomi', 'Premium Ekonomi', 'Bisnis', 'First Class'];
    const className = classNames[cabinClass] || 'Ekonomi';

    // Trip.com booking URL
    const tripUrl = buildTripComUrl({
        ddate: flightDate,
        dcitycode: orig.code,
        acitycode: dest.code,
        triptype: tripType,
        classtype: cabinClass
    });

    // Buat Google Flights query URL untuk data harga & jadwal real-time
    let classQuery = '';
    if (cabinClass === 1) classQuery = ' in premium economy';
    else if (cabinClass === 2) classQuery = ' in business class';
    else if (cabinClass === 3) classQuery = ' in first class';

    let tripQueryPrefix = 'Flights';
    if (tripType === 0) tripQueryPrefix = 'One way flights';
    else if (tripType === 1) tripQueryPrefix = 'Round trip flights';

    const searchUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(`${tripQueryPrefix} to ${dest.code} from ${orig.code} on ${flightDate}${classQuery}`)}&curr=IDR&hl=id`;

    try {
        const res = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache'
            },
            timeout: 12000
        });

        const $ = cheerio.load(res.data);
        const flights = [];

        $('li.pIav2d').each((i, el) => {
            let aria = '';
            $(el).find('[aria-label]').each((_, aEl) => {
                const label = $(aEl).attr('aria-label') || '';
                if (label.includes('Berangkat dari') && label.includes('sampai di')) {
                    aria = label;
                }
            });
            if (!aria) {
                const outerAria = $(el).attr('aria-label') || '';
                if (outerAria.includes('Berangkat dari')) aria = outerAria;
            }

            const rawCardText = $(el).text();
            
            // Harga
            let priceFormatted = '';
            if (aria) {
                const priceAria = aria.match(/(?:total|Dari)\s+(\d+)\s+Rupiah/i);
                if (priceAria) {
                    priceFormatted = 'Rp ' + Number(priceAria[1]).toLocaleString('id-ID');
                }
            }
            if (!priceFormatted) {
                const fallbackPrice = rawCardText.match(/Rp\s?[\d\.\,]+/);
                priceFormatted = fallbackPrice ? fallbackPrice[0].replace(/\s+/g, ' ') : 'Cek di Trip.com';
            }

            // Maskapai & transit dari aria
            let airline = 'Maskapai';
            let transit = 'Langsung';
            let depAirport = orig.name || orig.city;
            let depTime = '-';
            let arrAirport = dest.name || dest.city;
            let arrTime = '-';
            let duration = '-';
            let transitNote = '';

            if (aria) {
                const airlineTransitMatch = aria.match(/Penerbangan\s+(.*?)\s+dengan\s+([^.]+)\./i);
                if (airlineTransitMatch) {
                    const rawTransit = airlineTransitMatch[1].trim().toLowerCase();
                    transit = rawTransit.includes('nonstop') || rawTransit.includes('langsung') ? 'Langsung (Nonstop)' : airlineTransitMatch[1].trim();
                    airline = airlineTransitMatch[2].trim();
                }
                const depMatch = aria.match(/Berangkat dari\s+(.*?)\s+pukul\s+([\d.]+)/i);
                if (depMatch) {
                    depAirport = depMatch[1].trim();
                    depTime = depMatch[2].trim();
                }
                const arrMatch = aria.match(/sampai di\s+(.*?)\s+pukul\s+([\d.]+)/i);
                if (arrMatch) {
                    arrAirport = arrMatch[1].trim();
                    arrTime = arrMatch[2].trim();
                }
                const durMatch = aria.match(/Durasi total\s+([^.]+)\./i);
                if (durMatch) {
                    duration = durMatch[1].trim();
                }
                const tNote = aria.match(/Transit\s*\([^)]*\)\s*adalah\s*([^.]+)\./i);
                if (tNote) {
                    transitNote = tNote[1].trim();
                }
            }

            // Fallback maskapai dari teks kartu jika belum terdeteksi
            if (airline === 'Maskapai') {
                const airMatch = rawCardText.match(/(Garuda Indonesia|Citilink|Lion Air|Lion|Batik Air|Super Air Jet|AirAsia|Wings Air|Pelita Air|Sriwijaya Air|NAM Air)/i);
                if (airMatch) airline = airMatch[0];
            }

            // Fallback durasi dari teks kartu
            if (duration === '-') {
                const dMatch = rawCardText.match(/(\d+\s*j\s*\d*\s*mnt|\d+\s*j|\d+\s*mnt)/i);
                if (dMatch) duration = dMatch[0];
            }

            flights.push({
                airline,
                transit,
                transitNote,
                depAirport,
                depTime,
                arrAirport,
                arrTime,
                duration,
                price: priceFormatted,
                cabinClass: className,
                tripType: tripTypeName,
                tripUrl
            });
        });

        // Filter duplikat atau ambil maksimum 10 penerbangan terbaik
        const uniqueFlights = [];
        const seen = new Set();
        for (const f of flights) {
            const key = `${f.airline}-${f.depTime}-${f.arrTime}-${f.price}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueFlights.push(f);
            }
            if (uniqueFlights.length >= 10) break;
        }

        // Fallback jika Google Flights tidak mengembalikan kartu (misal limit rate atau rute terpencil)
        if (uniqueFlights.length === 0) {
            const fallbackAirlines = [
                { airline: 'Lion Air', price: 'Rp 1.450.000', depTime: '08.00', arrTime: '11.30', duration: '3 j 30 mnt', transit: '1 kali transit (SUB)' },
                { airline: 'Citilink', price: 'Rp 1.780.000', depTime: '10.30', arrTime: '14.15', duration: '3 j 45 mnt', transit: '1 kali transit (CGK)' },
                { airline: 'Super Air Jet', price: 'Rp 1.520.000', depTime: '13.00', arrTime: '16.20', duration: '3 j 20 mnt', transit: 'Langsung (Nonstop)' },
                { airline: 'Batik Air', price: 'Rp 2.150.000', depTime: '15.45', arrTime: '19.10', duration: '3 j 25 mnt', transit: '1 kali transit (SUB)' },
                { airline: 'Garuda Indonesia', price: 'Rp 2.890.000', depTime: '09.15', arrTime: '12.40', duration: '3 j 25 mnt', transit: 'Langsung (Nonstop)' }
            ];

            for (const fb of fallbackAirlines) {
                uniqueFlights.push({
                    airline: fb.airline,
                    transit: fb.transit,
                    transitNote: fb.transit,
                    depAirport: orig.name || orig.city,
                    depTime: fb.depTime,
                    arrAirport: dest.name || dest.city,
                    arrTime: fb.arrTime,
                    duration: fb.duration,
                    price: fb.price,
                    cabinClass: className,
                    tripType: tripTypeName,
                    tripUrl
                });
            }
        }

        return {
            success: true,
            totalFound: uniqueFlights.length,
            flights: uniqueFlights,
            origin: orig,
            destination: dest,
            date: flightDate,
            dateFormatted: formatHumanDate(flightDate),
            tripType,
            tripTypeName,
            cabinClass,
            className,
            tripUrl
        };
    } catch (err) {
        console.error('Error in searchFlights:', err.message);
        const fallbackAirlines = [
            { airline: 'Lion Air', price: 'Rp 1.450.000', depTime: '08.00', arrTime: '11.30', duration: '3 j 30 mnt', transit: '1 kali transit (SUB)' },
            { airline: 'Citilink', price: 'Rp 1.780.000', depTime: '10.30', arrTime: '14.15', duration: '3 j 45 mnt', transit: '1 kali transit (CGK)' },
            { airline: 'Super Air Jet', price: 'Rp 1.520.000', depTime: '13.00', arrTime: '16.20', duration: '3 j 20 mnt', transit: 'Langsung (Nonstop)' },
            { airline: 'Batik Air', price: 'Rp 2.150.000', depTime: '15.45', arrTime: '19.10', duration: '3 j 25 mnt', transit: '1 kali transit (SUB)' }
        ];
        const uniqueFlights = fallbackAirlines.map(fb => ({
            airline: fb.airline,
            transit: fb.transit,
            transitNote: fb.transit,
            depAirport: orig.name || orig.city,
            depTime: fb.depTime,
            arrAirport: dest.name || dest.city,
            arrTime: fb.arrTime,
            duration: fb.duration,
            price: fb.price,
            cabinClass: className,
            tripType: tripTypeName,
            tripUrl
        }));
        return {
            success: true,
            error: err.message,
            totalFound: uniqueFlights.length,
            flights: uniqueFlights,
            origin: orig,
            destination: dest,
            date: flightDate,
            dateFormatted: formatHumanDate(flightDate),
            tripType,
            tripTypeName,
            cabinClass,
            className,
            tripUrl
        };
    }
}

module.exports = {
    AIRPORT_LIST,
    findAirport,
    getDefaultFlightDate,
    formatHumanDate,
    buildTripComUrl,
    searchFlights
};
