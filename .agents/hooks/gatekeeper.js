#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Evaluasi apakah tool call tergolong FATAL atau KRITIS
 * sehingga memerlukan persetujuan manual Owner via WhatsApp.
 * Aksi non-fatal (curl, wget, node, npm test, git, cat, penulisan plugin biasa)
 * di-auto-allow secara otomatis tanpa meminta konfirmasi manual.
 */
function isFatalOrCritical(toolName, toolArgs) {
    toolArgs = toolArgs || {};

    const alwaysSafeTools = [
        'view_file', 'read_file', 'list_dir', 'grep_search', 'find_by_name',
        'search_web', 'read_url_content', 'read_resource',
        'list_resources', 'list_permissions', 'command_status',
        'manage_inbox', 'manage_task', 'wait', 'wait_5_seconds'
    ];
    if (alwaysSafeTools.includes(toolName)) return false;

    // 1. Eksekusi Perintah Terminal (run_command / bash)
    if (toolName === 'run_command') {
        const cmd = (toolArgs.CommandLine || toolArgs.command || '').trim();
        if (!cmd) return false;

        // a. Penghapusan file destruktif (rm / rmdir / shred / unlink)
        const hasRm = /\brm\s+/i.test(cmd);
        const isDestructiveRm = /\brm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+|--recursive\s+|--force\s+)/i.test(cmd) ||
                                /\b(rmdir|shred|unlink)\b/i.test(cmd);
        const isSafeTempRm = /^(rm\s+(-f\s+)?(scratch\/|temp\/|\/tmp\/|\.cache\/)[a-zA-Z0-9_\-\.\/]+)$/i.test(cmd);

        if ((hasRm || isDestructiveRm) && !isSafeTempRm) {
            return {
                isFatal: true,
                reason: 'Perintah terminal berpotensi menghapus file/direktori (rm/rmdir/shred)'
            };
        }

        // b. Operasi Git berbahaya (menghapus commit / riwayat kerja / force push)
        if (/\bgit\s+(reset\s+--hard|clean\s+-[a-zA-Z]*f|push\s+.*(-f|--force)|restore\s+\.)/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Operasi Git destruktif (git reset --hard / git clean / force push)'
            };
        }

        // c. Perintah perusak sistem atau reboot/shutdown
        if (/\b(reboot|shutdown|poweroff|halt|init\s+[06]|mkfs|fdisk|parted|dd\s+if=)\b/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Perintah sistem kritis (reboot / shutdown / manipulasi disk)'
            };
        }

        // d. Modifikasi hak akses sistem kritis di root/sistem
        if (/\bchmod\s+(-[a-zA-Z]*R\s+)?(777|000)\s+(\/|\/etc|\/usr|\/root|\/boot)/i.test(cmd) ||
            /\bchown\s+(-[a-zA-Z]*R\s+).*\s+(\/|\/etc|\/usr|\/root|\/boot)/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Modifikasi hak akses sistem kritis (chmod/chown sistem)'
            };
        }

        // e. Penghapusan kredensial / sesi WhatsApp
        if (/(\bsession|\bscratch_session|\bcredentials|\.auth_info)/i.test(cmd) && /\b(rm|mv|truncate)\b/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Aksi menyentuh/menghapus file sesi WhatsApp (berisiko logout)'
            };
        }

        // f. Menghentikan process kritis / kill tak terduga
        if (/\bkill\s+-9\s+(1\b|-(1\b))/i.test(cmd) || /\bpkill\s+-9\s+(node|pm2)\b/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Mematikan proses penting secara paksa (kill -9 node/pm2)'
            };
        }

        // Perintah non-fatal lainnya (curl, wget, node, npm, cat, git add/commit, pm2 restart self-bot, ls, mkdir, dll) OTOMATIS AMAN
        return false;
    }

    // 2. Penulisan dan Pengeditan File (write_to_file, replace_file_content, etc.)
    if (['write_to_file', 'replace_file_content', 'multi_replace_file_content', 'sed_file'].includes(toolName)) {
        const targetFile = toolArgs.TargetFile || toolArgs.filePath || toolArgs.path || '';
        if (!targetFile) return false;

        const normalizedTarget = path.resolve(targetFile);
        const cwd = process.cwd();

        // Target file di luar direktori bot (misal: /etc/, /usr/, /root/.ssh, dsb.)
        if (!normalizedTarget.startsWith(cwd) && !normalizedTarget.startsWith('/tmp/')) {
            return {
                isFatal: true,
                reason: `Menulis/mengedit file di luar direktori bot: ${targetFile}`
            };
        }

        // File-file inti / kritis bot yang tidak boleh diubah tanpa konfirmasi:
        const criticalCoreFiles = [
            'main.js',              // Baileys socket connection core
            'control.js',           // Core message routing
            'config.js',            // Nomor owner & konfigurasi bot
            'ecosystem.config.js',  // PM2 configuration
            'package.json'          // Dependencies kritis
        ];

        const baseName = path.basename(normalizedTarget);
        const isCoreBotFile = criticalCoreFiles.includes(baseName) && path.dirname(normalizedTarget) === cwd;

        if (isCoreBotFile) {
            return {
                isFatal: true,
                reason: `Memodifikasi file inti bot (${baseName}). Perubahan ini dapat mempengaruhi kestabilan koneksi bot.`
            };
        }

        // Penulisan plugin baru di ./perintah/, scraper di lib/, aset, docs -> OTOMATIS AMAN
        return false;
    }

    return false;
}

let inputBuffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { inputBuffer += chunk; });
process.stdin.on('end', () => {
    let payload = {};
    try {
        payload = JSON.parse(inputBuffer);
    } catch (e) {
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
    }

    const toolName = (payload.toolCall && payload.toolCall.name) || '';
    const toolArgs = (payload.toolCall && payload.toolCall.args) || {};

    const check = isFatalOrCritical(toolName, toolArgs);
    if (!check || !check.isFatal) {
        // Aksi non-fatal (curl, git, node, cat, write plugin, dll): izinkan langsung!
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
    }

    const fatalReason = check.reason || 'Aksi berisiko tinggi / berpotensi fatal';

    const candidatePortFiles = [
        '/tmp/.agy_bridge_port',
        path.join(os.homedir(), '.gemini', 'antigravity-cli', '.bridge_port'),
        path.join(__dirname, '../.bridge_port'),
        path.join(__dirname, '.bridge_port'),
        path.join(process.cwd(), '.agents/.bridge_port'),
        path.join(process.cwd(), '.bridge_port')
    ];

    let targetPort = null;
    for (const pf of candidatePortFiles) {
        try {
            if (fs.existsSync(pf)) {
                const val = parseInt(fs.readFileSync(pf, 'utf8').trim(), 10);
                if (!isNaN(val) && val > 0) {
                    targetPort = val;
                    break;
                }
            }
        } catch (e) {}
    }

    if (!targetPort) {
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
    }

    const postData = JSON.stringify({
        toolName,
        toolArgs,
        fatalReason,
        stepIdx: payload.stepIdx,
        conversationId: payload.conversationId
    });

    const req = http.request({
        hostname: '127.0.0.1',
        port: targetPort,
        path: '/ask-permission',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 125000
    }, (res) => {
        let resBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { resBody += chunk; });
        res.on('end', () => {
            try {
                const decision = JSON.parse(resBody);
                console.log(JSON.stringify(decision));
            } catch (err) {
                console.log(JSON.stringify({ decision: 'deny', reason: 'Format jawaban bridge invalid' }));
            }
            process.exit(0);
        });
    });

    req.on('error', () => {
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
    });

    req.on('timeout', () => {
        req.destroy();
        console.log(JSON.stringify({ decision: 'deny', reason: 'Waktu tunggu persetujuan WhatsApp habis (timeout 2 menit)' }));
        process.exit(0);
    });

    req.write(postData);
    req.end();
});
