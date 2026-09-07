'use strict';

const fs = require('fs');
const path = require('path');

// Auto-patch mc-seedlocator if it reverted or hasn't been patched yet
function ensurePatched() {
    try {
        const wasmJsPath = path.join(__dirname, '../node_modules/mc-seedlocator/superComplexWasm.js');
        if (fs.existsSync(wasmJsPath)) {
            let content = fs.readFileSync(wasmJsPath, 'utf8');
            if (content.includes('readFileSync("./chunky.wasm")') || content.includes("readFileSync('./chunky.wasm')")) {
                content = content.replace(
                    /const wasmbin = readFileSync\(['"]\.\/chunky\.wasm['"]\);/,
                    `import { fileURLToPath } from "url";\nimport { dirname, join } from "path";\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = dirname(__filename);\nconst wasmbin = readFileSync(join(__dirname, "chunky.wasm"));`
                );
                fs.writeFileSync(wasmJsPath, content, 'utf8');
            }
        }
    } catch (e) {
        console.error('[mcStructureFinder] Auto-patch error:', e);
    }
}

// Ensure patch is applied before importing
ensurePatched();

let CB3Libs = null;
async function getCB3Libs() {
    if (!CB3Libs) {
        ensurePatched();
        const { superComplexWasm } = await import('mc-seedlocator/superComplexWasm.js');
        CB3Libs = superComplexWasm();
    }
    return CB3Libs;
}

// ─── DEFINISI STRUKTUR ─────────────────────────────────────────────────────────
const STRUCTURE_DEFS = {
    village: {
        key: 'village',
        poi: 'village',
        emoji: '🏘️',
        label: 'Village (Desa)',
        dimension: 'overworld',
        defaultRadius: 3000,
        subtypes: {
            plains: 'Plains / Padang Rumput',
            desert: 'Desert / Gurun',
            savanna: 'Savanna',
            snowy: 'Snowy / Salju',
            taiga: 'Taiga / Hutan Pinus'
        },
        aliases: ['village', 'villages', 'desa', 'kampung', 'vilage']
    },
    stronghold: {
        key: 'stronghold',
        poi: 'stronghold',
        emoji: '🏰',
        label: 'Stronghold (Portal The End)',
        dimension: 'overworld',
        defaultRadius: 5000,
        aliases: ['stronghold', 'end', 'portalend', 'endportal', 'bentengend']
    },
    trialChamber: {
        key: 'trialChamber',
        poi: 'trialChamber',
        emoji: '🗝️',
        label: 'Trial Chamber',
        dimension: 'overworld',
        defaultRadius: 3000,
        aliases: ['trialchamber', 'trialchambers', 'trial', 'chamber', 'chambers']
    },
    ancientCity: {
        key: 'ancientCity',
        poi: 'ancientCity',
        emoji: '🌑',
        label: 'Ancient City (Kota Warden)',
        dimension: 'overworld',
        defaultRadius: 4000,
        aliases: ['ancientcity', 'ancient', 'city', 'warden', 'sculk', 'kotakuno']
    },
    woodlandMansion: {
        key: 'woodlandMansion',
        poi: 'woodlandMansion',
        emoji: '🏚️',
        label: 'Woodland Mansion',
        dimension: 'overworld',
        defaultRadius: 10000,
        aliases: ['woodlandmansion', 'mansion', 'woodland', 'rumahhantu']
    },
    oceanMonument: {
        key: 'oceanMonument',
        poi: 'oceanMonument',
        emoji: '🌊',
        label: 'Ocean Monument (Guardian)',
        dimension: 'overworld',
        defaultRadius: 3500,
        aliases: ['oceanmonument', 'monument', 'guardian', 'kuillaut', 'laut']
    },
    desertTemple: {
        key: 'desertTemple',
        poi: 'desertTemple',
        emoji: '🏛️',
        label: 'Desert Temple (Piramida)',
        dimension: 'overworld',
        defaultRadius: 4000,
        aliases: ['deserttemple', 'temple', 'candi', 'piramida', 'pyramid', 'candigurun']
    },
    witchHut: {
        key: 'witchHut',
        poi: 'witchHut',
        emoji: '🧙',
        label: 'Witch Hut (Gubuk Penyihir)',
        dimension: 'overworld',
        defaultRadius: 4000,
        aliases: ['witchhut', 'witch', 'penyihir', 'gubuk', 'rawa']
    },
    jungleTemple: {
        key: 'jungleTemple',
        poi: 'jungleTemple',
        emoji: '🌿',
        label: 'Jungle Temple (Candi Hutan)',
        dimension: 'overworld',
        defaultRadius: 5000,
        aliases: ['jungletemple', 'jungle', 'candihutan']
    },
    pillagerOutpost: {
        key: 'pillagerOutpost',
        poi: 'pillagerOutpost',
        emoji: '🏹',
        label: 'Pillager Outpost',
        dimension: 'overworld',
        defaultRadius: 3500,
        aliases: ['pillageroutpost', 'outpost', 'pillager', 'menara']
    },
    igloo: {
        key: 'igloo',
        poi: 'igloo',
        emoji: '🏔️',
        label: 'Igloo (Rumah Salju)',
        dimension: 'overworld',
        defaultRadius: 3500,
        aliases: ['igloo', 'iglo', 'rumahsalju', 'kutub']
    },
    trailRuin: {
        key: 'trailRuin',
        poi: 'trailRuin',
        emoji: '🪶',
        label: 'Trail Ruins (Reruntuhan Kuno)',
        dimension: 'overworld',
        defaultRadius: 3500,
        aliases: ['trailruin', 'trailruins', 'trail', 'ruin', 'ruins', 'sniffer']
    },
    shipwreck: {
        key: 'shipwreck',
        poi: 'shipwreck',
        emoji: '⛵',
        label: 'Shipwreck (Bangkai Kapal)',
        dimension: 'overworld',
        defaultRadius: 2500,
        aliases: ['shipwreck', 'ship', 'kapal', 'karam']
    },
    ruinedPortalOverworld: {
        key: 'ruinedPortalOverworld',
        poi: 'ruinedPortalOverworld',
        emoji: '🌀',
        label: 'Ruined Portal',
        dimension: 'overworld',
        defaultRadius: 2500,
        aliases: ['ruinedportal', 'portal', 'ruinedportaloverworld', 'portalrusak']
    },
    buriedTreasure: {
        key: 'buriedTreasure',
        poi: 'buriedTreasure',
        emoji: '💎',
        label: 'Buried Treasure (Harta Karun)',
        dimension: 'overworld',
        defaultRadius: 2000,
        aliases: ['buriedtreasure', 'treasure', 'hartakarun', 'harta']
    },
    mineshaft: {
        key: 'mineshaft',
        poi: 'mineshaft',
        emoji: '⛏️',
        label: 'Mineshaft (Tambang)',
        dimension: 'overworld',
        defaultRadius: 2000,
        aliases: ['mineshaft', 'tambang', 'shaft']
    },
    // Nether structures
    netherFortress: {
        key: 'netherFortress',
        poi: 'netherFortress',
        emoji: '🔥',
        label: 'Nether Fortress',
        dimension: 'nether',
        defaultRadius: 2500,
        aliases: ['netherfortress', 'fortress', 'bentengnether', 'blaze']
    },
    bastionRemnant: {
        key: 'bastionRemnant',
        poi: 'bastionRemnant',
        emoji: '🐷',
        label: 'Bastion Remnant',
        dimension: 'nether',
        defaultRadius: 2500,
        aliases: ['bastionremnant', 'bastion', 'piglin']
    },
    ruinedPortalNether: {
        key: 'ruinedPortalNether',
        poi: 'ruinedPortalNether',
        emoji: '🌀',
        label: 'Ruined Portal (Nether)',
        dimension: 'nether',
        defaultRadius: 2500,
        aliases: ['ruinedportalnether', 'netherportal']
    }
};

// Aliases lookup map
const ALIAS_LOOKUP = {};
for (const [key, def] of Object.entries(STRUCTURE_DEFS)) {
    ALIAS_LOOKUP[key.toLowerCase()] = def;
    ALIAS_LOOKUP[def.poi.toLowerCase()] = def;
    if (def.aliases) {
        for (const alias of def.aliases) {
            ALIAS_LOOKUP[alias.toLowerCase()] = def;
        }
    }
}

function resolveStructure(name) {
    if (!name) return null;
    const clean = name.toLowerCase().replace(/^minecraft:/, '').replace(/[-_\s]/g, '');
    return ALIAS_LOOKUP[clean] || null;
}

// Parse seed to signed 64-bit BigInt string (Java Long)
function parseSeedString(seedInput) {
    if (!seedInput && seedInput !== 0) return '0';
    const s = seedInput.toString().trim();
    if (/^-?\d+$/.test(s)) {
        return s;
    }
    // Java String.hashCode()
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (31 * hash + s.charCodeAt(i)) | 0;
    }
    return hash.toString();
}

// Direction compass calculation for Minecraft (-Z is North, +Z is South, +X is East, -X is West)
function getCompassDir(dx, dz) {
    const deg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const dirs = ['Utara ⬆️', 'Timur Laut ↗️', 'Timur ➡️', 'Tenggara ↘️', 'Selatan ⬇️', 'Barat Daya ↙️', 'Barat ⬅️', 'Barat Laut ↖️'];
    return dirs[Math.round(deg / 45) % 8];
}

// Cache of world instances to make subsequent searches instantaneous
const worldCache = new Map();

async function getPoiFinder(seedStr, edition = 'Java', javaVersionKey = 'V1_21', dimension = 'overworld') {
    const libs = await getCB3Libs();
    const cacheKey = `${seedStr}_${edition}_${javaVersionKey}_${dimension}`;
    if (worldCache.has(cacheKey)) {
        return worldCache.get(cacheKey);
    }

    const javaVer = libs.JavaVersion[javaVersionKey] || libs.JavaVersion.V1_21;
    const world = {
        edition: edition,
        javaVersion: javaVer,
        config: {},
        seed: libs.Long.fromString(seedStr),
    };

    const biomeProviders = {};
    if (dimension === 'nether') {
        biomeProviders[libs.Dimension.Nether] = new libs.BiomeProviderNether(world);
    } else if (dimension === 'end') {
        biomeProviders[libs.Dimension.End] = new libs.BiomeProviderEnd(world);
    } else {
        biomeProviders[libs.Dimension.Overworld] = libs.createBiomeProvider(world);
    }

    const sharedTasks = {};
    const finder = libs.createPoiFinder(world, biomeProviders, {
        sharedTask: (key, fn) => {
            if (!sharedTasks[key]) sharedTasks[key] = fn();
            return sharedTasks[key];
        },
    });

    const entry = { finder, libs, world, dimension };
    // Keep max 10 entries in cache
    if (worldCache.size >= 10) {
        const firstKey = worldCache.keys().next().value;
        worldCache.delete(firstKey);
    }
    worldCache.set(cacheKey, entry);
    return entry;
}

/**
 * Main search function
 */
async function searchStructures({
    seed,
    playerX,
    playerZ,
    targetStructure = null,
    radius = null,
    dimension = 'overworld',
    javaVersion = 'V1_21'
}) {
    const seedStr = parseSeedString(seed);
    const px = Math.round(Number(playerX));
    const pz = Math.round(Number(playerZ));

    const singleTarget = resolveStructure(targetStructure);
    const actualDimension = singleTarget ? singleTarget.dimension : dimension;

    // Determine structures to search
    let poisToSearch = [];
    if (singleTarget) {
        poisToSearch = [singleTarget.poi];
    } else if (actualDimension === 'nether') {
        poisToSearch = ['netherFortress', 'bastionRemnant', 'ruinedPortalNether'];
    } else {
        poisToSearch = [
            'village', 'stronghold', 'trialChamber', 'ancientCity',
            'woodlandMansion', 'oceanMonument', 'desertTemple', 'witchHut',
            'jungleTemple', 'pillagerOutpost', 'igloo', 'trailRuin',
            'shipwreck', 'ruinedPortalOverworld', 'buriedTreasure', 'mineshaft'
        ];
    }

    // Determine search radius in blocks
    let searchRadius = radius;
    if (!searchRadius || searchRadius <= 0) {
        if (singleTarget) {
            searchRadius = singleTarget.defaultRadius || 4000;
        } else {
            searchRadius = 3000;
        }
    }

    // Convert search bounds to chunks
    const centerChunkX = Math.floor(px / 16);
    const centerChunkZ = Math.floor(pz / 16);
    const chunkRadius = Math.ceil(searchRadius / 16);

    const tile = {
        x: centerChunkX - chunkRadius,
        z: centerChunkZ - chunkRadius,
        sizeX: chunkRadius * 2,
        sizeZ: chunkRadius * 2
    };

    const { finder } = await getPoiFinder(seedStr, 'Java', javaVersion, actualDimension);
    const rawResults = await finder(tile, poisToSearch);

    const foundList = [];

    for (const poi of poisToSearch) {
        const list = rawResults[poi] || [];
        const def = Object.values(STRUCTURE_DEFS).find(d => d.poi === poi);

        for (const item of list) {
            const chunkX = item[0];
            const chunkZ = item[1];
            const meta = item[2];

            let blockX = chunkX * 16 + 8;
            let blockZ = chunkZ * 16 + 8;

            // Specific structure precise coordinate adjustments
            if (poi === 'buriedTreasure') {
                blockX = chunkX * 16 + 9;
                blockZ = chunkZ * 16 + 9;
            } else if (Array.isArray(meta) && meta.length >= 3 && typeof meta[0] === 'number') {
                blockX = meta[0];
                blockZ = meta[2];
            }

            const dx = blockX - px;
            const dz = blockZ - pz;
            const dist = Math.round(Math.hypot(dx, dz));

            if (dist <= searchRadius) {
                // Parse details from metadata
                let detail = '';
                if (poi === 'village' && meta) {
                    const villageType = def.subtypes[meta.type] || meta.type || '';
                    detail = `Tipe: ${villageType}${meta.zombie ? ' (Zombie Village 🧟)' : ''}`;
                } else if (poi === 'igloo' && meta) {
                    detail = meta.hasBasement ? 'Ada Basement Bawah Tanah 🧪' : 'Tanpa Basement';
                } else if (poi === 'bastionRemnant' && meta) {
                    detail = `Tipe: ${meta.type || 'Piglin Bastion'}`;
                }

                foundList.push({
                    key: def ? def.key : poi,
                    poi: poi,
                    emoji: def ? def.emoji : '📍',
                    label: def ? def.label : poi,
                    dimension: actualDimension,
                    x: blockX,
                    z: blockZ,
                    distance: dist,
                    direction: getCompassDir(dx, dz),
                    netherX: actualDimension === 'overworld' ? Math.round(blockX / 8) : blockX,
                    netherZ: actualDimension === 'overworld' ? Math.round(blockZ / 8) : blockZ,
                    detail: detail,
                    meta: meta
                });
            }
        }
    }

    // Sort by closest distance
    foundList.sort((a, b) => a.distance - b.distance);

    return {
        seed: seedStr,
        playerX: px,
        playerZ: pz,
        dimension: actualDimension,
        radius: searchRadius,
        singleTarget: singleTarget,
        totalFound: foundList.length,
        results: foundList
    };
}

const { spawn } = require('child_process');
const sharp = require('sharp');

function rgbToPng(rawBuffer, width, height) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
            '-f', 'rawvideo',
            '-pixel_format', 'rgb24',
            '-video_size', `${width}x${height}`,
            '-i', '-',
            '-c:v', 'png',
            '-f', 'image2pipe',
            '-'
        ]);
        const chunks = [];
        ff.stdout.on('data', c => chunks.push(c));
        ff.on('close', code => {
            if (code === 0) resolve(Buffer.concat(chunks));
            else reject(new Error('ffmpeg exited with code ' + code));
        });
        ff.on('error', err => reject(err));
        ff.stdin.on('error', () => {});
        ff.stdin.write(rawBuffer);
        ff.stdin.end();
    });
}

