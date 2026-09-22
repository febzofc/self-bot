#!/usr/bin/env node
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
        'view_file', 'read_file', 'list_dir', 'grep_search', 'find_by_name',
        'search_web', 'read_url_content', 'read_resource',
        'list_resources', 'list_permissions', 'command_status',
        'manage_inbox', 'manage_task', 'wait', 'wait_5_seconds'
    ];

    if (autoAllowedTools.includes(toolName)) {
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
    }

    const candidatePortFiles = [
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
