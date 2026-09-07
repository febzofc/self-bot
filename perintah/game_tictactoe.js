const fs = require('fs');

const wins = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

const numEmoji = {
    '1': '1️⃣', '2': '2️⃣', '3': '3️⃣',
    '4': '4️⃣', '5': '5️⃣', '6': '6️⃣',
    '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
};

function checkWin(b, player) {
    return wins.some(([x, y, z]) => b[x] === player && b[y] === player && b[z] === player);
}

function checkFull(b) {
    return b.every(c => c === '❌' || c === '⭕');
}

function minimax(board, depth, isMax) {
    if (checkWin(board, '⭕')) return 10 - depth;
    if (checkWin(board, '❌')) return depth - 10;
    if (checkFull(board)) return 0;

    if (isMax) {
        let best = -1000;
        for (let i = 0; i < 9; i++) {
            if (board[i] !== '❌' && board[i] !== '⭕') {
                let temp = board[i];
                board[i] = '⭕';
                best = Math.max(best, minimax(board, depth + 1, false));
                board[i] = temp;
            }
        }
        return best;
    } else {
        let best = 1000;
        for (let i = 0; i < 9; i++) {
            if (board[i] !== '❌' && board[i] !== '⭕') {
                let temp = board[i];
                board[i] = '❌';
                best = Math.min(best, minimax(board, depth + 1, true));
                board[i] = temp;
            }
        }
        return best;
    }
}

function getBestMove(board) {
    let bestVal = -1000;
    let bestMove = -1;
    for (let i = 0; i < 9; i++) {
        if (board[i] !== '❌' && board[i] !== '⭕') {
            let temp = board[i];
            board[i] = '⭕';
            let moveVal = minimax(board, 0, false);
            board[i] = temp;
            if (moveVal > bestVal) {
                bestVal = moveVal;
                bestMove = i;
            }
        }
    }
    return bestMove;
}

function getRandomMove(board) {
    const available = [];
    for (let i = 0; i < 9; i++) {
        if (board[i] !== '❌' && board[i] !== '⭕') {
            available.push(i);
        }
    }
    if (available.length === 0) return -1;
    return available[Math.floor(Math.random() * available.length)];
}

function renderBoard(b, isModern = false) {
    const f = (val) => numEmoji[val] || val;
    if (isModern) {
        return `╔═════════════════╗\n` +
               `║  ${f(b[0])} │ ${f(b[1])} │ ${f(b[2])}  ║\n` +
               `║ ───┼───┼─── ║\n` +
               `║  ${f(b[3])} │ ${f(b[4])} │ ${f(b[5])}  ║\n` +
               `║ ───┼───┼─── ║\n` +
               `║  ${f(b[6])} │ ${f(b[7])} │ ${f(b[8])}  ║\n` +
               `╚═════════════════╝`;
    }
    return `${f(b[0])}  |  ${f(b[1])}  |  ${f(b[2])}\n` +
           `====+====+====\n` +
           `${f(b[3])}  |  ${f(b[4])}  |  ${f(b[5])}\n` +
           `====+====+====\n` +
           `${f(b[6])}  |  ${f(b[7])}  |  ${f(b[8])}`;
}

function getUserStats(sender) {
    if (!global.db.data) global.db.data = { users: {}, game: {} };
    if (!global.db.data.users) global.db.data.users = {};
    if (!global.db.data.users[sender]) global.db.data.users[sender] = {};
    if (!global.db.data.users[sender].game) global.db.data.users[sender].game = {};
    if (!global.db.data.users[sender].game.ttc) {
        global.db.data.users[sender].game.ttc = { win: 0, lose: 0, draw: 0 };
    }
    return global.db.data.users[sender].game.ttc;
}

function getBotStats() {
    if (!global.db.data) global.db.data = { users: {}, game: {} };
    if (!global.db.data.game) global.db.data.game = {};
    if (!global.db.data.game.ttc) {
        global.db.data.game.ttc = { win: 0, lose: 0, draw: 0 };
    }
    return global.db.data.game.ttc;
}

function saveDb() {
    try {
        if (global.db && typeof global.db.write === 'function') {
            global.db.write();
        }
        fs.writeFileSync('./src/database.json', JSON.stringify(global.db.data, null, 2));
    } catch (e) {
        console.error('Error saving database.json:', e);
    }
}

const { randomBytes, randomUUID } = require('crypto');

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

let codeToTokens;
const COLOR_MAP = {
  "#CB7676": "KEYWORD", "#4D9375": "KEYWORD", "#BD976A": "KEYWORD", "#AB5959": "KEYWORD",
  "#80A665": "METHOD", "#B8A965": "METHOD", "#59C639": "METHOD", "#569CD6": "METHOD",
  "#C98A7D": "STR", "#CE9178": "STR", "#4C9A91": "NUMBER", "#B5CEA8": "NUMBER",
  "#758575": "COMMENT", "#6A9955": "COMMENT", "#5C6370": "COMMENT"
};

