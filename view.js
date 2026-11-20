// Keyboard handling and screen drawing. Pure functions only: handleKey() turns a key into a new app state plus
// side effects for the caller to carry out, and renderScreen() turns an app state into rows of styled text.
// tictactoe.js connects these to Ink and the terminal.

import {
  COMPUTER_FIRST, PLAYER_FIRST, TWO_PLAYER,
  isLive, newGame, startGame, clearGame, playCell, setPlayMethod,
} from './game.js';

// ---------------------------------------------------------------------------
// App state: the game, which control has the keyboard focus, and the board cursor.
// ---------------------------------------------------------------------------

export function newApp(playMethod) {
  return { game: newGame(playMethod), focus: 'start', cursor: { r: 1, c: 1 } };
}

const FOCUS_ORDER = ['board', 'mode', 'start', 'clear'];     // top to bottom on screen

function available(app, zone) {
  const g = app.game;
  switch (zone) {
    case 'board': return isLive(g);
    case 'mode':
    case 'start': return !g.started;
    default: return true;                                    // Clear always works
  }
}

function cycleFocus(app, dir) {
  let i = FOCUS_ORDER.indexOf(app.focus);
  for (let step = 0; step < FOCUS_ORDER.length; step++) {
    i = (i + dir + FOCUS_ORDER.length) % FOCUS_ORDER.length;
    if (available(app, FOCUS_ORDER[i])) return { ...app, focus: FOCUS_ORDER[i] };
  }
  return app;
}

// ---------------------------------------------------------------------------
// Actions. Each returns {app, fx}. fx may contain: beep, writeIni (the new play method), exit.
// ---------------------------------------------------------------------------

const unchanged = (app) => ({ app, fx: {} });

function actStart(app, rng) {
  if (app.game.started) return unchanged(app);                // the Start button is disabled during a game
  return { app: { ...app, game: startGame(app.game, rng), focus: 'board' }, fx: {} };
}

function actClear(app) {
  return { app: { ...app, game: clearGame(app.game), focus: 'start' }, fx: {} };
}

function actPlace(app, idx, rng) {
  const { game, ok } = playCell(app.game, idx, rng);
  if (!ok) return { app, fx: { beep: true } };                // occupied, game over, or Start not pressed yet
  let focus = app.focus;
  if ((game.won || game.tie) && !(app.game.won || app.game.tie)) focus = 'clear';   // as in the Delphi version
  return { app: { game, focus, cursor: { r: Math.floor(idx / 3), c: idx % 3 } }, fx: {} };
}

function actMode(app, delta) {
  if (app.game.started) return unchanged(app);                // the group is disabled during a game
  const mode = Math.min(TWO_PLAYER, Math.max(COMPUTER_FIRST, app.game.playMethod + delta));
  if (mode === app.game.playMethod) return unchanged(app);
  return { app: { ...app, game: setPlayMethod(app.game, mode) }, fx: { writeIni: mode } };
}

function moveCursor(app, dr, dc) {
  if (!isLive(app.game)) return unchanged(app);
  const r = Math.min(2, Math.max(0, app.cursor.r + dr));
  const c = Math.min(2, Math.max(0, app.cursor.c + dc));
  return { app: { ...app, cursor: { r, c } }, fx: {} };
}

// ev.name is one of: up down left right enter space tab backtab escape char (then ev.char holds the character)
export function handleKey(app, ev, rng = Math.random) {
  if (ev.name === 'char') {
    const ch = ev.char;
    if (ch === 'q' || ch === 'Q') return { app, fx: { exit: true } };
    if (ch === 's' || ch === 'S') return actStart(app, rng);
    if (ch === 'c' || ch === 'C') return actClear(app);
    if (ch.length === 1 && ch >= '1' && ch <= '9') return actPlace(app, Number(ch) - 1, rng);
    return unchanged(app);
  }

  const focus = app.focus;
  switch (ev.name) {
    case 'escape': return { app, fx: { exit: true } };
    case 'tab': return { app: cycleFocus(app, 1), fx: {} };
    case 'backtab': return { app: cycleFocus(app, -1), fx: {} };

    case 'up':
    case 'down': {
      const d = ev.name === 'up' ? -1 : 1;
      if (focus === 'board') return moveCursor(app, d, 0);
      if (focus === 'mode') return actMode(app, d);
      return { app: cycleFocus(app, d), fx: {} };            // on a button: move to the control above or below
    }
    case 'left':
    case 'right': {
      const d = ev.name === 'left' ? -1 : 1;
      if (focus === 'board') return moveCursor(app, 0, d);
      if (focus === 'start' && d > 0) return { app: { ...app, focus: 'clear' }, fx: {} };
      if (focus === 'clear' && d < 0 && available(app, 'start')) return { app: { ...app, focus: 'start' }, fx: {} };
      return unchanged(app);
    }
    case 'enter':
    case 'space':
      if (focus === 'board') return actPlace(app, app.cursor.r * 3 + app.cursor.c, rng);
      if (focus === 'mode') return available(app, 'start') ? { app: { ...app, focus: 'start' }, fx: {} } : unchanged(app);
      if (focus === 'start') return actStart(app, rng);
      return actClear(app);
    default:
      return unchanged(app);
  }
}

