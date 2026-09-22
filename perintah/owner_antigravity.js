const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const aiRouter = require('../lib/aiSwitchRouter.js');

/**
 * Antigravity CLI Controller & Session Manager (Clean Text / Zero-Emoji Edition)
 * Full features:
 * 1. Multi-turn session per chat (Owner only)
 * 2. PreToolUse approval gatekeeper (tanpa --dangerously-skip-permissions liar)
 * 3. Minimalist live logs via WhatsApp message edit (sesuai TUI agy, clean text)
 * 4. Approval request: pesan lama difinalisasi, kirim pesan konfirmasi baru, lalu pesan log baru
 * 5. Jawaban akhir dikirim utuh sebagai gelembung teks chat biasa (BUKAN file dokumen)
 * 6. /btw slash command support during ongoing tasks
 * 7. 100% Auto-detect & auto-setup di VPS / perangkat baru mana pun
 * 8. Tampilan bebas emoji untuk pengalaman teks bersih dan profesional
 */

const DEFAULT_BRIDGE_PORT = 39281;
let activeBridgePort = DEFAULT_BRIDGE_PORT;
let bridgeServer = null;

// Sesi percakapan bersama per chat: Map(chatId => { conversationId, isInteractive, lastActive, history })
const sessions = aiRouter.sharedSessions;

// Task yang sedang berjalan per chat: Map(chatId => taskState)
const activeTasks = new Map();

/**
 * Deteksi path binary agy di sistem VPS
 */
function findAgyBinary() {
    const homedir = os.homedir();
    const candidates = [
        '/root/.local/bin/agy',
        path.join(homedir, '.local', 'bin', 'agy'),
        '/usr/local/bin/agy',
        '/usr/bin/agy',
        '/bin/agy'
    ];

    try {
        const whichResult = execSync('which agy 2>/dev/null', { encoding: 'utf8' }).trim();
        if (whichResult && fs.existsSync(whichResult)) {
            return whichResult;
        }
    } catch (e) {}

    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return null;
}

/**
 * Auto-Setup folder .agents, hooks.json, dan gatekeeper.js secara otomatis
 */
function ensureAgentHooks() {
    const agentsDir = path.join(process.cwd(), '.agents');
    const hooksDir = path.join(agentsDir, 'hooks');
    const homedir = os.homedir();

    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }

    const gatekeeperCode = `#!/usr/bin/env node
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
        const hasRm = /\\brm\\s+/i.test(cmd);
        const isDestructiveRm = /\\brm\\s+(-[a-zA-Z]*[rf][a-zA-Z]*\\s+|--recursive\\s+|--force\\s+)/i.test(cmd) ||
                                /\\b(rmdir|shred|unlink)\\b/i.test(cmd);
        const isSafeTempRm = /^(rm\\s+(-f\\s+)?(scratch\\/|temp\\/|\\/tmp\\/|\\.cache\\/)[a-zA-Z0-9_\\-\\.\\/]+)$/i.test(cmd);

        if ((hasRm || isDestructiveRm) && !isSafeTempRm) {
            return {
                isFatal: true,
                reason: 'Perintah terminal berpotensi menghapus file/direktori (rm/rmdir/shred)'
            };
        }

        // b. Operasi Git berbahaya (menghapus commit / riwayat kerja / force push)
        if (/\\bgit\\s+(reset\\s+--hard|clean\\s+-[a-zA-Z]*f|push\\s+.*(-f|--force)|restore\\s+\\.)/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Operasi Git destruktif (git reset --hard / git clean / force push)'
            };
        }

        // c. Perintah perusak sistem atau reboot/shutdown
        if (/\\b(reboot|shutdown|poweroff|halt|init\\s+[06]|mkfs|fdisk|parted|dd\\s+if=)\\b/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Perintah sistem kritis (reboot / shutdown / manipulasi disk)'
            };
        }

        // d. Modifikasi hak akses sistem kritis di root/sistem
        if (/\\bchmod\\s+(-[a-zA-Z]*R\\s+)?(777|000)\\s+(\\/|\\/etc|\\/usr|\\/root|\\/boot)/i.test(cmd) ||
            /\\bchown\\s+(-[a-zA-Z]*R\\s+).*\\s+(\\/|\\/etc|\\/usr|\\/root|\\/boot)/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Modifikasi hak akses sistem kritis (chmod/chown sistem)'
            };
        }

        // e. Penghapusan kredensial / sesi WhatsApp
        if (/(\\bsession|\\bscratch_session|\\bcredentials|\\.auth_info)/i.test(cmd) && /\\b(rm|mv|truncate)\\b/i.test(cmd)) {
            return {
                isFatal: true,
                reason: 'Aksi menyentuh/menghapus file sesi WhatsApp (berisiko logout)'
            };
        }

        // f. Menghentikan process kritis / kill tak terduga
        if (/\\bkill\\s+-9\\s+(1\\b|-(1\\b))/i.test(cmd) || /\\bpkill\\s+-9\\s+(node|pm2)\\b/i.test(cmd)) {
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
                reason: \`Menulis/mengedit file di luar direktori bot: \${targetFile}\`
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
                reason: \`Memodifikasi file inti bot (\${baseName}). Perubahan ini dapat mempengaruhi kestabilan koneksi bot.\`
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
`;
    const p1 = path.join(hooksDir, 'gatekeeper.js');
    const p2 = path.join(agentsDir, 'gatekeeper.js');
    fs.writeFileSync(p1, gatekeeperCode, { mode: 0o755 });
    fs.writeFileSync(p2, gatekeeperCode, { mode: 0o755 });

    const gatekeeperPath = p2;
    const hooksConfig = {
        "permission-gate": {
            "PreToolUse": [
                {
                    "matcher": "run_command|write_to_file|replace_file_content|multi_replace_file_content|sed_file|notebook_execution",
                    "hooks": [
                        {
                            "command": `node "${gatekeeperPath}"`,
                            "timeout": 130
                        }
                    ]
                }
            ]
        }
    };
    const hooksJsonStr = JSON.stringify(hooksConfig, null, 2);

    const targetHooksPaths = [
        path.join(agentsDir, 'hooks.json'),
        path.join(homedir, '.gemini', 'config', 'hooks.json'),
        path.join(homedir, '.gemini', 'antigravity-cli', 'hooks.json')
    ];

    for (const hp of targetHooksPaths) {
        try {
            const dir = path.dirname(hp);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(hp, hooksJsonStr, 'utf8');
        } catch (e) {}
    }
}

