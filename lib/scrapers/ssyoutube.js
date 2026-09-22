const axios = require('axios');
const { spawn } = require('child_process');

/**
 * Scraper YouTube MP3 & MP4 berbasis https://ssyoutube.com.mx/id/
 * Mengambil resolusi audio 128kbps untuk MP3 dan data lengkap all resolusi untuk MP4
 */

const YT_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

/**
 * Ekstraksi video ID dari berbagai bentuk link YouTube
 */
function extractVideoId(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(YT_REGEX);
    return (match && match[1]) ? match[1] : null;
}

/**
 * Format bytes ke ukuran yang mudah dibaca manusia (KB, MB, GB)
 */
function formatBytes(bytes, decimals = 2) {
    if (!bytes || isNaN(bytes) || bytes === 0) return 'Unknown Size';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format detik ke format menit:detik atau jam:menit:detik
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '-';
    const s = parseInt(seconds, 10);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => (n < 10 ? '0' + n : n);
    if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
    return `${m}:${pad(sec)}`;
}

/**
 * Scraper inti YouTube ssyoutube.com.mx
 * @param {string} url - Link YouTube atau Video ID
 */
async function scrapeSSYouTube(url) {
    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('URL YouTube tidak valid atau ID video tidak ditemukan!');
    }

    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // 1. Ambil data pencarian dari test.insvid.com (search endpoint yang dipakai ssyoutube.com.mx)
    let searchMeta = null;
    try {
        const searchRes = await axios.get(`https://test.insvid.com/search/?q=${encodeURIComponent(cleanUrl)}`, {
            headers: {
                'Referer': 'https://ssyoutube.com.mx/id/',
                'User-Agent': userAgent
            },
            timeout: 10000
        });
        if (searchRes.data && Array.isArray(searchRes.data.items)) {
            searchMeta = searchRes.data.items.find(i => i.id === videoId) || searchRes.data.items[0];
        }
    } catch (err) {
        // Abaikan jika pencarian gagal, lanjut ke converter backend
    }

    // Header permintaan ke backend converter ac.insvid.com
    const convHeaders = {
        'Content-Type': 'application/json',
        'Referer': `https://ac.insvid.com/widget?url=${encodeURIComponent(cleanUrl)}&el=100`,
        'Origin': 'https://ac.insvid.com',
        'User-Agent': userAgent
    };

    // 2. Ambil data MP4 (All resolutions) dari ac.insvid.com/converter
    let mp4Data = null;
    try {
        const res = await axios.post('https://ac.insvid.com/converter', 
            { id: videoId, fileType: 'mp4' },
            { headers: convHeaders, timeout: 20000 }
        );
        mp4Data = res.data;
    } catch (err) {
        throw new Error(`Gagal menghubungi server converter ssyoutube (MP4): ${err.message}`);
    }

    if (!mp4Data || mp4Data.status !== 'success' || !Array.isArray(mp4Data.formats) || mp4Data.formats.length === 0) {
        throw new Error('Video tidak ditemukan atau server converter ssyoutube menolak permintaan.');
    }

    // 3. Ambil data MP3 (128kbps) dari ac.insvid.com/converter
    let mp3Data = null;
    try {
        const res = await axios.post('https://ac.insvid.com/converter', 
            { id: videoId, fileType: 'MP3' },
            { headers: convHeaders, timeout: 15000 }
        );
        mp3Data = res.data;
    } catch (err) {
        // Fallback info mp3 jika converter mp3 gagal
    }

    const title = mp4Data.title || searchMeta?.title || 'YouTube Media';
    const thumbnail = searchMeta?.thumbMedium || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const duration = searchMeta?.duration || (mp4Data.formats[0]?.approxDurationMs ? formatDuration(mp4Data.formats[0].approxDurationMs / 1000) : '-');

    // Susun semua data resolusi MP4
    // Progressive direct streams dari googlevideo
    const primaryFormat = mp4Data.formats[0];
    const streamUrl = primaryFormat?.url || '';

    // Daftar resolusi yang disediakan / disupport ssyoutube.com.mx
    const standardResolutions = ['1080p', '720p', '480p', '360p', '240p', '144p'];
    const activeResolutions = [];

    // Format nyata yang didapat dari googlevideo
    mp4Data.formats.forEach((fmt) => {
        const qLabel = fmt.qualityLabel || `${fmt.height}p` || '360p';
        const size = fmt.contentLength ? parseInt(fmt.contentLength, 10) : (fmt.bitrate && fmt.approxDurationMs ? Math.round((fmt.bitrate * (fmt.approxDurationMs / 1000)) / 8) : 0);
        activeResolutions.push({
            resolution: qLabel,
            format: 'MP4',
            itag: fmt.itag,
            mimeType: fmt.mimeType || 'video/mp4',
            bitrate: fmt.bitrate || 0,
            width: fmt.width || 0,
            height: fmt.height || 0,
            fps: fmt.fps || 30,
            audioQuality: fmt.audioQuality || 'AUDIO_QUALITY_MEDIUM',
            filesize: size,
            formattedSize: formatBytes(size),
            url: fmt.url,
            isAvailableDirect: true
        });
    });

    // Menambahkan entri resolusi standar yang direpresentasikan di ssyoutube.com.mx
    standardResolutions.forEach((res) => {
        const exists = activeResolutions.some(r => r.resolution.toLowerCase() === res.toLowerCase());
        if (!exists) {
            activeResolutions.push({
                resolution: res,
                format: 'MP4',
                itag: null,
                mimeType: 'video/mp4',
                bitrate: null,
                width: null,
                height: parseInt(res),
                fps: 30,
                audioQuality: 'AUDIO_QUALITY_MEDIUM',
                filesize: null,
                formattedSize: 'Auto / Stream',
                url: streamUrl, // ssyoutube uses the active stream as fallback
                isAvailableDirect: false
            });
        }
    });

    // Susun data MP3 dengan kualitas 128kbps
    const mp3Info = {
        resolution: '128kbps',
        format: 'MP3',
        qualityLabel: '128 kbps',
        sampleRate: '44.1 kHz',
        channels: 'Stereo',
        filesize: mp3Data?.filesize || (primaryFormat?.approxDurationMs ? Math.round((128 * 1024 / 8) * (primaryFormat.approxDurationMs / 1000)) : 0),
        formattedSize: formatBytes(mp3Data?.filesize || (primaryFormat?.approxDurationMs ? Math.round((128 * 1024 / 8) * (primaryFormat.approxDurationMs / 1000)) : 0)),
        rawLink: mp3Data?.link || null,
        streamSourceUrl: streamUrl
    };

    return {
        status: true,
        source: 'https://ssyoutube.com.mx/id/',
        data: {
            id: videoId,
            url: cleanUrl,
            title: title,
            duration: duration,
            thumbnail: thumbnail,
            viewCount: searchMeta?.viewCount || '-',
            mp3: mp3Info,
            mp4: {
                totalResolutions: activeResolutions.length,
                allResolutions: activeResolutions,
                bestDirectResolution: activeResolutions.find(r => r.isAvailableDirect) || activeResolutions[0]
            }
        }
    };
}

