const { randomUUID } = require('crypto');

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

const HTML_PAYLOAD = `<style>
*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;box-sizing:border-box}
body{margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer}
.card{width:100%;max-width:620px;margin:auto;padding:16px}
.box{background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)}
.header{padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;align-items:center}
.title-sub{font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.45);text-transform:uppercase}
.title{font-size:21px;font-weight:bold;color:#fff}
.stats{text-align:right}
.score-val{font-size:18px;font-weight:bold;color:#fff;text-shadow:0 0 10px rgba(108,92,231,.85)}
.streak-val{font-size:10px;color:rgba(255,255,255,.45);margin-top:2px}

.arena{padding:22px 18px;text-align:center}
.versus{display:flex;justify-content:space-around;align-items:center;margin-bottom:16px}
.fighter{display:flex;flex-direction:column;align-items:center;width:38%}
.fighter-label{font-size:12px;color:rgba(255,255,255,.6);margin-bottom:8px;font-weight:bold;letter-spacing:1px}
.choice-display{width:76px;height:76px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.2);display:flex;justify-content:center;align-items:center;font-size:36px;box-shadow:0 4px 15px rgba(0,0,0,.2);transition:all .3s ease}
.choice-display.win{border-color:#00b894;box-shadow:0 0 20px rgba(0,184,148,.7);transform:scale(1.08)}
.choice-display.lose{border-color:#d63031;box-shadow:0 0 20px rgba(214,48,49,.7);opacity:.65}
.vs-badge{font-size:14px;font-weight:900;color:#fdcb6e;background:rgba(253,203,110,.15);padding:6px 12px;border-radius:20px;border:1px solid rgba(253,203,110,.3)}

.result-banner{font-size:17px;font-weight:bold;margin:12px 0 18px 0;min-height:26px;transition:all .3s}
.result-banner.win{color:#55efc4;text-shadow:0 0 10px rgba(85,239,196,.6)}
.result-banner.lose{color:#ff7675;text-shadow:0 0 10px rgba(255,118,117,.6)}
.result-banner.draw{color:#ffeaa7;text-shadow:0 0 10px rgba(255,234,167,.6)}

.btn-group{display:flex;gap:10px;justify-content:center}
.btn-choice{flex:1;max-width:130px;padding:12px 8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:12px;color:#fff;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:4px}
.btn-choice:active{transform:scale(.93);background:rgba(108,92,231,.35);border-color:#6c5ce7}
.btn-choice .icon{font-size:26px}
.btn-choice .label{font-size:11px;font-weight:bold;color:rgba(255,255,255,.85)}
</style>
<body style="margin:0">
<div class="card">
<div class="box">
<div class="header">
<div><div class="title-sub">NIXEL SUIT</div><div class="title">Suit vs Bot</div></div>
<div class="stats">
<div id="wins" class="score-val">W: 0 | L: 0</div>
<div id="streak" class="streak-val">STREAK: 0</div>
</div>
</div>
<div class="arena">
<div class="versus">
<div class="fighter">
<div class="fighter-label">KAMU</div>
<div id="player-choice" class="choice-display">❓</div>
</div>
<div class="vs-badge">VS</div>
<div class="fighter">
<div class="fighter-label">BOT</div>
<div id="bot-choice" class="choice-display">❓</div>
</div>
</div>
<div id="result" class="result-banner">Pilih ✊ Batu, ✌️ Gunting, atau 🖐️ Kertas!</div>
<div class="btn-group">
<button class="btn-choice" onclick="play('batu')">
<span class="icon">✊</span>
<span class="label">Batu</span>
</button>
<button class="btn-choice" onclick="play('gunting')">
<span class="icon">✌️</span>
<span class="label">Gunting</span>
</button>
<button class="btn-choice" onclick="play('kertas')">
<span class="icon">🖐️</span>
<span class="label">Kertas</span>
</button>
</div>
</div>
</div>
</div>
<script>
const emojis = { batu: '✊', gunting: '✌️', kertas: '🖐️' };
const options = ['batu', 'gunting', 'kertas'];
let winCount = 0, loseCount = 0, streakCount = 0;
let playing = false;

function loadStats(){
  try{
    let w = localStorage.getItem('suit_win') || 0;
    let l = localStorage.getItem('suit_lose') || 0;
    let s = localStorage.getItem('suit_streak') || 0;
    winCount = parseInt(w, 10);
    loseCount = parseInt(l, 10);
    streakCount = parseInt(s, 10);
    updateUI();
  }catch(e){}
}
function saveStats(){
  try{
    localStorage.setItem('suit_win', winCount);
    localStorage.setItem('suit_lose', loseCount);
    localStorage.setItem('suit_streak', streakCount);
  }catch(e){}
}
function updateUI(){
  document.getElementById('wins').textContent = 'W: ' + winCount + ' | L: ' + loseCount;
  document.getElementById('streak').textContent = 'STREAK: ' + streakCount;
}

function play(playerMove){
  if(playing) return;
  playing = true;

  const playerDisplay = document.getElementById('player-choice');
  const botDisplay = document.getElementById('bot-choice');
  const resultBanner = document.getElementById('result');

  playerDisplay.className = 'choice-display';
  botDisplay.className = 'choice-display';
  playerDisplay.textContent = emojis[playerMove];

  let shuffleCount = 0;
  const shuffleInterval = setInterval(()=>{
    botDisplay.textContent = emojis[options[Math.floor(Math.random()*3)]];
    shuffleCount++;
    if(shuffleCount >= 10){
      clearInterval(shuffleInterval);
      const botMove = options[Math.floor(Math.random()*3)];
      botDisplay.textContent = emojis[botMove];

      if(playerMove === botMove){
        resultBanner.textContent = '🤝 SERI / DRAW!';
        resultBanner.className = 'result-banner draw';
      } else if(
        (playerMove === 'batu' && botMove === 'gunting') ||
        (playerMove === 'gunting' && botMove === 'kertas') ||
        (playerMove === 'kertas' && botMove === 'batu')
      ){
        winCount++;
        streakCount++;
        saveStats();
        updateUI();
        resultBanner.textContent = '🎉 KAMU MENANG! 🏆';
        resultBanner.className = 'result-banner win';
        playerDisplay.className = 'choice-display win';
        botDisplay.className = 'choice-display lose';
      } else {
        loseCount++;
        streakCount = 0;
        saveStats();
        updateUI();
        resultBanner.textContent = '💻 BOT MENANG! 😜';
        resultBanner.className = 'result-banner lose';
        playerDisplay.className = 'choice-display lose';
        botDisplay.className = 'choice-display win';
      }
      playing = false;
    }
  }, 60);
}
loadStats();
</script>
</body>`;

module.exports = {
  CmD: ['suit'],
  aliases: ['suit', 'gbk', 'suitbot', 'guntingbatukertas'],
  categori: 'game',
  exec: async (m, { bob, text, prefix, command }) => {
    const conn = bob || m.conn || global.conn;
    const targetChat = m.chat || m.from;

    const rawMessage = {
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [
              {
                messageType: 2,
                messageText: 'Fiora Sylvie'
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
                          payload: HTML_PAYLOAD,
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

    try {
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
      console.error('Error executing suit plugin:', e);
      return m.reply('❌ Gagal menampilkan game Suit: ' + e.message);
    }
  }
};
