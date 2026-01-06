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


// HINT SYSTEM
let hintActive = false;

// Get hint button
const hintBtn = document.getElementById('hint-btn');
const explanationDiv = document.getElementById('explanation');

// Event listener for hint button
hintBtn.addEventListener('click', showHint);

// Main hint function
function showHint() {
    if (!gameActive) {
        updateStatus('Game is not active. Reset to play.');
        return;
    }

    // Clear previous hints
    clearHints();

    // Find best move
    const bestMove = findBestMove();

    if (!bestMove) {
        updateStatus('No valid moves available!');
        explanationDiv.innerHTML = '<h3>⚠️ No Moves Available</h3><p>It appears you have no valid moves. Try resetting the game.</p>';
        explanationDiv.classList.remove('hidden');
        return;
    }

    // Highlight the move
    highlightMove(bestMove);

    // Show explanation
    showExplanation(bestMove);

    updateStatus('💡 Hint shown! Check the explanation below.');
}

// Find the best move for current player
function findBestMove() {
    const moves = [];

    // Iterate through all pieces
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const piece = board[row][col];

            if (piece && piece.startsWith(currentPlayer)) {
                // Find all possible moves for this piece
                const pieceMoves = getPossibleMoves(row, col, piece);
                moves.push(...pieceMoves);
            }
        }
    }

    if (moves.length === 0) return null;

    // Sort by priority (highest first)
    moves.sort((a, b) => b.priority - a.priority);

    return moves[0];
}

// Get all possible moves for a piece
function getPossibleMoves(row, col, piece) {
    const moves = [];
    const isQueen = piece.includes('queen');
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
        if (isQueen) {
            // Queens can move any distance
            for (let dist = 1; dist < BOARD_SIZE; dist++) {
                const toRow = row + dr * dist;
                const toCol = col + dc * dist;

                if (toRow < 0 || toRow >= BOARD_SIZE || toCol < 0 || toCol >= BOARD_SIZE) break;
                if (board[toRow][toCol] !== null) {
                    // Check if it's a capture
                    if (!board[toRow][toCol].startsWith(currentPlayer)) {
                        // Try multi-capture
                        const captureMoves = getQueenCaptureMoves(row, col, dr, dc);
                        moves.push(...captureMoves);
                    }
                    break; // Path blocked
                }

                // Valid move
                const priority = getMovePriority(row, col, toRow, toCol, piece, false);
                moves.push({
                    fromRow: row,
                    fromCol: col,
                    toRow: toRow,
                    toCol: toCol,
                    captures: [],
                    priority: priority,
                    isQueen: isQueen
                });
            }
        } else {
            // Regular piece - single step
            const toRow = row + dr;
            const toCol = col + dc;

            if (toRow < 0 || toRow >= BOARD_SIZE || toCol < 0 || toCol >= BOARD_SIZE) continue;

            // Check direction
            if (currentPlayer === 'red' && dr <= 0) continue;
            if (currentPlayer === 'black' && dr >= 0) continue;

            const target = board[toRow][toCol];

            if (target === null) {
                // Regular move
                const priority = getMovePriority(row, col, toRow, toCol, piece, false);
                moves.push({
                    fromRow: row,
                    fromCol: col,
                    toRow: toRow,
                    toCol: toCol,
                    captures: [],
                    priority: priority,
                    isQueen: false
                });
            } else if (!target.startsWith(currentPlayer)) {
                // Capture
                const capRow = toRow + dr;
                const capCol = toCol + dc;
                if (capRow >= 0 && capRow < BOARD_SIZE && capCol >= 0 && capCol < BOARD_SIZE &&
                    board[capRow][capCol] === null) {
                    const priority = getMovePriority(row, col, capRow, capCol, piece, true);
                    moves.push({
                        fromRow: row,
                        fromCol: col,
                        toRow: capRow,
                        toCol: capCol,
                        captures: [{row: toRow, col: toCol}],
                        priority: priority,
                        isQueen: false
                    });
                }
            }
        }
    }

    return moves;
}

// Get queen capture moves (multi-capture)
function getQueenCaptureMoves(startRow, startCol, dr, dc) {
    const moves = [];
    let captured = [];
    let row = startRow;
    let col = startCol;

    for (let dist = 1; dist < BOARD_SIZE; dist++) {
        row += dr;
        col += dc;

        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) break;

        const piece = board[row][col];

        if (piece === null) {
            if (captured.length > 0) {
                // Landing spot after captures
                const priority = 100 + captured.length * 50; // High priority for multi-capture
                moves.push({
                    fromRow: startRow,
                    fromCol: startCol,
                    toRow: row,
                    toCol: col,
                    captures: [...captured],
                    priority: priority,
                    isQueen: true
                });
            }
        } else if (!piece.startsWith(currentPlayer)) {
            // Can capture this piece
            captured.push({row, col});
        } else {
            // Own piece blocks
            break;
        }
    }

    return moves;
}