function getTokenType(hexColor) {
  if (!hexColor) return "DEFAULT";
  const upper = hexColor.toUpperCase();
  if (COLOR_MAP[upper]) return COLOR_MAP[upper];
  if (/#(CB|BD|4D|AB)/i.test(hexColor)) return "KEYWORD";
  if (/#(80|B8|59|56)/i.test(hexColor)) return "METHOD";
  if (/#(C9|CE)/i.test(hexColor)) return "STR";
  if (/#(4C|B5)/i.test(hexColor)) return "NUMBER";
  if (/#(75|5C|6A)/i.test(hexColor)) return "COMMENT";
  return "DEFAULT";
}

async function tokenize(code, language = "javascript", displayLabel = null) {
  if (!codeToTokens) {
    try {
      const shiki = await import("shiki");
      codeToTokens = shiki.codeToTokens;
    } catch (e) {}
  }

  if (codeToTokens) {
    try {
      const tokens = (await codeToTokens(code, { lang: language, theme: "vitesse-dark" })).tokens.map((line) => {
        return line.map(({ content, color }) => ({ content, type: getTokenType(color) }));
      }).flatMap((value, index, original) => (
        index === original.length - 1 ? value : [...value, { content: "\n", type: "DEFAULT" }]
      ));

      return {
        view_model: {
          primitive: {
            language: displayLabel || language,
            code_blocks: tokens,
            __typename: "GenAICodeUXPrimitive"
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      };
    } catch (e) {}
  }

  const simpleTokens = code.split('\n').map((line, idx, arr) => [
    { content: line, type: "DEFAULT" },
    ...(idx < arr.length - 1 ? [{ content: "\n", type: "DEFAULT" }] : [])
  ]).flat();

  return {
    view_model: {
      primitive: {
        language: displayLabel || language,
        code_blocks: simpleTokens,
        __typename: "GenAICodeUXPrimitive"
      },
      __typename: "GenAISingleLayoutViewModel"
    }
  };
}

function getFullInteractiveHtml() {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover">
<title>Tic-Tac-Toe</title>
<style>
:root{
  --bg:#05070d;
  --bg-soft:#0a0e18;
  --card:rgba(255,255,255,0.045);
  --card-strong:rgba(255,255,255,0.07);
  --border:rgba(255,255,255,0.09);
  --text:#eef1f8;
  --text-dim:#8b93a7;
  --accent:#33e2ff;
  --accent-soft:rgba(51,226,255,0.15);
  --accent2:#a855ff;
  --accent2-soft:rgba(168,85,255,0.15);
  --danger:#ff4d6d;
  --win:#3ef7a3;
  --radius-lg:22px;
  --radius-md:14px;
  --radius-sm:9px;
  --shadow-deep:0 30px 60px -25px rgba(0,0,0,0.65);
  --font-display:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;
  --font-body:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;
  --dur:0.35s;
}
html[data-theme="light"]{
  --bg:#eef1f7;
  --bg-soft:#e3e8f2;
  --card:rgba(255,255,255,0.65);
  --card-strong:rgba(255,255,255,0.85);
  --border:rgba(20,25,40,0.09);
  --text:#12141c;
  --text-dim:#5c6478;
  --accent:#0891b2;
  --accent-soft:rgba(8,145,178,0.12);
  --accent2:#7c3aed;
  --accent2-soft:rgba(124,58,237,0.12);
  --shadow-deep:0 30px 60px -30px rgba(20,25,40,0.25);
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;height:100%;overflow-x:hidden;}
body{
  background:var(--bg);
  color:var(--text);
  font-family:var(--font-body);
  min-height:100vh;
  -webkit-tap-highlight-color:transparent;
  transition:background var(--dur) ease,color var(--dur) ease;
}
body.no-anim *{transition:none !important;animation:none !important;}
#app{
  position:relative;
  min-height:100vh;
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px 16px;
}
.bg-grid{
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size:42px 42px;
  opacity:0.35;
  mask-image:radial-gradient(ellipse at center, black 0%, transparent 75%);
}
.bg-glow{
  position:fixed;
  z-index:0;
  width:60vw;
  height:60vw;
  max-width:700px;
  max-height:700px;
  border-radius:50%;
  filter:blur(90px);
  opacity:0.28;
  pointer-events:none;
}
.bg-glow.a{top:-15%;left:-10%;background:var(--accent);}
.bg-glow.b{bottom:-15%;right:-10%;background:var(--accent2);}
.screen{
  position:relative;
  z-index:1;
  width:100%;
  max-width:480px;
  display:none;
  opacity:0;
  transform:translateY(14px) scale(0.985);
}
.screen.active{
  display:block;
  animation:screenIn var(--dur) ease forwards;
}
@keyframes screenIn{
  to{opacity:1;transform:translateY(0) scale(1);}
}
.panel{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  padding:32px 26px;
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
  box-shadow:var(--shadow-deep);
}
.eyebrow{
  font-size:11px;
  letter-spacing:3px;
  text-transform:uppercase;
  color:var(--accent);
  font-weight:600;
  margin:0 0 6px;
}
h1,h2,h3{font-family:var(--font-display);margin:0;}
.logo{
  font-size:38px;
  font-weight:800;
  letter-spacing:2px;
  text-align:center;
  background:linear-gradient(120deg,var(--text) 30%,var(--accent) 60%,var(--accent2) 90%);
  -webkit-background-clip:text;
  background-clip:text;
  -webkit-text-fill-color:transparent;
}
.logo span{color:var(--accent2);-webkit-text-fill-color:var(--accent2);}
.subtitle{
  text-align:center;
  color:var(--text-dim);
  font-size:14px;
  margin:10px 0 30px;
  letter-spacing:0.3px;
}
.menu-buttons{display:flex;flex-direction:column;gap:12px;}
.btn{
  font-family:inherit;
  font-size:14px;
  font-weight:700;
  letter-spacing:1.4px;
  text-transform:uppercase;
  border-radius:var(--radius-md);
  padding:16px 18px;
  border:1px solid var(--border);
  background:var(--card-strong);
  color:var(--text);
  cursor:pointer;
  transition:transform 0.15s ease,box-shadow 0.15s ease,border-color 0.15s ease,background 0.15s ease;
  -webkit-tap-highlight-color:transparent;
}
.btn:active{transform:scale(0.97);}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.btn-primary{
  background:linear-gradient(120deg,var(--accent-soft),var(--accent2-soft));
  border-color:rgba(51,226,255,0.35);
}
.btn-primary:hover{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset,0 10px 30px -12px var(--accent-soft);}
.btn-ghost{background:transparent;color:var(--text-dim);}
.btn-ghost:hover{color:var(--text);border-color:var(--text-dim);}
.btn-danger{color:var(--danger);border-color:rgba(255,77,109,0.4);}
.btn-small{padding:10px 14px;font-size:12px;}
.btn-row{display:flex;gap:12px;}
.btn-row .btn{flex:1;}
.back-row{margin-top:22px;}
.field{margin-bottom:20px;}
.field label{
  display:block;
  font-size:11px;
  letter-spacing:2px;
  text-transform:uppercase;
  color:var(--text-dim);
  margin-bottom:8px;
  font-weight:600;
}
.field input[type="text"],.field input[type="tel"]{
  width:100%;
  padding:14px 16px;
  border-radius:var(--radius-sm);
  border:1px solid var(--border);
  background:var(--bg-soft);
  color:var(--text);
  font-size:15px;
  font-family:inherit;
  letter-spacing:0.4px;
}
.field input:focus{outline:none;border-color:var(--accent);}
.field input.room-id-input{
  font-size:28px;
  letter-spacing:12px;
  text-align:center;
  font-weight:800;
}
.choice-row{display:flex;gap:10px;}
.choice-btn{
  flex:1;
  padding:14px 8px;
  border-radius:var(--radius-sm);
  border:1px solid var(--border);
  background:var(--bg-soft);
  color:var(--text-dim);
  font-weight:700;
  font-size:13px;
  letter-spacing:1px;
  cursor:pointer;
  transition:all 0.15s ease;
}
.choice-btn.selected{
  color:var(--bg);
  background:var(--accent);
  border-color:var(--accent);
}
.choice-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.section-title{
  font-size:12px;
  letter-spacing:2px;
  text-transform:uppercase;
  color:var(--text-dim);
  font-weight:700;
  margin:26px 0 12px;
}
.section-title:first-child{margin-top:0;}
.room-disclaimer{
  font-size:12.5px;
  line-height:1.6;
  color:var(--text-dim);
  background:var(--bg-soft);
  border:1px dashed var(--border);
  border-radius:var(--radius-sm);
  padding:14px 16px;
  margin-bottom:22px;
}
.room-id-display{
  text-align:center;
  font-size:56px;
  font-weight:800;
  letter-spacing:14px;
  color:var(--accent);
  margin:14px 0 6px;
  text-shadow:0 0 30px var(--accent-soft);
}
.room-id-caption{text-align:center;color:var(--text-dim);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:22px;}
.lobby-players{display:flex;flex-direction:column;gap:10px;margin-bottom:24px;}
.lobby-slot{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:14px 16px;
  border-radius:var(--radius-sm);
  border:1px solid var(--border);
  background:var(--bg-soft);
}
.lobby-slot.empty{color:var(--text-dim);font-style:normal;border-style:dashed;}
.lobby-slot .sym{
  width:32px;height:32px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:15px;
  background:var(--accent-soft);color:var(--accent);
}
.lobby-status{
  text-align:center;
  font-size:13px;
  color:var(--text-dim);
  letter-spacing:0.5px;
  margin-bottom:20px;
}
.lobby-status.ready{color:var(--win);}
.game-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:18px;
}
.mode-badge{
  font-size:10px;
  letter-spacing:2px;
  text-transform:uppercase;
  color:var(--accent);
  font-weight:700;
  background:var(--accent-soft);
  padding:5px 10px;
  border-radius:20px;
}
.room-badge{
  font-size:10px;
  letter-spacing:1px;
  color:var(--text-dim);
  font-weight:700;
}
.score-strip{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  gap:8px;
  align-items:stretch;
  margin-bottom:16px;
}
.score-box{
  background:var(--bg-soft);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  padding:12px 10px;
  text-align:center;
  transition:border-color 0.2s ease,box-shadow 0.2s ease;
}
.score-box.turn-active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset;}
.score-box .name{
  font-size:11px;
  color:var(--text-dim);
  letter-spacing:0.5px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  margin-bottom:4px;
  font-weight:600;
}
.score-box .val{font-size:22px;font-weight:800;}
.score-box.x .val{color:var(--accent);}
.score-box.o .val{color:var(--accent2);}
.score-box.draw{background:transparent;border-style:dashed;}
.score-box.draw .val{color:var(--text-dim);font-size:18px;}
.turn-indicator{
  text-align:center;
  font-size:12px;
  letter-spacing:2px;
  text-transform:uppercase;
  color:var(--text-dim);
  margin-bottom:16px;
  font-weight:700;
  min-height:16px;
}
.turn-indicator .who{color:var(--text);}
.board{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  grid-template-rows:repeat(3,1fr);
  gap:9px;
  width:100%;
  aspect-ratio:1/1;
  margin:0 auto 20px;
}
.cell{
  position:relative;
  background:var(--bg-soft);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:0;
  transition:border-color 0.15s ease,transform 0.1s ease,background 0.2s ease;
}
.cell:hover:not(.filled):not(.locked){border-color:var(--text-dim);}
.cell:active:not(.filled):not(.locked){transform:scale(0.95);}
.cell:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.cell.filled{cursor:default;}
.cell.locked{cursor:not-allowed;}
.cell.win{
  border-color:var(--win);
  background:rgba(62,247,163,0.08);
  animation:winPulse 1s ease-in-out infinite;
}
@keyframes winPulse{
  0%,100%{box-shadow:0 0 0 0 rgba(62,247,163,0.35);}
  50%{box-shadow:0 0 0 8px rgba(62,247,163,0);}
}
.mark{width:52%;height:52%;overflow:visible;}
.mark-x line{
  stroke:var(--accent);
  stroke-width:9;
  stroke-linecap:round;
  fill:none;
  stroke-dasharray:85;
  stroke-dashoffset:85;
}
.mark-o circle{
  stroke:var(--accent2);
  stroke-width:9;
  stroke-linecap:round;
  fill:none;
  stroke-dasharray:220;
  stroke-dashoffset:220;
  transform-origin:50% 50%;
  transform:rotate(-90deg);
}
.cell.filled .mark line,.cell.filled .mark circle{
  transition:stroke-dashoffset 0.35s ease;
  stroke-dashoffset:0;
}
.cell.win .mark-x line{stroke:var(--win);}
.cell.win .mark-o circle{stroke:var(--win);}
.game-controls{display:flex;gap:10px;margin-top:4px;}
.game-controls .btn{flex:1;}
.modal-overlay{
  position:fixed;
  inset:0;
  z-index:20;
  display:none;
  align-items:center;
  justify-content:center;
  padding:20px;
  background:rgba(3,5,10,0.6);
  backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);
}
.modal-overlay.active{display:flex;animation:fadeIn 0.25s ease;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.modal{
  width:100%;
  max-width:420px;
  background:var(--bg-soft);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  padding:30px 26px;
  box-shadow:var(--shadow-deep);
  max-height:85vh;
  overflow-y:auto;
  animation:modalIn 0.3s ease;
}
@keyframes modalIn{
  from{opacity:0;transform:translateY(18px) scale(0.96);}
  to{opacity:1;transform:translateY(0) scale(1);}
}
.modal h2{
  font-size:22px;
  letter-spacing:1px;
  text-align:center;
  margin-bottom:8px;
}
.modal .result-sub{text-align:center;color:var(--text-dim);font-size:13.5px;margin-bottom:24px;}
.modal-buttons{display:flex;flex-direction:column;gap:10px;}
.settings-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:14px 0;
  border-bottom:1px solid var(--border);
}
.settings-row:last-of-type{border-bottom:none;}
.settings-row .label{font-size:14px;font-weight:600;}
.settings-row .label small{display:block;color:var(--text-dim);font-size:11.5px;font-weight:400;margin-top:2px;}
.switch{
  position:relative;
  width:46px;height:26px;
  border-radius:20px;
  background:var(--border);
  border:none;
  cursor:pointer;
  flex-shrink:0;
}
.switch::after{
  content:'';
  position:absolute;
  top:3px;left:3px;
  width:20px;height:20px;
  border-radius:50%;
  background:var(--text-dim);
  transition:transform 0.2s ease,background 0.2s ease;
}
.switch.on{background:var(--accent-soft);}
.switch.on::after{transform:translateX(20px);background:var(--accent);}
.howto-content{font-size:13.5px;line-height:1.75;color:var(--text-dim);}
.howto-content h3{font-size:13px;color:var(--text);text-transform:uppercase;letter-spacing:1.5px;margin:18px 0 6px;}
.howto-content h3:first-child{margin-top:0;}
.howto-content ul{margin:0;padding-left:18px;}
.stats-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin-bottom:22px;
}
.stat-card{
  background:var(--bg-soft);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  padding:14px;
  text-align:center;
}
.stat-card .num{font-size:24px;font-weight:800;color:var(--accent);}
.stat-card .lbl{font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-dim);margin-top:4px;}
.toast-container{
  position:fixed;
  top:20px;
  left:50%;
  transform:translateX(-50%);
  z-index:50;
  display:flex;
  flex-direction:column;
  gap:10px;
  width:calc(100% - 32px);
  max-width:420px;
  align-items:center;
  pointer-events:none;
}
.toast{
  background:var(--card-strong);
  border:1px solid var(--border);
  color:var(--text);
  font-size:13.5px;
  font-weight:600;
  padding:13px 18px;
  border-radius:12px;
  box-shadow:var(--shadow-deep);
  backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);
  animation:toastIn 0.3s ease, toastOut 0.3s ease 2.2s forwards;
  max-width:100%;
}
.toast.error{border-color:rgba(255,77,109,0.5);color:var(--danger);}
.toast.success{border-color:rgba(62,247,163,0.5);}
@keyframes toastIn{from{opacity:0;transform:translateY(-14px);}to{opacity:1;transform:translateY(0);}}
@keyframes toastOut{to{opacity:0;transform:translateY(-10px);}}
.top-icons{
  position:fixed;
  top:16px;
  right:16px;
  z-index:5;
  display:flex;
  gap:8px;
}
.icon-btn{
  width:38px;height:38px;
  border-radius:12px;
  border:1px solid var(--border);
  background:var(--card);
  color:var(--text-dim);
  font-size:15px;
  cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(10px);
}
.icon-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
@media (max-width:420px){
  .panel{padding:24px 18px;}
  .logo{font-size:30px;}
  .room-id-display{font-size:44px;letter-spacing:10px;}
  .score-box .val{font-size:18px;}
}
</style>
</head>
<body>
<div class="bg-glow a"></div>
<div class="bg-glow b"></div>
<div class="bg-grid"></div>
<div class="top-icons">
  <button class="icon-btn" id="btnStatsIcon" aria-label="View statistics">&#9776;</button>
</div>
<div class="toast-container" id="toastContainer" aria-live="polite"></div>

<div id="app">

  <section id="screen-home" class="screen active">
    <div class="panel">
      <h1 class="logo">TIC<span>&middot;</span>TAC<span>&middot;</span>TOE</h1>
      <p class="subtitle">Strategic grid combat, refined.</p>
      <div class="menu-buttons">
        <button class="btn btn-primary" data-nav="vsbot-config" aria-label="Play against the bot">VS BOT</button>
        <button class="btn btn-primary" data-nav="vsplayer-config" aria-label="Play against another player">VS PLAYER</button>
        <button class="btn btn-primary" data-nav="room-home" aria-label="Custom room">CUSTOM ROOM</button>
        <button class="btn btn-ghost" id="btnHowTo" aria-label="How to play">HOW TO PLAY</button>
        <button class="btn btn-ghost" id="btnSettingsOpen" aria-label="Settings">SETTINGS</button>
      </div>
    </div>
  </section>

  <section id="screen-vsbot-config" class="screen">
    <div class="panel">
      <p class="eyebrow">Vs Bot</p>
      <h2 style="margin-bottom:22px;">Configure Match</h2>
      <div class="field">
        <label for="botPlayerName">Your Name</label>
        <input type="text" id="botPlayerName" maxlength="14" placeholder="Enter your name" autocomplete="off">
      </div>
      <div class="field">
        <label>Your Symbol</label>
        <div class="choice-row" id="botSymbolChoice" role="group" aria-label="Choose your symbol">
          <button class="choice-btn selected" data-symbol="X">X</button>
          <button class="choice-btn" data-symbol="O">O</button>
          <button class="choice-btn" data-symbol="RANDOM">RANDOM</button>
        </div>
      </div>
      <div class="field">
        <label>Difficulty</label>
        <div class="choice-row" id="botDifficultyChoice" role="group" aria-label="Choose difficulty">
          <button class="choice-btn selected" data-diff="easy">EASY</button>
          <button class="choice-btn" data-diff="normal">NORMAL</button>
          <button class="choice-btn" data-diff="hard">HARD</button>
        </div>
      </div>
      <div class="choice-row" style="margin-bottom:24px;">
        <button class="choice-btn" data-diff="impossible" id="btnImpossible" style="flex:1;">IMPOSSIBLE</button>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-nav="home">BACK</button>
        <button class="btn btn-primary" id="btnStartBot">START GAME</button>
      </div>
    </div>
  </section>

  <section id="screen-vsplayer-config" class="screen">
    <div class="panel">
      <p class="eyebrow">Vs Player</p>
      <h2 style="margin-bottom:22px;">Configure Match</h2>
      <p class="section-title">Player 1</p>
      <div class="field">
        <label for="p1Name">Name</label>
        <input type="text" id="p1Name" maxlength="14" placeholder="Player 1" autocomplete="off">
      </div>
      <div class="field">
        <label>Symbol</label>
        <div class="choice-row" id="p1SymbolChoice" role="group" aria-label="Player 1 symbol">
          <button class="choice-btn selected" data-symbol="X">X</button>
          <button class="choice-btn" data-symbol="O">O</button>
        </div>
      </div>
      <p class="section-title">Player 2</p>
      <div class="field">
        <label for="p2Name">Name</label>
        <input type="text" id="p2Name" maxlength="14" placeholder="Player 2" autocomplete="off">
      </div>
      <div class="field" style="margin-bottom:6px;">
        <label>Symbol</label>
        <div class="choice-row">
          <button class="choice-btn selected" id="p2SymbolLabel" disabled style="cursor:default;">O</button>
        </div>
      </div>
      <div class="btn-row" style="margin-top:20px;">
        <button class="btn btn-ghost" data-nav="home">BACK</button>
        <button class="btn btn-primary" id="btnStartPlayer">START GAME</button>
      </div>
    </div>
  </section>

  <section id="screen-room-home" class="screen">
    <div class="panel">
      <p class="eyebrow">Custom Room</p>
      <h2 style="margin-bottom:16px;">Local Room</h2>
      <div class="room-disclaimer">
        This is a local browser simulation, not real online multiplayer. Rooms sync between tabs on this same browser using storage, so open a second tab to play as the other side.
      </div>
      <div class="menu-buttons">
        <button class="btn btn-primary" data-nav="room-create">CREATE ROOM</button>
        <button class="btn btn-primary" data-nav="room-join">JOIN ROOM</button>
      </div>
      <div class="btn-row back-row">
        <button class="btn btn-ghost" data-nav="home">BACK</button>
      </div>
    </div>
  </section>

  <section id="screen-room-create" class="screen">
    <div class="panel">
      <p class="eyebrow">Create Room</p>
      <h2 style="margin-bottom:22px;">Room Setup</h2>
      <div class="field">
        <label for="roomHostName">Your Name</label>
        <input type="text" id="roomHostName" maxlength="14" placeholder="Enter your name" autocomplete="off">
      </div>
      <div class="field">
        <label>Your Symbol</label>
        <div class="choice-row" id="roomHostSymbolChoice" role="group" aria-label="Choose your symbol">
          <button class="choice-btn selected" data-symbol="X">X</button>
          <button class="choice-btn" data-symbol="O">O</button>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-nav="room-home">BACK</button>
        <button class="btn btn-primary" id="btnCreateRoom">CREATE</button>
      </div>
    </div>
  </section>

  <section id="screen-room-join" class="screen">
    <div class="panel">
      <p class="eyebrow">Join Room</p>
      <h2 style="margin-bottom:22px;">Enter Room ID</h2>
      <div class="field">
        <label for="joinRoomId">4-Digit Room ID</label>
        <input type="tel" id="joinRoomId" class="room-id-input" maxlength="4" placeholder="0000" inputmode="numeric" pattern="[0-9]*">
      </div>
      <div class="field">
        <label for="joinName">Your Name</label>
        <input type="text" id="joinName" maxlength="14" placeholder="Enter your name" autocomplete="off">
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-nav="room-home">BACK</button>
        <button class="btn btn-primary" id="btnJoinRoom">JOIN</button>
      </div>
    </div>
  </section>

  <section id="screen-room-lobby" class="screen">
    <div class="panel">
      <p class="eyebrow" style="text-align:center;">Room Lobby</p>
      <div class="room-id-display" id="lobbyRoomId">0000</div>
      <div class="room-id-caption">Room ID</div>
      <div class="btn-row" style="margin-bottom:24px;">
        <button class="btn btn-small btn-ghost" id="btnCopyRoomId">COPY ROOM ID</button>
      </div>
      <div class="lobby-players" id="lobbyPlayers"></div>
      <div class="lobby-status" id="lobbyStatus">Waiting for opponent to join&hellip;</div>
      <div class="btn-row">
        <button class="btn btn-danger" id="btnLeaveRoom">LEAVE ROOM</button>
        <button class="btn btn-primary" id="btnStartRoomGame" disabled>START GAME</button>
      </div>
    </div>
  </section>

  <section id="screen-game" class="screen">
    <div class="panel">
      <div class="game-header">
        <span class="mode-badge" id="gameModeBadge">VS BOT</span>
        <span class="room-badge" id="gameRoomBadge"></span>
      </div>
      <div class="score-strip">
        <div class="score-box x" id="scoreBoxX">
          <div class="name" id="scoreNameX">Player</div>
          <div class="val" id="scoreValX">0</div>
        </div>
        <div class="score-box draw">
          <div class="name">DRAW</div>
          <div class="val" id="scoreValDraw">0</div>
        </div>
        <div class="score-box o" id="scoreBoxO">
          <div class="name" id="scoreNameO">Bot</div>
          <div class="val" id="scoreValO">0</div>
        </div>
      </div>
      <div class="turn-indicator" id="turnIndicator">TURN &mdash; <span class="who">Player</span></div>
      <div class="board" id="board" role="grid" aria-label="Tic tac toe board"></div>
      <div class="game-controls">
        <button class="btn btn-ghost btn-small" id="btnRestartGame">RESTART</button>
        <button class="btn btn-ghost btn-small" id="btnResetScore">RESET SCORE</button>
        <button class="btn btn-ghost btn-small" id="btnBackToMenu">MENU</button>
      </div>
    </div>
  </section>

</div>

<div class="modal-overlay" id="modalResult">
  <div class="modal">
    <h2 id="resultTitle">DRAW</h2>
    <p class="result-sub" id="resultSubtitle"></p>
    <div class="modal-buttons">
      <button class="btn btn-primary" id="btnRematch">REMATCH</button>
      <button class="btn btn-ghost" id="btnChangeDifficulty">CHANGE DIFFICULTY</button>
      <button class="btn btn-ghost" id="btnResultMenu">BACK TO MENU</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="modalSettings">
  <div class="modal">
    <h2 style="margin-bottom:14px;">Settings</h2>
    <div class="settings-row">
      <div class="label">Sound<small>In-game audio cues</small></div>
      <button class="switch" id="toggleSound" aria-label="Toggle sound"></button>
    </div>
    <div class="settings-row">
      <div class="label">Animation<small>Motion and transitions</small></div>
      <button class="switch" id="toggleAnimation" aria-label="Toggle animation"></button>
    </div>
    <div class="settings-row">
      <div class="label">Dark Mode<small>Switch visual theme</small></div>
      <button class="switch" id="toggleTheme" aria-label="Toggle theme"></button>
    </div>
    <div class="btn-row" style="margin-top:24px;">
      <button class="btn btn-danger" id="btnResetAllData">RESET ALL DATA</button>
    </div>
    <div class="btn-row" style="margin-top:10px;">
      <button class="btn btn-ghost" id="btnSettingsClose">BACK</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="modalHowTo">
  <div class="modal modal-scroll">
    <h2 style="margin-bottom:14px;">How To Play</h2>
    <div class="howto-content">
      <h3>Objective</h3>
      <p>Be the first to align three of your symbols in a row, column, or diagonal on the 3x3 grid.</p>
      <h3>Basic Rules</h3>
      <ul>
        <li>Players alternate turns placing X or O on an empty cell.</li>
        <li>A filled cell cannot be played again.</li>
        <li>The game ends immediately once a winning line appears or the board is full.</li>
      </ul>
      <h3>Winning</h3>
      <p>Any complete horizontal, vertical, or diagonal line of three matching symbols wins the match. If all nine cells fill with no line, the result is a draw.</p>
      <h3>Vs Bot</h3>
      <p>Play against an automated opponent with four difficulty tiers, from fully random moves to a mathematically unbeatable Minimax engine.</p>
      <h3>Vs Player</h3>
      <p>Two people share one device and take turns on the same board.</p>
      <h3>Custom Room</h3>
      <p>A local simulation of a private match using this browser's storage. Open a second tab to act as the other player &mdash; no internet connection is used or required.</p>
      <h3>Room ID</h3>
      <p>A random 4-digit code identifies each room. Share it with your opponent so they can join from another tab.</p>
    </div>
    <div class="btn-row" style="margin-top:22px;">
      <button class="btn btn-ghost" id="btnHowToClose">CLOSE</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="modalStats">
  <div class="modal">
    <h2 style="margin-bottom:18px;">Statistics</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="num" id="statPlayed">0</div><div class="lbl">Played</div></div>
      <div class="stat-card"><div class="num" id="statWins">0</div><div class="lbl">Wins</div></div>
      <div class="stat-card"><div class="num" id="statLosses">0</div><div class="lbl">Losses</div></div>
      <div class="stat-card"><div class="num" id="statDraws">0</div><div class="lbl">Draws</div></div>
    </div>
    <div class="stat-card" style="margin-bottom:22px;">
      <div class="num" id="statWinRate">0%</div>
      <div class="lbl">Win Rate (Vs Bot)</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btnStatsClose">CLOSE</button>
    </div>
  </div>
</div>

<script>
const STORAGE_KEYS={
  settings:'ttt_settings',
  stats:'ttt_stats',
  rooms:'ttt_rooms'
};

const WIN_LINES=[
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

const state={
  screen:'home',
  mode:null,
  players:{X:{name:'Player',type:'human'},O:{name:'Bot',type:'bot'}},
  board:Array(9).fill(null),
  currentTurn:'X',
  gameOver:false,
  winningLine:null,
  score:{X:0,O:0,draw:0},
  difficulty:'easy',
  botSymbol:'O',
  humanSymbol:'X',
  botSymbolChoice:'X',
  p1SymbolChoice:'X',
  roomHostSymbolChoice:'X',
  room:null,
  roomRole:null,
  roomPollTimer:null,
  lastResult:null
};

let settings={sound:true,animation:true,theme:'dark'};
let stats={played:0,wins:0,losses:0,draws:0};

function loadSettings(){
  try{
    const raw=localStorage.getItem(STORAGE_KEYS.settings);
    if(raw){
      const parsed=JSON.parse(raw);
      settings=Object.assign(settings,parsed);
    }
  }catch(e){}
  applySettings();
}

function saveSettings(){
  try{
    localStorage.setItem(STORAGE_KEYS.settings,JSON.stringify(settings));
  }catch(e){}
}

function applySettings(){
  document.documentElement.setAttribute('data-theme',settings.theme);
  document.body.classList.toggle('no-anim',!settings.animation);
  document.getElementById('toggleSound').classList.toggle('on',settings.sound);
  document.getElementById('toggleAnimation').classList.toggle('on',settings.animation);
  document.getElementById('toggleTheme').classList.toggle('on',settings.theme==='dark');
}

function loadStats(){
  try{
    const raw=localStorage.getItem(STORAGE_KEYS.stats);
    if(raw){
      stats=Object.assign(stats,JSON.parse(raw));
    }
  }catch(e){}
}

function saveStats(){
  try{
    localStorage.setItem(STORAGE_KEYS.stats,JSON.stringify(stats));
  }catch(e){}
}

function renderStats(){
  document.getElementById('statPlayed').textContent=stats.played;
  document.getElementById('statWins').textContent=stats.wins;
  document.getElementById('statLosses').textContent=stats.losses;
  document.getElementById('statDraws').textContent=stats.draws;
  const rate=stats.played>0?Math.round((stats.wins/stats.played)*100):0;
  document.getElementById('statWinRate').textContent=rate+'%';
}

let audioCtx=null;
function getAudioCtx(){
  if(!audioCtx){
    const Ctor=window.AudioContext||window.webkitAudioContext;
    if(Ctor) audioCtx=new Ctor();
  }
  return audioCtx;
}

function playTone(freq,duration,type){
  if(!settings.sound) return;
  const ctx=getAudioCtx();
  if(!ctx) return;
  if(ctx.state==='suspended') ctx.resume();
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type=type||'sine';
  osc.frequency.value=freq;
  gain.gain.setValueAtTime(0.0001,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16,ctx.currentTime+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime+duration+0.02);
}

function soundClick(){playTone(520,0.09,'square');}
function soundMoveX(){playTone(660,0.13,'sine');}
function soundMoveO(){playTone(440,0.13,'sine');}
function soundWin(){playTone(880,0.14,'triangle');setTimeout(()=>playTone(1180,0.2,'triangle'),120);}
function soundDraw(){playTone(300,0.28,'sawtooth');}
function soundError(){playTone(180,0.18,'square');}

function showToast(message,tone){
  const container=document.getElementById('toastContainer');
  const el=document.createElement('div');
  el.className='toast'+(tone?(' '+tone):'');
  el.textContent=message;
  container.appendChild(el);
  if(tone==='error') soundError();
  setTimeout(()=>{
    if(el.parentNode) el.parentNode.removeChild(el);
  },2600);
}

function showModal(id){
  document.getElementById(id).classList.add('active');
}
function hideModal(id){
  document.getElementById(id).classList.remove('active');
}

function renderScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const target=document.getElementById('screen-'+name);
  if(target) target.classList.add('active');
  state.screen=name;
}

function navigate(name){
  soundClick();
  if(name==='home'&&state.room){
    leaveRoom(true);
  }
  renderScreen(name);
}

document.querySelectorAll('[data-nav]').forEach(btn=>{
  btn.addEventListener('click',()=>navigate(btn.getAttribute('data-nav')));
});

function setupChoiceGroup(containerId,onSelect){
  const container=document.getElementById(containerId);
  container.querySelectorAll('.choice-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      soundClick();
      container.querySelectorAll('.choice-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(btn.dataset.symbol||btn.dataset.diff);
    });
  });
}

