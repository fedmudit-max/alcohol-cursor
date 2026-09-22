#!/usr/bin/env node
/**
 * Quick localStorage / DataManager sanity checks (no browser).
 * Run: node scripts/storage-sanity.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function runScript(relativePath, context) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const ctx = vm.createContext({
  CONFIG: { showTestUI: false, isProduction: true, premiumBilling: 'local-stub' },
  console,
  localStorage,
  document: { getElementById: () => null },
  window: {},
  setTimeout: () => 0,
  clearTimeout: () => {},
});

runScript('src/config/app.config.js', ctx);
runScript('src/utils/dates.js', ctx);
runScript('src/utils/helpers.js', ctx);
runScript('src/data/local-storage.js', ctx);
vm.runInContext('this.DataManager = DataManager;', ctx);

const DM = ctx.DataManager;
let failed = 0;

function ok(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(` FAIL ${name}:`, e.message);
  }
}

console.log('DataManager sanity\n');

ok('fresh install → defaults', () => {
  Object.keys(store).forEach((k) => delete store[k]);
  const d = DM.load();
  if (d.attempt !== 1 || !d.dailyLog || d.currentScore.success !== 0) {
    throw new Error('unexpected defaults');
  }
});

ok('reload → data remains', () => {
  const d = DM.load();
  d.currentScore.success = 12;
  d.currentStreak = 4;
  d.dailyLog['2026-03-01'] = 'sober';
  DM.saveNow(d);
  const again = DM.load();
  if (again.currentScore.success !== 12 || again.currentStreak !== 4) {
    throw new Error('score/streak not persisted');
  }
  if (again.dailyLog['2026-03-01'] !== 'sober') throw new Error('dailyLog not persisted');
});

ok('corrupted JSON → defaults, no throw', () => {
  store[DM.KEY] = '{not json';
  const d = DM.load();
  if (d.attempt !== 1) throw new Error('should reset to defaults');
});

ok('null / array stored → defaults', () => {
  store[DM.KEY] = 'null';
  if (DM.load().attempt !== 1) throw new Error('null');
  store[DM.KEY] = '[]';
  if (DM.load().attempt !== 1) throw new Error('array');
});

ok('partial object → migrated keys', () => {
  store[DM.KEY] = JSON.stringify({ attempt: 2, currentScore: { success: 3, failures: 1 } });
  const d = DM.load();
  if (d.attempt !== 2 || d.currentScore.success !== 3) throw new Error('migrate failed');
  if (!d.reminders || typeof d.reminders.dailyEnabled !== 'boolean') throw new Error('reminders missing');
});

ok('simulatedToday stripped when showTestUI false', () => {
  store[DM.KEY] = JSON.stringify({ simulatedToday: '2030-01-01T12:00:00.000Z', attempt: 1 });
  const d = DM.load();
  if (d.simulatedToday) throw new Error('simulatedToday should be removed in production config');
});

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
