/**
 * VIDEY UPLOADER & DOWNLOADER
 * Created by MyTeam
 * ©2024 Recoverse TEAM®
 */

const axios = require('axios');
const FormData = require('form-data');
const { fromBuffer } = require('file-type');

class Videy {
    /**
     * Mengambil ID Videy dari berbagai format URL / input
     * @param {string} input - URL atau ID Videy
     * @returns {string|null} ID Videy
     */
    static extractId(input) {
        if (!input || typeof input !== 'string') return null;
        try {
            const parsed = new URL(input.trim());
            if (parsed.searchParams.has('id')) {
                return parsed.searchParams.get('id').trim();
            }
            const match = parsed.pathname.match(/\/([a-zA-Z0-9_-]+)(?:\.mp4)?$/);
            if (match && match[1] && match[1] !== 'v') {
                return match[1].trim();
            }
        } catch (e) {}

        const match = input.trim().match(/(?:id=|videy\.co\/|cdn\.videy\.co\/)([a-zA-Z0-9_-]+)/i);
        if (match && match[1]) return match[1].trim();

        if (/^[a-zA-Z0-9_-]+$/.test(input.trim())) {
            return input.trim();
        }
        return null;
    }

    /**
     * Mengunggah file video ke platform Videy.
     * @param {Buffer} buffer - Buffer yang merepresentasikan konten video.
     * @returns {Promise<{id: string, url: string, directUrl: string}>}
     * @throws {Error} Jika unggahan gagal atau ID tidak ditemukan dalam respons.
     */
    static async upload(buffer) {
        try {
            if (!Buffer.isBuffer(buffer)) {
                throw new Error('Input harus berupa Buffer!');
            }

            let ext = 'mp4';
            try {
                const ft = await fromBuffer(buffer);
                if (ft && ft.ext) ext = ft.ext;
            } catch (e) {
                ext = 'mp4';
            }

            let form = new FormData();
            form.append("file", buffer, {
                filename: `video.${ext}`,
                contentType: `video/${ext}`
            });

            const response = await axios.post("https://videy.co/api/upload", form, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
                    ...form.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.data && response.data.id) {
                const id = response.data.id;
                const url = `https://videy.co/v?id=${id}`;
                const directUrl = `https://cdn.videy.co/${id}.mp4`;
                return {
                    id,
                    url,
                    directUrl
                };
            } else {
                throw new Error('ID tidak ditemukan dalam respons Videy');
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Mengunduh file video dari platform Videy.
     * @param {string} query - URL video (misal: https://videy.co/v?id=ABC123) atau ID video.
     * @returns {Promise<{id: string, directUrl: string, buffer: Buffer}>}
     * @throws {Error} Jika URL tidak valid atau unduhan gagal.
     */
    static async download(query) {
        try {
            const id = this.extractId(query);
            if (!id) {
                throw new Error("Invalid URL. Gunakan format: https://videy.co/v?id=ABC123");
            }

            const downloadURL = `https://cdn.videy.co/${id}.mp4`;

            const response = await axios({
                method: 'get',
                url: downloadURL,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
                }
            });

            return {
                id,
                directUrl: downloadURL,
                buffer: Buffer.from(response.data)
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = { Videy };
