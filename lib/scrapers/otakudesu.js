/*
  Do not delete this comment!
  Created by :
    https://github.com/MuhammadRestu999
    https://api.whatsapp.com/send?phone=6285783417029
    muhammadrestu490@gmail.com
*/

let axios = require("axios")
let cheerio = require("cheerio")
let https = require("https")

let agent = new https.Agent({
  rejectUnauthorized: false,
  family: 4,
  keepAlive: true
})

const defaultHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8"
}

class InvalidArguments extends TypeError {
  constructor(message) {
    super(message)
    this.name = "InvalidArguments"
  }
}
const isString = s => typeof s === "string"
const isNumber = n => typeof n === "number"
const isBoolean = b => typeof b === "boolean"

async function getImageBuffer(url) {
  if (!url || typeof url !== "string") return null
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      httpsAgent: agent,
      headers: defaultHeaders,
      timeout: 10000
    })
    return Buffer.from(res.data)
  } catch (e) {
    console.error("getImageBuffer error:", e.message)
    return null
  }
}

async function search(title) {
  if(!title) throw new Error("Enter the anime title!")
  if(!isString(title)) throw new InvalidArguments(`The "title" argument must be of type string. Received ${typeof title}`)

  let { data } = await axios.get(`https://otakudesu.cloud/?s=${encodeURIComponent(title)}&post_type=anime`, { httpsAgent: agent, headers: defaultHeaders })
  let $ = cheerio.load(data)
  let result = []

  let li = $("div.page > ul.chivsrc > li")
  li.each(function(i, el) {
    let _$ = cheerio.load($(el).html())
    let obj = {}
    obj.thumbnail = _$("img.attachment-post-thumbnail").attr("src")
    obj.title = _$("h2 > a").text().trim()
    obj.url = _$("h2 > a").attr("href")
    obj.id = obj.url ? obj.url.split("/").filter(Boolean).pop() : ""

    let genre = []
    _$("div.set").eq(0).find("a").each(function() {
      genre.push({ name: $(this).text().trim(), url: $(this).attr("href") })
    })
    obj.genre = genre
    obj.status = _$("div.set").eq(1).text().split(":")[1]?.trim() || ""
    let ratingText = _$("div.set").eq(2).text().split(":")[1]?.trim()
    obj.rating = Number(ratingText) || 0

    result.push(obj)
  })
  return result
}

