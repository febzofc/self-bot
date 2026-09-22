const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Antigravity CLI Bridge & Session Manager
 * Full features:
 * 1. Multi-turn session per chat (Owner only)
 * 2. PreToolUse approval gatekeeper (tanpa --dangerously-skip-permissions secara liar)
 * 3. Live log updates using WhatsApp message edit (● Read(...), ✔ Read(...), etc.)
 * 4. Approval request: pesan lama difinalisasi, kirim pesan konfirmasi baru, lalu pesan log baru
 * 5. /btw slash command support during ongoing tasks
 * 6. Auto-detect & auto-setup on any VPS / device
 */

// Port bridge internal
const DEFAULT_BRIDGE_PORT = 39281;
let activeBridgePort = DEFAULT_BRIDGE_PORT;
let bridgeServer = null;

// Sesi per chat: { conversationId, isInteractive, lastActive }
const sessions = new Map();

// Task yang sedang berjalan per chat:
// Key: chatId -> { childProcess, prompt, startTime, actions, lastLogMsgKey, currentLogText, pendingApproval, bob, chatId, editTimeout }
const activeTasks = new Map();

/**
 * Deteksi path binary agy di sistem
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
 * Auto-Setup folder .agents, hooks.json, dan gatekeeper.js jika belum ada
 */
function ensureAgentHooks() {
    const agentsDir = path.join(process.cwd(), '.agents');
    const hooksDir = path.join(agentsDir, 'hooks');

    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hooksJsonPath = path.join(agentsDir, 'hooks.json');
    const hooksConfig = {
        "permission-gate": {
            "PreToolUse": [
                {
                    "matcher": "*",
                    "hooks": [
                        {
                            "command": "node .agents/hooks/gatekeeper.js",
                            "timeout": 130
                        }
                    ]
                }
            ]
        }
    };
    fs.writeFileSync(hooksJsonPath, JSON.stringify(hooksConfig, null, 2), 'utf8');

    const gatekeeperPath = path.join(hooksDir, 'gatekeeper.js');
    const gatekeeperCode = `#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

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

    const autoAllowedTools = [
        'view_file', 'list_dir', 'grep_search', 'find_by_name',
        'search_web', 'read_url_content', 'read_resource',
        'list_resources', 'list_permissions', 'command_status',
        'manage_inbox', 'manage_task', 'wait', 'wait_5_seconds'
    ];

    if (autoAllowedTools.includes(toolName)) {
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
    }

    let targetPort = 39281;
    const portFilePath = path.join(__dirname, '../.bridge_port');
    try {
        if (fs.existsSync(portFilePath)) {
            const savedPort = parseInt(fs.readFileSync(portFilePath, 'utf8').trim(), 10);
            if (!isNaN(savedPort) && savedPort > 0) targetPort = savedPort;
        }
    } catch (e) {}

    const postData = JSON.stringify({
        toolName,
        toolArgs,
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
                console.log(JSON.stringify({ decision: 'deny', reason: 'Format jawaban bridge tidak valid' }));
            }
            process.exit(0);
        });
    });

    req.on('error', (err) => {
        console.log(JSON.stringify({ decision: 'deny', reason: 'Bot WhatsApp Permission Bridge offline: ' + err.message }));
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
    fs.writeFileSync(gatekeeperPath, gatekeeperCode, { mode: 0o755 });
}

/**
 * Jalankan HTTP Bridge Server untuk menerima request persetujuan dari gatekeeper hook
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
            // Port bentrok, pilih port acak bebas
            bridgeServer.listen(0, '127.0.0.1');
        } else {
            console.error('Antigravity Bridge Server Error:', err);
        }
    });

    bridgeServer.listen(DEFAULT_BRIDGE_PORT, '127.0.0.1', () => {
        activeBridgePort = bridgeServer.address().port;
        bridgeServer.unref();
        const portFilePath = path.join(process.cwd(), '.agents', '.bridge_port');
        try {
            fs.writeFileSync(portFilePath, activeBridgePort.toString(), 'utf8');
        } catch (e) {}
    });
}

// Start bridge saat plugin pertama kali dimuat
startBridgeServer();

/**
 * Format nama tool dan argumen agar terbaca ringkas di chat
 */
function shortenPath(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const home = os.homedir();
    if (filePath.startsWith(home)) {
        return filePath.replace(home, '~');
    }
    return filePath;
}

function formatToolAction(toolName, params) {
    params = params || {};
    switch (toolName) {
        case 'view_file':
            return `Read(${shortenPath(params.AbsolutePath || '')})`;
        case 'write_to_file':
            return `Write(${shortenPath(params.TargetFile || '')})`;
        case 'replace_file_content':
        case 'multi_replace_file_content':
            return `Edit(${shortenPath(params.TargetFile || '')})`;
        case 'run_command':
            const cmd = (params.CommandLine || '').trim();
            const shortCmd = cmd.length > 35 ? cmd.slice(0, 32) + '...' : cmd;
            return `Bash(${shortCmd})`;
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

function formatToolDetailedDescription(toolName, params) {
    params = params || {};
    switch (toolName) {
        case 'run_command':
            return `• *Aksi:* Menjalankan Perintah Terminal (Bash)\n• *Command:* \`\`\`${params.CommandLine || '-'}\`\`\``;
        case 'write_to_file':
            return `• *Aksi:* Membuat / Menulis File Baru\n• *Target File:* \`${params.TargetFile || '-'}\`\n• *Keterangan:* ${params.Description || '-'}`;
        case 'replace_file_content':
        case 'multi_replace_file_content':
            return `• *Aksi:* Mengedit File\n• *Target File:* \`${params.TargetFile || '-'}\`\n• *Instruksi:* ${params.Instruction || params.Description || '-'}`;
        default:
            return `• *Tool:* \`${toolName}\`\n• *Parameter:* \`\`\`${JSON.stringify(params, null, 2)}\`\`\``;
    }
}