/**
 * Jalankan HTTP Bridge Server untuk menerima event konfirmasi persetujuan dari hook
 */
function startBridgeServer() {
    if (bridgeServer) return;

    ensureAgentHooks();

    bridgeServer = http.createServer(async (req, res) => {
        if (req.method === 'POST' && req.url === '/ask-permission') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    await handleIncomingPermissionRequest(data, res);
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ decision: 'deny', reason: 'Payload JSON invalid' }));
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    bridgeServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            bridgeServer.listen(0, '127.0.0.1');
        } else {
            console.error('Antigravity Bridge Server Error:', err);
        }
    });

    bridgeServer.listen(DEFAULT_BRIDGE_PORT, '127.0.0.1', () => {
        activeBridgePort = bridgeServer.address().port;
        bridgeServer.unref();
        const portFiles = [
            path.join(process.cwd(), '.agents', '.bridge_port'),
            '/tmp/.agy_bridge_port',
            path.join(os.homedir(), '.gemini', 'antigravity-cli', '.bridge_port')
        ];
        for (const pf of portFiles) {
            try {
                const dir = path.dirname(pf);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(pf, activeBridgePort.toString(), 'utf8');
            } catch (e) {}
        }
    });
}

startBridgeServer();

/**
 * Format string path agar ringkas (~/)
 */
function shortenPath(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const home = os.homedir();
    if (filePath.startsWith(home)) {
        filePath = filePath.replace(home, '~');
    }
    if (filePath.length > 45) {
        const start = filePath.slice(0, 20);
        const end = filePath.slice(-22);
        return `${start}...${end}`;
    }
    return filePath;
}

/**
 * Format nama tool simpel persis seperti log TUI Antigravity CLI
 * Contoh: Read(~/.gemini/antigravity-cli.../task-180.log)
 * Contoh: ManageTask(kill task-180)
 */
function formatSimpleToolAction(toolName, params) {
    params = params || {};
    switch (toolName) {
        case 'view_file':
        case 'read_file':
            return `Read(${shortenPath(params.AbsolutePath || params.filePath || params.path || '')})`;
        case 'write_to_file':
            return `Write(${shortenPath(params.TargetFile || params.filePath || params.path || '')})`;
        case 'replace_file_content':
        case 'multi_replace_file_content':
            return `Edit(${shortenPath(params.TargetFile || params.filePath || params.path || '')})`;
        case 'run_command':
            const cmd = (params.CommandLine || params.command || '').trim();
            const shortCmd = cmd.length > 32 ? cmd.slice(0, 29) + '...' : cmd;
            return `Bash(${shortCmd})`;
        case 'manage_task':
            return `ManageTask(${params.Action || ''} ${params.TaskId ? params.TaskId.split('/').pop() : ''})`.trim();
        case 'grep_search':
            return `Grep(${params.pattern || params.regex || params.query || ''})`;
        case 'find_by_name':
            return `Find(${params.pattern || params.name || ''})`;
        case 'search_web':
            const q = (params.query || '').trim();
            return `Search(${q.length > 25 ? q.slice(0, 22) + '...' : q})`;
        case 'read_url_content':
            return `Fetch(${params.Url || ''})`;
        case 'list_dir':
            return `Ls(${shortenPath(params.DirectoryPath || '')})`;
        default:
            return `${toolName}()`;
    }
}

