const nekopoi = require('../lib/scrapers/nekopoi.js');

module.exports = {
  CmD: ['nekopoi'],
  aliases: ['nekopoi', 'nekopoisearch', 'nekopoidetail', 'nekopoilatest'],
  categori: "search",
  exec: async (m, { bob, text, prefix, command }) => {
    try {
      if (!text) {
        return m.reply(
          `*🔞 NEKOPOI SCRAPER & DOWNLOADER 🔞*\n\n` +
          `📌 *Cara Penggunaan:*\n` +
          `• Episode Terbaru: *${prefix + command} latest*\n` +
          `• Cari Video: *${prefix + command} <kata_kunci>*\n` +
          `• Detail & Download: *${prefix + command} detail <url>*\n\n` +
          `💡 *Contoh:*\n` +
          `• ${prefix + command} latest\n` +
          `• ${prefix + command} shion\n` +
          `• ${prefix + command} detail https://nekopoi.care/...`
        );
      }

      const args = text.trim().split(' ');
      let subCommand = args[0].toLowerCase();
      let linkTarget = args.slice(1).join(' ');

      if (command.toLowerCase() === 'nekopoidetail') {
        subCommand = 'detail';
        linkTarget = text.trim();
      } else if (subCommand.startsWith('http') || subCommand.includes('nekopoi.care')) {
        linkTarget = text.trim();
        subCommand = 'detail';
      }

      if (subCommand === 'latest' || command.toLowerCase() === 'nekopoilatest') {
        await m.reply('⏳ *Mengambil daftar episode terbaru...*');
        const res = await nekopoi.latest();
        if (res.error || !res.length) return m.reply('❌ Gagal mengambil data terbaru atau tidak ada hasil.');

        let txt = `*🎬 NEKOPOI - EPISODE TERBARU 🎬*\n\n`;
        res.slice(0, 10).forEach((item, i) => {
          txt += `*${i + 1}. ${item.title}*\n`;
          txt += `🔗 ${item.link}\n\n`;
        });
        txt += `_Ketik *${prefix + command} detail <url>* untuk mendapatkan link streaming & download._`;
        return m.reply(txt.trim());
      }

      if (subCommand === 'detail') {
        const link = linkTarget;
        if (!link) return m.reply(`❌ Format salah! Contoh: *${prefix + command} detail <url>*`);
        await m.reply('⏳ *Mengambil detail video, link streaming & download...*');
        const res = await nekopoi.detail(link);
        if (res.error) return m.reply(`❌ Error: ${res.message}`);

        let txt = `*📺 DETAIL VIDEO NEKOPOI 📺*\n\n`;
        txt += `📌 *Judul:* ${res.title}\n`;
        if (res.releaseDate) txt += `📅 *Rilis:* ${res.releaseDate}\n`;
        if (res.views) txt += `👁️ *Views:* ${res.views}\n`;
        txt += `🌐 *URL:* ${res.url}\n\n`;

        if (res.streams && res.streams.length > 0) {
          txt += `━━━━━ 🎬 *STREAMING EMBED* 🎬 ━━━━━\n`;
          res.streams.forEach((streamUrl, i) => {
            txt += `▶️ *Server ${i + 1}:* ${streamUrl}\n`;
          });
          txt += `\n`;
        }

        txt += `━━━━━ 📥 *LINK DOWNLOAD* 📥 ━━━━━\n\n`;

        if (res.downloads && res.downloads.length > 0) {
          res.downloads.forEach((item) => {
            txt += `🎥 *Kualitas [ ${item.quality} ]*\n`;
            item.links.forEach((l) => {
              txt += `  • *${l.host}*: ${l.link}\n`;
            });
            txt += `\n`;
          });
        } else {
          txt += `⚠️ _Link download tidak ditemukan pada halaman ini._\n`;
        }

        if (res.thumbnail) {
          await bob.sendMessage(m.chat, { image: { url: res.thumbnail }, caption: txt.trim() }, { quoted: m });
        } else {
          await m.reply(txt.trim());
        }

        if (res.streams && res.streams.length > 0) {
          try {
            const buttons = [];
            res.streams.forEach((streamUrl, idx) => {
              if (idx < 3) {
                buttons.push({
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: `Server ${idx + 1} (In-app WebView)`,
                    url: streamUrl,
                    webview_interaction: true,
                  }),
                });
                buttons.push({
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: `Server ${idx + 1} (External Browser)`,
                    url: streamUrl,
                  }),
                });
              }
            });

            const interactiveMsg = {
              interactiveMessage: {
                header: {
                  title: `🎬 Stream NekoPoi: ${res.title.slice(0, 45)}`,
                },
                body: {
                  text: `Pilih server streaming di bawah untuk memutar video langsung melalui browser / in-app player:`,
                },
                nativeFlowMessage: {
                  buttons: buttons,
                  messageParamsJson: "{}",
                },
              },
            };

            const relayOpts = {
              additionalNodes: [
                {
                  tag: "biz",
                  attrs: {},
                  content: [
                    {
                      tag: "interactive",
                      attrs: {
                        type: "native_flow",
                        v: "1",
                      },
                      content: [
                        {
                          tag: "native_flow",
                          attrs: {
                            v: "9",
                            name: "mixed",
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            };

            let generateWAMessageFromContent;
            try {
              const baileys = await import('@whiskeysockets/baileys');
              generateWAMessageFromContent = baileys.generateWAMessageFromContent;
            } catch (e) {}

            if (generateWAMessageFromContent) {
              const waMsg = generateWAMessageFromContent(m.chat, interactiveMsg, {});
              await bob.relayMessage(m.chat, waMsg.message, { ...relayOpts, messageId: waMsg.key.id });
            } else {
              await bob.relayMessage(m.chat, interactiveMsg, relayOpts);
            }
          } catch (relayErr) {
            console.error("NekoPoi relayMessage streaming error:", relayErr);
          }
        }
        return;
      }

      // Default: Search
      await m.reply(`⏳ *Mencari "${text}" di NekoPoi...*`);
      const searchRes = await nekopoi.search(text);
      if (searchRes.error || !searchRes.length) return m.reply(`❌ Tidak ditemukan hasil untuk *"${text}"*.`);

      let txt = `*🔍 NEKOPOI - HASIL PENCARIAN 🔍*\n\n`;
      searchRes.slice(0, 10).forEach((item, i) => {
        txt += `*${i + 1}. ${item.title}*\n`;
        txt += `🔗 ${item.link}\n\n`;
      });
      txt += `_Gunakan *${prefix + command} detail <url>* untuk melihat stream embed & link download per kualitas._`;

      return m.reply(txt.trim());
    } catch (err) {
      console.error(err);
      return m.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};
