const axios = require('axios');
const { randomUUID } = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let generateWAMessageFromContent;
async function getGenerateWAMessageFromContent() {
  if (!generateWAMessageFromContent) {
    try {
      const baileys = await import('@whiskeysockets/baileys');
      generateWAMessageFromContent = baileys.generateWAMessageFromContent;
    } catch (e) {}
  }
  return generateWAMessageFromContent;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Downscale thumbnail image to ~15KB Base64
 */
function processThumbnailToBase64(imgBuffer) {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const tmpIn = path.join(os.tmpdir(), `t_in_${uniqueId}.jpg`);
  const tmpOut = path.join(os.tmpdir(), `t_out_${uniqueId}.jpg`);

  try {
    fs.writeFileSync(tmpIn, imgBuffer);
    execSync(`ffmpeg -y -i "${tmpIn}" -vf "scale=200:200" -q:v 5 "${tmpOut}"`, { stdio: 'ignore', timeout: 8000 });
    const outBuf = fs.readFileSync(tmpOut);
    return `data:image/jpeg;base64,${outBuf.toString('base64')}`;
  } catch (e) {
    return `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
  }
}

/**
 * Compress audio to 24k mono MP3 (max 2.5 mins) so total payload Base64 is < 700KB.
 * Keeping total message size < 1MB ensures WhatsApp server accepts and delivers the message.
 */
function compressAudioToBase64(mp3Buffer) {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const tmpIn = path.join(os.tmpdir(), `a_in_${uniqueId}.mp3`);
  const tmpOut = path.join(os.tmpdir(), `a_out_${uniqueId}.mp3`);

  try {
    fs.writeFileSync(tmpIn, mp3Buffer);
    // Presisi kompresi: 24k bitrate, 22050Hz, mono, durasi maksimal 150 detik (2.5 menit)
    execSync(`ffmpeg -y -i "${tmpIn}" -t 150 -b:a 24k -ar 22050 -ac 1 "${tmpOut}"`, { stdio: 'ignore', timeout: 15000 });
    const compressedBuffer = fs.readFileSync(tmpOut);
    return `data:audio/mp3;base64,${compressedBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Compress audio error:', err.message);
    return `data:audio/mp3;base64,${mp3Buffer.toString('base64')}`;
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
  }
}

module.exports = {
  CmD: ['play'],
  aliases: ['play', 'ytplay', 'musik', 'music', 'song', 'lagu'],
  categori: 'downloader',
  exec: async (m, { bob, prefix, command, text }) => {
    const conn = bob || m.conn || global.conn;
    const targetChat = m.chat || m.from;

    if (!text || !text.trim()) {
      return m.reply(`🎵 *PLAYER MUSIC INTERAKTIF*\n\nPenggunaan: *${prefix + command} <judul lagu / query>*\nContoh: *${prefix + command} dj dalinda*`);
    }

    await m.reply('⏳ *Memproses Musik...*\nSedang mengunduh & mengompresi data audio...');

    try {
      const apiUrl = `https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(text.trim())}`;
      const { data: apiRes } = await axios.get(apiUrl, { timeout: 30000 });

      if (!apiRes || !apiRes.status || !apiRes.result) {
        return m.reply('❌ Lagu tidak ditemukan. Silakan gunakan kata kunci pencarian yang lain.');
      }

      const song = apiRes.result;
      const title = song.title || 'Unknown Title';
      const author = song.author || 'Unknown Artist';
      const durationStr = song.duration_timestamp || '02:30';
      const thumbUrl = song.thumbnail;
      const mp3Url = song.mp3;

      if (!mp3Url) {
        return m.reply('❌ Audio MP3 tidak tersedia untuk lagu ini.');
      }

      // 1. Download & Kompres Thumbnail ke Base64 (~15KB)
      let imgSrc = thumbUrl || '';
      if (thumbUrl) {
        try {
          const imgResponse = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 10000 });
          imgSrc = processThumbnailToBase64(Buffer.from(imgResponse.data));
        } catch (err) {
          console.error('Thumbnail download error:', err.message);
        }
      }

      // 2. Download MP3 & Kompresi Super Hemat ke Base64 (~400KB - 600KB)
      const audioResponse = await axios.get(mp3Url, { responseType: 'arraybuffer', timeout: 30000 });
      const rawAudioBuffer = Buffer.from(audioResponse.data);
      const audioB64 = compressAudioToBase64(rawAudioBuffer);

      const safeTitle = escapeHtml(title);
      const safeAuthor = escapeHtml(author);

      const htmlPayload = `<style>
*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;box-sizing:border-box}
.disc{width:120px;height:120px;border-radius:50%;border:4px solid rgba(255,255,255,.2);box-shadow:0 0 20px rgba(0,0,0,.6);position:relative;animation:spin 6s linear infinite;animation-play-state:paused;background-size:cover;background-position:center;flex-shrink:0;background-color:#222}
.disc.playing{animation-play-state:running}
.disc::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:#14141e;border:3px solid rgba(255,255,255,.3)}
@keyframes spin{100%{transform:rotate(360deg)}}
.btn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;transition:all .15s}
.btn:active{transform:scale(.9);background:rgba(255,255,255,.25)}
.btn.main{width:56px;height:56px;background:linear-gradient(135deg,#00d2d3,#ff6b6b);border:none;color:#fff;font-size:22px}
.bar{width:4px;height:12px;background:#00d2d3;border-radius:2px;animation:eq 1s ease-in-out infinite alternate;animation-play-state:paused}
.playing .bar{animation-play-state:running}
@keyframes eq{0%{height:4px}100%{height:20px}}
</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee">
<div style="width:100%;max-width:620px;margin:auto;padding:16px;box-sizing:border-box">
<div style="background:rgba(20,20,30,.85);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1.5px solid rgba(255,255,255,.25);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.5)">
<div style="padding:16px 20px;border-bottom:2px solid rgba(255,255,255,.2);display:flex;justify-content:space-between;align-items:center">
<div style="overflow:hidden;padding-right:10px">
<div style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.55)">NOW PLAYING</div>
<div style="font-size:16px;font-weight:bold;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="tTitle">${safeTitle}</div>
</div>
<div id="eqBox" style="display:flex;align-items:center;gap:3px;height:24px;flex-shrink:0">
<div class="bar" style="animation-delay:.1s"></div>
<div class="bar" style="animation-delay:.3s;background:#ff6b6b"></div>
<div class="bar" style="animation-delay:.2s"></div>
<div class="bar" style="animation-delay:.4s;background:#ff6b6b"></div>
</div>
</div>
<div style="padding:20px;display:flex;flex-direction:column;align-items:center">
<div style="display:flex;align-items:center;gap:20px;width:100%;max-width:340px;margin-bottom:18px">
<div id="disc" class="disc" style="${imgSrc ? `background-image: url('${imgSrc}');` : ''}"></div>
<div style="flex:1;overflow:hidden">
<div style="font-size:15px;font-weight:bold;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="trackName">${safeTitle}</div>
<div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:4px" id="trackArtist">${safeAuthor}</div>
<div style="font-size:11px;background:rgba(0,210,211,.15);color:#00d2d3;padding:3px 8px;border-radius:6px;display:inline-block;margin-top:8px">HQ AUDIO • ${durationStr}</div>
</div>
</div>
<div style="width:100%;max-width:340px;margin-bottom:16px">
<div style="width:100%;height:6px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden;cursor:pointer;position:relative" onclick="seek(event)">
<div id="prog" style="width:0%;height:100%;background:linear-gradient(90deg,#00d2d3,#ff6b6b);border-radius:3px"></div>
</div>
<div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.5);margin-top:6px">
<span id="cTime">00:00</span>
<span id="dTime">${durationStr}</span>
</div>
</div>
<audio id="aud" src="${audioB64}" preload="auto" playsinline webkit-playsinline></audio>
<div style="display:flex;align-items:center;gap:16px">
<button class="btn" onclick="rw()">⏪</button>
<button id="playBtn" class="btn main" onclick="togglePlay()">▶</button>
<button class="btn" onclick="ff()">⏩</button>
</div>
</div>
</div>
</div>
<script>
const aud=document.getElementById("aud"),disc=document.getElementById("disc"),eq=document.getElementById("eqBox"),pBtn=document.getElementById("playBtn"),pBar=document.getElementById("prog"),cT=document.getElementById("cTime");
function fmt(s){let m=Math.floor(s/60),r=Math.floor(s%60);return(m<10?"0":"")+m+":"+(r<10?"0":"")+r}
function togglePlay(){
if(aud.paused){
aud.play().then(()=>{
disc.classList.add("playing");
eq.classList.add("playing");
pBtn.textContent="⏸";
}).catch(e=>{
console.log(e);
});
}else{
aud.pause();
disc.classList.remove("playing");
eq.classList.remove("playing");
pBtn.textContent="▶";
}
}
aud.addEventListener("timeupdate",()=>{
if(aud.duration){
pBar.style.width=(aud.currentTime/aud.duration*100)+"%";
cT.textContent=fmt(aud.currentTime);
}
});
aud.addEventListener("ended",()=>{
disc.classList.remove("playing");
eq.classList.remove("playing");
pBtn.textContent="▶";
pBar.style.width="0%";
cT.textContent="00:00";
});
function seek(e){
let r=e.currentTarget.getBoundingClientRect(),pct=(e.clientX-r.left)/r.width;
if(aud.duration) aud.currentTime=pct*aud.duration;
}
function rw(){aud.currentTime=Math.max(0,aud.currentTime-10)}
function ff(){if(aud.duration)aud.currentTime=Math.min(aud.duration,aud.currentTime+10)}
</script>
</body>`;

      const rawMessage = {
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages: [
                {
                  messageType: 2,
                  messageText: 'Music Player'
                }
              ],
              unifiedResponse: {
                data: Buffer.from(
                  JSON.stringify({
                    response_id: randomUUID(),
                    sections: [
                      {
                        view_model: {
                          primitive: {
                            __typename: 'GenAIaeacdsnwHtmlPrimitive',
                            payload: htmlPayload,
                            trusted_sources: []
                          },
                          __typename: 'GenAISingleLayoutViewModel'
                        }
                      }
                    ]
                  })
                ).toString('base64')
              },
              contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: {
                  botJid: '867051314767696@bot'
                },
                forwardOrigin: 4
              }
            }
          }
        }
      };

      const genMsgFunc = await getGenerateWAMessageFromContent();
      if (genMsgFunc) {
        const waMsg = genMsgFunc(targetChat, rawMessage, {
          additionalAttributes: { type: 'text' }
        });
        await conn.relayMessage(targetChat, waMsg.message, { messageId: waMsg.key.id });
      } else {
        await conn.relayMessage(targetChat, rawMessage, {
          additionalAttributes: { type: 'text' }
        });
      }
    } catch (e) {
      console.error('Error executing music play plugin:', e);
      return m.reply('❌ Gagal mengunduh atau memutar lagu: ' + (e.message || e));
    }
  }
};