function formatToolDetailForApproval(toolName, params, fatalReason) {
    params = params || {};
    let detail = '';
    switch (toolName) {
        case 'run_command':
            detail = `*Aksi:* Eksekusi Terminal Berisiko / Fatal\n*Command:* \`\`\`${params.CommandLine || params.command || '-'}\`\`\``;
            break;
        case 'write_to_file':
            detail = `*Aksi:* Menulis / Membuat File Kritis\n*Target:* \`${params.TargetFile || params.filePath || params.path || '-'}\`\n*Keterangan:* ${params.Description || '-'}`;
            break;
        case 'replace_file_content':
        case 'multi_replace_file_content':
            detail = `*Aksi:* Mengedit File Inti Bot / Kritis\n*Target:* \`${params.TargetFile || params.filePath || params.path || '-'}\`\n*Instruksi:* ${params.Instruction || '-'}`;
            break;
        default:
            detail = `*Tool:* \`${toolName}\`\n*Parameter:* \`\`\`${JSON.stringify(params, null, 2)}\`\`\``;
            break;
    }

    if (fatalReason) {
        return `*Peringatan Risiko:* ${fatalReason}\n${detail}`;
    }
    return detail;
}

/**
 * Handle permintaan izin dari hook gatekeeper
 */
async function handleIncomingPermissionRequest(data, res) {
    let targetTask = null;
    for (const [chatId, task] of activeTasks.entries()) {
        if (task) {
            targetTask = task;
            break;
        }
    }

    if (!targetTask) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ decision: 'allow' }));
    }

    const { bob, chatId } = targetTask;

    // 1. Perbarui pesan live logs utama agar menampilkan status aksi fatal apa yang sedang menunggu persetujuan
    targetTask.pendingApprovalReason = data.fatalReason || 'Aksi berisiko tinggi / fatal';
    targetTask.pendingApprovalTool = data.toolName;
    targetTask.pendingApprovalArgs = data.toolArgs;

    const logKey = targetTask.mainLogMsgKey || targetTask.lastLogMsgKey;
    if (logKey) {
        targetTask.lastLogMsgKey = logKey;
        const updatedLog = renderLiveLogText(targetTask);
        try {
            await bob.sendMessage(chatId, {
                text: updatedLog,
                edit: logKey
            });
            targetTask.renderedLogText = updatedLog;
        } catch (e) {}
    }

    // 2. Kirim PESAN BARU untuk konfirmasi persetujuan dengan MEMBALAS (reply/quote) pesan live log utama
    const toolDetails = formatToolDetailForApproval(data.toolName, data.toolArgs, data.fatalReason);
    const approvalPrompt = 
        `[KONFIRMASI AKSI KRITIS / FATAL]\n` +
        `----------------------------------------\n` +
        `${toolDetails}\n\n` +
        `Ketik:\n` +
        `*Y* (Setuju) untuk mengizinkan\n` +
        `*N* (Tolak) untuk membatalkan\n\n` +
        `_Batas waktu konfirmasi: 2 menit_`;

    let sentApprovalMsg = null;
    try {
        const quoteOpt = targetTask.initLogMsg ? { quoted: targetTask.initLogMsg } : {};
        sentApprovalMsg = await bob.sendMessage(chatId, { text: approvalPrompt }, quoteOpt);
    } catch (e) {
        try {
            sentApprovalMsg = await bob.sendMessage(chatId, { text: approvalPrompt });
        } catch (err) {
            console.error('Gagal mengirim pesan persetujuan ke WA:', err);
        }
    }

    // 3. Simpan state pending approval
    targetTask.pendingApproval = {
        toolName: data.toolName,
        toolArgs: data.toolArgs,
        res,
        approvalMsgKey: sentApprovalMsg ? sentApprovalMsg.key : null,
        timer: setTimeout(async () => {
            if (targetTask && targetTask.pendingApproval) {
                try {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ decision: 'deny', reason: 'Waktu konfirmasi WhatsApp habis (timeout 2 menit)' }));
                } catch (e) {}

                if (sentApprovalMsg) {
                    try {
                        await bob.sendMessage(chatId, {
                            text: `[Waktu Konfirmasi Habis] Eksekusi dibatalkan oleh sistem.`,
                            edit: sentApprovalMsg.key
                        });
                    } catch (e) {}
                }

                targetTask.pendingApproval = null;
                targetTask.pendingApprovalReason = null;

                // Lanjutkan pengeditan pada pesan live logs utama
                const currentKey = targetTask.mainLogMsgKey || targetTask.lastLogMsgKey;
                if (currentKey) {
                    targetTask.lastLogMsgKey = currentKey;
                    targetTask.latestThought = '✖ Waktu konfirmasi habis, melanjutkan proses tanpa aksi ini...';
                    scheduleLogUpdate(targetTask);
                }
            }
        }, 120000)
    };
}

/**
 * Render teks log realtime simpel persis seperti yang diminta user:
 * Narasi berpikir agen di atas, lalu bullet tool di bawahnya.
 */
