#!/usr/bin/env node
/**
 * Quick localStorage / DataManager sanity checks (no browser).
 * Journey score is log-derived: migrate/reload rebuild currentScore from dailyLog.
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
runScript('src/journey/journey-score.js', ctx);
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

ok('reload → dailyLog persists and score rebuilds from log (2–1)', () => {
  Object.keys(store).forEach((k) => delete store[k]);
  const d = DM.defaults();
  d.journeyStartKey = '2026-03-01';
  d.dailyLog = {
    '2026-03-01': 'sober',
    '2026-03-02': 'sober',
    '2026-03-03': 'drinking',
  };
  d.currentScore = { success: 12, failures: 0 };
  DM.saveNow(d);
  const again = DM.load();
  if (again.dailyLog['2026-03-01'] !== 'sober') throw new Error('dailyLog not persisted');
  if (again.dailyLog['2026-03-03'] !== 'drinking') throw new Error('drink day not persisted');
  if (again.currentScore.success !== 2 || again.currentScore.failures !== 1) {
    throw new Error(
      `score must be derived from log (expected 2–1, got ${again.currentScore.success}–${again.currentScore.failures})`
    );
  }
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

ok('partial object → migrated keys + score reconciled from dailyLog', () => {
  store[DM.KEY] = JSON.stringify({
    attempt: 2,
    journeyStartKey: '2026-03-01',
    currentScore: { success: 3, failures: 1 },
    dailyLog: {
      '2026-03-01': 'sober',
      '2026-03-02': 'sober',
      '2026-03-03': 'drinking',
    },
  });
  const d = DM.load();
  if (d.attempt !== 2) throw new Error('attempt not migrated');
  if (d.currentScore.success !== 2 || d.currentScore.failures !== 1) {
    throw new Error(
      `score should match log (expected 2–1, got ${d.currentScore.success}–${d.currentScore.failures})`
    );
  }
  if (!d.reminders || typeof d.reminders.dailyEnabled !== 'boolean') throw new Error('reminders missing');
});

ok('stale score without log entries → zeroed on load', () => {
  store[DM.KEY] = JSON.stringify({
    attempt: 1,
    journeyStartKey: '2026-06-01',
    currentScore: { success: 5, failures: 2 },
    dailyLog: {},
  });
  const d = DM.load();
  if (d.currentScore.success !== 0 || d.currentScore.failures !== 0) {
    throw new Error(`orphan counters should clear (got ${d.currentScore.success}–${d.currentScore.failures})`);
  }
});

ok('simulatedToday stripped when showTestUI false', () => {
  store[DM.KEY] = JSON.stringify({ simulatedToday: '2030-01-01T12:00:00.000Z', attempt: 1 });
  const d = DM.load();
  if (d.simulatedToday) throw new Error('simulatedToday should be removed in production config');
});

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
