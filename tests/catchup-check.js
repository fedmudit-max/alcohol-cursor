#!/usr/bin/env node
/** @format Manager entrypoint: node tests/catchup-check.js */
const { spawnSync } = require('child_process');
const path = require('path');

const child = spawnSync(process.execPath, [path.join(__dirname, 'catchup-sequences.mjs')], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});

process.exit(child.status === null ? 1 : child.status);
