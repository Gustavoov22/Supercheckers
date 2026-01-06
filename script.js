// Game state
let board = [];
let selectedSquare = null;
let currentPlayer = 'red'; // red or black
let gameActive = true;

const BOARD_SIZE = 10;
const gameBoard = document.getElementById('game-board');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');

// Initialize the game
function initGame() {
    board = [];
    selectedSquare = null;
    currentPlayer = 'red';
    gameActive = true;

    // Create empty board
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = null;
        }
    }

    // Place initial pieces (first 3 rows for each player)
    // Red pieces (top)
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if ((row + col) % 2 === 1) {
                board[row][col] = 'red';
            }
        }
    }

    // Black pieces (bottom)
    for (let row = BOARD_SIZE - 3; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if ((row + col) % 2 === 1) {
                board[row][col] = 'black';
            }
        }
    }

    renderBoard();
    updateStatus('Red player's turn!');
}

// Render the board
function renderBoard() {
    gameBoard.innerHTML = '';

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const square = document.createElement('div');
            square.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = row;
            square.dataset.col = col;

            // Add piece if exists
            if (board[row][col]) {
                square.classList.add(board[row][col] + '-piece');
                square.textContent = '●';
            }

            // Highlight selected square
            if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                square.classList.add('selected');
            }

            square.addEventListener('click', handleSquareClick);
            gameBoard.appendChild(square);
        }
    }
}

// Handle square click
function handleSquareClick(e) {
    if (!gameActive) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    const piece = board[row][col];

    // If no square selected yet
    if (!selectedSquare) {
        if (piece === currentPlayer) {
            selectedSquare = { row, col };
            renderBoard();
            updateStatus(`Selected (${row},${col}). Click destination.`);
        } else {
            updateStatus(`It's ${currentPlayer}'s turn! Select your piece.`);
        }
    } else {
        // If clicking the same square, deselect
        if (selectedSquare.row === row && selectedSquare.col === col) {
            selectedSquare = null;
            renderBoard();
            updateStatus(`Selection cancelled. Select your piece.`);
            return;
        }

        // Try to move
        if (isValidMove(selectedSquare.row, selectedSquare.col, row, col)) {
            movePiece(selectedSquare.row, selectedSquare.col, row, col);
            selectedSquare = null;
            currentPlayer = currentPlayer === 'red' ? 'black' : 'red';
            renderBoard();
            updateStatus(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} player's turn!`);
        } else {
            updateStatus('Invalid move! Try again.');
        }
    }
}

// Check if move is valid (simple diagonal move)
function isValidMove(fromRow, fromCol, toRow, toCol) {
    // Must be empty destination
    if (board[toRow][toCol] !== null) return false;

    // Must be diagonal
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    if (rowDiff !== 1 || colDiff !== 1) return false;

    // Red moves down (increasing row), black moves up (decreasing row)
    if (currentPlayer === 'red' && toRow <= fromRow) return false;
    if (currentPlayer === 'black' && toRow >= fromRow) return false;

    return true;
}

// Move piece
function movePiece(fromRow, fromCol, toRow, toCol) {
    board[toRow][toCol] = board[fromRow][fromCol];
    board[fromRow][fromCol] = null;
}

// Update status message
function updateStatus(message) {
    statusDiv.textContent = message;
}

// Event listeners
resetBtn.addEventListener('click', () => {
    initGame();
});

// Start game on load
window.addEventListener('DOMContentLoaded', initGame);
