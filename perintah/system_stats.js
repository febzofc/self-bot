const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const axios = require('axios');

/**
 * Plugin Inspeksi Spesifikasi VPS / Server & System Stats
 * 
 * Penggunaan:
 * .vps, .server, .spesifikasi, .spec, .sysinfo
 */

module.exports = {
    CmD: ['vps'],
    aliases: ['vps', 'server', 'spec', 'spesifikasi', 'sysinfo', 'system', 'hostinfo', 'botstat', 'neofetch'],
    categori: 'info',
    exec: async (m, { bob, prefix, command }) => {
        const start = Date.now();

        try {
            await m.reply('⏳ *Sedang memeriksa spesifikasi server & VPS...*');

            // 1. FORMAT BYTES & UPTIME HELPER
            const formatBytes = (bytes) => {
                if (bytes === 0 || isNaN(bytes)) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };

            const formatUptime = (seconds) => {
                seconds = Number(seconds);
                const d = Math.floor(seconds / (3600 * 24));
                const h = Math.floor((seconds % (3600 * 24)) / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = Math.floor(seconds % 60);

                const dDisplay = d > 0 ? `${d}d ` : '';
                const hDisplay = h > 0 ? `${h}j ` : '';
                const mDisplay = m > 0 ? `${m}m ` : '';
                const sDisplay = `${s}s`;
                return dDisplay + hDisplay + mDisplay + sDisplay;
            };

            const makeProgressBar = (percent, length = 10) => {
                const cleanPercent = Math.min(Math.max(percent || 0, 0), 100);
                const filled = Math.round((cleanPercent / 100) * length);
                const empty = length - filled;
                return '[' + '█'.repeat(filled) + '░'.repeat(empty) + `] ${cleanPercent.toFixed(1)}%`;
            };

            // 2. VIRTUALIZATION & OS DISTRO DETECTION
            let virtType = 'Bare Metal / Physical Server';
            try {
                const virtCmd = execSync('systemd-detect-virt 2>/dev/null || cat /sys/class/dmi/id/product_name 2>/dev/null', { encoding: 'utf8' }).trim();
                if (virtCmd && virtCmd !== 'none' && virtCmd.length < 50) {
                    virtType = virtCmd.toUpperCase();
                }
            } catch (_) {}

            let osDistro = `${os.type()} ${os.release()}`;
            try {
                if (fs.existsSync('/etc/os-release')) {
                    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
                    const prettyNameMatch = osRelease.match(/PRETTY_NAME="([^"]+)"/i) || osRelease.match(/PRETTY_NAME=([^\n]+)/i);
                    if (prettyNameMatch) {
                        osDistro = prettyNameMatch[1].replace(/"/g, '').trim();
                    }
                }
            } catch (_) {}

            let kernelVer = os.release();
            try {
                kernelVer = execSync('uname -r 2>/dev/null', { encoding: 'utf8' }).trim() || os.release();
            } catch (_) {}

            // 3. CPU INFO & LOAD (Dengan fallback ke /proc/cpuinfo & lscpu)
            const cpus = os.cpus() || [];
            let cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown CPU';
            let cpuCores = cpus.length;
            let rawSpeed = cpus.length > 0 ? cpus[0].speed : 0;

            if (cpuModel.toLowerCase() === 'unknown' || rawSpeed === 0) {
                try {
                    if (fs.existsSync('/proc/cpuinfo')) {
                        const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
                        const modelMatch = cpuinfo.match(/model name\s+:\s+(.+)/i);
                        const speedMatch = cpuinfo.match(/cpu MHz\s+:\s+(.+)/i);
                        if (modelMatch && modelMatch[1]) cpuModel = modelMatch[1].trim();
                        if (speedMatch && speedMatch[1]) rawSpeed = parseFloat(speedMatch[1].trim());
                    }
                } catch (_) {}
            }

            if (cpuModel.toLowerCase() === 'unknown') {
                try {
                    const lscpu = execSync('lscpu 2>/dev/null', { encoding: 'utf8' });
                    const lscpuModel = lscpu.match(/Model name:\s+(.+)/i);
                    if (lscpuModel && lscpuModel[1]) cpuModel = lscpuModel[1].trim();
                } catch (_) {}
            }

            const cpuSpeed = rawSpeed > 0
                ? (rawSpeed > 1000 ? (rawSpeed / 1000).toFixed(2) + ' GHz' : rawSpeed + ' MHz')
                : 'N/A';

            const loadAvg = os.loadavg();
            const load1m = loadAvg[0].toFixed(2);
            const load5m = loadAvg[1].toFixed(2);
            const load15m = loadAvg[2].toFixed(2);

            // 4. MEMORY (RAM & SWAP)
            const totalRam = os.totalmem();
            const freeRam = os.freemem();
            const usedRam = totalRam - freeRam;
            const ramPercent = (usedRam / totalRam) * 100;

            let swapTotal = 0, swapUsed = 0, swapFree = 0, swapPercent = 0;
            try {
                const freeCmd = execSync('free -b 2>/dev/null', { encoding: 'utf8' });
                const swapLine = freeCmd.split('\n').find(line => line.startsWith('Swap:'));
                if (swapLine) {
                    const parts = swapLine.trim().split(/\s+/);
                    swapTotal = parseInt(parts[1]) || 0;
                    swapUsed = parseInt(parts[2]) || 0;
                    swapFree = parseInt(parts[3]) || 0;
                    if (swapTotal > 0) swapPercent = (swapUsed / swapTotal) * 100;
                }
            } catch (_) {}

            // 5. DISK STORAGE
            let diskTotal = 0, diskUsed = 0, diskFree = 0, diskPercent = 0;
            let diskMount = '/';
            try {
                const dfCmd = execSync('df -B1 / 2>/dev/null', { encoding: 'utf8' });
                const lines = dfCmd.trim().split('\n');
                if (lines.length >= 2) {
                    const parts = lines[1].trim().split(/\s+/);
                    diskTotal = parseInt(parts[1]) || 0;
                    diskUsed = parseInt(parts[2]) || 0;
                    diskFree = parseInt(parts[3]) || 0;
                    const pctStr = parts[4] || '0%';
                    diskPercent = parseFloat(pctStr.replace('%', '')) || 0;
                }
            } catch (_) {}

            // 6. NETWORK & PUBLIC IP (ISP / LOKASI)
            let publicIp = 'Tidak Diketahui';
            let ispName = 'Tidak Diketahui';
            let location = 'Tidak Diketahui';

            try {
                const ipRes = await axios.get('http://ip-api.com/json/?fields=status,country,city,isp,org,query', { timeout: 3500 });
                if (ipRes.data && ipRes.data.status === 'success') {
                    publicIp = ipRes.data.query || 'N/A';
                    ispName = ipRes.data.isp || ipRes.data.org || 'N/A';
                    location = `${ipRes.data.city || ''}, ${ipRes.data.country || ''}`.trim().replace(/^,\s*/, '');
                }
            } catch (_) {
                try {
                    const fallbackIp = await axios.get('https://api.ipify.org?format=json', { timeout: 2000 });
                    if (fallbackIp.data && fallbackIp.data.ip) {
                        publicIp = fallbackIp.data.ip;
                    }
                } catch (__) {}
            }

            // 7. BOT PROCESS & PM2 INFO
            const botMemory = process.memoryUsage();
            const rssMem = formatBytes(botMemory.rss);
            const heapUsed = formatBytes(botMemory.heapUsed);
            const heapTotal = formatBytes(botMemory.heapTotal);

            const botUptime = formatUptime(process.uptime());
            const systemUptime = formatUptime(os.uptime());

            let pm2Info = 'Tidak menggunakan PM2';
            if (process.env.pm_id !== undefined || process.env.PM2_HOME || process.env.name) {
                const pmId = process.env.pm_id !== undefined ? process.env.pm_id : 'Aktif';
                const pmName = process.env.name || 'main';
                const restarts = process.env.restart_time !== undefined ? process.env.restart_time : '0';
                pm2Info = `ID: ${pmId} (${pmName}) | Restarts: ${restarts}`;
            }

            const latency = Date.now() - start;

            // 8. SUSUN OUTPUT FORMAT INDONESIA
            let caption = `🖥️ *SPESIFIKASI SERVER & VPS BOT* 🖥️\n\n`;

            caption += `───〔 📌 *INFORMASI SISTEM* 〕───\n`;
            caption += `💻 *Distro OS:* ${osDistro}\n`;
            caption += `🐧 *Kernel:* ${kernelVer}\n`;
            caption += `🏢 *Tipe VPS / Virt:* \`${virtType}\`\n`;
            caption += `🏷️ *Hostname:* \`${os.hostname()}\`\n`;
            caption += `🏗️ *Arsitektur:* ${os.arch()} (${os.platform()})\n\n`;

            caption += `───〔 ⚡ *PROSESOR (CPU)* 〕───\n`;
            caption += `⚙️ *Model:* ${cpuModel}\n`;
            caption += `🧩 *Cores & Speed:* ${cpuCores} Core(s) @ ${cpuSpeed}\n`;
            caption += `📊 *Beban CPU (Load Avg):*\n`;
            caption += `   • 1m: ${load1m} | 5m: ${load5m} | 15m: ${load15m}\n\n`;

            caption += `───〔 🧠 *MEMORI (RAM & SWAP)* 〕───\n`;
            caption += `💾 *Total RAM:* ${formatBytes(totalRam)}\n`;
            caption += `📈 *Digunakan:* ${formatBytes(usedRam)} (${ramPercent.toFixed(1)}%)\n`;
            caption += `📉 *Tersedia:* ${formatBytes(freeRam)}\n`;
            caption += `📊 *Penggunaan RAM:*\n${makeProgressBar(ramPercent)}\n`;

            if (swapTotal > 0) {
                caption += `\n🔄 *Total Swap:* ${formatBytes(swapTotal)}\n`;
                caption += `📈 *Swap Digunakan:* ${formatBytes(swapUsed)} (${swapPercent.toFixed(1)}%)\n`;
                caption += `📊 *Penggunaan Swap:*\n${makeProgressBar(swapPercent)}\n`;
            }
            caption += `\n`;

            caption += `───〔 💾 *PENYIMPANAN (DISK)* 〕───\n`;
            caption += `💽 *Partisi Utama:* ${diskMount}\n`;
            caption += `📦 *Total Disk:* ${formatBytes(diskTotal)}\n`;
            caption += `📈 *Terpakai:* ${formatBytes(diskUsed)} (${diskPercent.toFixed(1)}%)\n`;
            caption += `📉 *Sisa Bebas:* ${formatBytes(diskFree)}\n`;
            caption += `📊 *Penggunaan Disk:*\n${makeProgressBar(diskPercent)}\n\n`;

            caption += `───〔 🌐 *JARINGAN & LOKASI* 〕───\n`;
            caption += `🌐 *Public IP:* \`${publicIp}\`\n`;
            caption += `🏢 *ISP / Provider:* ${ispName}\n`;
            caption += `📍 *Lokasi Server:* ${location}\n\n`;

            caption += `───〔 🤖 *STATUS BOT & PROCESS* 〕───\n`;
            caption += `⚡ *Respon Bot:* ${latency} ms\n`;
            caption += `🟢 *Waktu Aktif Bot:* ${botUptime}\n`;
            caption += `🖥️ *Waktu Aktif VPS:* ${systemUptime}\n`;
            caption += `📦 *Node.js Version:* ${process.version}\n`;
            caption += `📊 *RAM Digunakan Bot:* ${rssMem} (Heap: ${heapUsed} / ${heapTotal})\n`;
            caption += `🔄 *Status PM2:* ${pm2Info}\n`;

            await m.reply(caption);

        } catch (err) {
            console.error('Error in system_stats plugin:', err);
            m.reply(`❌ *Terjadi kesalahan saat memeriksa spesifikasi server:* ${err.message || err}`);
        }
    }
};
