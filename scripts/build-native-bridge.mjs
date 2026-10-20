#!/usr/bin/env node
/**
 * Bundle Capacitor plugins for the static app (no Vite/webpack).
 * Output: dist/src/capacitor/native.bundle.js (and repo copy for local preview).
 */
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'src/capacitor/native-entry.js');
const outDist = path.join(root, 'dist/src/capacitor/native.bundle.js');
const outDev = path.join(root, 'src/capacitor/native.bundle.js');

for (const out of [outDist, outDev]) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
}

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  minify: true,
  outfile: outDist,
  logLevel: 'info',
});

fs.copyFileSync(outDist, outDev);
console.log('Native bridge:', outDist);
