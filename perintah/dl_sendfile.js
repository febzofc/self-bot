const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FileType = require('file-type');
const { spawn } = require('child_process');

/**
 * Helper to parse URL and optional caption from text
 * Supports: <url> [--cp|--c0|--caption <caption>]
 */
function parseInput(rawText) {
    if (!rawText) return { url: '', caption: '' };
    const text = rawText.trim();

    // Match flag at the end: <url> --cp <caption> or --c0 or --caption
    const flagEndMatch = text.match(/\s+--(?:cp|c0|caption)(?:\s+([\s\S]*))?$/i);
    if (flagEndMatch) {
        return {
            url: text.substring(0, flagEndMatch.index).trim().replace(/^[<"']+|[>"']+$/g, ''),
            caption: (flagEndMatch[1] || '').trim()
        };
    }

    // Match flag at the beginning: --cp <caption> <url>
    const flagStartMatch = text.match(/^--(?:cp|c0|caption)\s+([\s\S]*)$/i);
    if (flagStartMatch) {
        const remainder = flagStartMatch[1].trim();
        const urlMatch = remainder.match(/https?:\/\/[^\s]+/i);
        if (urlMatch) {
            const url = urlMatch[0];
            const caption = remainder.replace(url, '').trim();
            return {
                url: url.replace(/^[<"']+|[>"']+$/g, ''),
                caption
            };
        }
        return {
            url: remainder.replace(/^[<"']+|[>"']+$/g, ''),
            caption: ''
        };
    }

    // No flag present -> strictly leave caption empty as requested
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    return {
        url: (urlMatch ? urlMatch[0] : text).replace(/^[<"']+|[>"']+$/g, ''),
        caption: ''
    };
}

/**
 * Converts .mov to .mp4 using FFmpeg without lowering resolution
 */
function convertMovToMp4(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        // -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" ensures dimensions are even for yuv420p without downscaling or blurring
        const args = [
            '-y',
            '-i', inputPath,
            '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
            '-c:v', 'libx264',
            '-crf', '18',
            '-preset', 'veryfast',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            outputPath
        ];

        const ff = spawn('ffmpeg', args);
        let stderr = '';

        ff.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ff.on('error', (err) => {
            reject(err);
        });

        ff.on('close', (code) => {
            if (code === 0) {
                resolve(outputPath);
            } else {
                reject(new Error(`FFmpeg exit code ${code}: ${stderr.slice(-400)}`));
            }
        });
    });
}

module.exports = {
    CmD: ['sendfile'],
    aliases: ['sendfile', 'sf', 'kirimfile', 'sendurl'],
    categori: 'downloader',
    exec: async (m, { bob, prefix, command, text }) => {
        const { url, caption } = parseInput(text);

        if (!url || !/^https?:\/\//i.test(url)) {
            return m.reply(
                `📁 *SEND FILE DARI URL*\n\n` +
                `Fitur untuk mengunduh dan mengirimkan file dari URL langsung ke WhatsApp.\n\n` +
                `*Format Penggunaan:*\n` +
                `• *${prefix + command} <url-file>*\n` +
                `• *${prefix + command} <url-file> --cp <caption Anda>*\n\n` +
                `*Catatan:*\n` +
                `• Jika parameter *--cp* diisi, file akan dikirim dengan caption tersebut.\n` +
                `• Jika tidak ada *--cp*, caption akan dikosongkan.\n` +
                `• Video berformat *.MOV* akan otomatis dikonversi ke *.MP4* via FFmpeg tanpa menurunkan resolusi aslinya.\n\n` +
                `*Contoh:*\n` +
                `• *${prefix + command} https://example.com/video.mp4 --cp Anjay Caption*\n` +
                `• *${prefix + command} https://example.com/video.mov --cp Video MOV jernih*\n` +
                `• *${prefix + command} https://example.com/foto.jpg*`
            );
        }

        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const tempDownloadPath = path.join(tempDir, `raw_${uniqueId}`);
        let tempConvertedPath = null;

        await m.reply('_⏳ Sedang mengunduh file dari URL..._');

        try {
            // 1. Download file stream
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                },
                timeout: 120000,
                maxContentLength: 200 * 1024 * 1024 // 200 MB limit
            });

            // Write stream to temporary file
            await new Promise((resolve, reject) => {
                const writer = fs.createWriteStream(tempDownloadPath);
                response.data.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Check if file was saved properly and check size
            const stats = fs.statSync(tempDownloadPath);
            if (!stats || stats.size === 0) {
                return m.reply('❌ Gagal mengunduh file atau file yang diunduh kosong (0 byte).');
            }

            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            if (stats.size > 200 * 1024 * 1024) {
                return m.reply(`❌ File terlalu besar (${sizeMB} MB). Maksimal ukuran file adalah 200 MB.`);
            }

            // 2. Determine file details (MIME, Extension, Filename)
            const fileTypeResult = await FileType.fromFile(tempDownloadPath);
            const headerContentType = (response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();

            // Extract filename from Content-Disposition if available
            let fileName = '';
            const disposition = response.headers['content-disposition'];
            if (disposition && disposition.includes('filename')) {
                const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
                if (match && match[1]) {
                    fileName = decodeURIComponent(match[1].trim());
                }
            }

            if (!fileName) {
                try {
                    const parsedUrl = new URL(url);
                    fileName = path.basename(parsedUrl.pathname);
                } catch (_) {}
            }

            // Clean filename or set fallback
            if (!fileName || fileName === '/' || !fileName.includes('.')) {
                const fallbackExt = fileTypeResult?.ext || 'bin';
                fileName = `file_${Date.now()}.${fallbackExt}`;
            }

            // Check if file is MOV
            const isMov =
                fileTypeResult?.ext === 'mov' ||
                fileTypeResult?.mime === 'video/quicktime' ||
                headerContentType === 'video/quicktime' ||
                /\.mov$/i.test(fileName) ||
                /\.mov(\?.*)?$/i.test(url);

            let finalFilePath = tempDownloadPath;
            let mimeType = fileTypeResult?.mime || headerContentType || 'application/octet-stream';

            // 3. Convert MOV to MP4 if needed
            if (isMov) {
                await m.reply('_🔄 Video .MOV terdeteksi! Mengonversi ke .MP4 via FFmpeg tanpa menurunkan resolusi..._');
                tempConvertedPath = path.join(tempDir, `converted_${uniqueId}.mp4`);
                await convertMovToMp4(tempDownloadPath, tempConvertedPath);
                finalFilePath = tempConvertedPath;
                mimeType = 'video/mp4';
                fileName = fileName.replace(/\.mov$/i, '.mp4');
                if (!fileName.endsWith('.mp4')) fileName += '.mp4';
            }

            const fileBuffer = fs.readFileSync(finalFilePath);

            // 4. Send media according to detected type
            const isVideo = isMov || mimeType.startsWith('video/') || fileTypeResult?.mime?.startsWith('video/');
            const isImage = mimeType.startsWith('image/') || fileTypeResult?.mime?.startsWith('image/');
            const isAudio = mimeType.startsWith('audio/') || fileTypeResult?.mime?.startsWith('audio/');

            if (isVideo) {
                try {
                    const msgOptions = {
                        video: fileBuffer,
                        mimetype: 'video/mp4',
                        fileName: fileName
                    };
                    if (caption) msgOptions.caption = caption;

                    await bob.sendMessage(m.chat, msgOptions, { quoted: m });
                } catch (sendErr) {
                    // Fallback to document if WhatsApp rejects direct video streaming (e.g. large file)
                    const docOptions = {
                        document: fileBuffer,
                        mimetype: 'video/mp4',
                        fileName: fileName
                    };
                    if (caption) docOptions.caption = caption;

                    await bob.sendMessage(m.chat, docOptions, { quoted: m });
                }
            } else if (isImage) {
                const msgOptions = {
                    image: fileBuffer,
                    mimetype: mimeType
                };
                if (caption) msgOptions.caption = caption;

                await bob.sendMessage(m.chat, msgOptions, { quoted: m });
            } else if (isAudio) {
                await bob.sendMessage(m.chat, {
                    audio: fileBuffer,
                    mimetype: mimeType,
                    ptt: false
                }, { quoted: m });

                // Audio format in WhatsApp doesn't display captions inline; send caption as text reply if provided
                if (caption) {
                    await bob.sendMessage(m.chat, { text: caption }, { quoted: m });
                }
            } else {
                // Send as general document
                const docOptions = {
                    document: fileBuffer,
                    mimetype: mimeType,
                    fileName: fileName
                };
                if (caption) docOptions.caption = caption;

                await bob.sendMessage(m.chat, docOptions, { quoted: m });
            }

        } catch (error) {
            console.error('Error in sendfile plugin:', error);
            return m.reply(`❌ Terjadi kesalahan saat memproses file:\n${error.message || error}`);
        } finally {
            // Clean up temporary files
            try {
                if (fs.existsSync(tempDownloadPath)) fs.unlinkSync(tempDownloadPath);
            } catch (_) {}
            try {
                if (tempConvertedPath && fs.existsSync(tempConvertedPath)) fs.unlinkSync(tempConvertedPath);
            } catch (_) {}
        }
    }
};
