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

function renderBoard(b) {
    const f = (val) => numEmoji[val] || val;
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

global.tictactoe = global.tictactoe || {};

module.exports = {
    CmD: ['tictactoe'],
    aliases: ['tictactoe', 'ttt', 'ttc'],
    categori: 'game',
    exec: async (m, { prefix, command, text }) => {
        const sender = m.sender;
        const userStats = getUserStats(sender);
        const botStats = getBotStats();

        let input = text ? text.trim().toLowerCase() : '';

        // Opsi Menyerah / Reset
        if (input === 'reset' || input === 'surrender' || input === 'stop' || input === 'menyerah') {
            if (global.tictactoe[sender]) {
                delete global.tictactoe[sender];
                userStats.lose += 1;
                botStats.win += 1;
                saveDb();
                return m.reply(`🏳️ *Kamu telah menyerah! Bot Menang!*\n\n📊 Total Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`);
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
                let menu = `🎮 *TIC TAC TOE (Player vs Bot)* 🎮\n\n`;
                menu += `Pilih tingkat kesulitan untuk memulai:\n`;
                menu += `• *${prefix + command} easy* (atau *${prefix + command} 1*) - Mode Mudah\n`;
                menu += `• *${prefix + command} normal* (atau *${prefix + command} 2*) - Mode Sedang\n`;
                menu += `• *${prefix + command} hard* (atau *${prefix + command} 3*) - Mode Sulit\n\n`;
                menu += `📊 *Statistik Kamu:* ${userStats.win} Menang | ${userStats.lose} Kalah | ${userStats.draw} Seri\n`;
                menu += `🤖 *Statistik Bot:* ${botStats.win} Menang | ${botStats.lose} Kalah | ${botStats.draw} Seri\n\n`;
                menu += `_Ketik contoh: *${prefix + command} easy* untuk mulai_`;
                return m.reply(menu);
            }

            global.tictactoe[sender] = {
                board: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
                mode: mode
            };

            let startMsg = `🎮 *GAME TIC TAC TOE (${mode.toUpperCase()})* 🎮\n\n`;
            startMsg += `${renderBoard(global.tictactoe[sender].board)}\n\n`;
            startMsg += `👉 *Giliran Kamu (❌)!*\nKetik *${prefix + command} <1-9>* untuk memilih posisi.\n`;
            startMsg += `_(Ketik *${prefix + command} reset* untuk menyerah)_`;
            return m.reply(startMsg);
        }

        // Jika user sedang berada dalam sesi permainan
        const game = global.tictactoe[sender];
        const moveNum = parseInt(input);
        const pos = moveNum - 1;

        if (isNaN(moveNum) || pos < 0 || pos > 8) {
            return m.reply(`⚠️ *Pilih angka 1-9 yang sesuai dengan papan!*\n\n${renderBoard(game.board)}`);
        }

        if (game.board[pos] === '❌' || game.board[pos] === '⭕') {
            return m.reply(`⚠️ *Posisi ${moveNum} sudah terisi!* Pilih angka lain yang masih tersedia.\n\n${renderBoard(game.board)}`);
        }

        // Langkah Player
        game.board[pos] = '❌';

        // Cek Player Menang
        if (checkWin(game.board, '❌')) {
            delete global.tictactoe[sender];
            userStats.win += 1;
            botStats.lose += 1;
            saveDb();
            return m.reply(`🎉 *SELAMAT! KAMU MENANG!* 🏆\n\n${renderBoard(game.board)}\n\n📊 Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`);
        }

        // Cek Seri
        if (checkFull(game.board)) {
            delete global.tictactoe[sender];
            userStats.draw += 1;
            botStats.draw += 1;
            saveDb();
            return m.reply(`🤝 *PERMAINAN SERI / DRAW!* 🤝\n\n${renderBoard(game.board)}\n\n📊 Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`);
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
            delete global.tictactoe[sender];
            userStats.lose += 1;
            botStats.win += 1;
            saveDb();
            return m.reply(`💻 *BOT MENANG! KAMU KALAH!* 😜\n\n${renderBoard(game.board)}\n\n📊 Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`);
        }

        // Cek Seri setelah bot bergerak
        if (checkFull(game.board)) {
            delete global.tictactoe[sender];
            userStats.draw += 1;
            botStats.draw += 1;
            saveDb();
            return m.reply(`🤝 *PERMAINAN SERI / DRAW!* 🤝\n\n${renderBoard(game.board)}\n\n📊 Menang: ${userStats.win} | Kalah: ${userStats.lose} | Seri: ${userStats.draw}`);
        }

        // Lanjut ke giliran berikutnya
        let turnMsg = `🎮 *TIC TAC TOE (${game.mode.toUpperCase()})* 🎮\n\n`;
        turnMsg += `${renderBoard(game.board)}\n\n`;
        turnMsg += `👉 *Giliran Kamu (❌)!* Ketik *${prefix + command} <1-9>*`;
        return m.reply(turnMsg);
    }
};
