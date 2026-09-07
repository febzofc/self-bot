/**
 * Plugin: search_mcstructure.js
 * Pencari Struktur Minecraft Akurat Menggunakan ChunkBase WASM Engine
 * 
 * Mendukung:
 * - Kalkulasi 100% akurat sesuai world generation Minecraft Java (1.20 / 1.21)
 * - Support Village, Stronghold, Trial Chamber, Ancient City, Woodland Mansion,
 *   Ocean Monument, Desert Temple, Witch Hut, Jungle Temple, Pillager Outpost,
 *   Igloo, Trail Ruins, Shipwreck, Ruined Portal, Buried Treasure, Mineshaft,
 *   Nether Fortress, Bastion Remnant
 * - Deteksi otomatis lokasi player in-game via ServerTap API
 * - Koordinat portal Nether highway (X/8, Z/8) untuk navigasi cepat
 * - Peta radar visual ASCII
 */

'use strict';

const axios = require('axios');
function getStructureFinder() {
    try {
        delete require.cache[require.resolve('../lib/mcStructureFinder')];
    } catch (e) {}
    return require('../lib/mcStructureFinder');
}

// ─── KONFIGURASI DEFAULT SERVER ───────────────────────────────────────────────
const DEFAULT_SEED      = '-8181839858821880456';
const DEFAULT_PLATFORM  = 'java_26_2';
const SERVERTAP_URL     = process.env.SERVERTAP_URL || 'http://82.41.42.190:8122/v1';
const SERVERTAP_KEY     = process.env.SERVERTAP_KEY || 'my-server-gwh';

/**
 * Cek koordinat player online dari ServerTap API
 */
async function fetchOnlinePlayer(targetName) {
    if (!targetName) return null;
    try {
        const res = await axios.get(`${SERVERTAP_URL}/players`, {
            headers: { 'Key': SERVERTAP_KEY },
            timeout: 3500
        });
        const players = res.data || [];
        const cleanTarget = targetName.toLowerCase().replace(/^\./, '').trim();

        return players.find(p => {
            const dName = (p.displayName || p.name || '').toLowerCase().replace(/^\./, '').trim();
            return dName === cleanTarget || dName.includes(cleanTarget);
        });
    } catch (e) {
        return null;
    }
}

