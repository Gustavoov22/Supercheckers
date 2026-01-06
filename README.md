# Supercheckers 🎮

A modern 10x10 checkerboard game built with HTML, CSS, and JavaScript.

## Features

- **10x10 Checkerboard**: Larger than traditional 8x8 boards for more strategic gameplay
- **Interactive Gameplay**: Click-based piece selection and movement
- **Two Players**: Red and Black player turns
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, attractive interface with smooth animations

## How to Play

1. **Red starts first** (top pieces)
2. **Click on your piece** to select it (it will turn gold)
3. **Click on an adjacent diagonal square** to move
4. **Red moves down**, **Black moves up** (diagonally)
5. **Alternate turns** until someone wins or quits

## File Structure

```
Supercheckers/
├── index.html      # Main HTML file
├── style.css       # Styling and layout
├── script.js       # Game logic and interactivity
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
- **JavaScript ES6+**: Game logic and DOM manipulation

## Game Rules

- Players take turns moving one piece at a time
- Pieces move diagonally forward (one square)
- Cannot move onto occupied squares
- No capturing implemented in this version
- Game continues until manually reset

## Future Enhancements

- [ ] Piece capturing mechanics
- [ ] King pieces (crown when reaching opposite side)
- [ ] Move history and undo functionality
- [ ] AI opponent
- [ ] Score tracking
- [ ] Online multiplayer

## License

MIT License - Feel free to use and modify!

## Author

Created with ❤️ using Agent Zero