setupChoiceGroup('botSymbolChoice',(val)=>{state.botSymbolChoice=val;});
setupChoiceGroup('botDifficultyChoice',(val)=>{state.difficulty=val;});
document.getElementById('btnImpossible').addEventListener('click',()=>{
  soundClick();
  document.querySelectorAll('#botDifficultyChoice .choice-btn,#btnImpossible').forEach(b=>b.classList.remove('selected'));
  document.getElementById('btnImpossible').classList.add('selected');
  state.difficulty='impossible';
});

setupChoiceGroup('p1SymbolChoice',(val)=>{
  state.p1SymbolChoice=val;
  document.getElementById('p2SymbolLabel').textContent=val==='X'?'O':'X';
});

setupChoiceGroup('roomHostSymbolChoice',(val)=>{state.roomHostSymbolChoice=val;});

function randomSymbol(){return Math.random()<0.5?'X':'O';}

function resetBoardState(){
  state.board=Array(9).fill(null);
  state.gameOver=false;
  state.winningLine=null;
  state.lastResult=null;
}

function checkWinnerBoard(board){
  for(const line of WIN_LINES){
    const [a,b,c]=line;
    if(board[a]&&board[a]===board[b]&&board[b]===board[c]){
      return {winner:board[a],line:line};
    }
  }
  return null;
}

