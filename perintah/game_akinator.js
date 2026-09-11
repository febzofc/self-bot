const fs = require('fs');
const path = require('path');
const util = require('util');
const { execFile } = require('child_process');
const execFilePromise = util.promisify(execFile);
const { getBuffer } = require('../lib/fungsi.js');
const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const { UploadFileUgu, UploadZetnata } = require('../lib/scrapers/uploader.js');

const assetDir = path.join(__dirname, '../src/asset');

// In-memory session tracking
global.akinatorSessions = global.akinatorSessions || {};
const akinator = global.akinatorSessions;

/**
 * Wrapper class untuk Akinator API.
 * Mendukung akinator-client (bebas blokir Cloudflare dengan TLS fingerprint)
 * serta fallback ke aki-api jika diperlukan.
 */
class AkiWrapper {
    constructor({ region = 'id', childMode = false } = {}) {
        this.region = region;
        this.childMode = childMode;
        this.currentStep = 0;
        this.progress = 0;
        this.question = '';
        this.guess = undefined;
        this.client = null;
        this.legacyAki = null;
    }

    async start() {
        try {
            const { AkinatorClient } = require('akinator-client');
            this.client = new AkinatorClient({
                language: this.region === 'id' ? 'id' : this.region,
                childMode: !!this.childMode
            });
            await this.client.start();
            this._syncClient();
            return this;
        } catch (e) {
            try {
                const { Aki } = require('aki-api');
                this.legacyAki = new Aki({ region: this.region, childMode: this.childMode });
                await this.legacyAki.start();
                this._syncLegacy();
                return this;
            } catch (errLegacy) {
                throw e || errLegacy;
            }
        }
    }

    async step(answer) {
        if (this.client) {
            await this.client.answer(answer);
            this._syncClient();
            return this;
        } else if (this.legacyAki) {
            await this.legacyAki.step(answer);
            this._syncLegacy();
            return this;
        }
        throw new Error('Sesi Akinator belum dimulai.');
    }

    async back() {
        if (this.client) {
            await this.client.back();
            this._syncClient();
            return this;
        } else if (this.legacyAki) {
            await this.legacyAki.back();
            this._syncLegacy();
            return this;
        }
        throw new Error('Sesi Akinator belum dimulai.');
    }

    _syncClient() {
        this.currentStep = this.client.step;
        this.progress = typeof this.client.progression === 'number' ? this.client.progression : 0;
        this.question = this.client.question || '';
        if (this.client.won && this.client.winResult) {
            this.guess = {
                name_proposition: this.client.winResult.name,
                description_proposition: this.client.winResult.description,
                photo: this.client.winResult.pictureUrl
            };
        } else {
            this.guess = undefined;
        }
    }

    _syncLegacy() {
        this.currentStep = this.legacyAki.currentStep;
        this.progress = typeof this.legacyAki.progress === 'number' ? this.legacyAki.progress : 0;
        this.question = this.legacyAki.question || '';
        this.guess = this.legacyAki.guess;
    }
}

/*<--------------------( Helper Functions )--------------------->*/

function generateRandomUrl() {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var url = 'https://ini-buat-fake-preview.net/';

    for (var i = 0; i < 10; i++) {
        var randomIndex = Math.floor(Math.random() * chars.length);
        url += chars[randomIndex];
    }

    return url;
}

function getRandomImage() {
    var min = 1;
    var max = 7;
    var randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    return path.join(assetDir, 'aki' + randomNumber + '.png');
}

