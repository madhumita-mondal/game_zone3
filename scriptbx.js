const board = document.getElementById("board");
const moveCountEl = document.getElementById("moveCount");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const iqValueEl = document.getElementById("iqValue");

const SIZE = 4;
const EMPTY = 0;
const SOLVED_BOARD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

let tiles = [...SOLVED_BOARD];
let moves = 0;
let seconds = 0;
let timerInterval = null;
let gameStarted = false;
let gameWon = false;

function renderBoard() {
    board.innerHTML = "";

    tiles.forEach((value, index) => {
        const tile = document.createElement("button");
        tile.className = "tile";
        tile.setAttribute("type", "button");
        tile.dataset.index = index;

        if (value === EMPTY) {
            tile.classList.add("empty");
            tile.disabled = true;
            tile.textContent = "";
        } else {
            tile.textContent = value;
            tile.addEventListener("click", () => handleTileClick(index));
        }

        if (gameWon && value !== EMPTY) {
            tile.classList.add("win");
        }

        board.appendChild(tile);
    });
}

function handleTileClick(index) {
    if (gameWon) return;

    const emptyIndex = tiles.indexOf(EMPTY);

    if (!isAdjacent(index, emptyIndex)) {
        messageEl.textContent = "Only tiles next to the empty space can move.";
        return;
    }

    if (!gameStarted) {
        startTimer();
        gameStarted = true;
    }

    swapTiles(index, emptyIndex);
    moves++;
    updateMoves();
    renderBoard();

    if (checkWin()) {
        gameWon = true;
        stopTimer();
        updateIQ();
        renderBoard();
        messageEl.textContent = `You solved it in ${moves} moves and ${formatTime(seconds)}.`;
    } else {
        messageEl.textContent = "Good move! Keep going.";
    }
}

function isAdjacent(index1, index2) {
    const row1 = Math.floor(index1 / SIZE);
    const col1 = index1 % SIZE;
    const row2 = Math.floor(index2 / SIZE);
    const col2 = index2 % SIZE;

    const sameRowNext = row1 === row2 && Math.abs(col1 - col2) === 1;
    const sameColNext = col1 === col2 && Math.abs(row1 - row2) === 1;

    return sameRowNext || sameColNext;
}

function swapTiles(i, j) {
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
}

function updateMoves() {
    moveCountEl.textContent = moves;
}

function updateTimer() {
    timerEl.textContent = formatTime(seconds);
}

function formatTime(totalSeconds) {
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const secs = String(totalSeconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
}

function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
        seconds++;
        updateTimer();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function checkWin() {
    return tiles.every((value, index) => value === SOLVED_BOARD[index]);
}

function resetGame() {
    tiles = [...SOLVED_BOARD];
    moves = 0;
    seconds = 0;
    gameStarted = false;
    gameWon = false;

    stopTimer();
    updateMoves();
    updateTimer();
    iqValueEl.textContent = "60";
    messageEl.textContent = "Tap Shuffle to start a new puzzle.";
    renderBoard();
}

function shuffleGame() {
    tiles = [...SOLVED_BOARD];
    let emptyIndex = tiles.indexOf(EMPTY);

    for (let i = 0; i < 300; i++) {
        const neighbors = getMovableNeighbors(emptyIndex);
        const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
        swapTiles(emptyIndex, randomNeighbor);
        emptyIndex = randomNeighbor;
    }

    if (checkWin()) {
        shuffleGame();
        return;
    }

    moves = 0;
    seconds = 0;
    gameStarted = false;
    gameWon = false;

    stopTimer();
    updateMoves();
    updateTimer();
    iqValueEl.textContent = "60";
    messageEl.textContent = "Puzzle shuffled! Start sliding the tiles.";
    renderBoard();
}

function getMovableNeighbors(emptyIndex) {
    const row = Math.floor(emptyIndex / SIZE);
    const col = emptyIndex % SIZE;
    const neighbors = [];

    if (row > 0) neighbors.push(emptyIndex - SIZE);
    if (row < SIZE - 1) neighbors.push(emptyIndex + SIZE);
    if (col > 0) neighbors.push(emptyIndex - 1);
    if (col < SIZE - 1) neighbors.push(emptyIndex + 1);

    return neighbors;
}

function updateIQ() {
    let iqScore = 60;

    if (moves <= 80) iqScore += 60;
    // else if (moves <= 150) iqScore += 15;
    // else if (moves <= 140) iqScore += 20;
    // else if (moves <= 130) iqScore += 25;
    // else if (moves <= 120) iqScore += 30;
    // else if (moves <= 110) iqScore += 35;
    // else if (moves <= 100) iqScore += 40;


    else if (moves <= 100) iqScore += 40;
    else if (moves <= 110) iqScore += 35;
    else if (moves <= 120) iqScore += 30;
    else if (moves <= 130) iqScore += 25;
    else if (moves <= 140) iqScore += 20;
    else if (moves <= 150) iqScore += 15;
    else iqScore += 7;

    if (seconds <= 120) iqScore += 60;
    else if (seconds <= 180) iqScore += 40;
    else if (seconds <= 210) iqScore += 35;
    else if (seconds <= 240) iqScore += 25;
    else if (seconds <= 290) iqScore += 20;
    else if (seconds <= 300) iqScore += 15;
    else if (seconds <= 330) iqScore += 10;

    iqValueEl.textContent = iqScore;
}

shuffleBtn.addEventListener("click", shuffleGame);
resetBtn.addEventListener("click", resetGame);

resetGame();