function isBoardFull(board){
  return board.every(cell=>cell!==null);
}

function checkWinner(){
  return checkWinnerBoard(state.board);
}

function checkDraw(){
  return isBoardFull(state.board)&&!checkWinner();
}

function startBotGame(){
  let name=document.getElementById('botPlayerName').value.trim();
  if(!name) name='Player';
  let symbol=state.botSymbolChoice;
  if(symbol==='RANDOM') symbol=randomSymbol();
  state.humanSymbol=symbol;
  state.botSymbol=symbol==='X'?'O':'X';
  state.mode='bot';
  state.players={
    X:{name:symbol==='X'?name:difficultyLabel(state.difficulty),type:symbol==='X'?'human':'bot'},
    O:{name:symbol==='O'?name:difficultyLabel(state.difficulty),type:symbol==='O'?'human':'bot'}
  };
  state.score={X:0,O:0,draw:0};
  resetBoardState();
  state.currentTurn='X';
  renderScreen('game');
  setupGameHeader();
  buildBoardSkeleton();
  updateScoreboard();
  updateTurnIndicator();
  maybeBotTurn();
}

function difficultyLabel(diff){
  const map={easy:'Easy Bot',normal:'Normal Bot',hard:'Hard Bot',impossible:'Impossible Bot'};
  return map[diff]||'Bot';
}

