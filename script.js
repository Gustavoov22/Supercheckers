// Game state
let board = [];
let selectedSquare = null;
let currentPlayer = 'red'; // red or black
let gameActive = true;
let captureChain = null; // For multi-capture sequences

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
    captureChain = null;

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
                const pieceType = board[row][col];
                if (pieceType.includes('queen')) {
                    square.classList.add(pieceType.replace('-queen', '') + '-piece');
                    square.textContent = '👑';
                } else {
                    square.classList.add(pieceType + '-piece');
                    square.textContent = '●';
                }
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
        if (piece && piece.startsWith(currentPlayer)) {
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
        const moveResult = isValidMove(selectedSquare.row, selectedSquare.col, row, col);
        if (moveResult.valid) {
            movePiece(selectedSquare.row, selectedSquare.col, row, col, moveResult.captures);

            // Check for multi-capture
            if (moveResult.captures.length > 0 && canCaptureMore(row, col)) {
                selectedSquare = { row, col };
                captureChain = { row, col };
                renderBoard();
                updateStatus(`Multi-capture! Continue capturing or click your piece to finish.`);
                return;
            }

            // End turn
            selectedSquare = null;
            captureChain = null;
            currentPlayer = currentPlayer === 'red' ? 'black' : 'red';
            renderBoard();
            updateStatus(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} player's turn!`);
        } else {
            updateStatus('Invalid move! Try again.');
        }
    }
}

// Check if piece can capture more
function canCaptureMore(row, col) {
    const piece = board[row][col];
    if (!piece) return false;

    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
        const captureRow = row + dr;
        const captureCol = col + dc;
        const landRow = row + dr * 2;
        const landCol = col + dc * 2;

        if (isValidCapture(row, col, landRow, landCol, captureRow, captureCol)) {
            return true;
        }
    }
    return false;
}

// Check if move is valid
function isValidMove(fromRow, fromCol, toRow, toCol) {
    // Must be empty destination
    if (board[toRow][toCol] !== null) {
        return { valid: false };
    }

    const piece = board[fromRow][fromCol];
    const isQueen = piece.includes('queen');
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    // Must be diagonal
    if (absRowDiff !== absColDiff) {
        return { valid: false };
    }

    // Check for captures first
    const captures = [];

    // For regular pieces - single capture
    if (!isQueen && absRowDiff === 2 && absColDiff === 2) {
        const captureRow = fromRow + rowDiff / 2;
        const captureCol = fromCol + colDiff / 2;
        const capturedPiece = board[captureRow][captureCol];

        if (capturedPiece && !capturedPiece.startsWith(currentPlayer)) {
            captures.push({ row: captureRow, col: captureCol });
            return { valid: true, captures };
        }
        return { valid: false };
    }

    // For queens - multi capture
    if (isQueen && absRowDiff >= 2) {
        const stepRow = rowDiff / absRowDiff;
        const stepCol = colDiff / absColDiff;
        let hasCapture = false;

        for (let i = 1; i < absRowDiff; i++) {
            const checkRow = fromRow + stepRow * i;
            const checkCol = fromCol + stepCol * i;
            const pieceAtPos = board[checkRow][checkCol];

            if (pieceAtPos) {
                if (pieceAtPos.startsWith(currentPlayer)) {
                    return { valid: false }; // Own piece in path
                }
                captures.push({ row: checkRow, col: checkCol });
                hasCapture = true;
            }
        }

        if (hasCapture) {
            return { valid: true, captures };
        }
    }

    // Regular moves (no capture)
    // Regular pieces - single step
    if (!isQueen && absRowDiff === 1 && absColDiff === 1) {
        // Check direction
        if (currentPlayer === 'red' && rowDiff > 0) {
            return { valid: true, captures: [] };
        }
        if (currentPlayer === 'black' && rowDiff < 0) {
            return { valid: true, captures: [] };
        }
        return { valid: false };
    }

    // Queens - any distance
    if (isQueen && absRowDiff >= 1) {
        // Check path is clear
        const stepRow = rowDiff / absRowDiff;
        const stepCol = colDiff / absColDiff;

        for (let i = 1; i < absRowDiff; i++) {
            const checkRow = fromRow + stepRow * i;
            const checkCol = fromCol + stepCol * i;
            if (board[checkRow][checkCol] !== null) {
                return { valid: false };
            }
        }

        return { valid: true, captures: [] };
    }

    return { valid: false };
}

// Helper function for queen multi-capture validation
function isValidCapture(fromRow, fromCol, toRow, toCol, captureRow, captureCol) {
    if (toRow < 0 || toRow >= BOARD_SIZE || toCol < 0 || toCol >= BOARD_SIZE) return false;
    if (board[toRow][toCol] !== null) return false;
    if (captureRow < 0 || captureRow >= BOARD_SIZE || captureCol < 0 || captureCol >= BOARD_SIZE) return false;

    const capturedPiece = board[captureRow][captureCol];
    if (!capturedPiece || capturedPiece.startsWith(currentPlayer)) return false;

    // Check path is clear
    const stepRow = (captureRow - fromRow) / 2;
    const stepCol = (captureCol - fromCol) / 2;
    const midRow = fromRow + stepRow;
    const midCol = fromCol + stepCol;

    return board[midRow][midCol] !== null && !board[midRow][midCol].startsWith(currentPlayer);
}

// Move piece
function movePiece(fromRow, fromCol, toRow, toCol, captures) {
    const piece = board[fromRow][fromCol];

    // Remove captured pieces
    for (const capture of captures) {
        board[capture.row][capture.col] = null;
    }

    // Move piece
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;

    // Check for queen promotion
    if (!piece.includes('queen')) {
        if (currentPlayer === 'red' && toRow === BOARD_SIZE - 1) {
            board[toRow][toCol] = 'red-queen';
            updateStatus('🔴 Red piece promoted to QUEEN! 👑');
        } else if (currentPlayer === 'black' && toRow === 0) {
            board[toRow][toCol] = 'black-queen';
            updateStatus('⚫ Black piece promoted to QUEEN! 👑');
        }
    }
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