/**
 * Konversi audio stream ke format MP3 128kbps secara langsung menggunakan ffmpeg
 * @param {string} streamUrl - Direct URL stream dari YouTube (googlevideo)
 * @returns {Promise<Buffer>} Buffer MP3 128kbps
 */
function convertStreamToMp3(streamUrl) {
    return new Promise((resolve, reject) => {
        if (!streamUrl) return reject(new Error('Stream URL tidak boleh kosong'));

        const ffmpeg = spawn('ffmpeg', [
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-i', streamUrl,
            '-vn',
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '2',
            '-f', 'mp3',
            'pipe:1'
        ]);

        const chunks = [];
        let errOutput = '';

        ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
        ffmpeg.stderr.on('data', err => { errOutput += err.toString(); });

        ffmpeg.on('close', code => {
            if (code === 0 && chunks.length > 0) {
                resolve(Buffer.concat(chunks));
            } else {
                reject(new Error(`FFmpeg exit with code ${code}: ${errOutput.slice(-200)}`));
            }
        });

        ffmpeg.on('error', err => reject(err));
    });
}

/**
 * Download file stream MP4 ke Buffer
 * @param {string} url - URL file MP4
 * @returns {Promise<Buffer>}
 */
async function downloadMp4Buffer(url) {
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        responseType: 'arraybuffer',
        timeout: 60000,
        maxRedirects: 5
    });
    return Buffer.from(res.data);
}

module.exports = {
    YT_REGEX,
    extractVideoId,
    formatBytes,
    formatDuration,
    scrapeSSYouTube,
    convertStreamToMp3,
    downloadMp4Buffer
};