document.getElementById('btnStartBot').addEventListener('click',()=>{
  soundClick();
  startBotGame();
});

function startPlayerGame(){
  let n1=document.getElementById('p1Name').value.trim()||'Player 1';
  let n2=document.getElementById('p2Name').value.trim()||'Player 2';
  const s1=state.p1SymbolChoice;
  const s2=s1==='X'?'O':'X';
  state.mode='player';
  state.players={
    X:{name:s1==='X'?n1:n2,type:'human'},
    O:{name:s1==='O'?n1:n2,type:'human'}
  };
  state.score={X:0,O:0,draw:0};
  resetBoardState();
  state.currentTurn='X';
  renderScreen('game');
  setupGameHeader();
  buildBoardSkeleton();
  updateScoreboard();
  updateTurnIndicator();
}

document.getElementById('btnStartPlayer').addEventListener('click',()=>{
  soundClick();
  startPlayerGame();
});

function setupGameHeader(){
  const badge=document.getElementById('gameModeBadge');
  const roomBadge=document.getElementById('gameRoomBadge');
  if(state.mode==='bot') badge.textContent='VS BOT';
  else if(state.mode==='player') badge.textContent='VS PLAYER';
  else badge.textContent='CUSTOM ROOM';
  roomBadge.textContent=state.room?('ROOM '+state.room.id):'';
  document.getElementById('scoreNameX').textContent=state.players.X.name;
  document.getElementById('scoreNameO').textContent=state.players.O.name;
}

function updateScoreboard(){
  document.getElementById('scoreValX').textContent=state.score.X;
  document.getElementById('scoreValO').textContent=state.score.O;
  document.getElementById('scoreValDraw').textContent=state.score.draw;
  document.getElementById('scoreBoxX').classList.toggle('turn-active',state.currentTurn==='X'&&!state.gameOver);
  document.getElementById('scoreBoxO').classList.toggle('turn-active',state.currentTurn==='O'&&!state.gameOver);
}

function updateTurnIndicator(){
  const el=document.getElementById('turnIndicator');
  if(state.gameOver){
    el.innerHTML='GAME OVER';
    return;
  }
  const activeName=state.players[state.currentTurn].name;
  el.innerHTML='TURN &mdash; <span class="who">'+escapeHtml(activeName)+' ('+state.currentTurn+')</span>';
}

function escapeHtml(str){
  const div=document.createElement('div');
  div.textContent=str;
  return div.innerHTML;
}

function buildBoardSkeleton(){
  const boardEl=document.getElementById('board');
  boardEl.innerHTML='';
  for(let idx=0;idx<9;idx++){
    const cell=document.createElement('button');
    cell.className='cell';
    cell.setAttribute('data-index',idx);
    cell.setAttribute('role','gridcell');
    cell.setAttribute('aria-label','Cell '+(idx+1)+', empty');
    cell.innerHTML=
      '<svg class="mark mark-x" viewBox="0 0 100 100" style="display:none;"><line x1="22" y1="22" x2="78" y2="78"/><line x1="78" y1="22" x2="22" y2="78"/></svg>'+
      '<svg class="mark mark-o" viewBox="0 0 100 100" style="display:none;"><circle cx="50" cy="50" r="35"/></svg>';
    cell.addEventListener('click',()=>onCellClick(idx));
    boardEl.appendChild(cell);
  }
  renderBoard();
}

function renderBoard(){
  for(let idx=0;idx<9;idx++){
    updateCellVisual(idx,false);
  }
}