/**
 * Helper format angka ribuan
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

module.exports = {
    CmD: ['mcfind', 'mcstructure'],
    aliases: ['mcfind', 'mcstruktur', 'mcstructure', 'findstructure', 'struktur', 'mcmap'],
    categori: 'minecraft',
    filename: 'search_mcstructure.js',

    async exec(m, { bob, args, prefix, text }) {
        const {
            STRUCTURE_DEFS,
            resolveStructure,
            searchStructures,
            renderBiomeMapImage
        } = getStructureFinder();
        // ── 1. MENU BANTUAN / HELP ──
        if (args.length === 0 || args[0].toLowerCase() === 'help' || args[0].toLowerCase() === 'bantuan') {
            let help = `🗺️ *MINECRAFT STRUCTURE FINDER (CHUNKBASE ENGINE)* 🗺️\n`;
            help += `${'─'.repeat(36)}\n`;
            help += `Temukan struktur Minecraft terdekat dengan titik koordinat *100% AKURAT* sesuai world generation in-game!\n\n`;
            help += `🎮 *Versi:* Minecraft Java *26.2* (java_26_2)\n`;
            help += `🌱 *Seed Server:* \`${DEFAULT_SEED}\`\n\n`;

            help += `📋 *Format Perintah:*\n`;
            help += `1️⃣ *Cari Semua Struktur Terdekat:*\n`;
            help += `   • \`${prefix}mcfind <X> <Z>\`\n`;
            help += `   • \`${prefix}mcfind <X> <Z> [seed]\`\n`;
            help += `   • \`${prefix}mcfind <NamaPlayer>\` *(Auto-deteksi koordinat player)*\n\n`;

            help += `2️⃣ *Cari Struktur Spesifik:*\n`;
            help += `   • \`${prefix}mcfind <struktur> <X> <Z>\`\n`;
            help += `   • \`${prefix}mcfind <struktur> <NamaPlayer>\`\n\n`;

            help += `📌 *Contoh Penggunaan:*\n`;
            help += `• \`${prefix}mcfind -100 200\`\n`;
            help += `• \`${prefix}mcfind village -1056 550\`\n`;
            help += `• \`${prefix}mcfind mansion -1056 550\`\n`;
            help += `• \`${prefix}mcfind trial 0 0\`\n`;
            help += `• \`${prefix}mcfind .the_god_pero\`\n`;
            help += `• \`${prefix}mcfind village .itsMeRyoku\`\n\n`;

            help += `🏗️ *Daftar Struktur yang Didukung:*\n`;
            const overworldList = Object.values(STRUCTURE_DEFS).filter(s => s.dimension === 'overworld');
            const netherList = Object.values(STRUCTURE_DEFS).filter(s => s.dimension === 'nether');

            help += `*Overworld:*\n`;
            overworldList.forEach(s => {
                help += `• ${s.emoji} *${s.label}* (\`${s.key}\`)\n`;
            });

            help += `\n*Nether:*\n`;
            netherList.forEach(s => {
                help += `• ${s.emoji} *${s.label}* (\`${s.key}\`)\n`;
            });

            return m.reply(help);
        }

        // ── 2. PARSING ARGUMEN FLEKSIBEL ──
        // Bisa berupa:
        // - [X, Z]
        // - [X, Z, seed]
        // - [structure, X, Z]
        // - [X, Z, structure]
        // - [structure, X, Z, seed]
        // - [playerName]
        // - [structure, playerName]
        // - [playerName, structure]

        let detectedStructure = null;
        let detectedPlayer = null;
        let playerX = null;
        let playerZ = null;
        let seed = DEFAULT_SEED;
        let dimension = 'overworld';
        let playerName = null;

        // Ambil semua token argumen
        const tokens = [...args];

        // Cek apakah ada token yang merupakan nama struktur
        for (let i = 0; i < tokens.length; i++) {
            const resolved = resolveStructure(tokens[i]);
            if (resolved) {
                detectedStructure = resolved;
                tokens.splice(i, 1);
                break;
            }
        }

        // Cari angka koordinat dari sisa token
        // Regex menangani angka negatif seperti -1056
        const remainingStr = tokens.join(' ').trim();
        const numberMatches = remainingStr.match(/-?\d+/g) || [];

        if (numberMatches.length >= 2) {
            playerX = parseInt(numberMatches[0], 10);
            playerZ = parseInt(numberMatches[1], 10);
            if (numberMatches[2]) {
                seed = numberMatches[2];
            }
        } else if (tokens.length >= 1) {
            // Kemungkinan nama player online di server!
            const candidatePlayer = tokens[0].trim();
            const onlinePlayer = await fetchOnlinePlayer(candidatePlayer);

            if (onlinePlayer && onlinePlayer.location) {
                detectedPlayer = onlinePlayer;
                playerName = onlinePlayer.displayName || onlinePlayer.name;
                playerX = Math.round(onlinePlayer.location[0]);
                playerZ = Math.round(onlinePlayer.location[2]);
                dimension = (onlinePlayer.dimension === 'NETHER') ? 'nether' : 'overworld';
            }
        }

        // Jika koordinat masih belum didapat
        if (playerX === null || playerZ === null || isNaN(playerX) || isNaN(playerZ)) {
            return m.reply(
                `❌ *Koordinat atau Nama Player tidak valid!*\n\n` +
                `Silakan masukkan koordinat X dan Z, atau nama player yang sedang online.\n\n` +
                `*Contoh:* \`${prefix}mcfind -100 200\`\n` +
                `*Contoh:* \`${prefix}mcfind village -1056 550\`\n` +
                `*Contoh:* \`${prefix}mcfind .the_god_pero\`\n` +
                `*Bantuan:* \`${prefix}mcfind help\``
            );
        }

        // ── 3. LOADING NOTIFICATION ──
        let loadingMsg = `🔍 *Menghitung posisi struktur via ChunkBase Engine...*\n`;
        if (playerName) {
            loadingMsg += `👤 *Player:* \`${playerName}\` (${dimension.toUpperCase()})\n`;
        }
        loadingMsg += `📍 *Posisi:* X:\`${playerX}\` Z:\`${playerZ}\`\n`;
        if (detectedStructure) {
            loadingMsg += `🎯 *Target:* ${detectedStructure.emoji} ${detectedStructure.label}\n`;
        }
        loadingMsg += `🌱 *Seed:* \`${seed}\`\n⏳ _Mohon tunggu sebentar..._`;
        await m.reply(loadingMsg);

        try {
            // ── 4. EKSEKUSI PENCARIAN CHUNKBASE WASM ──
            const searchResult = await searchStructures({
                seed: seed,
                playerX: playerX,
                playerZ: playerZ,
                targetStructure: detectedStructure ? detectedStructure.key : null,
                dimension: detectedStructure ? detectedStructure.dimension : dimension
            });

            const { results, radius, totalFound } = searchResult;

            if (totalFound === 0) {
                let noResult = `❌ *Tidak ada struktur ditemukan dalam radius ${formatNumber(radius)} blok.*\n\n`;
                noResult += `💡 *Saran:* Struktur mungkin berada lebih jauh dari posisi saat ini.\n`;
                noResult += `🔗 *Cek di ChunkBase:*\nhttps://www.chunkbase.com/apps/seed-map#seed=${encodeURIComponent(seed)}&platform=${DEFAULT_PLATFORM}&dimension=${dimension}&x=${playerX}&z=${playerZ}&zoom=0.291`;
                return m.reply(noResult);
            }

            // ── 5. FORMAT PESAN HASIL ──
            let txt = `🗺️ *MINECRAFT STRUCTURE FINDER*\n`;
            txt += `${'═'.repeat(35)}\n`;
            if (playerName) {
                txt += `👤 *Player Online:* \`${playerName}\`\n`;
            }
            txt += `📍 *Posisi Kamu:* X:\`${playerX}\` Z:\`${playerZ}\`\n`;
            txt += `🌱 *Seed:* \`${seed}\`\n`;
            txt += `🎮 *Versi:* Minecraft Java *26.2* (${searchResult.dimension.toUpperCase()})\n`;
            txt += `🔭 *Radius Pencarian:* ${formatNumber(radius)} blok\n`;
            txt += `${'═'.repeat(35)}\n\n`;

            if (detectedStructure) {
                // ── TAMPILAN PENCARIAN STRUKTUR SPESIFIK ──
                const topResults = results.slice(0, 5);
                txt += `📌 *Ditemukan ${totalFound} ${detectedStructure.label} Terdekat:*\n\n`;

                topResults.forEach((s, idx) => {
                    txt += `${s.emoji} *#${idx + 1} ${s.label}*\n`;
                    txt += `   📍 *Koordinat:* X:\`${s.x}\` Z:\`${s.z}\`\n`;
                    txt += `   📏 *Jarak:* ~*${formatNumber(s.distance)}* blok | 🧭 *${s.direction}*\n`;
                    if (s.dimension === 'overworld') {
                        txt += `   🚇 *Nether Portal:* X:\`${s.netherX}\` Z:\`${s.netherZ}\`\n`;
                    }
                    if (s.detail) {
                        txt += `   ℹ️ *Detail:* ${s.detail}\n`;
                    }
                    txt += `\n`;
                });
            } else {
                // ── TAMPILAN PENCARIAN SEMUA STRUKTUR ──
                // Ambil struktur terdekat untuk setiap tipe
                const groupedByType = {};
                results.forEach(s => {
                    if (!groupedByType[s.key]) {
                        groupedByType[s.key] = [];
                    }
                    groupedByType[s.key].push(s);
                });

                // Urutkan tipe berdasarkan jarak yang paling dekat dengan player
                const sortedKeys = Object.keys(groupedByType).sort((a, b) => {
                    return groupedByType[a][0].distance - groupedByType[b][0].distance;
                });

                txt += `📌 *Struktur Terdekat dari Posisi Kamu:*\n\n`;

                sortedKeys.forEach(key => {
                    const items = groupedByType[key];
                    const closest = items[0];

                    txt += `${closest.emoji} *${closest.label}*`;
                    if (items.length > 1) {
                        txt += ` _(${items.length} di area)_`;
                    }
                    txt += `\n`;
                    txt += `   📍 X:\`${closest.x}\` Z:\`${closest.z}\`\n`;
                    txt += `   📏 ~*${formatNumber(closest.distance)}* blok | 🧭 *${closest.direction}*\n`;
                    if (closest.dimension === 'overworld') {
                        txt += `   🚇 *Nether:* X:\`${closest.netherX}\` Z:\`${closest.netherZ}\`\n`;
                    }
                    if (closest.detail) {
                        txt += `   ℹ️ *${closest.detail}*\n`;
                    }
                    txt += `\n`;
                });
            }

            txt += `${'─'.repeat(35)}\n`;
            txt += `💡 *Tips In-Game:*\n`;
            txt += `• Tekan \`F3\` untuk cek koordinat in-game.\n`;
            txt += `• Gunakan koordinat *Nether* untuk bepergian 8x lebih cepat!\n`;

            // ── 6. RENDER GAMBAR PETA BIOMA & KIRIM PESAN ──
            // Hasilkan foto visual bioma satelit dengan tanda struktur & player
            let biomeImage = null;
            try {
                biomeImage = await renderBiomeMapImage({
                    seed: seed,
                    playerX: playerX,
                    playerZ: playerZ,
                    radius: radius,
                    structures: results.slice(0, 30),
                    dimension: searchResult.dimension,
                    zoom: 0.290
                });
            } catch (imgErr) {
                console.error('[mcstructure] Gagal render gambar bioma:', imgErr);
                biomeImage = null;
            }

            if (biomeImage && bob && typeof bob.sendMessage === 'function') {
                await bob.sendMessage(m.chat, {
                    image: biomeImage,
                    caption: txt
                }, { quoted: m });
            } else {
                await m.reply(txt);
            }

            // ── 7. KIRIM TOMBOL INTERAKTIF CHUNKBASE WEBVIEW ──
            const chunkbaseUrl = `https://www.chunkbase.com/apps/seed-map#seed=${encodeURIComponent(seed)}&platform=${DEFAULT_PLATFORM}&dimension=${searchResult.dimension}&x=${playerX}&z=${playerZ}&zoom=0.291`;

            try {
                const buttons = [
                    {
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🗺️ Buka ChunkBase Map (WebView)",
                            url: chunkbaseUrl,
                            webview_interaction: true,
                        }),
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🌐 Buka di Browser External",
                            url: chunkbaseUrl,
                        }),
                    },
                ];

                const interactiveMsg = {
                    interactiveMessage: {
                        header: {
                            title: `🗺️ ChunkBase Seed Map`,
                        },
                        body: {
                            text: `Buka peta interaktif ChunkBase untuk melihat semua struktur di seed *${seed}* secara visual.\n\n📍 Posisi: X:${playerX} Z:${playerZ}\n🌱 Seed: ${seed}\n🎮 ${searchResult.dimension.toUpperCase()}`,
                        },
                        nativeFlowMessage: {
                            buttons: buttons,
                            messageParamsJson: "{}",
                        },
                    },
                };

                const relayOpts = {
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

                let generateWAMessageFromContent;
                try {
                    const baileys = await import('@whiskeysockets/baileys');
                    generateWAMessageFromContent = baileys.generateWAMessageFromContent;
                } catch (e) {}

                if (generateWAMessageFromContent) {
                    const waMsg = generateWAMessageFromContent(m.chat, interactiveMsg, {});
                    await bob.relayMessage(m.chat, waMsg.message, { ...relayOpts, messageId: waMsg.key.id });
                } else {
                    await bob.relayMessage(m.chat, interactiveMsg, relayOpts);
                }
            } catch (relayErr) {
                console.error('[mcstructure] ChunkBase button relay error:', relayErr);
                // Fallback: kirim link biasa jika button gagal
                await m.reply(`🔗 *ChunkBase Map:*\n${chunkbaseUrl}`);
            }

        } catch (err) {
            console.error('[mcstructure] Error:', err);
            return m.reply(
                `⚠️ *Terjadi kesalahan saat menghitung struktur!*\n\n` +
                `_Error: ${err.message}_\n\n` +
                `💡 Cek manual di ChunkBase:\nhttps://www.chunkbase.com/apps/seed-map#seed=${encodeURIComponent(seed)}&platform=${DEFAULT_PLATFORM}&dimension=${dimension}&x=${playerX}&z=${playerZ}&zoom=0.291`
            );
        }
    }
};