// ---------------------------------------------------------------------------
// Drawing. A Canvas is a grid of characters, each with an optional style:
//   {fg, bg, bold, dim, underline, inverse}   (fg and bg are Ink color names or #rrggbb)
// ---------------------------------------------------------------------------

const CURSOR_BG = '#1f4e79';
const CURSOR_FLASH_BG = '#9b1c1c';
const WIN_COLOR = 'red';
const FOCUS_COLOR = 'cyan';

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.rows = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ch: ' ', s: null })));
  }
  put(x, y, text, s = null) {
    [...text].forEach((ch, i) => {
      const cx = x + i;
      if (cx >= 0 && cx < this.w && y >= 0 && y < this.h) this.rows[y][cx] = { ch, s };
    });
  }
  fill(x, y, w, h, s) {
    for (let j = 0; j < h; j++) this.put(x, y + j, ' '.repeat(w), s);
  }
  blit(x, y, other) {
    other.rows.forEach((row, j) => row.forEach((cell, i) => {
      if (x + i >= 0 && x + i < this.w && y + j >= 0 && y + j < this.h) this.rows[y + j][x + i] = cell;
    }));
  }
  box(x, y, w, h, s = null) {
    this.put(x, y, '┌' + '─'.repeat(w - 2) + '┐', s);
    this.put(x, y + h - 1, '└' + '─'.repeat(w - 2) + '┘', s);
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, '│', s);
      this.put(x + w - 1, y + j, '│', s);
    }
  }
  // Rows of runs: [{text, ...style}], merging neighbours with the same style and dropping unstyled trailing spaces.
  toRuns() {
    const key = (s) => (s ? [s.fg, s.bg, s.bold, s.dim, s.underline, s.inverse].join('|') : '');
    return this.rows.map((row) => {
      const runs = [];
      for (const { ch, s } of row) {
        const last = runs[runs.length - 1];
        if (last && key(last.s) === key(s)) last.text += ch;
        else runs.push({ text: ch, s });
      }
      while (runs.length && !runs[runs.length - 1].s && runs[runs.length - 1].text.trim() === '') runs.pop();
      return runs.map(({ text, s }) => ({ text, ...(s || {}) }));
    });
  }
}

// ----- the board: 3x3 cells of 7x3 characters, divided by heavy lines (23 x 11 characters) -----

const CELL_W = 7, CELL_H = 3, BOARD_W = 3 * CELL_W + 2, BOARD_H = 3 * CELL_H + 2;
const GLYPH = {
  X: ['╲   ╱', '  ╳  ', '╱   ╲'],
  O: ['╭───╮', '│   │', '╰───╯'],
};

function drawBoard(game, cursor, showCursor, flash) {
  const cv = new Canvas(BOARD_W, BOARD_H);
  // grid lines
  for (let x = 0; x < BOARD_W; x++) for (const y of [3, 7]) cv.put(x, y, '━');
  for (let y = 0; y < BOARD_H; y++) for (const x of [7, 15]) cv.put(x, y, '┃');
  for (const y of [3, 7]) for (const x of [7, 15]) cv.put(x, y, '╋');

  // squares
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x0 = c * (CELL_W + 1), y0 = r * (CELL_H + 1);
      const here = showCursor && cursor.r === r && cursor.c === c;
      const cs = here ? { fg: '#ffffff', bg: flash ? CURSOR_FLASH_BG : CURSOR_BG } : null;
      if (here) cv.fill(x0, y0, CELL_W, CELL_H, cs);
      const letter = game.cap[r * 3 + c];
      if (letter) GLYPH[letter].forEach((line, j) => cv.put(x0 + 1, y0 + j, line, { ...cs, bold: true }));
      else cv.put(x0 + 3, y0 + 1, String(r * 3 + c + 1), here ? cs : { dim: true });   // the key that picks this square
    }
  }

  // the red win line, drawn over the letters as in the Delphi version
  const w = game.win;
  if (w) {
    const red = { fg: WIN_COLOR, bold: true };
    if (w.type === 'row') for (let x = 0; x < BOARD_W; x++) cv.put(x, w.index * (CELL_H + 1) + 1, '━', red);
    else if (w.type === 'col') for (let y = 0; y < BOARD_H; y++) cv.put(w.index * (CELL_W + 1) + 3, y, '┃', red);
    else if (w.type === 'diag') for (let x = 0; x < BOARD_W; x++) cv.put(x, Math.round((x * (BOARD_H - 1)) / (BOARD_W - 1)), '╲', red);
    else for (let x = 0; x < BOARD_W; x++) cv.put(x, Math.round(((BOARD_W - 1 - x) * (BOARD_H - 1)) / (BOARD_W - 1)), '╱', red);
  }
  return cv;
}