// ─── SVG ICON DEFINITIONS (ChunkBase-style) ───────────────────────────────────
const STRUCTURE_ICONS = {
    village: {
        color: '#4CAF50', borderColor: '#2E7D32',
        symbol: '<path d="M6 20 L14 6 L22 20 Z" fill="#8D6E63" stroke="#5D4037" stroke-width="1"/><rect x="11" y="14" width="6" height="6" fill="#FFEB3B" stroke="#F57F17" stroke-width="0.5"/><polygon points="8,12 14,4 20,12" fill="#D84315" stroke="#BF360C" stroke-width="0.5"/>',
        label: 'Village'
    },
    stronghold: {
        color: '#7B1FA2', borderColor: '#4A148C',
        symbol: '<rect x="6" y="10" width="16" height="12" rx="1" fill="#9C27B0" stroke="#4A148C" stroke-width="1"/><rect x="8" y="6" width="4" height="6" fill="#9C27B0" stroke="#4A148C" stroke-width="1"/><rect x="16" y="6" width="4" height="6" fill="#9C27B0" stroke="#4A148C" stroke-width="1"/><rect x="12" y="14" width="4" height="4" fill="#E1BEE7"/>',
        label: 'Stronghold'
    },
    trialChamber: {
        color: '#FF6F00', borderColor: '#E65100',
        symbol: '<rect x="7" y="7" width="14" height="14" rx="2" fill="#FF8F00" stroke="#E65100" stroke-width="1"/><circle cx="14" cy="14" r="4" fill="none" stroke="#FFF" stroke-width="1.5"/><text x="14" y="17" font-size="8" fill="white" text-anchor="middle" font-weight="bold" font-family="Arial">?</text>',
        label: 'Trial'
    },
    ancientCity: {
        color: '#00838F', borderColor: '#006064',
        symbol: '<rect x="6" y="8" width="16" height="14" rx="1" fill="#0097A7" stroke="#006064" stroke-width="1"/><rect x="8" y="10" width="3" height="4" fill="#00BCD4"/><rect x="17" y="10" width="3" height="4" fill="#00BCD4"/><rect x="12" y="10" width="4" height="8" fill="#004D40"/><rect x="9" y="6" width="10" height="3" fill="#00838F" stroke="#006064" stroke-width="0.5"/>',
        label: 'Ancient City'
    },
    woodlandMansion: {
        color: '#5D4037', borderColor: '#3E2723',
        symbol: '<rect x="5" y="10" width="18" height="12" fill="#795548" stroke="#3E2723" stroke-width="1"/><polygon points="4,11 14,3 24,11" fill="#4E342E" stroke="#3E2723" stroke-width="0.5"/><rect x="8" y="13" width="3" height="3" fill="#FFCC80"/><rect x="17" y="13" width="3" height="3" fill="#FFCC80"/><rect x="12" y="16" width="4" height="6" fill="#4E342E"/>',
        label: 'Mansion'
    },
    oceanMonument: {
        color: '#00ACC1', borderColor: '#00838F',
        symbol: '<polygon points="14,4 24,20 4,20" fill="#00BCD4" stroke="#006064" stroke-width="1"/><polygon points="14,9 20,18 8,18" fill="#0097A7"/><circle cx="14" cy="15" r="2" fill="#B2EBF2"/>',
        label: 'Monument'
    },
    desertTemple: {
        color: '#F9A825', borderColor: '#F57F17',
        symbol: '<polygon points="14,4 24,18 4,18" fill="#FFB300" stroke="#E65100" stroke-width="1"/><polygon points="14,8 20,16 8,16" fill="#FF8F00"/><rect x="12" y="18" width="4" height="4" fill="#FFB300" stroke="#E65100" stroke-width="0.5"/><circle cx="14" cy="13" r="1.5" fill="#FFF9C4"/>',
        label: 'Desert Temple'
    },
    witchHut: {
        color: '#7B1FA2', borderColor: '#6A1B9A',
        symbol: '<polygon points="14,3 22,13 6,13" fill="#4A148C" stroke="#311B92" stroke-width="0.5"/><rect x="8" y="13" width="12" height="8" fill="#6A1B9A" stroke="#4A148C" stroke-width="0.5"/><rect x="9" y="13" width="4" height="4" rx="2" fill="#CE93D8" opacity="0.7"/><line x1="14" y1="3" x2="14" y2="1" stroke="#4A148C" stroke-width="1"/>',
        label: 'Witch Hut'
    },
    jungleTemple: {
        color: '#33691E', borderColor: '#1B5E20',
        symbol: '<rect x="7" y="8" width="14" height="14" rx="1" fill="#558B2F" stroke="#1B5E20" stroke-width="1"/><rect x="9" y="10" width="3" height="4" fill="#7CB342"/><rect x="16" y="10" width="3" height="4" fill="#7CB342"/><polygon points="6,9 14,3 22,9" fill="#33691E" stroke="#1B5E20" stroke-width="0.5"/><rect x="12" y="15" width="4" height="5" fill="#1B5E20"/>',
        label: 'Jungle Temple'
    },
    pillagerOutpost: {
        color: '#757575', borderColor: '#424242',
        symbol: '<rect x="10" y="5" width="8" height="17" fill="#9E9E9E" stroke="#424242" stroke-width="1"/><rect x="7" y="10" width="14" height="4" fill="#BDBDBD" stroke="#424242" stroke-width="0.5"/><rect x="12" y="7" width="4" height="3" fill="#616161"/><line x1="14" y1="2" x2="14" y2="5" stroke="#424242" stroke-width="1.5"/><rect x="13" y="1" width="5" height="3" fill="#B71C1C"/>',
        label: 'Outpost'
    },
    igloo: {
        color: '#E0E0E0', borderColor: '#9E9E9E',
        symbol: '<ellipse cx="14" cy="17" rx="9" ry="6" fill="#F5F5F5" stroke="#9E9E9E" stroke-width="1"/><ellipse cx="14" cy="16" rx="7" ry="5" fill="#ECEFF1"/><rect x="11" y="17" width="5" height="5" rx="1" fill="#90A4AE" stroke="#607D8B" stroke-width="0.5"/>',
        label: 'Igloo'
    },
    trailRuin: {
        color: '#A1887F', borderColor: '#795548',
        symbol: '<rect x="6" y="14" width="6" height="6" fill="#BCAAA4" stroke="#795548" stroke-width="0.5" transform="rotate(-10,9,17)"/><rect x="14" y="12" width="7" height="5" fill="#A1887F" stroke="#795548" stroke-width="0.5" transform="rotate(5,17,15)"/><rect x="10" y="16" width="5" height="4" fill="#8D6E63" stroke="#5D4037" stroke-width="0.5"/><circle cx="17" cy="10" r="2" fill="#FFB74D" stroke="#E65100" stroke-width="0.5"/>',
        label: 'Trail Ruins'
    },
    shipwreck: {
        color: '#1565C0', borderColor: '#0D47A1',
        symbol: '<path d="M4,16 Q14,8 24,16" fill="none" stroke="#795548" stroke-width="2.5"/><path d="M4,16 Q14,10 24,16" fill="#8D6E63"/><line x1="14" y1="8" x2="14" y2="15" stroke="#5D4037" stroke-width="1.5"/><polygon points="14,6 21,10 14,12" fill="#ECEFF1" stroke="#B0BEC5" stroke-width="0.5"/>',
        label: 'Shipwreck'
    },
    ruinedPortalOverworld: {
        color: '#6A1B9A', borderColor: '#4A148C',
        symbol: '<rect x="7" y="6" width="14" height="16" rx="1" fill="#7B1FA2" stroke="#4A148C" stroke-width="1"/><rect x="9" y="8" width="10" height="12" rx="1" fill="#CE93D8" opacity="0.6"/><rect x="11" y="10" width="6" height="8" fill="#E040FB" opacity="0.5"/><rect x="7" y="6" width="3" height="4" fill="#FF6F00" opacity="0.8"/><rect x="18" y="16" width="3" height="4" fill="#FF6F00" opacity="0.8"/>',
        label: 'Portal'
    },
    ruinedPortalNether: {
        color: '#6A1B9A', borderColor: '#4A148C',
        symbol: '<rect x="7" y="6" width="14" height="16" rx="1" fill="#7B1FA2" stroke="#4A148C" stroke-width="1"/><rect x="9" y="8" width="10" height="12" rx="1" fill="#CE93D8" opacity="0.6"/><rect x="11" y="10" width="6" height="8" fill="#E040FB" opacity="0.5"/><rect x="7" y="6" width="3" height="4" fill="#FF6F00" opacity="0.8"/><rect x="18" y="16" width="3" height="4" fill="#FF6F00" opacity="0.8"/>',
        label: 'Nether Portal'
    },
    buriedTreasure: {
        color: '#FFA000', borderColor: '#FF6F00',
        symbol: '<rect x="6" y="10" width="16" height="10" rx="2" fill="#FFB300" stroke="#E65100" stroke-width="1"/><rect x="6" y="10" width="16" height="4" rx="1" fill="#FFA000" stroke="#E65100" stroke-width="0.5"/><rect x="12" y="8" width="4" height="4" rx="1" fill="#FFD54F" stroke="#E65100" stroke-width="0.5"/><circle cx="14" cy="16" r="2" fill="#FFF176" stroke="#F9A825" stroke-width="0.5"/>',
        label: 'Treasure'
    },
    mineshaft: {
        color: '#616161', borderColor: '#212121',
        symbol: '<rect x="5" y="12" width="18" height="3" fill="#795548" stroke="#3E2723" stroke-width="0.5"/><rect x="8" y="8" width="3" height="12" fill="#795548" stroke="#3E2723" stroke-width="0.5"/><rect x="17" y="8" width="3" height="12" fill="#795548" stroke="#3E2723" stroke-width="0.5"/><circle cx="14" cy="13" r="2" fill="#FFC107" stroke="#FF8F00" stroke-width="0.5"/>',
        label: 'Mineshaft'
    },
    netherFortress: {
        color: '#B71C1C', borderColor: '#880E0E',
        symbol: '<rect x="5" y="10" width="18" height="12" fill="#C62828" stroke="#880E0E" stroke-width="1"/><rect x="6" y="6" width="5" height="6" fill="#D32F2F" stroke="#880E0E" stroke-width="0.5"/><rect x="17" y="6" width="5" height="6" fill="#D32F2F" stroke="#880E0E" stroke-width="0.5"/><rect x="11" y="8" width="6" height="4" fill="#B71C1C" stroke="#880E0E" stroke-width="0.5"/><rect x="12" y="16" width="4" height="6" fill="#880E0E"/>',
        label: 'Nether Fort'
    },
    bastionRemnant: {
        color: '#4E342E', borderColor: '#3E2723',
        symbol: '<rect x="6" y="8" width="16" height="14" rx="1" fill="#5D4037" stroke="#3E2723" stroke-width="1"/><rect x="8" y="10" width="4" height="5" fill="#795548"/><rect x="16" y="10" width="4" height="5" fill="#795548"/><rect x="11" y="6" width="6" height="4" fill="#4E342E" stroke="#3E2723" stroke-width="0.5"/><circle cx="14" cy="8" r="1.5" fill="#FFD54F"/><rect x="12" y="17" width="4" height="5" fill="#3E2723"/>',
        label: 'Bastion'
    }
};