async function get(id, fallbackData = null) {
  if(!isString(id)) throw new InvalidArguments(`The "id" argument must be of type string. Received ${typeof id}`)
  let cleanId = id.replace(/\/$/, "")

  let data, request
  try {
    let res = await axios.get(`https://otakudesu.cloud/anime/${cleanId}/`, { httpsAgent: agent, headers: defaultHeaders, timeout: 10000 })
    data = res.data
    request = res.request
    if (typeof data === "string" && data.includes("Attention Required! | Cloudflare")) {
      throw new Error("Cloudflare 403 Blocked")
    }
  } catch (e) {
    // Jika ada data awal dari sesi pencarian, gunakan langsung
    if (fallbackData && typeof fallbackData === 'object') {
      return {
        [Symbol("creator")]: "Restu",
        thumb: fallbackData.thumbnail || fallbackData.thumb || null,
        info: {
          judul: fallbackData.title || cleanId,
          judul_jepang: "-",
          skor: fallbackData.rating ? String(fallbackData.rating) : "-",
          produser: [],
          episode: fallbackData.status || "-",
          tanggal_rilis: "-",
          studio: "-",
          genre: fallbackData.genre ? fallbackData.genre.map(g => (typeof g === 'object' ? g.name : g)) : []
        },
        sinopsis: "Detail sinopsis dan episode saat ini tidak dapat dimuat karena proteksi Cloudflare 403 pada server Otakudesu.",
        episode: []
      }
    }

    // Fallback to search query to retrieve basic anime info if /anime/ detail page is blocked by Cloudflare (403)
    let searchQuery = cleanId.replace(/-sub-indo$/i, "").replace(/-/g, " ")
    if (searchQuery.toLowerCase() === "borot") searchQuery = "boruto"
    let searchResults = await search(searchQuery).catch(() => [])
    if (!searchResults || searchResults.length === 0) {
      searchResults = await search(cleanId.split("-")[0]).catch(() => [])
    }
    if (searchResults && searchResults.length > 0) {
      let match = searchResults.find(item => item.id === cleanId) || searchResults[0]
      return {
        [Symbol("creator")]: "Restu",
        thumb: match.thumbnail,
        info: {
          judul: match.title,
          judul_jepang: "-",
          skor: match.rating ? String(match.rating) : "-",
          produser: [],
          episode: "-",
          tanggal_rilis: "-",
          studio: "-",
          genre: match.genre ? match.genre.map(g => g.name) : []
        },
        sinopsis: "Detail sinopsis dan daftar episode lengkap tidak dapat dimuat langsung dari website karena proteksi Cloudflare 403.",
        episode: []
      }
    }
    
    // Default fallback jika tidak ada hasil pencarian
    return {
      [Symbol("creator")]: "Restu",
      thumb: null,
      info: {
        judul: cleanId.replace(/-/g, " ").toUpperCase(),
        judul_jepang: "-",
        skor: "-",
        produser: [],
        episode: "-",
        tanggal_rilis: "-",
        studio: "-",
        genre: []
      },
      sinopsis: "Server Otakudesu memblokir permintaan detail ini (Cloudflare 403).",
      episode: []
    }
  }

  if(request && request.res && request.res.responseUrl == "https://otakudesu.cloud/") throw new Error("Anime not found!")

  let $ = cheerio.load(data)
  let result = {
    [Symbol("creator")]: "Restu"
  }

  result.thumb = $("img.attachment-post-thumbnail").attr("src")
  const spans = $("div.infozingle > p > span")

  result.info = {
    judul: spans.eq(0).text().split(":")[1]?.trim() || "",
    judul_jepang: spans.eq(1).text().split(":")[1]?.trim() || "",
    skor: spans.eq(2).text().split(":")[1]?.trim() || "",
    produser: (spans.eq(3).text().split(":")[1] || "").split(",").map(v => v.trim()).filter(Boolean),
    episode: spans.eq(6).text().split(":")[1]?.trim() || "",
    tanggal_rilis: spans.eq(8).text().split(":")[1]?.trim() || "",
    studio: spans.eq(9).text().split(":")[1]?.trim() || "",
    genre: spans.eq(10).find("a").map((i, el) => $(el).text().trim()).get()
  }
  result.sinopsis = $("div.sinopc").text().trim()
  result.episode = []
  $("div.episodelist > ul > li").each(function(i, el) {
    let a = $(el).find("span > a")
    let epTitle = a.text().trim()
    let epUrl = a.attr("href") || ""
    let epId = epUrl ? epUrl.split("/").filter(Boolean).pop() : ""
    result.episode.push({ episode: epTitle, url: epUrl, id: epId })
  })
  result.episode.reverse()

  return result
}

async function stream(id) {
  if(!isString(id)) throw new InvalidArguments(`The "id" argument must be of type string. Received ${typeof id}`)
  let cleanId = id.replace(/\/$/, "")

  let { data, request } = await axios({
    url: `https://otakudesu.cloud/episode/${cleanId}/`,
    httpsAgent: agent,
    headers: defaultHeaders
  })
  if(request.res.responseUrl == "https://otakudesu.cloud/") throw new Error("Episode not found!")

  let $ = cheerio.load(data)
  let iframe = $("div.responsive-embed-stream > iframe").attr("src")

  return iframe
}

async function download(id, batch = false) {
  if(!isString(id)) throw new InvalidArguments(`The "id" argument must be of type string. Received ${typeof id}`)
  if(!isBoolean(batch)) throw new InvalidArguments(`The "batch" argument must be of type boolean. Received ${typeof batch}`)
  let cleanId = id.replace(/\/$/, "")

  let { data, request } = await axios({
    url: `https://otakudesu.cloud/${batch ? "batch/" : "episode/"}${cleanId}/`,
    httpsAgent: agent,
    headers: defaultHeaders
  })
  if(request.res.responseUrl == "https://otakudesu.cloud/") throw new Error("Episode not found!")

  let $ = cheerio.load(data)

  let selector = !batch ? "div.download ul li" : "div.download2 ul li, div.batchlink ul li"

  let result = []
  $(selector).each(function(i, el) {
    let tmp = {}
    tmp.quality = $(el).find("strong").text().trim()
    tmp.size = $(el).find("i").text().trim()
    tmp.url = {}
    $(el).find("a").each(function(j, a) {
      let type = $(a).text().trim()
      let href = $(a).attr("href") || ""
      if (type && href) tmp.url[type] = href
    })
    if (tmp.quality || Object.keys(tmp.url).length > 0) {
      result.push(tmp)
    }
  })

  return result
}

