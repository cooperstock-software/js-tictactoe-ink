// The Ink component: keys in, rows of styled text out.
// All of the game and drawing logic lives in game.js and view.js; this file only connects them to Ink.

import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { newApp, handleKey, renderScreen } from './view.js';

const h = React.createElement;

function toEvent(input, key) {
  if (key.ctrl || key.meta) return null;
  if (key.upArrow) return { name: 'up' };
  if (key.downArrow) return { name: 'down' };
  if (key.leftArrow) return { name: 'left' };
  if (key.rightArrow) return { name: 'right' };
  if (key.return) return { name: 'enter' };
  if (key.escape) return { name: 'escape' };
  if (key.tab) return { name: key.shift ? 'backtab' : 'tab' };
  if (input === ' ') return { name: 'space' };
  if (input && input.length === 1) return { name: 'char', char: input };
  return null;
}

// onPlayMethod(n) is called when the Game Mode changes, so the caller can save it.
export function App({ initialPlayMethod, onPlayMethod }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [app, setApp] = useState(() => newApp(initialPlayMethod));
  const [flash, setFlash] = useState(false);
  const [size, setSize] = useState({ columns: stdout.columns || 80, rows: stdout.rows || 24 });
  const appRef = useRef(app);
  appRef.current = app;
  const flashTimer = useRef(null);

  useEffect(() => {
    const onResize = () => setSize({ columns: stdout.columns || 80, rows: stdout.rows || 24 });
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
      clearTimeout(flashTimer.current);
    };
  }, [stdout]);

  useInput((input, key) => {
    const ev = toEvent(input, key);
    if (!ev) return;
    const { app: next, fx } = handleKey(appRef.current, ev);
    appRef.current = next;
    setApp(next);
    if (fx.writeIni !== undefined && onPlayMethod) onPlayMethod(fx.writeIni);
    if (fx.beep) {
      stdout.write('\x07');                          // the terminal bell, like Delphi's Beep
      setFlash(true);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 200);
    }
    if (fx.exit) exit();
  });

  const rows = renderScreen(app, size, flash);
  return h(
    Box,
    { flexDirection: 'column' },
    ...rows.map((runs, i) =>
      h(
        Text,
        { key: i, wrap: 'truncate-end' },
        ...(runs.length === 0
          ? [' ']                                    // an empty row still has to take up a line
          : runs.map(({ text, fg, bg, bold, dim, underline, inverse }, j) =>
              h(Text, { key: j, color: fg, backgroundColor: bg, bold, dimColor: dim, underline, inverse }, text))),
      ),
    ),
  );
}
