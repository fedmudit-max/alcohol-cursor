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
const bundles = [
  {
    entry: path.join(root, 'src/capacitor/native-entry.js'),
    outDist: path.join(root, 'dist/src/capacitor/native.bundle.js'),
    outDev: path.join(root, 'src/capacitor/native.bundle.js'),
    label: 'Native bridge',
  },
  {
    entry: path.join(root, 'src/capacitor/revenuecat-entry.js'),
    outDist: path.join(root, 'dist/src/capacitor/revenuecat.bundle.js'),
    outDev: path.join(root, 'src/capacitor/revenuecat.bundle.js'),
    label: 'RevenueCat bridge',
  },
];

for (const spec of bundles) {
  fs.mkdirSync(path.dirname(spec.outDist), { recursive: true });
  await esbuild.build({
    entryPoints: [spec.entry],
    bundle: true,
    format: 'iife',
    minify: true,
    outfile: spec.outDist,
    logLevel: 'info',
  });
  fs.copyFileSync(spec.outDist, spec.outDev);
  console.log(`${spec.label}:`, spec.outDist);
}
