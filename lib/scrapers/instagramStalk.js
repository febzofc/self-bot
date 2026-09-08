'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

// RapidAPI Configuration
const RAPID_KEY = process.env.RAPIDAPI_IG_KEY || '345fecb88bmsh9fd87e59d6ec29bp11fb64jsn3db04af75f47';
const RAPID_HOST = 'instagram-scraper-api2.p.rapidapi.com';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Format number to Indonesian locale string (e.g. 1.234.567)
 */
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('id-ID');
}

/**
 * Clean Instagram username from @ or full URL
 */
function cleanUsername(input) {
    if (!input || typeof input !== 'string') return '';
    let clean = input.trim();
    // Jika berupa link/URL Instagram (misal: https://instagram.com/jokowi?igsh=...)
    const urlMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i);
    if (urlMatch) {
        clean = urlMatch[1];
    }
    // Hapus @ di awal dan slash atau query di belakang
    clean = clean.replace(/^@/, '').split('?')[0].replace(/\/$/, '').trim();
    return clean;
}

/**
 * Unduh buffer gambar profil Instagram
 */
async function getProfileImageBuffer(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            httpsAgent,
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://www.instagram.com/'
            },
            timeout: 10000
        });
        if (res.data && res.data.length > 0) {
            return Buffer.from(res.data);
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Engine 1: RapidAPI Instagram Scraper (Lengkap dengan Detail HD & Postingan Terbaru)
 */
async function scrapeViaRapidApi(username) {
    const infoUrl = `https://${RAPID_HOST}/v1/info?username_or_id_or_url=${encodeURIComponent(username)}`;
    const headers = {
        'x-rapidapi-key': RAPID_KEY,
        'x-rapidapi-host': RAPID_HOST
    };

    const res = await axios.get(infoUrl, {
        headers,
        timeout: 12000,
        httpsAgent
    });

    const d = res.data?.data;
    if (!d || !d.username) {
        throw new Error('Akun Instagram tidak ditemukan.');
    }

    // Ambil bio link
    let bioLink = d.external_url || '';
    if (!bioLink && Array.isArray(d.bio_links) && d.bio_links.length > 0) {
        bioLink = d.bio_links[0].url || d.bio_links[0].title || '';
    }

    // Ambil beberapa postingan terbaru jika akun publik
    let recentPosts = [];
    if (!d.is_private) {
        try {
            const postsUrl = `https://${RAPID_HOST}/v1/posts?username_or_id_or_url=${encodeURIComponent(username)}`;
            const postsRes = await axios.get(postsUrl, {
                headers,
                timeout: 8000,
                httpsAgent
            });
            const items = postsRes.data?.data?.items || [];
            recentPosts = items.slice(0, 3).map(p => {
                const isVideo = p.media_type === 2 || !!p.video_versions;
                return {
                    code: p.code,
                    url: `https://www.instagram.com/p/${p.code}/`,
                    type: isVideo ? 'Video/Reels 🎬' : 'Foto 📸',
                    likes: formatNumber(p.like_count || 0),
                    comments: formatNumber(p.comment_count || 0),
                    caption: (p.caption?.text || '').slice(0, 100).replace(/\n+/g, ' ')
                };
            });
        } catch (e) {
            // Post fetch non-critical
        }
    }

    return {
        status: true,
        source: 'api',
        userId: d.pk_id || d.id || '-',
        username: d.username,
        fullName: d.full_name || d.username,
        bio: (d.biography || '').trim(),
        bioLink: bioLink,
        followersCount: d.follower_count || 0,
        followersFormatted: formatNumber(d.follower_count || 0),
        followingCount: d.following_count || 0,
        followingFormatted: formatNumber(d.following_count || 0),
        postsCount: d.media_count || 0,
        postsFormatted: formatNumber(d.media_count || 0),
        reelsCount: d.total_clips_count !== undefined ? formatNumber(d.total_clips_count) : null,
        isVerified: !!d.is_verified,
        isPrivate: !!d.is_private,
        category: d.category_name || d.category || '',
        accountType: d.account_type === 3 ? 'Kreator / Bisnis 💼' : (d.account_type === 1 ? 'Personal 👤' : 'Publik 🌐'),
        profilePicUrl: d.profile_pic_url_hd || d.profile_pic_url || '',
        profileUrl: `https://www.instagram.com/${d.username}/`,
        recentPosts
    };
}

/**
 * Engine 2: Pure HTTP Web Scraper Fallback (Tanpa Browser / Chromium)
 * Menggunakan Insta-Stories-Viewer engine
 */
async function scrapeViaWeb(username) {
    const targetUrl = `https://insta-stories-viewer.com/${encodeURIComponent(username)}/`;
    const res = await axios.get(targetUrl, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 10000,
        httpsAgent
    });

    const $ = cheerio.load(res.data);
    const bio = $('.profile__description').text().trim();
    const isVerified = $('.profile__nickname-is-verify').length > 0;
    let avatar = $('img.profile__avatar-img, .profile__avatar img').attr('src') || '';
    if (avatar && avatar.startsWith('/')) {
        avatar = 'https://insta-stories-viewer.com' + avatar;
    }

    let followers = $('.profile__stats-followers').text().trim() || '0';
    let following = $('.profile__stats-follows').text().trim() || '0';
    let posts = $('.profile__stats-posts').text().trim() || '0';

    // Ekstrak data akurat jika ada CHART_DATA
    const chartMatch = res.data.match(/var\s+CHART_DATA\s*=\s*({[^;]+});/);
    if (chartMatch) {
        try {
            const chartObj = JSON.parse(chartMatch[1]);
            const keys = Object.keys(chartObj).sort();
            if (keys.length > 0) {
                const latest = chartObj[keys[keys.length - 1]];
                if (latest.followers !== undefined) followers = formatNumber(latest.followers);
                if (latest.followings !== undefined) following = formatNumber(latest.followings);
                if (latest.posts !== undefined) posts = formatNumber(latest.posts);
            }
        } catch (e) {}
    }

    let userId = '-';
    const idMatch = res.data.match(/var\s+USER_ID\s*=\s*['"]?([0-9]+)['"]?;/);
    if (idMatch) userId = idMatch[1];

    return {
        status: true,
        source: 'scraper',
        userId,
        username,
        fullName: username,
        bio,
        bioLink: '',
        followersCount: 0,
        followersFormatted: followers,
        followingCount: 0,
        followingFormatted: following,
        postsCount: 0,
        postsFormatted: posts,
        reelsCount: null,
        isVerified,
        isPrivate: res.data.includes('This account is private'),
        category: '',
        accountType: 'Publik 🌐',
        profilePicUrl: avatar,
        profileUrl: `https://www.instagram.com/${username}/`,
        recentPosts: []
    };
}

/**
 * Fungsi Utama Stalker Instagram Multi-Engine
 * @param {string} input - Username atau Link Profil Instagram
 */
async function stalkInstagram(input) {
    const username = cleanUsername(input);
    if (!username) {
        throw new Error('Harap masukkan username atau link akun Instagram yang valid!');
    }

    // Coba Engine 1 (RapidAPI)
    try {
        const result = await scrapeViaRapidApi(username);
        return result;
    } catch (errApi) {
        // Jika akun memang tidak ada (400 invalid username), lempar error langsung
        const status = errApi.response?.status;
        const errDetail = errApi.response?.data?.detail || '';
        if (status === 400 || errDetail.toLowerCase().includes('invalid')) {
            throw new Error(`Akun Instagram *@${username}* tidak ditemukan.`);
        }

        // Coba Engine 2 (Web Scraper Fallback)
        try {
            const fallbackResult = await scrapeViaWeb(username);
            return fallbackResult;
        } catch (errWeb) {
            throw new Error(`Gagal mengambil data akun *@${username}*. Pastikan akun publik dan username benar.`);
        }
    }
}

module.exports = {
    cleanUsername,
    formatNumber,
    getProfileImageBuffer,
    stalkInstagram
};