function updateCellVisual(idx,animate){
  const boardEl=document.getElementById('board');
  const cell=boardEl.children[idx];
  if(!cell) return;
  const val=state.board[idx];
  const xMark=cell.querySelector('.mark-x');
  const oMark=cell.querySelector('.mark-o');
  cell.classList.toggle('locked',Boolean(val)||state.gameOver);
  cell.classList.toggle('win',Boolean(state.winningLine&&state.winningLine.includes(idx)));
  cell.setAttribute('aria-label','Cell '+(idx+1)+(val?(', filled with '+val):', empty'));
  if(!val){
    cell.classList.remove('filled');
    xMark.style.display='none';
    oMark.style.display='none';
    return;
  }
  const activeMark=val==='X'?xMark:oMark;
  const inactiveMark=val==='X'?oMark:xMark;
  inactiveMark.style.display='none';
  if(cell.classList.contains('filled')){
    activeMark.style.display='block';
  }else{
    activeMark.style.display='block';
    cell.classList.remove('filled');
    void cell.offsetWidth;
    requestAnimationFrame(()=>{
      cell.classList.add('filled');
    });
  }
}

function onCellClick(idx){
  if(state.gameOver) return;
  if(state.board[idx]) return;
  if(state.mode==='bot'&&state.players[state.currentTurn].type==='bot') return;
  if(state.mode==='room'){
    if(!isLocalTurn()){
      showToast("It's not your turn",null);
      return;
    }
  }
  makeMove(idx,state.currentTurn);
}

function makeMove(idx,symbol){
  if(state.board[idx]||state.gameOver) return;
  state.board[idx]=symbol;
  symbol==='X'?soundMoveX():soundMoveO();
  const result=checkWinnerBoard(state.board);
  if(result){
    state.gameOver=true;
    state.winningLine=result.line;
    state.score[result.winner]+=1;
    state.lastResult={type:'win',winner:result.winner};
  }else if(isBoardFull(state.board)){
    state.gameOver=true;
    state.score.draw+=1;
    state.lastResult={type:'draw'};
  }else{
    state.currentTurn=symbol==='X'?'O':'X';
  }
  renderBoard();
  updateScoreboard();
  updateTurnIndicator();
  if(state.mode==='room'){
    persistRoomState();
  }
  if(state.gameOver){
    if(state.mode==='bot') recordBotStats(state.lastResult);
    setTimeout(showResultModal,450);
  }else if(state.mode==='bot'){
    maybeBotTurn();
  }
}

function recordBotStats(result){
  stats.played+=1;
  if(result.type==='draw'){
    stats.draws+=1;
  }else if(result.winner===state.humanSymbol){
    stats.wins+=1;
  }else{
    stats.losses+=1;
  }
  saveStats();
}

function maybeBotTurn(){
  if(state.mode!=='bot') return;
  if(state.gameOver) return;
  if(state.players[state.currentTurn].type!=='bot') return;
  setTimeout(()=>{
    const idx=botChooseMove();
    if(idx!==null&&idx!==undefined) makeMove(idx,state.botSymbol);
  },420);
}

function emptyIndices(board){
  const arr=[];
  board.forEach((v,i)=>{if(!v) arr.push(i);});
  return arr;
}

function botChooseMove(){
  const board=state.board;
  const empties=emptyIndices(board);
  if(empties.length===0) return null;
  if(state.difficulty==='easy'){
    return empties[Math.floor(Math.random()*empties.length)];
  }
  if(state.difficulty==='normal'){
    return normalBotMove(board,empties);
  }
  if(state.difficulty==='hard'){
    return hardBotMove(board,empties);
  }
  return bestMove(board,state.botSymbol,state.humanSymbol,true);
}

function normalBotMove(board,empties){
  const bot=state.botSymbol;
  const human=state.humanSymbol;
  if(Math.random()<0.7){
    const winIdx=findImmediateWin(board,bot);
    if(winIdx!==null) return winIdx;
  }
  if(Math.random()<0.55){
    const blockIdx=findImmediateWin(board,human);
    if(blockIdx!==null) return blockIdx;
  }
  if(board[4]===null&&Math.random()<0.5) return 4;
  return empties[Math.floor(Math.random()*empties.length)];
}

function hardBotMove(board,empties){
  const winIdx=findImmediateWin(board,state.botSymbol);
  if(winIdx!==null) return winIdx;
  const blockIdx=findImmediateWin(board,state.humanSymbol);
  if(blockIdx!==null) return blockIdx;
  if(Math.random()<0.18){
    const ranked=rankMoves(board,state.botSymbol,state.humanSymbol);
    if(ranked.length>1) return ranked[1].index;
    return ranked[0].index;
  }
  return bestMove(board,state.botSymbol,state.humanSymbol,true);
}

function findImmediateWin(board,symbol){
  for(const line of WIN_LINES){
    const vals=line.map(i=>board[i]);
    const countSym=vals.filter(v=>v===symbol).length;
    const countEmpty=vals.filter(v=>v===null).length;
    if(countSym===2&&countEmpty===1){
      const emptyIdx=line[vals.indexOf(null)];
      return emptyIdx;
    }
  }
  return null;
}

function rankMoves(board,botSym,humanSym){
  const empties=emptyIndices(board);
  const scored=empties.map(idx=>{
    const copy=board.slice();
    copy[idx]=botSym;
    const score=minimax(copy,false,botSym,humanSym,0);
    return {index:idx,score:score};
  });
  scored.sort((a,b)=>b.score-a.score);
  return scored;
}

function bestMove(board,botSym,humanSym){
  const ranked=rankMoves(board,botSym,humanSym);
  return ranked[0].index;
}

function minimax(board,isMaximizing,botSym,humanSym,depth){
  const result=checkWinnerBoard(board);
  if(result){
    if(result.winner===botSym) return 10-depth;
    return depth-10;
  }
  if(isBoardFull(board)) return 0;
  const empties=emptyIndices(board);
  if(isMaximizing){
    let best=-Infinity;
    for(const idx of empties){
      board[idx]=botSym;
      const score=minimax(board,false,botSym,humanSym,depth+1);
      board[idx]=null;
      if(score>best) best=score;
    }
    return best;
  }else{
    let best=Infinity;
    for(const idx of empties){
      board[idx]=humanSym;
      const score=minimax(board,true,botSym,humanSym,depth+1);
      board[idx]=null;
      if(score<best) best=score;
    }
    return best;
  }
}

function showResultModal(){
  const title=document.getElementById('resultTitle');
  const subtitle=document.getElementById('resultSubtitle');
  const changeBtn=document.getElementById('btnChangeDifficulty');
  if(state.lastResult.type==='draw'){
    title.textContent="IT'S A DRAW!";
    subtitle.textContent='Neither side found an opening this round.';
    soundDraw();
  }else{
    const winnerName=state.players[state.lastResult.winner].name;
    title.textContent=winnerName.toUpperCase()+' WINS!';
    subtitle.textContent='Victory by three in a row.';
    soundWin();
  }
  changeBtn.style.display=state.mode==='bot'?'block':'none';
  showModal('modalResult');
}

document.getElementById('btnRematch').addEventListener('click',()=>{
  soundClick();
  hideModal('modalResult');
  resetBoardState();
  state.currentTurn='X';
  renderBoard();
  updateScoreboard();
  updateTurnIndicator();
  if(state.mode==='room'){
    persistRoomState();
  }
  maybeBotTurn();
});

document.getElementById('btnChangeDifficulty').addEventListener('click',()=>{
  soundClick();
  hideModal('modalResult');
  renderScreen('vsbot-config');
});

document.getElementById('btnResultMenu').addEventListener('click',()=>{
  soundClick();
  hideModal('modalResult');
  navigate('home');
});

document.getElementById('btnRestartGame').addEventListener('click',()=>{
  soundClick();
  resetBoardState();
  state.currentTurn='X';
  renderBoard();
  updateScoreboard();
  updateTurnIndicator();
  if(state.mode==='room'){
    persistRoomState();
  }
  maybeBotTurn();
});

document.getElementById('btnResetScore').addEventListener('click',()=>{
  soundClick();
  state.score={X:0,O:0,draw:0};
  updateScoreboard();
  showToast('Score reset','success');
});

document.getElementById('btnBackToMenu').addEventListener('click',()=>{
  navigate('home');
});

function generateRoomId(existingRooms){
  let id;
  do{
    id=String(Math.floor(1000+Math.random()*9000));
  }while(existingRooms[id]);
  return id;
}

function readRooms(){
  try{
    const raw=localStorage.getItem(STORAGE_KEYS.rooms);
    return raw?JSON.parse(raw):{};
  }catch(e){
    return {};
  }
}

function writeRooms(rooms){
  try{
    localStorage.setItem(STORAGE_KEYS.rooms,JSON.stringify(rooms));
  }catch(e){}
}

function createRoom(){
  const name=document.getElementById('roomHostName').value.trim();
  if(!name){
    showToast('Please enter your name','error');
    return;
  }
  const rooms=readRooms();
  const id=generateRoomId(rooms);
  const hostSymbol=state.roomHostSymbolChoice;
  const room={
    id:id,
    hostName:name,
    hostSymbol:hostSymbol,
    guestName:null,
    guestSymbol:hostSymbol==='X'?'O':'X',
    board:Array(9).fill(null),
    currentTurn:'X',
    score:{X:0,O:0,draw:0},
    status:'waiting',
    updatedAt:Date.now()
  };
  rooms[id]=room;
  writeRooms(rooms);
  sessionStorage.setItem('ttt_room_role_'+id,'host');
  state.room=room;
  state.roomRole='host';
  enterLobby();
  showToast('Room created successfully','success');
}

