#!/usr/bin/env node
// Terminal version of the tic-tac-toe program, drawn with Ink.
// Run with:  npm install   (once)   then   node tictactoe.js

import fs from 'node:fs';
import React from 'react';
import { render } from 'ink';
import { PLAYER_FIRST, COMPUTER_FIRST, TWO_PLAYER } from './game.js';
import { App } from './app.js';

const INI_FILE = 'tictactoe.ini';      // same name and format as the Python and plain Node versions, read from the current directory

// The ini file is:   [All]
//                    PlayMethod = 1
function readIni() {
  let playMethod = PLAYER_FIRST;       // default if the ini file is missing or invalid
  try {
    let section = '';
    for (const rawLine of fs.readFileSync(INI_FILE, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      const header = line.match(/^\[(.*)\]$/);
      if (header) {
        section = header[1];
        continue;
      }
      const pair = line.match(/^([^=:]+?)\s*[=:]\s*(.*)$/);
      if (section === 'All' && pair && pair[1] === 'PlayMethod' && /^[+-]?\d+$/.test(pair[2])) {
        const value = parseInt(pair[2], 10);
        if ([COMPUTER_FIRST, PLAYER_FIRST, TWO_PLAYER].includes(value)) playMethod = value;
      }
    }
  } catch (e) {
    // no ini file, or it can't be read: keep the default
  }
  return playMethod;
}

function writeIni(playMethod) {
  try {
    fs.writeFileSync(INI_FILE, `[All]\nPlayMethod = ${playMethod}\n`);
  } catch (e) {
    // can't save the setting (read-only folder?): the game still works
  }
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('This program needs an interactive terminal (it cannot read keys from a pipe or file).');
    process.exitCode = 1;
    return;
  }
  const leaveScreen = () => process.stdout.write('\x1b[?1049l');
  process.stdout.write('\x1b[?1049h');                // use the alternate screen, so the game leaves your terminal as it was
  try {
    const instance = render(React.createElement(App, { initialPlayMethod: readIni(), onPlayMethod: writeIni }));
    await instance.waitUntilExit();
  } finally {
    leaveScreen();
  }
}

main();