function createStructureIconSvg(structureKey, size) {
    const icon = STRUCTURE_ICONS[structureKey];
    if (!icon) return null;
    const id = 'sh' + structureKey.replace(/[^a-zA-Z]/g, '').slice(0, 6);
    return '<svg width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><filter id="' + id + '" x="-20%" y="-20%" width="140%" height="140%">' +
        '<feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.5"/>' +
        '</filter></defs>' +
        '<g filter="url(#' + id + ')">' +
        '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + (size/2-1) + '" fill="' + icon.color + '" stroke="' + icon.borderColor + '" stroke-width="2" opacity="0.85"/>' +
        icon.symbol +
        '</g></svg>';
}

function createLabelSvg(text, bgColor) {
    var w = text.length * 6.5 + 12;
    var h = 18;
    return {
        svg: '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="3" fill="' + (bgColor || '#000') + '" opacity="0.75"/>' +
            '<text x="' + (w/2) + '" y="13" font-size="11" fill="white" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold">' + text + '</text>' +
            '</svg>',
        width: w,
        height: h
    };
}

/**
 * Render satellite-style biome map PNG image with ChunkBase-style structure icons
 */
async function renderBiomeMapImage({
    seed,
    playerX,
    playerZ,
    radius = 1500,
    structures = [],
    dimension = 'overworld',
    width = 600,
    height = 600,
    zoom = 0.290
}) {
    try {
        const seedStr = parseSeedString(seed);
        const { libs, world } = await getPoiFinder(seedStr, 'Java', 'V1_21', dimension);
        let bp;
        if (dimension === 'nether') {
            bp = new libs.BiomeProviderNether(world);
        } else if (dimension === 'end') {
            bp = new libs.BiomeProviderEnd(world);
        } else {
            bp = libs.createBiomeProvider(world);
        }

        // Calculate mapRadius from zoom level to match ChunkBase zoom
        const mapRadius = Math.round(width / (2 * zoom));
        const step = (mapRadius * 2) / width;
        const minX = playerX - mapRadius;
        const minZ = playerZ - mapRadius;

        // ── RENDER BIOME BACKGROUND ──
        const raw = Buffer.alloc(width * height * 3);
        const colorCache = new Map();

        function getBiomeColor(id) {
            if (colorCache.has(id)) return colorCache.get(id);
            const b = libs.getBiomeById(id);
            const rgb = b && b.rgb ? b.rgb : [60, 100, 60];
            colorCache.set(id, rgb);
            return rgb;
        }

        for (let y = 0; y < height; y++) {
            const bz = minZ + y * step;
            const nz = Math.floor(bz / 4);
            const rowOffset = y * width * 3;
            for (let x = 0; x < width; x++) {
                const bx = minX + x * step;
                const nx = Math.floor(bx / 4);
                const biomeId = bp.getNoiseBiome(nx, 16, nz);
                const [r, g, b] = getBiomeColor(biomeId);
                const idx = rowOffset + x * 3;
                raw[idx] = r;
                raw[idx + 1] = g;
                raw[idx + 2] = b;
            }
        }

        // Convert biome raw RGB to PNG via ffmpeg
        const biomePng = await rgbToPng(raw, width, height);

        // ── BUILD COMPOSITE LAYERS ──
        const composites = [];

        // Helper: safely add a composite, skipping if it would exceed canvas bounds
        function safeAdd(svgStr, left, top) {
            // Parse SVG dimensions
            const wMatch = svgStr.match(/width="(\d+)"/);
            const hMatch = svgStr.match(/height="(\d+)"/);
            if (!wMatch || !hMatch) return;
            const sw = parseInt(wMatch[1]);
            const sh = parseInt(hMatch[1]);
            // Clamp position so the element stays within canvas
            let cl = Math.max(0, Math.min(left, width - sw));
            let ct = Math.max(0, Math.min(top, height - sh));
            // Skip if element is bigger than canvas
            if (sw > width || sh > height) return;
            composites.push({ input: Buffer.from(svgStr), left: cl, top: ct });
        }

        // ── COORDINATE GRID OVERLAY (every 256 blocks) ──
        const gridSpacing = 256;
        const gridParts = [];
        const startGX = Math.ceil(minX / gridSpacing) * gridSpacing;
        for (let gx = startGX; gx < minX + mapRadius * 2; gx += gridSpacing) {
            const px = Math.round((gx - minX) / step);
            if (px >= 0 && px < width) {
                gridParts.push('<line x1="' + px + '" y1="0" x2="' + px + '" y2="' + height + '" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>');
            }
        }
        const startGZ = Math.ceil(minZ / gridSpacing) * gridSpacing;
        for (let gz = startGZ; gz < minZ + mapRadius * 2; gz += gridSpacing) {
            const py = Math.round((gz - minZ) / step);
            if (py >= 0 && py < height) {
                gridParts.push('<line x1="0" y1="' + py + '" x2="' + width + '" y2="' + py + '" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>');
            }
        }
        if (gridParts.length > 0) {
            composites.push({
                input: Buffer.from('<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg">' + gridParts.join('') + '</svg>'),
                left: 0, top: 0
            });
        }

        // ── PLAYER CROSSHAIR MARKER ──
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);
        const chSize = 18;
        const chW = chSize * 2 + 4;
        const chC = chSize + 2;
        const chR = chSize - 2;
        const chSvg = '<svg width="' + chW + '" height="' + chW + '" xmlns="http://www.w3.org/2000/svg">' +
            '<defs><filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#FF0000" flood-opacity="0.8"/></filter></defs>' +
            '<g filter="url(#glow)">' +
            '<circle cx="' + chC + '" cy="' + chC + '" r="' + chR + '" fill="none" stroke="white" stroke-width="2.5" opacity="0.9"/>' +
            '<circle cx="' + chC + '" cy="' + chC + '" r="' + chR + '" fill="none" stroke="#FF1744" stroke-width="1.5"/>' +
            '<line x1="2" y1="' + chC + '" x2="' + (chW-2) + '" y2="' + chC + '" stroke="white" stroke-width="2.5" opacity="0.9"/>' +
            '<line x1="2" y1="' + chC + '" x2="' + (chW-2) + '" y2="' + chC + '" stroke="#FF1744" stroke-width="1.5"/>' +
            '<line x1="' + chC + '" y1="2" x2="' + chC + '" y2="' + (chW-2) + '" stroke="white" stroke-width="2.5" opacity="0.9"/>' +
            '<line x1="' + chC + '" y1="2" x2="' + chC + '" y2="' + (chW-2) + '" stroke="#FF1744" stroke-width="1.5"/>' +
            '<circle cx="' + chC + '" cy="' + chC + '" r="3" fill="#FF1744" stroke="white" stroke-width="1.5"/>' +
            '</g></svg>';
        safeAdd(chSvg, cx - chSize - 2, cy - chSize - 2);

        // Player label
        const pLabel = createLabelSvg('YOU (' + playerX + ', ' + playerZ + ')', '#D32F2F');
        safeAdd(pLabel.svg, cx - Math.floor(pLabel.width / 2), cy + chSize + 6);

        // ── STRUCTURE ICONS ──
        const iconSize = 32;
        const placed = [];

        for (const s of structures) {
            const sx = Math.round((s.x - minX) / step);
            const sz = Math.round((s.z - minZ) / step);

            if (sx < -iconSize || sx >= width + iconSize || sz < -iconSize || sz >= height + iconSize) continue;

            const tooClose = placed.some(function(p) {
                return Math.abs(p.x - sx) < iconSize * 0.7 && Math.abs(p.z - sz) < iconSize * 0.7;
            });
            if (tooClose) continue;
            placed.push({ x: sx, z: sz });

            const iconLeft = sx - Math.floor(iconSize / 2);
            const iconTop = sz - Math.floor(iconSize / 2);

            const iconSvg = createStructureIconSvg(s.key, iconSize);
            if (iconSvg) {
                safeAdd(iconSvg, iconLeft, iconTop);
            }

            // Coordinate label
            const shortName = (STRUCTURE_ICONS[s.key] || {}).label || s.label.split(' ')[0];
            const coordLabel = createLabelSvg(shortName + ' (' + s.x + ', ' + s.z + ')', (STRUCTURE_ICONS[s.key] || {}).borderColor || '#333');
            safeAdd(coordLabel.svg, sx - Math.floor(coordLabel.width / 2), iconTop + iconSize + 2);
        }

        // ── LEGEND PANEL ──
        const uniqueTypes = [];
        const seenKeys = new Set();
        for (const s of structures) {
            if (!seenKeys.has(s.key) && STRUCTURE_ICONS[s.key]) {
                seenKeys.add(s.key);
                uniqueTypes.push(s.key);
            }
            if (uniqueTypes.length >= 10) break;
        }

        if (uniqueTypes.length > 0) {
            const lItemH = 20;
            const lPad = 8;
            const lH = uniqueTypes.length * lItemH + lPad * 2 + 20;
            const lW = 160;
            let lSvg = '<svg width="' + lW + '" height="' + lH + '" xmlns="http://www.w3.org/2000/svg">';
            lSvg += '<rect x="0" y="0" width="' + lW + '" height="' + lH + '" rx="6" fill="rgba(0,0,0,0.75)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>';
            lSvg += '<text x="' + (lW/2) + '" y="16" font-size="11" fill="#FFD54F" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold">STRUKTUR</text>';
            uniqueTypes.forEach(function(key, idx) {
                const ic = STRUCTURE_ICONS[key];
                const yy = lPad + 22 + idx * lItemH;
                lSvg += '<circle cx="16" cy="' + (yy+6) + '" r="6" fill="' + ic.color + '" stroke="' + ic.borderColor + '" stroke-width="1"/>';
                lSvg += '<text x="28" y="' + (yy+10) + '" font-size="10" fill="white" font-family="Arial,sans-serif">' + ic.label + '</text>';
            });
            lSvg += '</svg>';
            safeAdd(lSvg, width - lW - 8, 8);
        }

        // ── TITLE BAR ──
        const dimLabel = dimension === 'nether' ? 'NETHER' : dimension === 'end' ? 'THE END' : 'OVERWORLD';
        const titleText = dimLabel + '  |  Seed: ' + seedStr.substring(0, 12) + (seedStr.length > 12 ? '...' : '') + '  |  Zoom: ' + zoom;
        const tW = Math.min(width - 16, titleText.length * 7 + 24);
        const tSvg = '<svg width="' + tW + '" height="24" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="0" y="0" width="' + tW + '" height="24" rx="4" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>' +
            '<text x="' + (tW/2) + '" y="16" font-size="11" fill="#E0E0E0" text-anchor="middle" font-family="Arial,sans-serif">' + titleText + '</text>' +
            '</svg>';
        safeAdd(tSvg, 8, 8);

        // ── COMPOSE FINAL IMAGE ──
        const result = await sharp(biomePng)
            .composite(composites)
            .png({ quality: 90 })
            .toBuffer();

        return result;

    } catch (e) {
        console.error('[mcStructureFinder] Biome map generation error:', e);
        return null;
    }
}

module.exports = {
    STRUCTURE_DEFS,
    resolveStructure,
    searchStructures,
    renderBiomeMapImage,
    parseSeedString
};