function renderLiveLogText(task) {
    let result = '';

    if (task.latestThought) {
        result += `${task.latestThought.trim()}\n\n`;
    }

    const maxActions = 6;
    const recent = task.actions.slice(-maxActions);
    if (recent.length > 0) {
        result += recent.map(a => `${a.statusSymbol} ${a.display}`).join('\n');
    } else if (!task.latestThought) {
        result += '● Memproses...';
    }

    if (task.pendingApprovalReason) {
        result += `\n\n⏸ *Menunggu Persetujuan:* ${task.pendingApprovalReason}`;
    }

    return result.trim();
}

/**
 * Update pesan log dengan sistem edit pesan WhatsApp
 */
function scheduleLogUpdate(task) {
    const currentKey = task.mainLogMsgKey || task.lastLogMsgKey;
    if (!task || !currentKey) return;
    if (task.editTimeout) return;

    task.editTimeout = setTimeout(async () => {
        task.editTimeout = null;
        const logKey = task.mainLogMsgKey || task.lastLogMsgKey;
        if (!logKey) return;

        const rendered = renderLiveLogText(task);
        if (!rendered || rendered === task.renderedLogText) return;
        task.renderedLogText = rendered;

        try {
            await task.bob.sendMessage(task.chatId, {
                text: rendered,
                edit: logKey
            });
        } catch (e) {
            // Abaikan rate limit sesaat
        }
    }, 700);
}

/**
 * Kirim hasil respon teks utuh ke chat WhatsApp.
 * Jika teks sangat panjang (> 3800 karakter), otomatis dipecah rapi
 * menjadi beberapa pesan teks berurutan (TIDAK pernah dikirim sebagai file .txt).
 */
async function sendFullTextResponse(bob, chatId, fullText, quotedMsg) {
    const textToSend = (fullText || '').trim();
    if (!textToSend) return;

    const MAX_CHUNK = 3800;
    if (textToSend.length <= MAX_CHUNK) {
        await bob.sendMessage(chatId, { text: textToSend }, { quoted: quotedMsg });
        return;
    }

    const paragraphs = textToSend.split('\n\n');
    let currentChunk = '';

    for (const para of paragraphs) {
        if ((currentChunk + '\n\n' + para).length > MAX_CHUNK) {
            if (currentChunk.trim()) {
                await bob.sendMessage(chatId, { text: currentChunk.trim() });
                currentChunk = '';
            }
            if (para.length > MAX_CHUNK) {
                const lines = para.split('\n');
                for (const line of lines) {
                    if ((currentChunk + '\n' + line).length > MAX_CHUNK) {
                        if (currentChunk.trim()) {
                            await bob.sendMessage(chatId, { text: currentChunk.trim() });
                            currentChunk = '';
                        }
                    }
                    currentChunk += (currentChunk ? '\n' : '') + line;
                }
            } else {
                currentChunk = para;
            }
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + para;
        }
    }

    if (currentChunk.trim()) {
        await bob.sendMessage(chatId, { text: currentChunk.trim() });
    }
}