document.getElementById('btnCreateRoom').addEventListener('click',()=>{
  soundClick();
  createRoom();
});

function joinRoom(){
  const idInput=document.getElementById('joinRoomId').value.trim();
  const name=document.getElementById('joinName').value.trim();
  if(!/^\d{4}$/.test(idInput)){
    showToast('Invalid Room ID','error');
    return;
  }
  if(!name){
    showToast('Please enter your name','error');
    return;
  }
  const rooms=readRooms();
  const room=rooms[idInput];
  if(!room){
    showToast('Invalid Room ID','error');
    return;
  }
  if(sessionStorage.getItem('ttt_room_role_'+idInput)==='host'){
    showToast('You cannot join your own room','error');
    return;
  }
  if(room.guestName){
    showToast('Room is full','error');
    return;
  }
  room.guestName=name;
  room.status='ready';
  room.updatedAt=Date.now();
  rooms[idInput]=room;
  writeRooms(rooms);
  sessionStorage.setItem('ttt_room_role_'+idInput,'guest');
  state.room=room;
  state.roomRole='guest';
  enterLobby();
  showToast('Joined room successfully','success');
}

document.getElementById('joinRoomId').addEventListener('input',(e)=>{
  e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);
});

document.getElementById('btnJoinRoom').addEventListener('click',()=>{
  soundClick();
  joinRoom();
});

function enterLobby(){
  renderScreen('room-lobby');
  renderLobby();
  startRoomPolling();
}

function renderLobby(){
  if(!state.room) return;
  document.getElementById('lobbyRoomId').textContent=state.room.id;
  const container=document.getElementById('lobbyPlayers');
  container.innerHTML='';
  const hostSlot=document.createElement('div');
  hostSlot.className='lobby-slot';
  hostSlot.innerHTML='<span>'+escapeHtml(state.room.hostName)+' (Host)</span><span class="sym">'+state.room.hostSymbol+'</span>';
  container.appendChild(hostSlot);
  const guestSlot=document.createElement('div');
  if(state.room.guestName){
    guestSlot.className='lobby-slot';
    guestSlot.innerHTML='<span>'+escapeHtml(state.room.guestName)+'</span><span class="sym">'+state.room.guestSymbol+'</span>';
  }else{
    guestSlot.className='lobby-slot empty';
    guestSlot.textContent='Waiting for a guest to join';
  }
  container.appendChild(guestSlot);
  const statusEl=document.getElementById('lobbyStatus');
  const startBtn=document.getElementById('btnStartRoomGame');
  if(state.room.guestName){
    statusEl.textContent='Both players are in. Host can start the match.';
    statusEl.classList.add('ready');
    startBtn.disabled=state.roomRole!=='host';
  }else{
    statusEl.textContent='Waiting for opponent to join\u2026';
    statusEl.classList.remove('ready');
    startBtn.disabled=true;
  }
  if(state.room.status==='playing'){
    startRoomGameFromLobby();
  }
}

function startRoomPolling(){
  stopRoomPolling();
  state.roomPollTimer=setInterval(syncRoom,600);
  window.addEventListener('storage',onStorageEvent);
}

function stopRoomPolling(){
  if(state.roomPollTimer){
    clearInterval(state.roomPollTimer);
    state.roomPollTimer=null;
  }
  window.removeEventListener('storage',onStorageEvent);
}

function onStorageEvent(e){
  if(e.key===STORAGE_KEYS.rooms) syncRoom();
}

function syncRoom(){
  if(!state.room) return;
  const rooms=readRooms();
  const fresh=rooms[state.room.id];
  if(!fresh){
    if(state.screen==='game'||state.screen==='room-lobby'){
      showToast('Room closed by host','error');
      stopRoomPolling();
      state.room=null;
      navigate('home');
    }
    return;
  }
  const changed=JSON.stringify(fresh)!==JSON.stringify(state.room);
  state.room=fresh;
  if(!changed) return;
  if(state.screen==='room-lobby'){
    renderLobby();
  }else if(state.screen==='game'&&state.mode==='room'){
    state.board=fresh.board.slice();
    state.currentTurn=fresh.currentTurn;
    state.score=fresh.score;
    const result=checkWinnerBoard(state.board);
    const wasOver=state.gameOver;
    if(result){
      state.gameOver=true;
      state.winningLine=result.line;
      state.lastResult={type:'win',winner:result.winner};
    }else if(isBoardFull(state.board)){
      state.gameOver=true;
      state.lastResult={type:'draw'};
    }else{
      state.gameOver=false;
      state.winningLine=null;
    }
    renderBoard();
    updateScoreboard();
    updateTurnIndicator();
    if(state.gameOver&&!wasOver){
      setTimeout(showResultModal,350);
    }
  }
}

function isLocalTurn(){
  if(!state.room) return true;
  const mySymbol=state.roomRole==='host'?state.room.hostSymbol:state.room.guestSymbol;
  return mySymbol===state.currentTurn;
}

function persistRoomState(){
  if(!state.room) return;
  const rooms=readRooms();
  const room=rooms[state.room.id];
  if(!room) return;
  room.board=state.board.slice();
  room.currentTurn=state.currentTurn;
  room.score=state.score;
  room.updatedAt=Date.now();
  rooms[state.room.id]=room;
  writeRooms(rooms);
  state.room=room;
}

document.getElementById('btnCopyRoomId').addEventListener('click',()=>{
  soundClick();
  const id=state.room?state.room.id:'';
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(id).then(()=>showToast('Copied!','success')).catch(()=>showToast('Copied!','success'));
  }else{
    showToast('Copied!','success');
  }
});

document.getElementById('btnLeaveRoom').addEventListener('click',()=>{
  soundClick();
  leaveRoom(true);
  navigate('home');
});

function leaveRoom(closeIfHost){
  if(!state.room) return;
  stopRoomPolling();
  const rooms=readRooms();
  if(state.roomRole==='host'&&closeIfHost){
    delete rooms[state.room.id];
    writeRooms(rooms);
  }else if(state.roomRole==='guest'){
    const room=rooms[state.room.id];
    if(room){
      room.guestName=null;
      room.status='waiting';
      room.board=Array(9).fill(null);
      room.currentTurn='X';
      writeRooms(rooms);
    }
  }
  sessionStorage.removeItem('ttt_room_role_'+state.room.id);
  state.room=null;
  state.roomRole=null;
  state.mode=null;
}

document.getElementById('btnStartRoomGame').addEventListener('click',()=>{
  if(state.roomRole!=='host') return;
  soundClick();
  const rooms=readRooms();
  const room=rooms[state.room.id];
  if(!room||!room.guestName) return;
  room.status='playing';
  room.board=Array(9).fill(null);
  room.currentTurn='X';
  room.score={X:0,O:0,draw:0};
  room.updatedAt=Date.now();
  rooms[state.room.id]=room;
  writeRooms(rooms);
  state.room=room;
  startRoomGameFromLobby();
});

function startRoomGameFromLobby(){
  state.mode='room';
  const room=state.room;
  const hostSym=room.hostSymbol;
  const guestSym=room.guestSymbol;
  state.players={
    X:{name:hostSym==='X'?room.hostName:room.guestName,type:'human'},
    O:{name:hostSym==='O'?room.hostName:room.guestName,type:'human'}
  };
  state.board=room.board.slice();
  state.currentTurn=room.currentTurn;
  state.score=room.score;
  resetBoardState();
  state.currentTurn='X';
  renderScreen('game');
  setupGameHeader();
  buildBoardSkeleton();
  updateScoreboard();
  updateTurnIndicator();
}

document.getElementById('btnHowTo').addEventListener('click',()=>{
  soundClick();
  showModal('modalHowTo');
});
document.getElementById('btnHowToClose').addEventListener('click',()=>{
  soundClick();
  hideModal('modalHowTo');
});

document.getElementById('btnSettingsOpen').addEventListener('click',()=>{
  soundClick();
  showModal('modalSettings');
});
document.getElementById('btnSettingsClose').addEventListener('click',()=>{
  soundClick();
  hideModal('modalSettings');
});

document.getElementById('toggleSound').addEventListener('click',()=>{
  settings.sound=!settings.sound;
  applySettings();
  saveSettings();
  soundClick();
});
document.getElementById('toggleAnimation').addEventListener('click',()=>{
  settings.animation=!settings.animation;
  applySettings();
  saveSettings();
  soundClick();
});
document.getElementById('toggleTheme').addEventListener('click',()=>{
  settings.theme=settings.theme==='dark'?'light':'dark';
  applySettings();
  saveSettings();
  soundClick();
});