// Calculate move priority
function getMovePriority(fromRow, fromCol, toRow, toCol, piece, isCapture) {
    let priority = 0;
    const isQueen = piece.includes('queen');

    // 1. Captures are highest priority
    if (isCapture) {
        priority += 100;
        if (isQueen) priority += 50; // Queen captures are even better
    }

    // 2. Queen promotion
    if (!isQueen) {
        if (currentPlayer === 'red' && toRow === BOARD_SIZE - 1) {
            priority += 80;
        } else if (currentPlayer === 'black' && toRow === 0) {
            priority += 80;
        }
    }

    // 3. Move toward center (strategic)
    const centerRow = BOARD_SIZE / 2;
    const centerCol = BOARD_SIZE / 2;
    const distToCenter = Math.abs(toRow - centerRow) + Math.abs(toCol - centerCol);
    priority += (10 - distToCenter); // Closer to center = higher priority

    // 4. Queen mobility
    if (isQueen) {
        priority += 10;
    }

    return priority;
}

// Highlight the move on board
function highlightMove(move) {
    // Find the squares
    const squares = gameBoard.querySelectorAll('.square');

    squares.forEach(square => {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);

        if (row === move.fromRow && col === move.fromCol) {
            square.classList.add('hint-source');
        } else if (row === move.toRow && col === move.toCol) {
            square.classList.add('hint-destination');
        } else if (move.captures.some(c => c.row === row && c.col === col)) {
            square.classList.add('hint-capture');
        }
    });

    hintActive = true;
}

// Show explanation
function showExplanation(move) {
    let explanation = '<h3>💡 Best Move Analysis</h3>';

    const piece = board[move.fromRow][move.fromCol];
    const isQueen = piece.includes('queen');

    explanation += '<ul>';

    // Explain the move
    explanation += `<li><strong>Move:</strong> (${move.fromRow},${move.fromCol}) → (${move.toRow},${move.toCol})</li>`;

    // Explain captures
    if (move.captures.length > 0) {
        if (move.captures.length === 1) {
            explanation += `<li><strong>Capture:</strong> Removes 1 opponent piece at (${move.captures[0].row},${move.captures[0].col})</li>`;
        } else {
            explanation += `<li><strong>Multi-Capture:</strong> Removes ${move.captures.length} opponent pieces!</li>`;
        }
        explanation += '<li><strong>Why:</strong> Captures reduce opponent options and gain material advantage.</li>';
    }

    // Explain promotion
    if (!isQueen) {
        if (currentPlayer === 'red' && move.toRow === BOARD_SIZE - 1) {
            explanation += '<li><strong>Promotion:</strong> This move creates a QUEEN! 👑</li>';
            explanation += '<li><strong>Why:</strong> Queens have unlimited movement and can capture multiple pieces.</li>';
        } else if (currentPlayer === 'black' && move.toRow === 0) {
            explanation += '<li><strong>Promotion:</strong> This move creates a QUEEN! 👑</li>';
            explanation += '<li><strong>Why:</strong> Queens have unlimited movement and can capture multiple pieces.</li>';
        }
    }

    // Explain queen move
    if (isQueen) {
        const distance = Math.abs(move.toRow - move.fromRow);
        explanation += `<li><strong>Queen Move:</strong> Travels ${distance} squares diagonally</li>`;
        explanation += '<li><strong>Why:</strong> Queens control long diagonals and create multiple threats.</li>';
    }

    // Strategic explanation
    if (move.captures.length === 0 && !isQueen) {
        explanation += '<li><strong>Strategy:</strong> Safe positioning move</li>';
        explanation += '<li><strong>Why:</strong> Maintains piece safety while preparing for future captures.</li>';
    }

    explanation += '</ul>';

    explanationDiv.innerHTML = explanation;
    explanationDiv.classList.remove('hidden');
}

// Clear all hints
function clearHints() {
    const squares = gameBoard.querySelectorAll('.square');
    squares.forEach(square => {
        square.classList.remove('hint-source', 'hint-destination', 'hint-capture');
    });
    explanationDiv.classList.add('hidden');
    hintActive = false;
}

// Override reset to clear hints
const originalReset = initGame;
initGame = function() {
    originalReset();
    clearHints();
};
// Event listeners
resetBtn.addEventListener('click', () => {
    initGame();
});

// Start game on load
window.addEventListener('DOMContentLoaded', initGame);
