# Supercheckers 🎮

A modern 10x10 checkerboard game built with HTML, CSS, and JavaScript.

## 🆕 NEW FEATURES - Advanced Rules!

### Queen Pieces 👑
- **Automatic Promotion**: When a piece reaches the opposite side, it becomes a QUEEN!
- **Unlimited Movement**: Queens can move any distance diagonally (like bishops in chess)
- **Multi-Capture**: Queens can capture multiple pieces in a single turn
- **Any Direction**: Queens can move/capture in all 4 diagonal directions

### Enhanced Gameplay
- **Multi-Capture Chains**: Continue capturing as long as you have valid moves
- **Strategic Depth**: Queens dominate the board but require skill to create

## Features

- **10x10 Checkerboard**: Larger than traditional 8x8 boards for more strategic gameplay
- **Interactive Gameplay**: Click-based piece selection and movement
- **Two Players**: Red and Black player turns
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, attractive interface with smooth animations

## How to Play

### Basic Rules
1. **Red starts first** (top pieces)
2. **Click on your piece** to select it (it will turn gold)
3. **Click on an adjacent diagonal square** to move
4. **Red moves down**, **Black moves up** (diagonally)
5. **Alternate turns** until someone wins or quits

### Advanced Rules

#### Regular Pieces
- Move **one square diagonally forward**
- Can **capture** by jumping over opponent pieces
- **Cannot** move backward

#### Queen Pieces (👑)
- **Promotion**: Automatically becomes queen when reaching opposite side
- **Movement**: Can move ANY distance diagonally (forward or backward)
- **Capturing**: Can capture multiple pieces in one turn
- **Strategy**: Queens are powerful - protect them!

#### Capturing
- **Single Capture**: Jump over one opponent piece to empty square
- **Multi-Capture (Queens)**: Capture multiple pieces in a line
- **Chain Capture**: Continue capturing if more opportunities exist

## File Structure

```
Supercheckers/
├── index.html      # Main HTML file
├── style.css       # Styling and layout
├── script.js       # Game logic and interactivity (ENHANCED)
└── README.md       # This file
```

## Running the Game

Simply open `index.html` in any modern web browser:

```bash
open index.html
# or
firefox index.html
# or
chrome index.html
```

## Technologies Used

- **HTML5**: Semantic structure
- **CSS3**: Grid layout, gradients, and animations
- **JavaScript ES6+**: Advanced game logic with queen mechanics

## Game Rules Summary

| Feature | Regular Piece | Queen Piece |
|---------|---------------|-------------|
| **Movement** | 1 square forward | Any distance, any direction |
| **Capture** | Single jump | Multiple pieces in line |
| **Promotion** | Reach opposite side | - |
| **Symbol** | ● | 👑 |

## Strategy Tips

1. **Protect your pieces** - losing pieces early is costly
2. **Create queens** - they're game-changers!
3. **Control the center** - more mobility options
4. **Watch for multi-captures** - queens can clear the board
5. **Don't rush** - plan your queen promotion carefully

## Future Enhancements

- [ ] Score tracking and win conditions
- [ ] Move history and undo functionality
- [ ] AI opponent with difficulty levels
- [ ] Online multiplayer
- [ ] Sound effects and animations
- [ ] Game timer

## License

MIT License - Feel free to use and modify!

## Author

Created with Agent Zero - Enhanced with advanced checker rules