document.getElementById('btnResetAllData').addEventListener('click',()=>{
  soundClick();
  try{
    localStorage.removeItem(STORAGE_KEYS.settings);
    localStorage.removeItem(STORAGE_KEYS.stats);
    localStorage.removeItem(STORAGE_KEYS.rooms);
  }catch(e){}
  settings={sound:true,animation:true,theme:'dark'};
  stats={played:0,wins:0,losses:0,draws:0};
  applySettings();
  renderStats();
  showToast('All data has been reset','success');
});

document.getElementById('btnStatsIcon').addEventListener('click',()=>{
  soundClick();
  renderStats();
  showModal('modalStats');
});
document.getElementById('btnStatsClose').addEventListener('click',()=>{
  soundClick();
  hideModal('modalStats');
});

function init(){
  loadSettings();
  loadStats();
  renderScreen('home');
}

init();
</script>
</body>
</html>`;
}

async function sendModernResponse(m, bob, textContent, isModern) {
  if (!isModern || !bob) return m.reply(textContent);
  try {
    const htmlPayload = getFullInteractiveHtml();

    const rawContent = {
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            unifiedResponse: {
              data: Buffer.from(JSON.stringify({
                __typename: "GenAIUnifiedResponse",
                response_id: randomUUID(),
                sections: [{
                  __typename: "GenAIUnifiedResponseSection",
                  view_model: {
                    __typename: "GenAISingleLayoutViewModel",
                    primitive: {
                      __typename: "FOAHtmlPrimitiveDemoDONOTUSE",
                      trusted_sources: [],
                      payload: htmlPayload
                    }
                  }
                }]
              })).toString("base64")
            },
            contextInfo: {
              isForwarded: true,
              forwardOrigin: 4
            }
          }
        }
      }
    };

    const genMsgFunc = await getGenerateWAMessageFromContent();
    if (genMsgFunc) {
      const waMsg = genMsgFunc(m.chat, rawContent, {
        additionalAttributes: { type: "text" }
      });
      await bob.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id });
    } else {
      await bob.relayMessage(m.chat, rawContent, {
        additionalAttributes: { type: "text" }
      });
    }
  } catch (e) {
    console.error('Error sending modern response:', e);
    return m.reply(textContent);
  }
}

global.tictactoe = global.tictactoe || {};

module.exports = {
    CmD: ['tictactoe'],
    aliases: ['tictactoe', 'ttt', 'ttc', 'newttc'],
    categori: 'game',
    exec: async (m, { bob, prefix, command, text }) => {
        const sender = m.sender;
        const userStats = getUserStats(sender);
        const botStats = getBotStats();

        let input = text ? text.trim().toLowerCase() : '';
        const isModernCmd = command === 'newttc' || command === 'newttt';

        // Opsi Menyerah / Reset
        if (input === 'reset' || input === 'surrender' || input === 'stop' || input === 'menyerah') {
            if (global.tictactoe[sender]) {
                const wasModern = global.tictactoe[sender].isModern;
                delete global.tictactoe[sender];
                userStats.lose += 1;
                botStats.win += 1;
                saveDb();
                return sendModernResponse(m, bob, `🏳️ *Kamu telah menyerah! Bot Menang!*\n\n📊 Total Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`, wasModern || isModernCmd);
            } else {
                return m.reply('❌ Kamu sedang tidak berada dalam permainan Tic-Tac-Toe.');
            }
        }

        // Jika user belum punya sesi permainan
        if (!global.tictactoe[sender]) {
            let mode = '';
            if (input === 'easy' || input === '1') mode = 'easy';
            else if (input === 'normal' || input === '2') mode = 'normal';
            else if (input === 'hard' || input === '3') mode = 'hard';

            if (!mode) {
                let menu = `🎮 *TIC TAC TOE (${isModernCmd ? 'MODERN ' : ''}Player vs Bot)* 🎮\n\n`;
                menu += `Pilih tingkat kesulitan untuk memulai:\n`;
                menu += `• *${prefix + command} easy* (atau *${prefix + command} 1*) - Mode Mudah\n`;
                menu += `• *${prefix + command} normal* (atau *${prefix + command} 2*) - Mode Sedang\n`;
                menu += `• *${prefix + command} hard* (atau *${prefix + command} 3*) - Mode Sulit\n\n`;
                menu += `📊 *Statistik Kamu:* ${userStats.win} Menang | ${userStats.lose} Kalah | ${userStats.draw} Seri\n`;
                menu += `🤖 *Statistik Bot:* ${botStats.win} Menang | ${botStats.lose} Kalah | ${botStats.draw} Seri\n\n`;
                menu += `_Ketik contoh: *${prefix + command} easy* untuk mulai_`;
                return sendModernResponse(m, bob, menu, isModernCmd);
            }

            global.tictactoe[sender] = {
                board: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
                mode: mode,
                isModern: isModernCmd
            };

            let startMsg = `🎮 *GAME TIC TAC TOE MODERN (${mode.toUpperCase()})* 🎮\n\n`;
            startMsg += `${renderBoard(global.tictactoe[sender].board, isModernCmd)}\n\n`;
            startMsg += `👉 *Giliran Kamu (❌)!*\nKetik *${prefix + command} <1-9>* untuk memilih posisi.\n`;
            startMsg += `_(Ketik *${prefix + command} reset* untuk menyerah)_`;
            return sendModernResponse(m, bob, startMsg, isModernCmd, global.tictactoe[sender].board, "Giliran Kamu (❌)!", mode);
        }

        // Jika user sedang berada dalam sesi permainan
        const game = global.tictactoe[sender];
        const isModern = game.isModern || isModernCmd;
        const moveNum = parseInt(input);
        const pos = moveNum - 1;

        if (isNaN(moveNum) || pos < 0 || pos > 8) {
            return sendModernResponse(m, bob, `⚠️ *Pilih angka 1-9 yang sesuai dengan papan!*\n\n${renderBoard(game.board, isModern)}`, isModern, game.board, "Pilih posisi 1-9!", game.mode);
        }

        if (game.board[pos] === '❌' || game.board[pos] === '⭕') {
            return sendModernResponse(m, bob, `⚠️ *Posisi ${moveNum} sudah terisi!* Pilih angka lain yang masih tersedia.\n\n${renderBoard(game.board, isModern)}`, isModern, game.board, "Posisi terisi!", game.mode);
        }

        // Langkah Player
        game.board[pos] = '❌';

        // Cek Player Menang
        if (checkWin(game.board, '❌')) {
            const finalBoard = [...game.board];
            delete global.tictactoe[sender];
            userStats.win += 1;
            botStats.lose += 1;
            saveDb();
            return sendModernResponse(m, bob, `🎉 *SELAMAT! KAMU MENANG!* 🏆\n\n${renderBoard(finalBoard, isModern)}\n\n📊 Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`, isModern, finalBoard, "🎉 Kamu Menang!", game.mode);
        }

        // Cek Seri
        if (checkFull(game.board)) {
            const finalBoard = [...game.board];
            delete global.tictactoe[sender];
            userStats.draw += 1;
            botStats.draw += 1;
            saveDb();
            return sendModernResponse(m, bob, `🤝 *PERMAINAN SERI / DRAW!* 🤝\n\n${renderBoard(finalBoard, isModern)}\n\n📊 Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`, isModern, finalBoard, "🤝 Permainan Seri!", game.mode);
        }

        // Langkah Bot
        let botPos = -1;
        if (game.mode === 'easy') {
            botPos = getRandomMove(game.board);
        } else if (game.mode === 'normal') {
            botPos = Math.random() < 0.5 ? getBestMove(game.board) : getRandomMove(game.board);
        } else if (game.mode === 'hard') {
            botPos = getBestMove(game.board);
        }

        if (botPos !== -1) {
            game.board[botPos] = '⭕';
        }

        // Cek Bot Menang
        if (checkWin(game.board, '⭕')) {
            const finalBoard = [...game.board];
            delete global.tictactoe[sender];
            userStats.lose += 1;
            botStats.win += 1;
            saveDb();
            return sendModernResponse(m, bob, `💻 *BOT MENANG! KAMU KALAH!* 😜\n\n${renderBoard(finalBoard, isModern)}\n\n📊 Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`, isModern, finalBoard, "💻 Bot Menang!", game.mode);
        }

        // Cek Seri setelah bot bergerak
        if (checkFull(game.board)) {
            const finalBoard = [...game.board];
            delete global.tictactoe[sender];
            userStats.draw += 1;
            botStats.draw += 1;
            saveDb();
            return sendModernResponse(m, bob, `🤝 *PERMAINAN SERI / DRAW!* 🤝\n\n${renderBoard(finalBoard, isModern)}\n\n📊 Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`, isModern, finalBoard, "🤝 Permainan Seri!", game.mode);
        }

        // Lanjut ke giliran berikutnya
        let turnMsg = `🎮 *TIC TAC TOE (${game.mode.toUpperCase()})* 🎮\n\n`;
        turnMsg += `${renderBoard(game.board, isModern)}\n\n`;
        turnMsg += `👉 *Giliran Kamu (❌)!* Ketik *${prefix + command} <1-9>*`;
        return sendModernResponse(m, bob, turnMsg, isModern, game.board, "Giliran Kamu (❌)!", game.mode);
    }
};
