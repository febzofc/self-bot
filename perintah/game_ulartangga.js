const { randomUUID } = require('crypto');
const fs = require('fs');

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

// Global text-based session storage
global.ulartanggaSessions = global.ulartanggaSessions || {};

// Default board config (10x10)
const LADDERS_10 = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };
const SNAKES_10 = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78 };

function renderTextBoard(playerPos, botPos, cols = 10, rows = 10) {
  const totalCells = cols * rows;
  let boardStr = `*🎲 PAPAN ULAR TANGGA (${cols}x${rows})*\n\n`;
  
  for (let r = 0; r < rows; r++) {
    let rowCells = [];
    const rowFromBottom = rows - 1 - r;
    for (let c = 0; c < cols; c++) {
      let colFromLeft = (rowFromBottom % 2 === 1) ? (cols - 1 - c) : c;
      let cellNum = rowFromBottom * cols + colFromLeft + 1;
      
      let mark = '';
      if (playerPos === cellNum && botPos === cellNum) {
        mark = '👥';
      } else if (playerPos === cellNum) {
        mark = '🧑';
      } else if (botPos === cellNum) {
        mark = '🤖';
      } else if (LADDERS_10[cellNum]) {
        mark = '🪜';
      } else if (SNAKES_10[cellNum]) {
        mark = '🐍';
      } else if (cellNum === totalCells) {
        mark = '🏆';
      } else {
        mark = String(cellNum).padStart(2, '0');
      }
      rowCells.push(`[${mark}]`);
    }
    boardStr += rowCells.join('') + '\n';
  }
  boardStr += `\nKeterangan: 🧑 Player | 🤖 Bot | 🪜 Tangga | 🐍 Ular | 🏆 Finish (Sel ${totalCells})`;
  return boardStr;
}