/**
 * Handle request persetujuan dari hook gatekeeper
 */
async function handleIncomingPermissionRequest(data, res) {
    // Cari task yang sedang aktif
    let targetTask = null;
    for (const [chatId, task] of activeTasks.entries()) {
        if (task) {
            targetTask = task;
            break;
        }
    }

    if (!targetTask) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ decision: 'deny', reason: 'Tidak ada task WhatsApp aktif yang meminta persetujuan' }));
    }

    const { bob, chatId } = targetTask;

    // 1. Finalisasi pesan log yang sedang diedit sebelumnya (dianggap sudah selesai untuk fase ini)
    if (targetTask.lastLogMsgKey) {
        const finalizedLog = (targetTask.currentLogText || '').trim() + '\n\n⏸️ _[Menunggu Persetujuan Owner]_';
        try {
            await bob.sendMessage(chatId, {
                text: finalizedLog,
                edit: targetTask.lastLogMsgKey
            });
        } catch (e) {}
        targetTask.lastLogMsgKey = null; // Tutup kanvas edit sebelumnya
    }

    // 2. Kirim PESAN BARU untuk konfirmasi persetujuan
    const toolDetails = formatToolDetailedDescription(data.toolName, data.toolArgs);
    const approvalPrompt = 
        `⚠️ *Persetujuan Diperlukan!*\n` +
        `─────────────────────────────\n` +
        `${toolDetails}\n\n` +
        `👉 *Ketik:* \n` +
        `• *Y* / *Yes* untuk Mengizinkan\n` +
        `• *N* / *No* untuk Menolak\n\n` +
        `⏱️ _Batas waktu: 2 menit_`;

    let sentApprovalMsg = null;
    try {
        sentApprovalMsg = await bob.sendMessage(chatId, { text: approvalPrompt });
    } catch (e) {
        console.error('Gagal mengirim pesan persetujuan:', e);
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
                            text: `⏱️ *Waktu Persetujuan Habis.* Aksi otomatis dibatalkan oleh sistem.`,
                            edit: sentApprovalMsg.key
                        });
                    } catch (e) {}
                }
                targetTask.pendingApproval = null;
            }
        }, 120000)
    };
}

/**
 * Debounced live log message edit
 */