module.exports = {
    CmD: ['agy', 'antigravity', 'btw'],
    aliases: ['agy', 'antigravity', 'btw'],
    categori: 'owner tools',

    /**
     * Hook before: Menangani interaksi persetujuan (Y/N), /btw, dan sesi percakapan tanpa prefix
     */
    before: async (m, { bob, body, budy, isCmd, prefix, isCreator, isOwner }) => {
        const ownerAuth = isCreator || isOwner;
        if (!m || m.isBaileys || m.fromMe) return false;
        if (!ownerAuth) return false;

        const text = (budy || body || '').trim();
        if (!text) return false;

        // 1. TANGANI PERSETUJUAN (Y / N)
        const activeTask = activeTasks.get(m.chat);
        if (activeTask && activeTask.pendingApproval) {
            const isYes = /^(y|ya|yes|izinkan|setuju|ok)$/i.test(text);
            const isNo = /^(n|no|tidak|tolak|batal)$/i.test(text);

            if (isYes || isNo) {
                clearTimeout(activeTask.pendingApproval.timer);
                const { res, approvalMsgKey } = activeTask.pendingApproval;
                activeTask.pendingApproval = null;
                activeTask.pendingApprovalReason = null;
                activeTask.pendingApprovalTool = null;
                activeTask.pendingApprovalArgs = null;

                if (isYes) {
                    try {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ decision: 'allow' }));
                    } catch (e) {}

                    if (approvalMsgKey) {
                        try {
                            await bob.sendMessage(m.chat, {
                                text: `[Eksekusi Dilanjutkan]`,
                                edit: approvalMsgKey
                            });
                        } catch (e) {}
                    }
                } else {
                    try {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ decision: 'deny', reason: 'Ditolak oleh Owner melalui WhatsApp' }));
                    } catch (e) {}

                    if (approvalMsgKey) {
                        try {
                            await bob.sendMessage(m.chat, {
                                text: `[Eksekusi Dibatalkan oleh Owner]`,
                                edit: approvalMsgKey
                            });
                        } catch (e) {}
                    }
                }

                // Lanjutkan pengeditan pada pesan live logs pertama tanpa membuat gelembung log baru!
                const logKey = activeTask.mainLogMsgKey || activeTask.lastLogMsgKey;
                if (logKey) {
                    activeTask.lastLogMsgKey = logKey;
                    activeTask.latestThought = isYes ? '● Melanjutkan eksekusi...' : '✖ Aksi dibatalkan, melanjutkan proses...';
                    scheduleLogUpdate(activeTask);
                }

                return true;
            }
        }

        // 2. FITUR /BTW (Interupsi / Tanya Status Task Berjalan)
        if (/^(\/|\.)?btw(\s|$)/i.test(text)) {
            const query = text.replace(/^(\/|\.)?btw\s*/i, '').trim();

            if (!activeTask) {
                const sess = sessions.get(m.chat);
                return m.reply(
                    `*Tidak Ada Task Antigravity yang Sedang Berjalan*\n\n` +
                    `*ID Percakapan:* ${sess?.conversationId ? `\`${sess.conversationId}\`` : 'Belum aktif'}\n` +
                    `*Mode Interaktif:* ${sess?.isInteractive ? 'Aktif' : 'Nonaktif'}\n\n` +
                    `Untuk memulai tugas:\n` +
                    `*${prefix}agy <instruksi Anda>*\n` +
                    `*${prefix}agy --sesi* (untuk mode chat interaktif tanpa prefix)`
                );
            }

            const elapsedSec = Math.floor((Date.now() - activeTask.startTime) / 1000);
            const totalActions = activeTask.actions.length;
            const lastAction = totalActions > 0 ? activeTask.actions[totalActions - 1] : null;
            const currentStatusDesc = lastAction ? `${lastAction.statusSymbol} ${lastAction.display}` : 'Sedang memproses...';

            if (query) {
                let btwResponse =
                    `*Jawaban /btw:*\n` +
                    `*Pertanyaan:* "${query}"\n` +
                    `*Tugas Berjalan:* ${activeTask.prompt}\n` +
                    `*Durasi:* ${elapsedSec} detik (${totalActions} langkah)\n` +
                    `*Langkah Saat Ini:* ${currentStatusDesc}\n`;

                if (activeTask.pendingApproval) {
                    btwResponse += `\n*Catatan:* Saat ini task sedang dijeda menunggu persetujuan Anda (Ketik Y/N).`;
                }

                return m.reply(btwResponse);
            } else {
                let overview =
                    `*Status Task Antigravity (/btw)*\n` +
                    `----------------------------------------\n` +
                    `*Instruksi:* ${activeTask.prompt}\n` +
                    `*Durasi:* ${elapsedSec} detik\n` +
                    `*Langkah Terkini:* ${currentStatusDesc}\n` +
                    `*Total Aksi:* ${totalActions} langkah\n` +
                    `*Status:* ${activeTask.pendingApproval ? 'Menunggu Persetujuan Anda (Ketik Y/N)' : 'Sedang Berjalan'}\n\n` +
                    `_Langkah Terakhir:_\n` +
                    (activeTask.actions.slice(-4).map(a => `${a.statusSymbol} ${a.display}`).join('\n') || '_(Belum ada tool)_');

                return m.reply(overview);
            }
        }

        // 3. SESI INTERAKTIF (Chat tanpa prefix jika --sesi aktif)
        const session = sessions.get(m.chat);
        if (session && session.isInteractive && !isCmd && !text.startsWith('.')) {
            module.exports.dispatch(bob, m, text, { isCreator: true, prefix });
            return true;
        }

        return false;
    },

    /**
     * Entrypoint Perintah .agy / .antigravity / .btw
     */
    exec: async (m, { bob, args, text, prefix, command, isCreator, isOwner }) => {
        const ownerAuth = isCreator || isOwner;
        if (!ownerAuth) {
            return m.reply('[Akses Ditolak] Perintah ini terhubung langsung ke Antigravity CLI dan hanya dapat digunakan oleh Owner.');
        }

        if (command === 'btw') {
            return module.exports.before(m, { bob, budy: `/btw ${text}`, isCreator: true, prefix });
        }

        const cleanText = (text || '').trim();

        // 1. Tampilkan panduan jika tanpa argumen
        if (!cleanText) {
            const sess = sessions.get(m.chat);
            return m.reply(
                `*Antigravity CLI & AI Controller*\n` +
                `----------------------------------------\n` +
                `*Perintah:*\n` +
                `*${prefix + command} <instruksi>*\n` +
                `_Contoh: ${prefix + command} buatkan plugin kalkulator_\n` +
                `_Contoh: ${prefix + command} halo bro lagi apa (otomatis hemat token via QwQ)_\n\n` +
                `*Fitur Auto-Switch Cerdas:*\n` +
                `• Obrolan santai/chitchat otomatis menggunakan model QwQ-32B untuk menghemat token Antigravity.\n` +
                `• Coding, search web, & eksekusi terminal otomatis dialihkan ke Antigravity CLI.\n` +
                `• Sesi riwayat percakapan tersambung mulus dalam 1 konteks obrolan.\n\n` +
                `*Sesi Chat Interaktif:*\n` +
                `*${prefix + command} --sesi*\n` +
                `_Masuk mode chat langsung tanpa prefix._\n\n` +
                `*${prefix + command} --stop*\n` +
                `_Keluar dari mode sesi chat interaktif._\n\n` +
                `*${prefix + command} --reset*\n` +
                `_Reset riwayat percakapan dan mulai dari awal._\n\n` +
                `*Monitoring Progres:*\n` +
                `*/btw* atau *${prefix}btw*\n` +
                `_Cek status live progress task Antigravity yang sedang berjalan._\n\n` +
                `*Keamanan:* Aksi kritis memerlukan persetujuan WhatsApp (Y/N).\n` +
                `*Status Sesi:* ${sess?.conversationId ? `Aktif (\`${sess.conversationId.slice(0, 8)}...\`)` : (sess?.history?.length ? `Aktif (${sess.history.length / 2} pesan tersimpan)` : 'Belum aktif')}`
            );
        }

        // 2. Mode Kontrol Sesi
        if (cleanText === '--stop') {
            aiRouter.stopInteractive(m.chat);
            return m.reply('*Sesi Interaktif Dinonaktifkan.*\nGunakan prefix seperti biasa untuk menjalankan perintah.');
        }

        if (cleanText === '--reset') {
            aiRouter.resetSession(m.chat);
            return m.reply('*Konteks Percakapan Direset.*\nPercakapan berikutnya akan dimulai sebagai sesi baru.');
        }

        if (cleanText.startsWith('--sesi')) {
            const sess = aiRouter.getOrCreateSession(m.chat);
            sess.isInteractive = true;

            const initialPrompt = cleanText.replace('--sesi', '').trim();
            if (initialPrompt) {
                await m.reply('*Sesi Interaktif Aktif*\n_Memproses pesan Anda..._');
                return module.exports.dispatch(bob, m, initialPrompt, { isCreator: true, prefix });
            } else {
                return m.reply(
                    `*Sesi Interaktif Antigravity & AI Dimulai*\n\n` +
                    `Anda dapat langsung mengobrol atau mengirim instruksi coding *(tanpa prefix)*.\n` +
                    `• Obrolan santai otomatis menggunakan model alternatif (hemat token).\n` +
                    `• Coding & pencarian web otomatis ditangani oleh Antigravity CLI.\n` +
                    `• Riwayat percakapan tetap tersambung secara seamless.\n\n` +
                    `Gunakan */btw* kapan saja untuk memeriksa progres task.\n` +
                    `Ketik *${prefix + command} --stop* untuk keluar dari sesi.\n` +
                    `Ketik *${prefix + command} --reset* untuk mereset riwayat sesi.`
                );
            }
        }

        // 3. Jalankan melalui dispatcher pintar (Auto-Switch)
        return module.exports.dispatch(bob, m, cleanText, { isCreator: true, prefix });
    },

    /**
     * Dispatcher pintar: Auto-switch antara QwQ-32B dan Antigravity CLI
     * - Obrolan santai / chitchat: QwQ-32B API (hemat token Antigravity)
     * - Tugas berat / coding / search web / VPS: Antigravity CLI (agy)
     * - Riwayat obrolan tersambung dalam 1 sesi terpadu
     */
    dispatch: async (bob, m, promptText, { isCreator, prefix, forceAgy = false }) => {
        const session = aiRouter.getOrCreateSession(m.chat);
        const text = (promptText || '').trim();
        if (!text) return;

        // Cek apakah instruksi memerlukan Antigravity CLI
        const needsAgy = forceAgy || aiRouter.needsAntigravity(text, session.history);

        if (needsAgy) {
            // Jalankan Antigravity CLI untuk coding, edit file, browsing internet, VPS/Terminal
            return module.exports.executeTask(bob, m, text, { isCreator, prefix, session });
        }

        // Jalankan model AI QwQ-32B untuk obrolan santai (hemat token Antigravity)
        try {
            if (bob?.sendPresenceUpdate) {
                await bob.sendPresenceUpdate('composing', m.chat).catch(() => {});
            }
            const replyText = await aiRouter.fetchQwQ(text, session.history);
            aiRouter.recordTurn(m.chat, text, replyText, 'qwq');
            return m.reply(replyText);
        } catch (err) {
            console.error('[Auto-Switch QwQ Error]:', err.message);
            // Fallback otomatis ke Antigravity jika API eksternal mengalami kendala
            return module.exports.executeTask(bob, m, text, { isCreator, prefix, session });
        }
    },

    /**
     * Eksekutor Utama Antigravity Task
     */
    executeTask: async (bob, m, promptText, { isCreator, prefix }) => {
        // Cek ketersediaan binary agy di VPS
        const agyPath = findAgyBinary();
        if (!agyPath) {
            return m.reply(
                `[ERROR] Antigravity CLI Belum Terinstall / Ditemukan!\n\n` +
                `Perangkat atau VPS ini belum memiliki binary Antigravity CLI (\`agy\`).\n\n` +
                `*Langkah Instalasi di VPS:*\n` +
                `1. Pastikan Antigravity CLI terpasang di sistem VPS Anda:\n` +
                `   Dokumentasi: https://antigravity.google/docs/cli/reference\n` +
                `2. Pastikan binary \`agy\` dapat diakses via PATH (\`~/.local/bin/agy\` atau \`/usr/local/bin/agy\`).\n` +
                `3. Jalankan perintah \`agy\` sekali di terminal VPS untuk login / autentikasi akun Google.\n\n` +
                `Setelah selesai, ketik kembali perintah *.agy* di sini.`
            );
        }

        if (activeTasks.has(m.chat)) {
            return m.reply('Masih ada tugas Antigravity yang sedang diproses di chat ini. Gunakan */btw* untuk melihat progresnya.');
        }

        // Pastikan folder hooks dan bridge server siap
        startBridgeServer();

        let session = sessions.get(m.chat);
        if (!session) {
            session = { conversationId: null, isInteractive: false };
            sessions.set(m.chat, session);
        }

        // Kirim pesan live log pertama yang bersih & simpel
        let initLogMsg = null;
        try {
            initLogMsg = await bob.sendMessage(m.chat, {
                text: `● Memulai agent...`
            });
        } catch (e) {
            console.error('Gagal mengirim pesan log awal:', e);
        }

        const taskState = {
            childProcess: null,
            prompt: promptText,
            startTime: Date.now(),
            actions: [],
            latestThought: '',
            initLogMsg: initLogMsg, // Referensi pesan live logs pertama untuk quote reply
            mainLogMsgKey: initLogMsg ? initLogMsg.key : null, // Kunci pesan live log pertama yang dipertahankan
            lastLogMsgKey: initLogMsg ? initLogMsg.key : null,
            renderedLogText: '● Memulai agent...',
            pendingApproval: null,
            pendingApprovalReason: null,
            pendingApprovalTool: null,
            pendingApprovalArgs: null,
            bob,
            chatId: m.chat,
            editTimeout: null
        };
        activeTasks.set(m.chat, taskState);

        const systemPrefix = 
            `[SISTEM WORKSPACE WHATSAPP BOT - /root/self-bot]\n` +
            `Anda adalah asisten AI coding untuk repository WhatsApp bot Baileys ini.\n` +
            `- Jika pengguna meminta membuat fitur, perintah, atau plugin baru, Anda WAJIB membuat filenya secara nyata di folder './perintah/<nama_plugin>.js' menggunakan tool write_to_file.\n` +
            `- Format plugin: export object dengan 'CmD', 'aliases', 'categori', dan method 'exec(m, { bob, args, text, prefix, command, isCreator, isOwner, quoted, qmsg, budy })'.\n` +
            `- JANGAN HANYA MENAMPILKAN KODE DI CHAT jika diminta membuat fitur/plugin. Anda harus menuliskan file ke sistem.\n` +
            `- KEBIJAKAN PERSETUJUAN & AUTONOMI:\n` +
            `  * Eksekusi terminal non-fatal (curl, wget, node, npm test, git status/add/commit, cat, ls) dan penulisan/pengeditan plugin di './perintah/' SUDAH DISETUJUI OTOMATIS oleh sistem tanpa memerlukan konfirmasi manual.\n` +
            `  * HANYA aksi fatal/destruktif (seperti rm -rf, git reset --hard, modifikasi file inti bot seperti main.js/control.js/config.js, atau manipulasi sistem) yang memicu konfirmasi izin manual.\n` +
            `  * Jika terdapat beberapa opsi pendekatan kode, arsitektur alternatif, atau butuh pertimbangan pengguna ("rekomendasi kode / pilihan kode"), sampaikan opsi-opsi tersebut dan berikan rekomendasi terbaik Anda secara jelas dan ringkas di pesan chat agar pengguna dapat memilihnya.\n` +
            `- GAYA BICARA & KARAKTER: Berikan penjelasan dan respon dengan bahasa santai gaul tongkrongan Indonesia (lu, gua, wir), sedikit tengil dan akrab tapi tetap handal dan presisi dalam hal kode. HINDARI bahasa kaku/formal seperti robot atau asisten korporat agar obrolan terasa natural dan tidak terlihat ke-ai-ai-an.\n\n` +
            `[INSTRUKSI PENGGUNA]:\n`;

        const contextPrompt = aiRouter.buildContextForAntigravity(session.history, promptText);
        const fullPrompt = session.conversationId ? contextPrompt : `${systemPrefix}${contextPrompt}`;

        const cliArgs = [
            '--add-dir', process.cwd(),
            '--dangerously-skip-permissions',
            '--output-format', 'stream-json',
            '-p', fullPrompt
        ];

        if (session.conversationId) {
            cliArgs.unshift('--conversation', session.conversationId);
        }

        let child = null;
        try {
            child = spawn(agyPath, cliArgs, {
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    PATH: `${process.env.PATH}:/root/.local/bin:/usr/local/bin`
                }
            });
            taskState.childProcess = child;
        } catch (err) {
            activeTasks.delete(m.chat);
            return m.reply(`[ERROR] Gagal memulai proses Antigravity: ${err.message}`);
        }

        let lineBuffer = '';
        let finalResponseText = '';

        child.stdout.on('data', (chunk) => {
            lineBuffer += chunk.toString();
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                let eventObj = null;
                try {
                    eventObj = JSON.parse(trimmed);
                } catch (e) {
                    continue;
                }

                if (eventObj.event === 'init' && eventObj.conversation_id) {
                    session.conversationId = eventObj.conversation_id;
                }

                if (eventObj.event === 'step_update' && eventObj.step_update) {
                    const su = eventObj.step_update;

                    if (su.conversation_id && !session.conversationId) {
                        session.conversationId = su.conversation_id;
                    }

                    // Tangkap narasi berpikir / thought dari agen
                    if (su.step_type === 'agent_response' && su.text_delta) {
                        const delta = su.text_delta;
                        taskState.latestThought = (taskState.latestThought + delta).trim();
                        if (taskState.latestThought.length > 250) {
                            taskState.latestThought = taskState.latestThought.slice(-250);
                        }
                        scheduleLogUpdate(taskState);
                    }

                    // Tangkap eksekusi tool
                    if (su.step_type === 'tool' && su.tool_name) {
                        const actionDisplay = formatSimpleToolAction(su.tool_name, su.tool_info?.parameters);
                        const stepIndex = su.step_index;

                        let existingAction = taskState.actions.find(a => a.stepIndex === stepIndex);
                        if (!existingAction) {
                            existingAction = {
                                stepIndex,
                                toolName: su.tool_name,
                                display: actionDisplay,
                                state: su.state,
                                statusSymbol: '●'
                            };
                            taskState.actions.push(existingAction);
                        }

                        if (su.state === 'DONE') {
                            existingAction.state = 'DONE';
                            existingAction.statusSymbol = '✔';
                        } else if (su.state === 'ERROR') {
                            existingAction.state = 'ERROR';
                            existingAction.statusSymbol = '✖';
                        } else {
                            existingAction.state = 'ACTIVE';
                            existingAction.statusSymbol = '●';
                        }

                        scheduleLogUpdate(taskState);
                    }
                }

                if (eventObj.event === 'result' && eventObj.result) {
                    if (eventObj.result.conversation_id) {
                        session.conversationId = eventObj.result.conversation_id;
                    }
                    if (eventObj.result.response) {
                        finalResponseText = eventObj.result.response;
                    }
                }
            }
        });

        child.stderr.on('data', (chunk) => {
            const errStr = chunk.toString();
            if (errStr.includes('error') || errStr.includes('Error')) {
                console.error('[Antigravity Stderr]:', errStr);
            }
        });

        child.on('close', async (code) => {
            activeTasks.delete(m.chat);

            if (taskState.editTimeout) {
                clearTimeout(taskState.editTimeout);
                taskState.editTimeout = null;
            }

            // Finalisasi log terakhir pada pesan live logs pertama
            taskState.pendingApprovalReason = null;
            const finalKey = taskState.mainLogMsgKey || taskState.lastLogMsgKey;
            if (finalKey) {
                const finalRender = renderLiveLogText(taskState);
                try {
                    await bob.sendMessage(m.chat, {
                        text: finalRender || '● Selesai',
                        edit: finalKey
                    });
                } catch (e) {}
            }

            // Kirim respon akhir secara UTUH sebagai gelembung pesan chat biasa (BUKAN dokumen .txt)
            const outputToSend = (finalResponseText || '').trim();
            if (outputToSend) {
                aiRouter.recordTurn(m.chat, promptText, outputToSend, 'agy');
                await sendFullTextResponse(bob, m.chat, outputToSend, m);
            } else {
                if (code === 0) {
                    aiRouter.recordTurn(m.chat, promptText, 'Tugas telah selesai dilaksanakan.', 'agy');
                    await m.reply('Tugas telah selesai dilaksanakan.');
                } else {
                    await m.reply(`[Antigravity CLI keluar dengan kode status: ${code}]`);
                }
            }
        });

        child.on('error', (err) => {
            activeTasks.delete(m.chat);
            m.reply(`[ERROR] Gagal menjalankan Antigravity CLI: ${err.message}`);
        });
    }
};
