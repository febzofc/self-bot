const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://nekopoi.care';
const headers = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

const latest = async () => {
  try {
    const { data } = await axios.get(BASE_URL, { headers });
    const $ = cheerio.load(data);
    const result = [];

    $('h2').each((i, el) => {
      const title = $(el).text().trim();
      const link = $(el).find('a').attr('href') || $(el).closest('a').attr('href');
      if (link && title && title !== 'Direkomendasikan' && title !== 'Hentai terbaru' && title !== 'Episode Terbaru') {
        result.push({
          title,
          link
        });
      }
    });

    return result;
  } catch (error) {
    return { error: true, message: error.message };
  }
};

const search = async (query) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, { headers });
    const $ = cheerio.load(data);
    const result = [];

    $('h2').each((i, el) => {
      const title = $(el).text().trim();
      const link = $(el).find('a').attr('href') || $(el).closest('a').attr('href');
      if (link && title && title !== 'Posts pagination') {
        result.push({
          title,
          link
        });
      }
    });

    return result;
  } catch (error) {
    return { error: true, message: error.message };
  }
};

const list = async (type = 'hentai', page = 1) => {
  try {
    let url = `${BASE_URL}/category/${type}/`;
    if (page > 1) {
      url = `${BASE_URL}/category/${type}/page/${page}/`;
    }
    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const result = [];

    $('a').each((i, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr('href');
      if (link && link.includes('nekopoi.care/') && title.length > 10 && !link.includes('/category/') && !link.includes('/hentai-list/')) {
        if (!result.some(item => item.link === link)) {
          result.push({
            title: title.replace(/\n+/g, ' ').replace(/\s+/g, ' '),
            link
          });
        }
      }
    });

    return result;
  } catch (error) {
    return { error: true, message: error.message };
  }
};

const detail = async (url) => {
  try {
    const targetUrl = url.startsWith('http') ? url : `${BASE_URL}/${url}`;
    const { data } = await axios.get(targetUrl, { headers });
    const $ = cheerio.load(data);

    const title = $('h1').first().text().trim() || $('title').text().trim();
    const thumbnail = $('.nk-featured-img img').attr('src') || $('img').eq(2).attr('src') || null;
    const views = $('.nk-post-header-meta span').first().text().trim() || null;
    const releaseDate = $('.nk-post-header-meta span').last().text().trim() || null;

    // Parse stream embed URLs (iframe)
    const streams = [];
    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && (src.includes('http') || src.includes('//'))) {
        const streamUrl = src.startsWith('//') ? `https:${src}` : src;
        if (!streams.includes(streamUrl)) {
          streams.push(streamUrl);
        }
      }
    });

    const downloads = [];

    // Parse .nk-download-row
    $('.nk-download-row').each((i, el) => {
      const rawTitle = $(el).find('.nk-download-name').text().trim();
      const qualityMatch = rawTitle.match(/\[(\d+p)\]/);
      const quality = qualityMatch ? qualityMatch[1] : (rawTitle.includes('4K') ? '4K' : 'HD');

      const links = [];
      $(el).find('.nk-download-links a').each((j, a) => {
        const host = $(a).text().trim();
        const link = $(a).attr('href');
        if (host && link) {
          links.push({ host, link });
        }
      });

      if (links.length > 0) {
        downloads.push({
          quality,
          title: rawTitle,
          links
        });
      }
    });

    // Fallback download links
    if (downloads.length === 0) {
      const fallbackLinks = [];
      $('a').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href');
        if (href && (href.includes('ouo.io') || href.includes('mega') || href.includes('drive') || text.includes('Mp4Upload') || text.includes('Pixeldrain') || text.includes('PixelDrain'))) {
          fallbackLinks.push({ host: text || 'Download Link', link: href });
        }
      });
      if (fallbackLinks.length > 0) {
        downloads.push({
          quality: 'Default',
          title,
          links: fallbackLinks
        });
      }
    }

    return {
      title,
      thumbnail,
      views,
      releaseDate,
      url: targetUrl,
      streams,
      downloads
    };
  } catch (error) {
    return { error: true, message: error.message };
  }
};

module.exports = {
  latest,
  search,
  list,
  detail,
  default: {
    latest,
    search,
    list,
    detail
  }
};