function wrapText(text__, maxLength) {
    if (!text__) return '';
    if (text__.length <= maxLength) {
        return text__;
    } else {
        var wrappedText = '';
        var words = text__.split(' ');
        var lineLength = 0;

        words.forEach(function(word) {
            if ((lineLength + word.length) > maxLength) {
                wrappedText += '\n' + word + ' ';
                lineLength = word.length + 1;
            } else {
                wrappedText += word + ' ';
                lineLength += word.length + 1;
            }
        });

        return wrappedText.trim();
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateQuestionImage(question, outputPath, akiImg = null) {
    const selectedAki = akiImg || getRandomImage();
    const wrappedQ = wrapText(question, 40);
    await execFilePromise('convert', [
        path.join(assetDir, 'akinator_bg.jpg'),
        selectedAki,
        '-gravity', 'west',
        '-fill', '#FFFFFF',
        '-font', path.join(assetDir, 'Santuy.otf'),
        '-size', '1280x720',
        '-pointsize', '52',
        '-annotate', '+475-235', wrappedQ,
        '-gravity', 'center',
        '-composite',
        outputPath
    ]);
}

async function generateFinishImage(jawabanImgPath, characterName, outputPath) {
    await execFilePromise('convert', [
        path.join(assetDir, 'akinator_bg_finish.jpg'),
        '(', jawabanImgPath, '-resize', '300x485', ')',
        '-gravity', 'center',
        '-geometry', '+200+20',
        '-composite',
        '-font', path.join(assetDir, 'Santuy.otf'),
        '-pointsize', '45',
        '-fill', 'white',
        '-annotate', '+200-255', characterName || 'Tebakan Akinator',
        path.join(assetDir, 'aki7.png'),
        '-gravity', 'center',
        '-composite',
        outputPath
    ]);
}

async function uploadToUrl(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        const res = await UploadFileUgu(filePath);
        if (res?.url) return res.url;
    } catch (e) {}
    try {
        const res = await UploadZetnata(filePath);
        if (res?.rawUrl || res?.downloadUrl) return res.rawUrl || res.downloadUrl;
    } catch (e) {}
    return null;
}

/**
 * Mengirim pesan preview link Akinator dengan alur persis search_lyrics.js:
 * 1. Upload media lokal ke URL hosting
 * 2. Ambil buffer dari URL online dengan getBuffer
 * 3. Upload ke server WhatsApp via prepareWAMessageMedia (thumbnail-link)
 * 4. Matched-text dan target link dialihkan ke GitHub owner (global.sourceUrl)
 */
async function sendAkinatorPreview(conn, chat, text, title, body, imgPathOrBuf, quoted) {
    const targetUrl = global.sourceUrl || 'https://github.com/febzofc/self-bot';

    // 1. Upload media lokal menjadi URL terlebih dahulu
    let uploadedUrl = null;
    if (typeof imgPathOrBuf === 'string' && fs.existsSync(imgPathOrBuf)) {
        uploadedUrl = await uploadToUrl(imgPathOrBuf);
    }

    // 2. Ambil buffer dari URL hasil upload (fallback ke buffer lokal jika perlu)
    let rawBuf = null;
    if (uploadedUrl) {
        try {
            let buf = await getBuffer(uploadedUrl);
            if (Buffer.isBuffer(buf)) {
                rawBuf = buf;
            }
        } catch (e) {
            console.error('Error fetching buffer from uploaded URL:', e);
        }
    }
    if (!rawBuf) {
        if (Buffer.isBuffer(imgPathOrBuf)) {
            rawBuf = imgPathOrBuf;
        } else if (typeof imgPathOrBuf === 'string' && fs.existsSync(imgPathOrBuf)) {
            rawBuf = fs.readFileSync(imgPathOrBuf);
        }
    }

    // 3. Upload ke server WhatsApp menggunakan prepareWAMessageMedia & waUploadToServer
    let imgMsg = null;
    if (rawBuf && conn?.waUploadToServer) {
        try {
            let resMedia = await prepareWAMessageMedia(
                { image: rawBuf },
                { upload: conn.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
            );
            if (resMedia?.imageMessage) {
                imgMsg = resMedia.imageMessage;
            }
        } catch (e) {
            console.error('Error prepareWAMessageMedia link preview for Akinator:', e);
        }
    }

    // 4. Susun linkPreview persis seperti search_lyrics.js
    let linkPreview = {
        'matched-text': targetUrl,
        title: title,
        description: body,
        jpegThumbnail: imgMsg?.jpegThumbnail
            ? Buffer.from(imgMsg.jpegThumbnail)
            : (rawBuf || undefined),
        highQualityThumbnail: imgMsg
            ? {
                ...imgMsg,
                width: 1280,
                height: 720,
            }
            : undefined,
    };

    // 5. Kirim pesan dengan format targetUrl di awal teks & linkPreview
    return await conn.sendMessage(chat, {
        text: `${targetUrl}\n\n` + text.trim(),
        linkPreview
    }, {
        quoted
    });
}

module.exports = {
    CmD: ['akinator'],
    aliases: ['akinator', 'aki', 'berhenti', 'cencelakinator', 'cancelakinator', 'delsesiakinator'],
    categori: 'game',
    desc: '🧙 Game Akinator: Bot akan menebak tokoh yang kamu pikirkan!',

    /**
     * Hook before: Menangani jawaban interaktif angka 1-6 dan pembatalan sesi
     */
    before: async (m, { bob, body, budy, isCmd }) => {
        if (!m || m.isBaileys || m.fromMe) return false;

        const chat = m.chat;
        const sender = m.sender;
        const sessionPath = path.join(__dirname, '../src/' + chat + '.json');

        if (!fs.existsSync(sessionPath)) return false;
        if (!akinator[sender]) return false;

        const text = (budy || body || '').trim();
        const cleanText = text.toLowerCase().replace(/^[#.!❗\s]+/, '').trim();

        // Cek jika pengguna ingin menghentikan permainan
        if (['berhenti', 'cencelakinator', 'cancelakinator', 'delsesiakinator', 'stop', 'batal'].includes(cleanText)) {
            delete akinator[sender];
            try {
                if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
            } catch (e) {}
            await m.reply('Anda mengakhiri permainan');
            return true;
        }

        // Cek jawaban angka 1-6
        if (!isCmd && ['0', '1', '2', '3', '4', '5', '6'].includes(cleanText)) {
            const ans = Math.floor(Number(cleanText));
            if (ans > 0 && ans < 7) {
                const conn = bob || m.conn || global.conn;
                const safeSender = sender.replace(/[^a-zA-Z0-9]/g, '_');
                const tempQImg = path.join(__dirname, `../src/aki_${safeSender}.jpg`);
                const tempAnsImg = path.join(__dirname, `../src/jawaban_aki_${safeSender}.jpg`);
                const tempEndImg = path.join(__dirname, `../src/akinator_${safeSender}_end.jpg`);

                try {
                    if (ans === 6) {
                        if (akinator[sender].currentStep === 0) {
                            await m.reply('anda blum menjawab pertanyaan apapun');
                            return true;
                        }
                        await akinator[sender].back();
                    } else {
                        await akinator[sender].step(ans - 1);
                    }

                    // Jika Akinator sudah berhasil menebak
                    if (akinator[sender].guess !== undefined) {
                        const guess = akinator[sender].guess;
                        try {
                            let photoUrl = guess.photo;
                            let jawaban_akinator = null;
                            if (photoUrl && /^https?:\/\//.test(photoUrl)) {
                                jawaban_akinator = await getBuffer(photoUrl).catch(() => null);
                            }
                            if (!Buffer.isBuffer(jawaban_akinator) || jawaban_akinator.length === 0) {
                                jawaban_akinator = fs.readFileSync(path.join(assetDir, 'aki7.png'));
                            }
                            fs.writeFileSync(tempAnsImg, jawaban_akinator);
                            await sleep(500);

                            await generateFinishImage(tempAnsImg, guess.name_proposition, tempEndImg);
                        } catch (err) {
                            console.error('Error saat membuat gambar akhir Akinator:', err);
                        }

                        await sleep(1000);
                        let thumbBuf = fs.existsSync(tempEndImg)
                            ? fs.readFileSync(tempEndImg)
                            : fs.readFileSync(path.join(assetDir, 'akinator.jpg'));

                        await sendAkinatorPreview(
                            conn,
                            chat,
                            `> *Tebakan:* ${guess.name_proposition}\n> *Deskripsi:* ${guess.description_proposition}\n\nketik #akinator untuk bermain kembali\n© febriansyah`,
                            '🧙AKINATOR GAME🔮',
                            'Bener gak nih tebakan nya guys?😌!',
                            thumbBuf,
                            m
                        );

                        // Bersihkan sesi & file sementara
                        delete akinator[sender];
                        try { if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath); } catch (e) {}
                        try { if (fs.existsSync(tempEndImg)) fs.unlinkSync(tempEndImg); } catch (e) {}
                        try { if (fs.existsSync(tempAnsImg)) fs.unlinkSync(tempAnsImg); } catch (e) {}
                        return true;
                    }

                    // Pertanyaan selanjutnya
                    try {
                        await generateQuestionImage(akinator[sender].question, tempQImg);
                    } catch (err) {
                        console.error('Error saat membuat gambar pertanyaan Akinator:', err);
                    }
                    await sleep(1000);

                    let qThumb = fs.existsSync(tempQImg)
                        ? fs.readFileSync(tempQImg)
                        : fs.readFileSync(path.join(assetDir, 'akinator.jpg'));

                    await sendAkinatorPreview(
                        conn,
                        chat,
                        `*🧙 AKINATOR GAME 🔮*\n\n` +
                        `Pertanyaan: *${akinator[sender].question}*\n\n` +
                        `*1.* Ya\n` +
                        `*2.* Tidak\n` +
                        `*3.* Saya tidak tahu\n` +
                        `*4.* Mungkin\n` +
                        `*5.* Mungkin tidak\n` +
                        `*6.* Kembali (Pertanyaan sebelumnya)\n\n` +
                        `> Ketik angka 1-6 untuk menjawab, ketik #berhenti untuk berhenti bermain akinator\n\n© febriansyah`,
                        '🧙AKINATOR GAME🔮',
                        `Progress ${Number(akinator[sender].progress).toFixed(2)}% Capai 100% Untuk Kemenangan!`,
                        qThumb,
                        m
                    );
                    try { if (fs.existsSync(tempQImg)) fs.unlinkSync(tempQImg); } catch (e) {}
                    return true;

                } catch (e) {
                    console.error('Error pada langkah Akinator:', e);
                    await m.reply('Terjadi error, game dibatalkan');
                    delete akinator[sender];
                    try { if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath); } catch (err) {}
                    try { if (fs.existsSync(tempQImg)) fs.unlinkSync(tempQImg); } catch (err) {}
                    try { if (fs.existsSync(tempAnsImg)) fs.unlinkSync(tempAnsImg); } catch (err) {}
                    try { if (fs.existsSync(tempEndImg)) fs.unlinkSync(tempEndImg); } catch (err) {}
                    return true;
                }
            }
        }

        return false;
    },

    /**
     * Eksekusi perintah (.akinator / .berhenti / .cencelakinator)
     */
    exec: async (m, { bob, command }) => {
        const conn = bob || m.conn || global.conn;
        const chat = m.chat;
        const sender = m.sender;
        const sessionPath = path.join(__dirname, '../src/' + chat + '.json');

        // Penanganan pembatalan sesi
        if (['berhenti', 'cencelakinator', 'cancelakinator', 'delsesiakinator'].includes(command)) {
            if (!fs.existsSync(sessionPath) && !akinator[sender]) {
                return m.reply('Tidak ada sesi yang bisa dihapus disini!');
            }
            delete akinator[sender];
            try {
                if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
            } catch (e) {}
            return m.reply('Anda mengakhiri permainan');
        }

        // Penanganan mulai sesi game akinator
        if (fs.existsSync(sessionPath) && akinator[sender]) {
            return m.reply('Masih ada game akinator yg berlangsung\nketik .cencelakinator untuk menghapus game');
        }

        // Hapus file sesi lama jika bot sempat restart
        if (fs.existsSync(sessionPath)) {
            try { fs.unlinkSync(sessionPath); } catch (e) {}
        }

        await m.reply('Game akan segera dimulai\nPikirkan 1 tokoh terkenal\nAku akan menebaknya');

        try {
            akinator[sender] = new AkiWrapper({ region: 'id', childMode: false });
            await akinator[sender].start();

            let sesi = [sender];
            fs.writeFileSync(sessionPath, JSON.stringify(sesi, null, 2));

            const safeSender = sender.replace(/[^a-zA-Z0-9]/g, '_');
            const tempQImg = path.join(__dirname, `../src/aki_${safeSender}.jpg`);

            try {
                await generateQuestionImage(
                    akinator[sender].question,
                    tempQImg,
                    path.join(assetDir, 'aki2.png')
                );
            } catch (err) {
                console.error('Error saat membuat gambar awal Akinator:', err);
            }

            await sleep(1000);

            let qThumb = fs.existsSync(tempQImg)
                ? fs.readFileSync(tempQImg)
                : fs.readFileSync(path.join(assetDir, 'akinator.jpg'));

            await sendAkinatorPreview(
                conn,
                chat,
                `*🧙 AKINATOR GAME 🔮*\n\n` +
                `Pertanyaan: *${akinator[sender].question}*\n\n` +
                `*1.* Ya\n` +
                `*2.* Tidak\n` +
                `*3.* Saya tidak tahu\n` +
                `*4.* Mungkin\n` +
                `*5.* Mungkin tidak\n` +
                `*6.* Kembali (Pertanyaan sebelumnya)\n\n` +
                `> Ketik angka 1-6 untuk menjawab, ketik #berhenti untuk menghentikan sesi.\n\n© febriansyah`,
                '🧙AKINATOR GAME🔮',
                `Progress ${Number(akinator[sender].progress).toFixed(2)}%`,
                qThumb,
                m
            );
            try { if (fs.existsSync(tempQImg)) fs.unlinkSync(tempQImg); } catch (e) {}

        } catch (err) {
            console.error('Gagal memulai sesi Akinator:', err);
            delete akinator[sender];
            try { if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath); } catch (e) {}
            return m.reply('❌ Terjadi kesalahan saat memulai Akinator: ' + (err.message || err));
        }
    }
};
