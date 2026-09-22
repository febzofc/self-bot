const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Plugin Cek Ukuran Keseluruhan Folder Bot WhatsApp
 * 
 * Penggunaan:
 * - .foldersize (Melihat ringkasan seluruh folder di bot dari yang terbesar)
 * - .foldersize <nama_folder> (Melihat rincian isi subfolder/file tertentu, misal: .foldersize session)
 * - Alias: .dirsize, .ceksize, .sizefolder, .botsize, .du
 */

// Helper format bytes ke B, KB, MB, GB, TB
function formatBytes(bytes) {
    if (bytes === 0 || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper visual progress bar
function makeProgressBar(percent, length = 10) {
    const cleanPercent = Math.min(Math.max(percent || 0, 0), 100);
    const filled = Math.round((cleanPercent / 100) * length);
    const empty = length - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + `] ${cleanPercent.toFixed(1)}%`;
}

// Helper hitung ukuran item (file atau folder) dengan du -sb dan fallback fs
function getItemSize(itemPath, isDirectory) {
    if (!isDirectory) {
        try {
            return fs.statSync(itemPath).size;
        } catch (_) {
            return 0;
        }
    }

    try {
        const out = execSync(`du -sb "${itemPath}" 2>/dev/null`, { encoding: 'utf8' }).trim();
        if (out) {
            const size = parseInt(out.split(/\s+/)[0], 10);
            if (!isNaN(size)) return size;
        }
    } catch (_) {}

    // Fallback: hitung rekursif menggunakan Node.js fs
    let totalSize = 0;
    try {
        const entries = fs.readdirSync(itemPath, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(itemPath, entry.name);
            if (entry.isDirectory()) {
                totalSize += getItemSize(full, true);
            } else {
                try {
                    totalSize += fs.statSync(full).size;
                } catch (_) {}
            }
        }
    } catch (_) {}

    return totalSize;
}

// Helper hitung jumlah file dan direktori dalam suatu folder
function countDirItems(dirPath) {
    let filesCount = 0;
    let dirsCount = 0;

    try {
        const out = execSync(`find "${dirPath}" -mindepth 1 \\( -type f -printf "f\\n" -o -type d -printf "d\\n" \\) 2>/dev/null`, { encoding: 'utf8' });
        if (out) {
            const lines = out.split('\n');
            for (const line of lines) {
                if (line === 'f') filesCount++;
                else if (line === 'd') dirsCount++;
            }
            return { filesCount, dirsCount };
        }
    } catch (_) {}

    // Fallback rekursif fs jika find gagal
    function walk(p) {
        try {
            const list = fs.readdirSync(p, { withFileTypes: true });
            for (const item of list) {
                if (item.isDirectory()) {
                    dirsCount++;
                    walk(path.join(p, item.name));
                } else {
                    filesCount++;
                }
            }
        } catch (_) {}
    }

    walk(dirPath);
    return { filesCount, dirsCount };
}

// Helper cek info disk server
function getDiskInfo(botRoot) {
    try {
        const dfOut = execSync(`df -B1 "${botRoot}" 2>/dev/null`, { encoding: 'utf8' }).trim();
        const lines = dfOut.split('\n');
        if (lines.length >= 2) {
            const parts = lines[1].trim().split(/\s+/);
            const total = parseInt(parts[1], 10) || 0;
            const used = parseInt(parts[2], 10) || 0;
            const free = parseInt(parts[3], 10) || 0;
            const percent = parts[4] ? parseFloat(parts[4].replace('%', '')) : 0;
            return { total, used, free, percent };
        }
    } catch (_) {}
    return null;
}

module.exports = {
    CmD: ['foldersize'],
    aliases: ['foldersize', 'dirsize', 'ceksize', 'sizefolder', 'botsize', 'du'],
    categori: 'system',
    exec: async (m, { bob, args, text, prefix, command }) => {
        const botRoot = process.cwd();
        const start = Date.now();

        try {
            const subTarget = (text || '').trim();

            // ==========================================
            // MODE 1: DETAIL SUBFOLDER / FILE TERTENTU
            // ==========================================
            if (subTarget && subTarget.toLowerCase() !== 'all') {
                const cleanSub = subTarget.replace(/^[./\\]+/, '');
                const targetPath = path.resolve(botRoot, cleanSub);

                // Keamanan: cegah directory traversal ke luar botRoot
                if (!targetPath.startsWith(botRoot)) {
                    return m.reply('❌ *Akses Ditolak!*\nFolder atau berkas yang diperiksa harus berada di dalam direktori bot.');
                }

                if (!fs.existsSync(targetPath)) {
                    return m.reply(`❌ *Folder/Berkas Tidak Ditemukan!*\nJalur \`${cleanSub}\` tidak ditemukan di dalam direktori bot.`);
                }

                const stat = fs.statSync(targetPath);

                // JIKA TARGET ADALAH SEBUAH FILE
                if (!stat.isDirectory()) {
                    const fileSize = formatBytes(stat.size);
                    const modified = stat.mtime.toLocaleString('id-ID');
                    let capFile = `📄 *RINCIAN UKURAN BERKAS*\n\n`;
                    capFile += `🏷️ *Nama File:* \`${path.basename(targetPath)}\`\n`;
                    capFile += `📍 *Relatif Path:* \`./${path.relative(botRoot, targetPath)}\`\n`;
                    capFile += `📦 *Ukuran:* *${fileSize}* (${stat.size.toLocaleString('id-ID')} bytes)\n`;
                    capFile += `🕒 *Terakhir Diubah:* ${modified}\n`;
                    return m.reply(capFile);
                }

                // JIKA TARGET ADALAH FOLDER
                await m.reply(`⏳ *Menganalisis ukuran isi folder \`${cleanSub}\`...*`);

                const folderTotalSize = getItemSize(targetPath, true);
                const { filesCount, dirsCount } = countDirItems(targetPath);

                // Baca entri langsung dalam folder ini
                const entries = fs.readdirSync(targetPath, { withFileTypes: true });
                const itemsList = [];

                for (const entry of entries) {
                    const itemFullPath = path.join(targetPath, entry.name);
                    const isDir = entry.isDirectory();
                    const itemSize = getItemSize(itemFullPath, isDir);
                    const percent = folderTotalSize > 0 ? (itemSize / folderTotalSize) * 100 : 0;

                    itemsList.push({
                        name: entry.name,
                        isDir,
                        size: itemSize,
                        percent
                    });
                }

                // Urutkan item dari yang paling memakan tempat
                itemsList.sort((a, b) => b.size - a.size);

                const limit = 15;
                const topItems = itemsList.slice(0, limit);
                const latency = Date.now() - start;

                let cap = `📂 *RINCIAN UKURAN FOLDER: \`${cleanSub}/\`*\n\n`;
                cap += `📍 *Lokasi:* \`./${path.relative(botRoot, targetPath) || '.'}\`\n`;
                cap += `📦 *Total Ukuran Folder:* *${formatBytes(folderTotalSize)}*\n`;
                cap += `📊 *Rincian Item:* ${filesCount.toLocaleString('id-ID')} file | ${dirsCount.toLocaleString('id-ID')} subfolder\n`;
                cap += `⚡ *Waktu Analisis:* ${latency} ms\n\n`;

                cap += `───〔 📋 *ITEM TERBESAR DALAM FOLDER* 〕───\n`;

                if (itemsList.length === 0) {
                    cap += `_(Folder ini kosong)_\n`;
                } else {
                    topItems.forEach((item, idx) => {
                        const icon = item.isDir ? '📁' : '📄';
                        const typeLabel = item.isDir ? '/' : '';
                        cap += `${idx + 1}. ${icon} *\`${item.name}${typeLabel}\`*\n`;
                        cap += `   └ Ukuran: *${formatBytes(item.size)}* (${item.percent.toFixed(1)}%)\n`;
                    });

                    if (itemsList.length > limit) {
                        cap += `\n_...dan ${itemsList.length - limit} item lainnya tidak ditampilkan._\n`;
                    }
                }

                cap += `\n💡 *Tips:* Ketik \`${prefix}${command}\` untuk melihat ringkasan ukuran seluruh folder bot.`;

                return m.reply(cap);
            }

            // ==========================================
            // MODE 2: RINGKASAN SELURUH FOLDER BOT
            // ==========================================
            await m.reply('⏳ *Sedang menghitung ukuran seluruh folder bot...*');

            // 1. Dapatkan pemetaan ukuran per item di root dengan du
            const duMap = new Map();
            try {
                const duOut = execSync(`du -sb "${botRoot}"/* "${botRoot}"/.[!.]* 2>/dev/null`, { encoding: 'utf8' }).trim();
                if (duOut) {
                    const lines = duOut.split('\n');
                    for (const line of lines) {
                        const parts = line.split(/\t+/);
                        if (parts.length >= 2) {
                            const size = parseInt(parts[0], 10) || 0;
                            const full = parts.slice(1).join('\t').trim();
                            const bName = path.basename(full);
                            duMap.set(bName, size);
                        }
                    }
                }
            } catch (_) {}

            // 2. Baca seluruh isi botRoot
            const rootEntries = fs.readdirSync(botRoot, { withFileTypes: true });
            const folders = [];
            let rootFilesSize = 0;
            let rootFilesCount = 0;
            const rootFilesList = [];

            let totalWorkspaceSize = 0;

            for (const entry of rootEntries) {
                const fullPath = path.join(botRoot, entry.name);
                let itemSize = duMap.has(entry.name) ? duMap.get(entry.name) : getItemSize(fullPath, entry.isDirectory());

                if (entry.isDirectory()) {
                    folders.push({
                        name: entry.name,
                        path: fullPath,
                        size: itemSize
                    });
                } else {
                    rootFilesSize += itemSize;
                    rootFilesCount++;
                    rootFilesList.push({
                        name: entry.name,
                        size: itemSize
                    });
                }
                totalWorkspaceSize += itemSize;
            }

            // Urutkan folder dari yang paling besar
            folders.sort((a, b) => b.size - a.size);
            rootFilesList.sort((a, b) => b.size - a.size);

            // Dapatkan rincian item (file & subfolder) untuk tiap folder
            const folderDetails = folders.map(f => {
                const { filesCount, dirsCount } = countDirItems(f.path);
                const percent = totalWorkspaceSize > 0 ? (f.size / totalWorkspaceSize) * 100 : 0;
                return {
                    ...f,
                    filesCount,
                    dirsCount,
                    percent
                };
            });

            // Hitung total file dan total folder di seluruh bot
            let grandTotalFiles = rootFilesCount;
            let grandTotalDirs = folders.length;
            for (const f of folderDetails) {
                grandTotalFiles += f.filesCount;
                grandTotalDirs += f.dirsCount;
            }

            // Sisa disk storage di VPS
            const diskInfo = getDiskInfo(botRoot);
            const latency = Date.now() - start;

            // 3. Susun Teks Output Rapi, Bersih, dan Profesional
            let output = `📊 *STATISTIK UKURAN FOLDER BOT* 📊\n\n`;
            output += `🏢 *Direktori:* \`${botRoot}\`\n`;
            output += `📦 *Total Ukuran Bot:* *${formatBytes(totalWorkspaceSize)}*\n`;
            output += `🗂️ *Total Direktori:* ${grandTotalDirs.toLocaleString('id-ID')} folder (${folders.length} di root)\n`;
            output += `📄 *Total Berkas:* ${grandTotalFiles.toLocaleString('id-ID')} file (${rootFilesCount} di root)\n`;

            if (diskInfo) {
                output += `💾 *Penyimpanan VPS:* ${formatBytes(diskInfo.free)} bebas / ${formatBytes(diskInfo.total)} (${diskInfo.percent}% terpakai)\n`;
            }
            output += `⚡ *Waktu Analisis:* ${latency} ms\n\n`;

            output += `───〔 📂 *RINCIAN FOLDER (DARI TERBESAR)* 〕───\n`;

            folderDetails.forEach((f, idx) => {
                const bar = makeProgressBar(f.percent, 8);
                output += `${idx + 1}. 📁 *\`${f.name}/\`*\n`;
                output += `   • Ukuran: *${formatBytes(f.size)}* (${f.percent.toFixed(1)}%)\n`;
                output += `   • Item: ${f.filesCount.toLocaleString('id-ID')} file | ${f.dirsCount.toLocaleString('id-ID')} subfolder\n`;
                output += `   • Rasio: ${bar}\n`;
                if (idx < folderDetails.length - 1) output += `\n`;
            });

            // Rincian berkas langsung di root
            output += `\n───〔 📄 *BERKAS ROOT (FILE UTAMA)* 〕───\n`;
            const rootPercent = totalWorkspaceSize > 0 ? (rootFilesSize / totalWorkspaceSize) * 100 : 0;
            output += `• *Total Berkas Root:* *${formatBytes(rootFilesSize)}* (${rootPercent.toFixed(1)}% dari bot)\n`;
            output += `• *Jumlah Berkas:* ${rootFilesCount} file\n`;

            if (rootFilesList.length > 0) {
                const topRootFiles = rootFilesList.slice(0, 4).map(rf => `\`${rf.name}\` (${formatBytes(rf.size)})`).join(', ');
                output += `• *Berkas Terbesar:* ${topRootFiles}\n`;
            }

            output += `\n───〔 💡 *PANDUAN & TIPS* 〕───\n`;
            output += `Ingin cek isi detail subfolder tertentu?\n`;
            output += `Ketik: \`${prefix}${command} <nama_folder>\`\n`;
            output += `Contoh:\n`;
            output += `• \`${prefix}${command} session\` (cek riwayat session WhatsApp)\n`;
            output += `• \`${prefix}${command} perintah\` (cek rincian plugin)\n`;
            output += `• \`${prefix}${command} src\` atau \`${prefix}${command} lib\``;

            await m.reply(output);

        } catch (err) {
            console.error('Error in system_foldersize plugin:', err);
            m.reply(`❌ *Terjadi kesalahan saat memeriksa ukuran folder:* ${err.message || err}`);
        }
    }
};