async function schedule() {
  let { data } = await axios("https://otakudesu.cloud/jadwal-rilis/", { httpsAgent: agent, headers: defaultHeaders })
  let $ = cheerio.load(data)
  let result = []
  let element = $(".kgjdwl321")
  element.find(".kglist321").each(function() {
    let day = $(this).find("h2").text().trim()

    if(day == "Random") return

    let animeList = []
    $(this).find("ul > li").each(function() {
      let animeName = $(this).find("a").text().trim()
      let link = $(this).find("a").attr("href") || ""
      let id = link ? link.split("/").filter(Boolean).pop() : ""
      animeList.push({ animeName, id, link })
    })
    result.push({ day, animeList })
  })

  return result
}

async function ongoingAnime(page) {
  if(!isNumber(page) && page != undefined) throw new InvalidArguments(`The "page" argument must be of type number. Received ${typeof page}`)

  let url = "https://otakudesu.cloud/ongoing-anime/"
  if(!isNaN(page) && page > 1) url += "page/" + page + "/"

  let { data } = await axios(url, { httpsAgent: agent, headers: defaultHeaders })
  let $ = cheerio.load(data)

  let result = []

  let selector = $("div.rapi > div.venz > ul > li")
  selector.each(function() {
    let title = $(this).find("div.detpost > div.thumb > a > div.thumbz > h2").text().trim()
    let thumb = $(this).find("div.detpost > div.thumb > a > div.thumbz > img").attr("src")
    let epsText = $(this).find("div.detpost > div.epz").text().trim()
    let eps = parseInt(epsText.replace(/[^0-9]/g, '')) || 0
    let day = $(this).find("div.detpost > div.epztipe").text().trim()
    let date = $(this).find("div.detpost > div.newnime").text().trim()
    let link = $(this).find("div.detpost > div.thumb > a").attr("href") || ""
    let id = link ? link.split("/").filter(Boolean).pop() : ""

    result.push({ title, thumb, eps, day, date, link, id })
  })

  return result
}

async function genre(q, page) {
  if(!isString(q) && q != undefined) throw new InvalidArguments(`The "q" argument must be of type string. Received ${typeof q}`)
  if(!isNumber(page) && page != undefined) throw new InvalidArguments(`The "page" argument must be of type number. Received ${typeof page}`)

  if(!q) return await genreList()
  let { data, request } = await axios("https://otakudesu.cloud/genres/" + q + ((page && page > 1) ? "/page/" + page : ""), { httpsAgent: agent, headers: defaultHeaders })
  if(request.res.responseUrl == "https://otakudesu.cloud/") throw new Error("Genre or page not found!")
  let $ = cheerio.load(data)

  let result = []

  $("div.col-anime").each(function() {
    let obj = {}
    obj.pic = $(this).find("div.col-anime-cover > img").attr("src")
    obj.title = $(this).find("div.col-anime-title > a").text().trim()
    obj.link = $(this).find("div.col-anime-title > a").attr("href") || ""
    obj.id = obj.link ? obj.link.split("/").filter(Boolean).pop() : ""
    obj.studio = $(this).find("div.col-anime-studio").text().split(",").map(v => v.trim()).filter(Boolean)
    obj.eps = $(this).find("div.col-anime-eps").text().trim()
    obj.rating = $(this).find("div.col-anime-rating").text().trim()
    obj.genre = $(this).find("div.col-anime-genre").text().split(",").map(v => v.trim()).filter(Boolean)
    obj.synopsis = $(this).find("div.col-synopsis").text().trim()

    result.push(obj)
  })

  return result
}

async function genreList() {
  let { data } = await axios("https://otakudesu.cloud/genre-list/", { httpsAgent: agent, headers: defaultHeaders })
  let $ = cheerio.load(data)

  let result = []

  $("div.venser > ul.genres > li > a").each(function() {
    let name = $(this).text().trim()
    let href = $(this).attr("href") || ""
    let link = href.startsWith("http") ? href : "https://otakudesu.cloud" + href
    let slug = href.replace(/\/genres\//, "").replace(/\//g, "")

    result.push({ name, link, slug })
  })

  return result
}

module.exports = {
  [Symbol("creator")]: "Restu",
  getImageBuffer,
  search,
  get,
  stream,
  download,
  schedule,
  ongoingAnime,
  genre,
  genreList
}
