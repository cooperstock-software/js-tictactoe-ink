# Tic Tac Toe (terminal version, drawn with Ink)

A port of the Delphi tic-tac-toe program. Same three game modes, same computer player (minimax, choosing at
random among equally good moves), same messages, and a red line through a winning row, column or diagonal.

## Run

    npm install      (once, in this folder)
    node tictactoe.js          or          npm start

Needs Node.js 18 or newer and an interactive terminal at least 70x18 characters (or 44x30 for the taller,
stacked layout). The game uses the terminal's alternate screen, so your scrollback is left alone.

## Keys

| Key | Does |
| --- | --- |
| Arrow keys, Enter or Space | move the highlighted square and place a letter there |
| 1 to 9 | place a letter in that square directly (the numbers are shown in the empty squares) |
| S | Start (the Start button) |
| C | Clear (the Clear button) |
| Tab / Shift+Tab | move the focus between the board, Game Mode, Start and Clear |
| Up / Down (with Game Mode focused) | change the game mode |
| Q, Esc or Ctrl+C | quit |

A key that cannot be used (an occupied square, or a move before pressing Start) rings the terminal bell and
flashes the square, as the Delphi version beeps.

The chosen Game Mode is remembered in `tictactoe.ini` in the folder you run the game from, in the same format
as the Python and plain Node versions.

## Files

- `game.js` - rules, computer player, game state (no terminal code)
- `view.js` - key handling and drawing of the screen (no terminal code)
- `app.js` - the Ink component that connects those to the keyboard and screen
- `tictactoe.js` - entry point: reads and writes the ini file, switches to the alternate screen
- `test/` - tests for `game.js` and `view.js`; run with `npm test`