const HTML_PAYLOAD = `<style>
* { -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; box-sizing: border-box; }
body { margin: 0; padding: 0; background: #0f172a; font-family: Arial, sans-serif; color: #f8fafc; cursor: pointer; }
.card { width: 100%; max-width: 620px; margin: auto; padding: 12px; }
.box { background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
.header { padding: 14px 18px; background: rgba(15, 23, 42, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; }
.title-sub { font-size: 10px; letter-spacing: 1.5px; color: #38bdf8; text-transform: uppercase; font-weight: bold; }
.title { font-size: 19px; font-weight: bold; color: #fff; }
.stats { text-align: right; }
.score-val { font-size: 13px; font-weight: bold; color: #e2e8f0; }
.streak-val { font-size: 10px; color: #94a3b8; margin-top: 2px; }

.controls-bar { padding: 10px 14px; background: rgba(15, 23, 42, 0.5); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; }
.size-selector label { font-size: 11px; color: #94a3b8; }
.size-selector select { background: #1e293b; color: #f8fafc; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 3px 6px; font-size: 11px; outline: none; cursor: pointer; }

.board-container { padding: 12px; text-align: center; background: #0f172a; }
#gameCanvas { width: 100%; height: auto; border-radius: 10px; border: 2px solid rgba(255, 255, 255, 0.15); background: #1e293b; display: block; margin: auto; }

.turn-banner { padding: 10px 14px; margin: 8px 12px; border-radius: 10px; font-size: 13px; font-weight: bold; text-align: center; transition: all 0.3s ease; }
.turn-player { background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; }
.turn-bot { background: rgba(244, 63, 94, 0.2); border: 1px solid rgba(244, 63, 94, 0.4); color: #f43f5e; }

.action-area { padding: 12px 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.dice-row { display: flex; align-items: center; gap: 16px; justify-content: center; width: 100%; }

.dice-display { width: 56px; height: 56px; background: #ffffff; border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 2px solid #cbd5e1; color: #0f172a; font-weight: bold; }
.dice-display.rolling { animation: shake 0.1s infinite alternate; }
@keyframes shake {
  0% { transform: rotate(-10deg) scale(0.95); }
  100% { transform: rotate(10deg) scale(1.05); }
}

.btn-roll { padding: 12px 24px; background: #2563eb; border: none; border-radius: 12px; color: #ffffff; font-size: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); transition: all 0.15s; }
.btn-roll:active:not(:disabled) { transform: scale(0.95); background: #1d4ed8; }
.btn-roll:disabled { opacity: 0.4; cursor: not-allowed; background: #475569; box-shadow: none; }

.btn-reset { padding: 6px 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #cbd5e1; font-size: 11px; cursor: pointer; }

.log-box { width: 100%; max-height: 70px; overflow-y: auto; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 6px 10px; font-size: 11px; color: #94a3b8; text-align: left; }
.log-item { margin-bottom: 2px; }
.log-item.player { color: #38bdf8; }
.log-item.bot { color: #f43f5e; }
.log-item.event { color: #f59e0b; font-weight: bold; }
</style>
<body style="margin:0">
<div class="card">
<div class="box">
  <div class="header">
    <div>
      <div class="title-sub">NIXEL GAME</div>
      <div class="title">🎲 Ular Tangga</div>
    </div>
    <div class="stats">
      <div id="scoreVal" class="score-val">W: 0 | L: 0</div>
      <div id="streakVal" class="streak-val">STREAK: 0</div>
    </div>
  </div>

  <div class="controls-bar">
    <div class="size-selector">
      <label>Ukuran Papan: </label>
      <select id="boardSize" onchange="changeSize(this.value)">
        <option value="10">10 x 10 (100 Sel - Standar)</option>
        <option value="8">8 x 8 (64 Sel - Cepat)</option>
        <option value="6">6 x 6 (36 Sel - Super Cepat)</option>
      </select>
    </div>
    <button class="btn-reset" onclick="resetGame()">🔄 Reset</button>
  </div>

  <div class="board-container">
    <canvas id="gameCanvas" width="480" height="480"></canvas>
  </div>

  <div id="turnBanner" class="turn-banner turn-player">🎮 Giliran Kamu! Klik 'KOCOK DADU'.</div>

  <div class="action-area">
    <div class="dice-row">
      <div id="diceBox" class="dice-display">🎲</div>
      <button id="rollBtn" class="btn-roll" onclick="handleRoll()">🎲 KOCOK DADU</button>
    </div>

    <div id="logBox" class="log-box">
      <div class="log-item event">Game siap! Silakan kocok dadu.</div>
    </div>
  </div>
</div>
</div>

<script>
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const diceFaces = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

let gridSize = 10;
let totalCells = 100;

const BOARDS = {
  10: {
    ladders: { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 },
    snakes: { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78 }
  },
  8: {
    ladders: { 3: 18, 12: 30, 22: 44, 36: 58, 41: 57 },
    snakes: { 14: 4, 31: 10, 47: 25, 53: 20, 62: 38 }
  },
  6: {
    ladders: { 2: 15, 8: 22, 17: 33 },
    snakes: { 14: 3, 27: 7, 34: 12 }
  }
};

let ladders = BOARDS[10].ladders;
let snakes = BOARDS[10].snakes;

let playerPos = 1;
let botPos = 1;
let isPlayerTurn = true;
let isAnimating = false;
let wins = 0, losses = 0, streak = 0;

function loadStats() {
  try {
    wins = parseInt(localStorage.getItem('ut_win') || '0', 10);
    losses = parseInt(localStorage.getItem('ut_lose') || '0', 10);
    streak = parseInt(localStorage.getItem('ut_streak') || '0', 10);
  } catch (e) {}
  updateStatsUI();
}

function saveStats() {
  try {
    localStorage.setItem('ut_win', String(wins));
    localStorage.setItem('ut_lose', String(losses));
    localStorage.setItem('ut_streak', String(streak));
  } catch (e) {}
  updateStatsUI();
}

function updateStatsUI() {
  document.getElementById('scoreVal').textContent = 'W: ' + wins + ' | L: ' + losses;
  document.getElementById('streakVal').textContent = 'STREAK: ' + streak;
}

function getCoords(cellNum) {
  const zeroIdx = cellNum - 1;
  const rowFromBottom = Math.floor(zeroIdx / gridSize);
  const colFromLeft = zeroIdx % gridSize;
  const col = (rowFromBottom % 2 === 1) ? (gridSize - 1 - colFromLeft) : colFromLeft;
  const row = gridSize - 1 - rowFromBottom;

  const cellW = canvas.width / gridSize;
  const cellH = canvas.height / gridSize;

  const x = col * cellW + cellW / 2;
  const y = row * cellH + cellH / 2;
  return { x, y, cellW, cellH, row, col };
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cellW = canvas.width / gridSize;
  const cellH = canvas.height / gridSize;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const rowFromBottom = gridSize - 1 - r;
      const colFromLeft = (rowFromBottom % 2 === 1) ? (gridSize - 1 - c) : c;
      const cellNum = rowFromBottom * gridSize + colFromLeft + 1;

      ctx.fillStyle = ((r + c) % 2 === 0) ? '#1e293b' : '#0f172a';
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = 'bold ' + Math.max(9, Math.floor(cellW * 0.22)) + 'px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(cellNum, c * cellW + 3, r * cellH + 3);
    }
  }

  // Draw Finish Cell
  const fin = getCoords(totalCells);
  ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
  ctx.fillRect(fin.col * cellW, fin.row * cellH, cellW, cellH);
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold ' + Math.floor(cellW * 0.32) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏆', fin.x, fin.y);

  // Draw Ladders
  for (let start in ladders) {
    const end = ladders[start];
    const p1 = getCoords(parseInt(start, 10));
    const p2 = getCoords(end);
    drawLadder(p1.x, p1.y, p2.x, p2.y, cellW);
  }

  // Draw Snakes
  for (let start in snakes) {
    const end = snakes[start];
    const p1 = getCoords(parseInt(start, 10));
    const p2 = getCoords(end);
    drawSnake(p1.x, p1.y, p2.x, p2.y, cellW);
  }

  // Draw Tokens
  const pPos = getCoords(playerPos);
  const bPos = getCoords(botPos);

  if (playerPos === botPos) {
    drawToken(pPos.x - cellW * 0.18, pPos.y, cellW * 0.36, '#38bdf8', '🧑');
    drawToken(bPos.x + cellW * 0.18, bPos.y, cellW * 0.36, '#f43f5e', '🤖');
  } else {
    drawToken(pPos.x, pPos.y, cellW * 0.38, '#38bdf8', '🧑');
    drawToken(bPos.x, bPos.y, cellW * 0.38, '#f43f5e', '🤖');
  }
}

function drawLadder(x1, y1, x2, y2, cellW) {
  ctx.save();
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = Math.max(3, cellW * 0.08);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const railDist = cellW * 0.14;

  ctx.translate(x1, y1);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, -railDist);
  ctx.lineTo(len, -railDist);
  ctx.moveTo(0, railDist);
  ctx.lineTo(len, railDist);
  ctx.stroke();

  const rungs = Math.max(3, Math.floor(len / (cellW * 0.28)));
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = Math.max(2, cellW * 0.05);
  for (let i = 1; i < rungs; i++) {
    const rx = (len / rungs) * i;
    ctx.beginPath();
    ctx.moveTo(rx, -railDist);
    ctx.lineTo(rx, railDist);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnake(x1, y1, x2, y2, cellW) {
  ctx.save();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = Math.max(4, cellW * 0.11);

  const midX = (x1 + x2) / 2 + (y1 - y2) * 0.18;
  const midY = (y1 + y2) / 2 + (x2 - x1) * 0.18;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(midX, midY, x2, y2);
  ctx.stroke();

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(x1, y1, cellW * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawToken(x, y, radius, color, emoji) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = Math.floor(radius * 1.1) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y + 1);
  ctx.restore();
}

function addLog(text, type) {
  const box = document.getElementById('logBox');
  const d = document.createElement('div');
  d.className = 'log-item ' + (type || '');
  d.textContent = text;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function changeSize(val) {
  gridSize = parseInt(val, 10);
  totalCells = gridSize * gridSize;
  ladders = BOARDS[gridSize].ladders;
  snakes = BOARDS[gridSize].snakes;
  resetGame();
}

function resetGame() {
  playerPos = 1;
  botPos = 1;
  isPlayerTurn = true;
  isAnimating = false;

  document.getElementById('rollBtn').disabled = false;
  document.getElementById('turnBanner').className = 'turn-banner turn-player';
  document.getElementById('turnBanner').textContent = "🎮 Giliran Kamu! Klik 'KOCOK DADU'.";
  document.getElementById('diceBox').textContent = '🎲';
  document.getElementById('logBox').innerHTML = '<div class="log-item event">Game direset! Silakan kocok dadu.</div>';

  drawBoard();
}

function rollAnimation(finalVal, callback) {
  const diceBox = document.getElementById('diceBox');
  diceBox.classList.add('rolling');

  let count = 0;
  const timer = setInterval(function() {
    const temp = Math.floor(Math.random() * 6) + 1;
    diceBox.textContent = diceFaces[temp];
    count++;
    if (count > 10) {
      clearInterval(timer);
      diceBox.classList.remove('rolling');
      diceBox.textContent = diceFaces[finalVal];
      callback();
    }
  }, 60);
}

function handleRoll() {
  if (!isPlayerTurn || isAnimating) return;
  isAnimating = true;
  document.getElementById('rollBtn').disabled = true;

  const val = Math.floor(Math.random() * 6) + 1;
  addLog('🎲 Kamu mengocok dadu dan mendapat angka ' + val, 'player');

  rollAnimation(val, function() {
    movePlayer(val);
  });
}

function movePlayer(steps) {
  let target = playerPos + steps;
  if (target > totalCells) {
    addLog('⚠️ Langkah melebihi sel ' + totalCells + '. Posisi tetap di sel ' + playerPos, 'player');
    switchTurn();
    return;
  }

  let current = playerPos;
  const timer = setInterval(function() {
    current++;
    playerPos = current;
    drawBoard();

    if (current === target) {
      clearInterval(timer);
      setTimeout(function() {
        if (ladders[playerPos]) {
          const next = ladders[playerPos];
          addLog('🪜 Hore! Naik tangga dari sel ' + playerPos + ' ke sel ' + next, 'event');
          playerPos = next;
          drawBoard();
        } else if (snakes[playerPos]) {
          const next = snakes[playerPos];
          addLog('🐍 Tergelincir ular dari sel ' + playerPos + ' ke sel ' + next, 'event');
          playerPos = next;
          drawBoard();
        }

        if (playerPos === totalCells) {
          addLog('🎉 KAMU MENANG MEMENANGKAN ULAR TANGGA!', 'event');
          wins++;
          streak++;
          saveStats();
          document.getElementById('turnBanner').className = 'turn-banner turn-player';
          document.getElementById('turnBanner').textContent = '🏆 KAMU MENANG!';
          isAnimating = false;
          return;
        }

        switchTurn();
      }, 250);
    }
  }, 180);
}

function switchTurn() {
  isPlayerTurn = !isPlayerTurn;
  const banner = document.getElementById('turnBanner');

  if (!isPlayerTurn) {
    banner.className = 'turn-banner turn-bot';
    banner.textContent = '🤖 Giliran Bot sedang mengocok dadu...';
    setTimeout(botTurn, 900);
  } else {
    banner.className = 'turn-banner turn-player';
    banner.textContent = "🎮 Giliran Kamu! Klik 'KOCOK DADU'.";
    document.getElementById('rollBtn').disabled = false;
    isAnimating = false;
  }
}

function botTurn() {
  const val = Math.floor(Math.random() * 6) + 1;
  addLog('🎲 Bot mengocok dadu dan mendapat angka ' + val, 'bot');

  rollAnimation(val, function() {
    let target = botPos + val;
    if (target > totalCells) {
      addLog('🤖 Bot melebihi sel ' + totalCells + '. Bot tetap di sel ' + botPos, 'bot');
      switchTurn();
      return;
    }

    let current = botPos;
    const timer = setInterval(function() {
      current++;
      botPos = current;
      drawBoard();

      if (current === target) {
        clearInterval(timer);
        setTimeout(function() {
          if (ladders[botPos]) {
            const next = ladders[botPos];
            addLog('🪜 Bot naik tangga dari sel ' + botPos + ' ke sel ' + next, 'event');
            botPos = next;
            drawBoard();
          } else if (snakes[botPos]) {
            const next = snakes[botPos];
            addLog('🐍 Bot tergelincir ular dari sel ' + botPos + ' ke sel ' + next, 'event');
            botPos = next;
            drawBoard();
          }

          if (botPos === totalCells) {
            addLog('💻 BOT MENANG! Kamu kalah kali ini.', 'event');
            losses++;
            streak = 0;
            saveStats();
            banner.className = 'turn-banner turn-bot';
            banner.textContent = '💻 BOT MENANG!';
            isAnimating = false;
            return;
          }

          switchTurn();
        }, 250);
      }
    }, 180);
  });
}

canvas.addEventListener('click', function() {
  if (isPlayerTurn && !isAnimating) handleRoll();
});

loadStats();
drawBoard();
</script>
</body>`;

