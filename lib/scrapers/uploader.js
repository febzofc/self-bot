let axios = require('axios')
let BodyForm = require('form-data')
let { fromBuffer } = require('file-type')
let fetch = require('node-fetch')
let fs = require('fs')
let cheerio = require('cheerio')


async function UploadFileUgu (input) {
	return new Promise (async (resolve, reject) => {
			const form = new BodyForm();
			form.append("files[]", fs.createReadStream(input))
			await axios({
				url: "https://uguu.se/upload.php",
				method: "POST",
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
					...form.getHeaders()
				},
				data: form
			}).then((data) => {
				resolve(data.data.files[0])
			}).catch((err) => reject(err))
	})
}

function webp2mp4File(filePath) {
	return new Promise(async (resolve, reject) => {
		try {
			const form = new BodyForm();
			form.append('new-image-url', '');
			form.append('new-image', fs.createReadStream(filePath));

			const r1 = await axios({
				method: 'post',
				url: 'https://ezgif.com/webp-to-mp4',
				data: form,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
					...form.getHeaders()
				},
				timeout: 30000
			});

			const $1 = cheerio.load(r1.data);
			const file = $1('input[name="file"]').attr('value');
			if (!file) {
				return reject(new Error('Gagal mengunggah berkas webp ke ezgif'));
			}

			const form2 = new BodyForm();
			form2.append('file', file);
			form2.append('convert', 'Convert WebP to MP4!');

			const r2 = await axios({
				method: 'post',
				url: 'https://ezgif.com/webp-to-mp4/' + file,
				data: form2,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
					...form2.getHeaders()
				},
				timeout: 30000
			});

			const $2 = cheerio.load(r2.data);
			let videoSrc = $2('div#output video source').attr('src') || $2('div#output video').attr('src') || $2('video source').attr('src') || $2('video').attr('src');
			if (!videoSrc) {
				return reject(new Error('Gagal menemukan video hasil konversi ezgif'));
			}

			if (!videoSrc.startsWith('http')) {
				videoSrc = (videoSrc.startsWith('//') ? 'https:' : 'https://ezgif.com') + videoSrc;
			}

			resolve({
				status: true,
				message: 'Converted by ezgif',
				result: videoSrc
			});
		} catch (err) {
			reject(err);
		}
	});
}

async function floNime(medianya, options = {}) {
const { ext } = await fromBuffer(medianya) || options.ext
        var form = new BodyForm()
        form.append('file', medianya, 'tmp.'+ext)
        let jsonnya = await fetch('https://flonime.my.id/upload', {
                method: 'POST',
                body: form
        })
        .then((response) => response.json())
        return jsonnya
}

async function UploadZetnata(filePath) {
	return new Promise(async (resolve, reject) => {
		try {
			const form = new BodyForm();
			form.append("files", fs.createReadStream(filePath));
			const { data } = await axios.post("https://cloud.zetnata.web.id/api/public/upload", form, {
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					...form.getHeaders()
				}
			});
			if (data && data.success) {
				resolve(data.result || data.data);
			} else {
				reject(new Error(data?.message || 'Gagal mengunggah ke Zetnata Cloud Storage'));
			}
		} catch (err) {
			reject(err);
		}
	});
}

const { Videy } = require('./videy.js');

module.exports = { UploadFileUgu, webp2mp4File, floNime, UploadZetnata, Videy }