function scheduleLogUpdate(task) {
    if (!task || !task.lastLogMsgKey) return;
    if (task.editTimeout) return;

    task.editTimeout = setTimeout(async () => {
        task.editTimeout = null;
        if (!task.lastLogMsgKey) return;

        const maxRecent = 7;
        const recentActions = task.actions.slice(-maxRecent);
        const header = `⚙️ *Antigravity Task:* ${task.prompt.length > 70 ? task.prompt.slice(0, 67) + '...' : task.prompt}\n─────────────────────────────\n`;
        const body = recentActions.map(a => `${a.statusSymbol} ${a.display}`).join('\n');
        const text = header + (body || '● Memproses...');

        task.currentLogText = text;

        try {
            await task.bob.sendMessage(task.chatId, {
                text: text,
                edit: task.lastLogMsgKey
            });
        } catch (e) {
            // Abaikan rate limit / network transient error
        }
    }, 750);
}

module.exports = {
    CmD: ['agy', 'antigravity', 'btw'],
    aliases: ['agy', 'antigravity', 'btw'],
    categori: 'owner tools',

    /**
     * Hook before: Menangani interaksi persetujuan (Y/N), /btw, dan sesi chat tanpa prefix
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

                if (isYes) {
                    try {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ decision: 'allow' }));
                    } catch (e) {}

                    if (approvalMsgKey) {
                        try {
                            await bob.sendMessage(m.chat, {
                                text: `✅ *Aksi Diizinkan.* Melanjutkan eksekusi task...`,
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
                                text: `🚫 *Aksi Ditolak.* Antigravity melanjutkan tanpa mengeksekusi aksi ini.`,
                                edit: approvalMsgKey
                            });
                        } catch (e) {}
                    }
                }

                // Kirim PESAN BARU untuk melanjutkan live logs berikutnya!
                try {
                    const newLogMsg = await bob.sendMessage(m.chat, {
                        text: `⚙️ *Melanjutkan Log Antigravity:*\n─────────────────────────────\n● Memproses lanjutan...`
                    });
                    activeTask.lastLogMsgKey = newLogMsg.key;
                    activeTask.currentLogText = `⚙️ *Melanjutkan Log Antigravity:*\n─────────────────────────────\n`;
                } catch (e) {
                    console.error('Gagal mengirim pesan log lanjutan:', e);
                }

                return true; // Berhasil ditangani
            }
        }

        // 2. FITUR /BTW (Interupsi / Tanya Status Task Berjalan)
        if (/^(\/|\.)?btw(\s|$)/i.test(text)) {
            const query = text.replace(/^(\/|\.)?btw\s*/i, '').trim();

            if (!activeTask) {
                const sess = sessions.get(m.chat);
                return m.reply(
                    `ℹ️ *Tidak Ada Task Antigravity yang Sedang Berjalan*\n\n` +
                    `• *ID Percakapan:* ${sess?.conversationId ? `\`${sess.conversationId}\`` : 'Belum dimulai'}\n` +
                    `• *Mode Interaktif:* ${sess?.isInteractive ? '✅ Aktif' : '❌ Nonaktif'}\n\n` +
                    `Untuk memulai tugas baru:\n` +
                    `👉 *${prefix}agy <instruksi Anda>*\n` +
                    `👉 *${prefix}agy --sesi* (untuk chat interaktif tanpa prefix)`
                );
            }

            const elapsedSec = Math.floor((Date.now() - activeTask.startTime) / 1000);
            const totalActions = activeTask.actions.length;
            const lastAction = totalActions > 0 ? activeTask.actions[totalActions - 1] : null;
            const currentStatusDesc = lastAction ? `${lastAction.statusSymbol} ${lastAction.display}` : 'Menganalisis prompt...';

            if (query) {
                let btwResponse =
                    `🔍 *Jawaban /btw:*\n` +
                    `• *Pertanyaan Anda:* "${query}"\n` +
                    `• *Tugas Berjalan:* ${activeTask.prompt}\n` +
                    `• *Durasi:* ${elapsedSec} detik (${totalActions} aksi dilakukan)\n` +
                    `• *Langkah Saat Ini:* ${currentStatusDesc}\n`;

                if (activeTask.pendingApproval) {
                    btwResponse += `\n⚠️ *Catatan:* Saat ini task sedang dijeda menunggu persetujuan Anda (Ketik Y/N).`;
                }

                return m.reply(btwResponse);
            } else {
                let overview =
                    `🔍 *Status Task Antigravity (/btw)*\n` +
                    `─────────────────────────────\n` +
                    `• *Instruksi:* ${activeTask.prompt}\n` +
                    `• *Durasi Berjalan:* ${elapsedSec} detik\n` +
                    `• *Langkah Saat Ini:* ${currentStatusDesc}\n` +
                    `• *Total Aksi:* ${totalActions} langkah\n` +
                    `• *Status Approval:* ${activeTask.pendingApproval ? '⏸️ Menunggu Persetujuan Anda (Y/N)' : '⚡ Berjalan Normal'}\n\n` +
                    `_Riwayat Langkah Terakhir:_\n` +
                    (activeTask.actions.slice(-5).map(a => `${a.statusSymbol} ${a.display}`).join('\n') || '_(Belum ada aksi)_');

                return m.reply(overview);
            }
        }

        // 3. SESI INTERAKTIF (Chat tanpa prefix jika mode --sesi aktif)
        const session = sessions.get(m.chat);
        if (session && session.isInteractive && !isCmd && !text.startsWith('.')) {
            // Teruskan ke runner eksekusi
            module.exports.executeTask(bob, m, text, { isCreator: true, prefix });
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
            return m.reply('❌ Perintah ini terhubung langsung ke Antigravity CLI dan hanya dapat digunakan oleh Owner.');
        }

        // Jika dipanggil via alias .btw
        if (command === 'btw') {
            return module.exports.before(m, { bob, budy: `/btw ${text}`, isCreator: true, prefix });
        }

        const cleanText = (text || '').trim();

        // 1. Tampilkan panduan jika tanpa argumen
        if (!cleanText) {
            const sess = sessions.get(m.chat);
            return m.reply(
                `🤖 *Antigravity CLI Controller*\n` +
                `─────────────────────────────\n` +
                `*Perintah Dasar:*\n` +
                `• *${prefix + command} <instruksi>*\n` +
                `  _Contoh: ${prefix + command} periksa error pada control.js_\n\n` +
                `*Sistem Sesi:*\n` +
                `• *${prefix + command} --sesi*\n` +
                `  _Masuk ke mode percakapan interaktif (bisa chat tanpa prefix)._\n\n` +
                `• *${prefix + command} --stop*\n` +
                `  _Mengakhiri mode sesi percakapan interaktif._\n\n` +
                `• *${prefix + command} --reset*\n` +
                `  _Reset memory konteks obrolan (mulai obrolan baru)._\n\n` +
                `*Fitur Monitoring:*\n` +
                `• */btw* atau *${prefix}btw*\n` +
                `  _Cek status live progress task yang sedang berjalan._\n\n` +
                `• */btw <pertanyaan>*\n` +
                `  _Tanya perkembangan task di tengah-tengah proses._\n\n` +
                `🔒 *Keamanan:* Setiap perintah sistem/file akan meminta konfirmasi persetujuan (Y/N) ke WhatsApp Anda.\n` +
                `📊 *Status Sesi Saat Ini:* ${sess?.conversationId ? `\`${sess.conversationId.slice(0, 8)}...\`` : 'Belum aktif'}`
            );
        }

        // 2. Mode Kontrol Sesi
        if (cleanText === '--stop') {
            const sess = sessions.get(m.chat);
            if (sess) sess.isInteractive = false;
            return m.reply('🛑 *Sesi Interaktif Antigravity Dinonaktifkan.*\nSekarang Anda perlu menggunakan prefix untuk memanggil bot.');
        }

        if (cleanText === '--reset') {
            sessions.delete(m.chat);
            return m.reply('🔄 *Konteks Percakapan Direset.*\nPercakapan berikutnya akan dimulai sebagai sesi baru yang segar.');
        }

        if (cleanText.startsWith('--sesi')) {
            let sess = sessions.get(m.chat);
            if (!sess) {
                sess = { conversationId: null, isInteractive: true };
                sessions.set(m.chat, sess);
            } else {
                sess.isInteractive = true;
            }

            const initialPrompt = cleanText.replace('--sesi', '').trim();
            if (initialPrompt) {
                await m.reply('🤖 *Sesi Interaktif Aktif!*\n_Memproses instruksi pertama Anda..._');
                return module.exports.executeTask(bob, m, initialPrompt, { isCreator: true, prefix });
            } else {
                return m.reply(
                    `🤖 *Sesi Interaktif Antigravity Dimulai!*\n\n` +
                    `• Anda dapat langsung mengirim pesan coding atau perintah *(tanpa prefix)*.\n` +
                    `• Gunakan */btw* untuk memantau progres tugas yang sedang berlangsung.\n` +
                    `• Ketik *${prefix + command} --stop* untuk keluar dari sesi interaktif.\n` +
                    `• Ketik *${prefix + command} --reset* untuk mereset riwayat sesi.`
                );
            }
        }

        // 3. Jalankan Task Biasa
        return module.exports.executeTask(bob, m, cleanText, { isCreator: true, prefix });
    },

    /**
     * Eksekutor Utama Antigravity Task
     */
    executeTask: async (bob, m, promptText, { isCreator, prefix }) => {
        // Cek binary agy
        const agyPath = findAgyBinary();
        if (!agyPath) {
            return m.reply(
                `❌ *Antigravity CLI Belum Terinstall / Ditemukan!*\n\n` +
                `Perangkat atau VPS ini belum memiliki binary Antigravity CLI (\`agy\`).\n\n` +
                `📌 *Langkah Instalasi di VPS:*\n` +
                `1. Pastikan Antigravity CLI terpasang di sistem:\n` +
                `   Panduan: https://antigravity.google/docs/cli/reference\n` +
                `2. Pastikan binary \`agy\` dapat diakses via PATH (\`~/.local/bin/agy\` atau \`/usr/local/bin/agy\`).\n` +
                `3. Buka terminal VPS dan jalankan perintah \`agy\` sekali untuk login / autentikasi akun Google.\n\n` +
                `Setelah selesai, ketik kembali perintah *.agy* di sini.`
            );
        }

        // Pastikan tidak ada task ganda di chat yang sama
        if (activeTasks.has(m.chat)) {
            return m.reply('⏳ Masih ada tugas Antigravity yang sedang diproses di chat ini. Gunakan */btw* untuk melihat progresnya.');
        }

        // Pastikan folder hooks dan bridge server siap
        startBridgeServer();

        // Ambil atau inisialisasi sesi
        let session = sessions.get(m.chat);
        if (!session) {
            session = { conversationId: null, isInteractive: false };
            sessions.set(m.chat, session);
        }

        // Kirim pesan live log pertama
        let initLogMsg = null;
        try {
            initLogMsg = await bob.sendMessage(m.chat, {
                text: `⚙️ *Antigravity Task:* ${promptText.length > 70 ? promptText.slice(0, 67) + '...' : promptText}\n─────────────────────────────\n● Memulai inisialisasi agent...`
            });
        } catch (e) {
            console.error('Gagal mengirim pesan log awal:', e);
        }

        // Siapkan state task aktif
        const taskState = {
            childProcess: null,
            prompt: promptText,
            startTime: Date.now(),
            actions: [],
            lastLogMsgKey: initLogMsg ? initLogMsg.key : null,
            currentLogText: '',
            pendingApproval: null,
            bob,
            chatId: m.chat,
            editTimeout: null
        };
        activeTasks.set(m.chat, taskState);

        // Susun argumen CLI
        // Catatan: kita sertakan --dangerously-skip-permissions pada level CLI
        // AGAR mesin headless agy TIDAK langsung men-denied tool di latar belakang,
        // KARENA kontrol persetujuan sepenuhnya dipegang oleh PreToolUse Hook (.agents/hooks/gatekeeper.js)
        // yang terhubung langsung ke WhatsApp Anda!
        const cliArgs = [
            '--dangerously-skip-permissions',
            '--output-format', 'stream-json',
            '-p', promptText
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
            return m.reply(`❌ Gagal memulai proses Antigravity: ${err.message}`);
        }

        let lineBuffer = '';
        let finalResponseText = '';

        child.stdout.on('data', (chunk) => {
            lineBuffer += chunk.toString();
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop(); // Sisa buffer yang belum genap 1 baris

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                let eventObj = null;
                try {
                    eventObj = JSON.parse(trimmed);
                } catch (e) {
                    continue;
                }

                // 1. Simpan conversation ID saat init
                if (eventObj.event === 'init' && eventObj.conversation_id) {
                    session.conversationId = eventObj.conversation_id;
                }

                // 2. Parsing Step Updates
                if (eventObj.event === 'step_update' && eventObj.step_update) {
                    const su = eventObj.step_update;

                    if (su.conversation_id && !session.conversationId) {
                        session.conversationId = su.conversation_id;
                    }

                    if (su.step_type === 'tool' && su.tool_name) {
                        const actionDisplay = formatToolAction(su.tool_name, su.tool_info?.parameters);
                        const stepIndex = su.step_index;

                        // Cari apakah aksi ini sudah ada di daftar
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

                // 3. Simpan Hasil Akhir
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
            // Tangani error jika ada
            const errStr = chunk.toString();
            if (errStr.includes('error') || errStr.includes('Error')) {
                console.error('[Antigravity Stderr]:', errStr);
            }
        });

        child.on('close', async (code) => {
            activeTasks.delete(m.chat);

            // Bersihkan timer pending jika ada
            if (taskState.editTimeout) {
                clearTimeout(taskState.editTimeout);
                taskState.editTimeout = null;
            }

            // Finalisasi pesan log
            if (taskState.lastLogMsgKey) {
                const maxRecent = 7;
                const recentActions = taskState.actions.slice(-maxRecent);
                const header = `⚙️ *Antigravity Task:* ${taskState.prompt.length > 70 ? taskState.prompt.slice(0, 67) + '...' : taskState.prompt}\n─────────────────────────────\n`;
                const body = recentActions.map(a => `${a.statusSymbol} ${a.display}`).join('\n');
                const completionStatus = code === 0 ? '✅ *Semua Langkah Selesai!*' : `⚠️ *Proses Berhenti (Exit Code: ${code})*`;
                const finalText = header + (body || '● Selesai') + `\n─────────────────────────────\n${completionStatus}`;

                try {
                    await bob.sendMessage(m.chat, {
                        text: finalText,
                        edit: taskState.lastLogMsgKey
                    });
                } catch (e) {}
            }

            // Kirim jawaban hasil dari agent ke WhatsApp
            const outputToSend = (finalResponseText || '').trim();
            if (outputToSend) {
                if (outputToSend.length > 4000) {
                    const tempFilePath = path.join('/tmp', `agy_response_${Date.now()}.txt`);
                    fs.writeFileSync(tempFilePath, outputToSend, 'utf8');

                    try {
                        await bob.sendMessage(m.chat, {
                            document: fs.readFileSync(tempFilePath),
                            mimetype: 'text/plain',
                            fileName: 'antigravity_result.txt',
                            caption: `🤖 *Hasil Antigravity Task*\nOutput respon terlalu panjang (${outputToSend.length} karakter), dikirimkan sebagai file dokumen.`
                        }, { quoted: m });
                    } catch (e) {
                        await m.reply(outputToSend.slice(0, 3900) + '\n\n_(Respon terpotong karena batas karakter WhatsApp)_');
                    }

                    try { fs.unlinkSync(tempFilePath); } catch (e) {}
                } else {
                    await m.reply(`🤖 *Antigravity:*\n\n${outputToSend}`);
                }
            } else {
                if (code === 0) {
                    await m.reply('🤖 *Antigravity:* Tugas telah selesai dilaksanakan tanpa output teks tambahan.');
                } else {
                    await m.reply(`⚠️ Antigravity CLI keluar dengan kode error: ${code}.`);
                }
            }
        });

        child.on('error', (err) => {
            activeTasks.delete(m.chat);
            m.reply(`❌ Gagal menjalankan Antigravity CLI: ${err.message}`);
        });
    }
};