// ----- the Game Mode group (38 x 5) and the buttons (9 x 3) -----

const MODE_LABELS = ['Computer goes first (I play O)', 'I go first (I play X)', 'Two players'];
const GROUP_W = 38, GROUP_H = 5, BUTTON_W = 9, BUTTON_H = 3;

function drawGroup(cv, x, y, game, focus) {
  const disabled = game.started;
  const focused = focus === 'mode' && !disabled;
  const border = disabled ? { dim: true } : focused ? { fg: FOCUS_COLOR } : null;
  cv.box(x, y, GROUP_W, GROUP_H, border);
  cv.put(x + 2, y, ' Game Mode ', { ...border, bold: true });
  MODE_LABELS.forEach((label, i) => {
    const selected = game.playMethod === i;
    const s = disabled ? { dim: true } : selected && focused ? { fg: FOCUS_COLOR, bold: true } : selected ? { bold: true } : null;
    cv.put(x + 2, y + 1 + i, `(${selected ? '•' : ' '}) ${label}`, s);
  });
}

function drawButton(cv, x, y, label, focused, enabled) {
  const border = !enabled ? { dim: true } : focused ? { fg: FOCUS_COLOR } : null;
  cv.box(x, y, BUTTON_W, BUTTON_H, border);
  const base = !enabled ? { dim: true } : focused ? { inverse: true, bold: true } : null;
  cv.put(x + 1, y + 1, ' ', base);
  cv.put(x + 2, y + 1, label[0], { ...base, underline: true });    // the letter that is also the shortcut key
  cv.put(x + 3, y + 1, label.slice(1) + ' ', base);
}

// ----- the whole screen -----

const LAYOUTS = {
  stacked: {
    w: 42, h: 27, instr: [2, 3], board: [9, 5], group: [2, 17], buttons: [[2, 23], [15, 23]],
    hint: ['Arrows/Enter or 1-9: play a square', 'S Start   C Clear   Tab focus   Q quit'],
    minCols: 44, minRows: 30,                // keep the picture shorter than the terminal, or Ink redraws it from scratch
  },
  compact: {
    w: 68, h: 16, instr: [2, 3], board: [2, 4], group: [28, 4], buttons: [[28, 10], [41, 10]],
    hint: ['Arrows/Enter/1-9: play   S Start   C Clear   Tab: focus   Q: quit'],
    minCols: 70, minRows: 18,
  },
};

export function chooseLayout(columns, rows) {
  const fits = (l) => columns >= l.minCols && rows >= l.minRows;
  if (fits(LAYOUTS.stacked)) return 'stacked';
  if (fits(LAYOUTS.compact)) return 'compact';
  return null;
}

// Returns rows of runs for Ink to print. flash is true for a moment after a rejected key press.
export function renderScreen(app, size, flash = false) {
  const { columns, rows } = size;
  const name = chooseLayout(columns, rows);
  if (!name) {
    const cv = new Canvas(columns, 5);
    cv.put(1, 1, 'Terminal too small.', { bold: true });
    cv.put(1, 2, `Need at least ${LAYOUTS.compact.minCols}x${LAYOUTS.compact.minRows} or ${LAYOUTS.stacked.minCols}x${LAYOUTS.stacked.minRows},`);
    cv.put(1, 3, `this one is ${columns}x${rows}. Make it bigger, or press Q.`);
    return cv.toRuns();
  }

  const L = LAYOUTS[name];
  const g = app.game;
  const left = Math.max(0, Math.floor((columns - L.w) / 2));
  const hintLines = L.hint.length;
  const cv = new Canvas(columns, L.h + hintLines);

  // window frame and caption bar
  const win = new Canvas(L.w, L.h);
  win.box(0, 0, L.w, L.h);
  win.put(1, 1, ' Tic Tac Toe'.padEnd(L.w - 2), { inverse: true, bold: true });
  win.put(0, 2, '├' + '─'.repeat(L.w - 2) + '┤');

  win.put(L.instr[0], L.instr[1], g.msg, { bold: true });
  win.blit(L.board[0], L.board[1], drawBoard(g, app.cursor, app.focus === 'board' && isLive(g), flash));
  drawGroup(win, L.group[0], L.group[1], g, app.focus);
  drawButton(win, L.buttons[0][0], L.buttons[0][1], 'Start', app.focus === 'start', !g.started);
  drawButton(win, L.buttons[1][0], L.buttons[1][1], 'Clear', app.focus === 'clear', true);
  cv.blit(left, 0, win);

  L.hint.forEach((text, i) => cv.put(Math.max(0, Math.floor((columns - text.length) / 2)), L.h + i, text, { dim: true }));
  return cv.toRuns();
}
