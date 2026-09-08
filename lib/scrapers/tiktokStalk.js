'use strict';

const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('id-ID');
}

function cleanTikTokUsername(input) {
    if (!input || typeof input !== 'string') return '';
    let clean = input.trim();
    const urlMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)/i);
    if (urlMatch) {
        clean = urlMatch[1];
    }
    return clean.replace(/^@/, '').split('?')[0].replace(/\/$/, '').trim();
}

async function getAvatarBuffer(avatarUrl) {
    if (!avatarUrl || typeof avatarUrl !== 'string') return null;
    try {
        const res = await axios.get(avatarUrl, {
            responseType: 'arraybuffer',
            httpsAgent,
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://www.tiktok.com/'
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

async function stalkTikTok(input) {
    const username = cleanTikTokUsername(input);
    if (!username) {
        throw new Error('Harap masukkan username atau link akun TikTok yang valid!');
    }

    const apiUrl = `https://api-faa.my.id/faa/tiktokstalk?username=${encodeURIComponent(username)}`;
    let res;
    try {
        res = await axios.get(apiUrl, {
            headers: {
                'User-Agent': USER_AGENT
            },
            timeout: 15000,
            httpsAgent
        });
    } catch (err) {
        const errData = err.response?.data;
        if (errData && typeof errData === 'object' && errData.error) {
            throw new Error(`Akun TikTok *@${username}* tidak ditemukan (${errData.error}).`);
        }
        if (err.response?.status === 404 || err.response?.status === 500) {
            throw new Error(`Akun TikTok *@${username}* tidak ditemukan atau profil bersifat privat.`);
        }
        throw new Error(err.message || 'Gagal menghubungi API TikTok Faa.');
    }

    const data = res.data;
    if (!data || !data.status || !data.result) {
        const errMsg = data?.error || 'Akun TikTok tidak ditemukan atau data tidak lengkap.';
        throw new Error(errMsg);
    }

    const r = data.result;
    const stats = r.stats || {};

    // Tangani kemungkinan integer overflow pada likes TikTok
    let likesFormatted = '0';
    if (stats.likes && stats.likes > 0) {
        likesFormatted = formatNumber(stats.likes);
    } else if (r.description) {
        const match = r.description.match(/([0-9.]+[kKmMbB]?)\s+Likes/i);
        likesFormatted = match ? match[1] : '0';
    }

    let createdDate = '-';
    if (r.create_time) {
        try {
            createdDate = new Date(r.create_time * 1000).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch (e) {}
    }

    return {
        id: r.id || '-',
        username: r.username,
        name: r.name || r.username,
        avatar: r.avatar || '',
        bio: (r.bio || '').trim(),
        createdDate: createdDate,
        profileUrl: r.link || `https://www.tiktok.com/@${r.username}`,
        isVerified: !!r.verified,
        isPrivate: !!r.private,
        isSeller: !!r.seller,
        region: (r.region || '').toUpperCase(),
        followers: formatNumber(stats.followers || 0),
        following: formatNumber(stats.following || 0),
        likes: likesFormatted,
        videos: formatNumber(stats.videos || 0),
        friends: formatNumber(stats.friend || 0)
    };
}

module.exports = {
    cleanTikTokUsername,
    formatNumber,
    getAvatarBuffer,
    stalkTikTok
};
