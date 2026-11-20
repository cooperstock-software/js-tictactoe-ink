// Game rules and computer player. Pure functions only: nothing here touches the terminal or the disk.
// Port of MinMaxSolve.pas and the game logic in TTT.pas / tictactoe.py.

export const COMPUTER_FIRST = 0;
export const PLAYER_FIRST = 1;
export const TWO_PLAYER = 2;

export const MSG_SELECT = 'Select a Game Mode then press Start';
const WIN_SCORE = 10;

// ---------------------------------------------------------------------------
// Search. A board is a 3x3 array of '', 'X' or 'O', indexed [row][col] from 0.
// ---------------------------------------------------------------------------

export function opponent(letter) {
  return letter === 'O' ? 'X' : 'O';
}

// Returns the winning line for the letter, or null:
//   {type: 'row', index}, {type: 'col', index}, {type: 'diag'} (top left to bottom right), {type: 'anti'}
export function findWin(board, letter) {
  for (let i = 0; i < 3; i++) {
    if (board[i][0] === letter && board[i][1] === letter && board[i][2] === letter) return { type: 'row', index: i };
    if (board[0][i] === letter && board[1][i] === letter && board[2][i] === letter) return { type: 'col', index: i };
  }
  if (board[0][0] === letter && board[1][1] === letter && board[2][2] === letter) return { type: 'diag' };
  if (board[0][2] === letter && board[1][1] === letter && board[2][0] === letter) return { type: 'anti' };
  return null;
}

export function boardFull(board) {
  return !board.some((row) => row.includes(''));
}

// Value of the position from the point of view of the player with the given letter, who is about to move.
// The board can be changed while searching, but is always returned to its original state.
function calcScore(board, letter, depth) {
  const other = opponent(letter);
  // The opponent just moved, so only they can have just completed a line.
  if (findWin(board, other)) return -WIN_SCORE + depth;      // a later loss is better than an earlier one
  if (boardFull(board)) return 0;

  let result = -Infinity;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[r][c] === '') {
        board[r][c] = letter;
        const value = -calcScore(board, other, depth + 1);
        board[r][c] = '';
        if (value > result) result = value;
      }
    }
  }
  return result;
}

// Picks the computer's move at random among all equally good squares. Call only when a square is empty.
// Returns [row, col]. The board is always returned to its original state.
export function chooseMove(board, letter, rng = Math.random) {
  let bestValue = -Infinity;
  let bestMoves = [];
  const other = opponent(letter);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {         // try playing in all empty squares
      if (board[r][c] === '') {
        board[r][c] = letter;
        const value = -calcScore(board, other, 1);
        board[r][c] = '';
        if (value > bestValue) {
          bestValue = value;
          bestMoves = [[r, c]];
        } else if (value === bestValue) {
          bestMoves.push([r, c]);
        }
      }
    }
  }
  return bestMoves[Math.floor(rng() * bestMoves.length)];
}

// ---------------------------------------------------------------------------
// Game state. cap[i] is the letter in square i (0..8, row by row), as the Delphi cells' captions were.
// Every function returns a new game and leaves its argument alone.
// ---------------------------------------------------------------------------

export function newGame(playMethod) {
  return {
    cap: Array(9).fill(''),
    nextPlay: 1,
    started: false,
    won: false,
    tie: false,
    playMethod,
    computerLetter: '',
    playerLetter: '',
    msg: MSG_SELECT,
    win: null,                 // {type, index?, letter} once someone has won
  };
}

export const isLive = (g) => g.started && !g.won && !g.tie;
export const placeMsg = (letter) => `Choose a square to place an ${letter}`;

export function boardOf(cap) {
  return [0, 1, 2].map((r) => cap.slice(r * 3, r * 3 + 3));
}

export function setPlayMethod(g, playMethod) {
  return { ...g, playMethod };
}

export function clearGame(g) {
  return newGame(g.playMethod);
}

export function startGame(g, rng = Math.random) {
  const n = { ...g, cap: [...g.cap], started: true };
  switch (n.playMethod) {
    case COMPUTER_FIRST: {
      n.computerLetter = 'X';
      n.playerLetter = 'O';
      // a somewhat random first move, in a corner
      const corner = [0, 2, 6, 8][Math.floor(rng() * 4)];
      n.cap[corner] = n.computerLetter;
      n.msg = placeMsg('O');
      n.nextPlay += 1;
      break;
    }
    case PLAYER_FIRST:
      n.computerLetter = 'O';
      n.playerLetter = 'X';
      n.msg = placeMsg('X');
      break;
    default:
      n.msg = placeMsg('X');
  }
  return n;
}

// Checks for a win by the letter just played, or a tie. Updates n (a working copy) and returns true if the game is over.
function checkEnd(n, letter) {
  const line = findWin(boardOf(n.cap), letter);
  if (line) {
    if (n.playMethod === TWO_PLAYER) n.msg = `${letter} won!`;
    else if (letter === n.computerLetter) n.msg = 'Sorry, the computer won.';
    else n.msg = 'You beat the computer!';
    n.won = true;
    n.win = { ...line, letter };
    return true;
  }
  if (n.nextPlay > 9) {
    n.tie = true;
    n.msg = "It's a tie.";
    return true;
  }
  return false;
}

// The player picks square idx. Returns {game, ok}; ok is false when the click isn't allowed (Delphi beeps).
export function playCell(g, idx, rng = Math.random) {
  if (g.cap[idx] !== '' || g.won || !g.started) return { game: g, ok: false };

  const n = { ...g, cap: [...g.cap] };
  const letter = n.playMethod !== TWO_PLAYER ? n.playerLetter : n.nextPlay % 2 === 1 ? 'X' : 'O';
  n.cap[idx] = letter;
  n.nextPlay += 1;

  if (!checkEnd(n, letter)) {
    if (n.playMethod === TWO_PLAYER) {
      n.msg = placeMsg(n.nextPlay % 2 === 1 ? 'X' : 'O');
    } else {
      const [row, col] = chooseMove(boardOf(n.cap), n.computerLetter, rng);
      n.cap[row * 3 + col] = n.computerLetter;
      n.msg = placeMsg(n.playerLetter);
      n.nextPlay += 1;
      checkEnd(n, n.computerLetter);
    }
  }
  return { game: n, ok: true };
}