module.exports = {
  CmD: ['ulartangga'],
  aliases: ['ulartangga', 'ut', 'snakeladder', 'snakesandladders'],
  categori: 'game',
  exec: async (m, { bob, text, prefix, command }) => {
    const conn = bob || m.conn || global.conn;
    const targetChat = m.chat || m.from;
    const sender = m.sender || m.key.remoteJid;

    const args = (text || '').trim().split(/\s+/);
    const subCommand = args[0] ? args[0].toLowerCase() : '';

    // Handle text-based chat game mode commands
    if (subCommand === 'start' || subCommand === 'main') {
      global.ulartanggaSessions[targetChat] = {
        player: sender,
        playerPos: 1,
        botPos: 1,
        turn: 'player',
        size: 10,
        totalCells: 100
      };

      const boardVisual = renderTextBoard(1, 1);
      return m.reply(
        `🎮 *GAME ULAR TANGGA DIMULAI!*\n\n` +
        `Pemain: @${sender.split('@')[0]}\n` +
        `Lawan: Bot 🤖\n\n` +
        `${boardVisual}\n\n` +
        `📌 Gunakan *${prefix || '.'}${command} kocok* untuk mengocok dadu!\n` +
        `📌 Gunakan *${prefix || '.'}${command} stop* untuk mengakhiri game.`
      , null, { mentions: [sender] });
    }

    if (subCommand === 'stop' || subCommand === 'menyerah') {
      if (!global.ulartanggaSessions[targetChat]) {
        return m.reply(`❌ Tidak ada sesi game Ular Tangga yang sedang berlangsung di chat ini.`);
      }
      delete global.ulartanggaSessions[targetChat];
      return m.reply(`🛑 Sesi game Ular Tangga telah dihentikan.`);
    }

    if (subCommand === 'kocok' || subCommand === 'roll') {
      const session = global.ulartanggaSessions[targetChat];
      if (!session) {
        return m.reply(
          `❌ Belum ada game Ular Tangga berjalan di chat ini.\n\n` +
          `• Ketik *${prefix || '.'}${command} start* untuk main mode teks.\n` +
          `• Ketik *${prefix || '.'}${command}* untuk main mode web interactive card!`
        );
      }

      if (session.turn !== 'player') {
        return m.reply(`⏳ Sekarang giliran Bot untuk jalan.`);
      }

      // Player Turn
      const playerRollVal = Math.floor(Math.random() * 6) + 1;
      let playerTarget = session.playerPos + playerRollVal;
      let playerLog = `🎲 @${sender.split('@')[0]} mengocok dadu dan dapat angka *${playerRollVal}*.\n`;

      if (playerTarget > session.totalCells) {
        playerLog += `⚠️ Langkah melebihi sel ${session.totalCells}. Posisi tetap di sel ${session.playerPos}.\n`;
      } else {
        session.playerPos = playerTarget;
        playerLog += `➡️ Maju ke sel *${session.playerPos}*.\n`;

        if (LADDERS_10[session.playerPos]) {
          const up = LADDERS_10[session.playerPos];
          playerLog += `🪜 *HORE!* Kamu naik tangga ke sel *${up}*!\n`;
          session.playerPos = up;
        } else if (SNAKES_10[session.playerPos]) {
          const down = SNAKES_10[session.playerPos];
          playerLog += `🐍 *AWW!* Kamu tergelincir ular ke sel *${down}*!\n`;
          session.playerPos = down;
        }
      }

      if (session.playerPos === session.totalCells) {
        delete global.ulartanggaSessions[targetChat];
        return m.reply(
          `🎉 *SLAMET! KAMU MENANG!* 🎉\n\n` +
          `@${sender.split('@')[0]} berhasil mencapai sel 100 dan mengalahkan Bot! 🏆`
        , null, { mentions: [sender] });
      }

      // Bot Turn
      const botRollVal = Math.floor(Math.random() * 6) + 1;
      let botTarget = session.botPos + botRollVal;
      let botLog = `🤖 *Bot* mengocok dadu dan dapat angka *${botRollVal}*.\n`;

      if (botTarget > session.totalCells) {
        botLog += `⚠️ Bot melebihi sel ${session.totalCells}. Bot tetap di sel ${session.botPos}.\n`;
      } else {
        session.botPos = botTarget;
        botLog += `➡️ Bot maju ke sel *${session.botPos}*.\n`;

        if (LADDERS_10[session.botPos]) {
          const up = LADDERS_10[session.botPos];
          botLog += `🪜 Bot naik tangga ke sel *${up}*!\n`;
          session.botPos = up;
        } else if (SNAKES_10[session.botPos]) {
          const down = SNAKES_10[session.botPos];
          botLog += `🐍 Bot tergelincir ular ke sel *${down}*!\n`;
          session.botPos = down;
        }
      }

      if (session.botPos === session.totalCells) {
        delete global.ulartanggaSessions[targetChat];
        return m.reply(
          `💻 *BOT MENANG!* 🤖\n\n` +
          `Bot berhasil mencapai sel 100 terlebih dahulu!`
        );
      }

      const boardVisual = renderTextBoard(session.playerPos, session.botPos);
      return m.reply(
        `🎲 *HASIL PUTARAN DADU*\n\n` +
        `${playerLog}\n` +
        `${botLog}\n` +
        `${boardVisual}\n\n` +
        `👉 Ketik *${prefix || '.'}${command} kocok* untuk giliran berikutnya!`
      , null, { mentions: [sender] });
    }

    // Default: Send Rich Interactive Canvas HTML Card payload
    const rawMessage = {
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [
              {
                messageType: 2,
                messageText: 'Nixel Ular Tangga'
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
      console.error('Error executing ulartangga plugin:', e);
      return m.reply(
        `🎲 *ULAR TANGGA GAME*\n\n` +
        `• *${prefix || '.'}${command} start* : Mulai game mode teks\n` +
        `• *${prefix || '.'}${command} kocok* : Kocok dadu\n` +
        `• *${prefix || '.'}${command} stop* : Hentikan game`
      );
    }
  }
};
