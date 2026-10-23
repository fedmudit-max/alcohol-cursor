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
  CONFIG: { showTestUI: false, isProduction: true, premiumBilling: 'local-stub', enforceTrialEntitlement: true },
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

console.log('\nTrial entitlement\n');

ctx.Tracker = { data: null };
ctx.CONFIG.showTestUI = true;
runScript('src/premium/premium.js', ctx);
const {
  reconcileTrialClock,
  reconcileStubPremiumWithTrial,
  isTrialActive,
  isBestScoreLocked,
  isBestScoreCardLocked,
  isCalendarLocked,
  hasPremiumAccess,
  getTrialEndTimestamp,
} = ctx;
const TRIAL_STORE_KEY = 'sj_trialStartedAt';
const PREMIUM_KEY = 'sj_premium';

ok('wall-clock trial expired → isTrialActive false', () => {
  Object.keys(store).forEach((k) => delete store[k]);
  const past = new Date(Date.now() - ((16) * 86400000));
  store[TRIAL_STORE_KEY] = past.toISOString();
  ctx.Tracker.data = DM.load();
  if (isTrialActive()) throw new Error('trial should be expired');
});

ok('wall-clock trial active → isTrialActive true', () => {
  store[TRIAL_STORE_KEY] = new Date().toISOString();
  ctx.Tracker.data = DM.load();
  if (!isTrialActive()) throw new Error('trial should be active');
});

ok('Best Score tile open on journey 2 even after trial ended', () => {
  const past = new Date(Date.now() - ((16) * 86400000));
  store[TRIAL_STORE_KEY] = past.toISOString();
  ctx.Tracker.data = { attempt: 2 };
  if (isBestScoreCardLocked(ctx.Tracker.data)) throw new Error('best score tile should stay open on J2');
});

ok('Best Score tile locked from journey 3 even if trial still active', () => {
  store[TRIAL_STORE_KEY] = new Date().toISOString();
  ctx.Tracker.data = { attempt: 3 };
  if (!isBestScoreCardLocked(ctx.Tracker.data)) throw new Error('best score tile should lock on J3');
});

ok('Calendar open on journey 2 with trial active', () => {
  store[TRIAL_STORE_KEY] = new Date().toISOString();
  ctx.Tracker.data = { attempt: 2 };
  if (isCalendarLocked(ctx.Tracker.data)) throw new Error('calendar should stay open on J2 during trial');
});

ok('Calendar locked from journey 3 even if trial still active', () => {
  store[TRIAL_STORE_KEY] = new Date().toISOString();
  ctx.Tracker.data = { attempt: 3 };
  if (!isCalendarLocked(ctx.Tracker.data)) throw new Error('calendar should lock on J3');
});

ok('History / Best Scores tier unlocked on journey 3', () => {
  store[TRIAL_STORE_KEY] = new Date().toISOString();
  ctx.Tracker.data = { attempt: 3 };
  if (isBestScoreLocked(ctx.Tracker.data)) throw new Error('should stay open on J3');
});

ok('History / Best Scores tier locked from journey 4 even if trial still active', () => {
  store[TRIAL_STORE_KEY] = new Date().toISOString();
  ctx.Tracker.data = { attempt: 4 };
  if (!isBestScoreLocked(ctx.Tracker.data)) throw new Error('should lock on J4');
});

ok('History / Best Scores tier locked when journey 3 ended (pending reset)', () => {
  store[TRIAL_STORE_KEY] = new Date().toISOString();
  ctx.Tracker.data = { attempt: 3, journeyPendingReset: true };
  if (!isBestScoreLocked(ctx.Tracker.data)) throw new Error('should lock after J3 ends');
});

ok('trial ends after 15 calendar days from start', () => {
  const start = new Date(2026, 0, 1, 10, 0, 0);
  store[TRIAL_STORE_KEY] = start.toISOString();
  ctx.Tracker.data = DM.load();
  const endMs = getTrialEndTimestamp(start);
  const day16 = new Date(2026, 0, 16, 12, 0, 0).getTime();
  if (day16 <= endMs) throw new Error('day 16 should be after trial end');
});

ok('reconcileTrialClock does not pull trial start from journey logs', () => {
  Object.keys(store).forEach((k) => delete store[k]);
  const stamp = new Date().toISOString();
  store[DM.KEY] = JSON.stringify({
    attempt: 1,
    journeyStartKey: '2026-01-01',
    calendarDay: 20,
    dailyLog: { '2026-01-01': 'sober', '2026-01-16': 'sober' },
    trialStartedAt: null,
  });
  store[TRIAL_STORE_KEY] = stamp;
  const data = DM.load();
  reconcileTrialClock(data);
  if (store[TRIAL_STORE_KEY] !== stamp) throw new Error('trial start should stay at first app open, not log span');
  if (!isTrialActive()) throw new Error('trial should stay active regardless of journey day');
});

ok('journey day 20 does not end trial — only wall-clock 15 days since install', () => {
  store[TRIAL_STORE_KEY] = new Date().toISOString();
  ctx.Tracker.data = { attempt: 1, calendarDay: 20 };
  if (!isTrialActive()) throw new Error('trial should not use journey day counter');
});

ok('simulated app calendar past day 15 ends trial (Next calendar day QA)', () => {
  ctx.CONFIG.showTestUI = false;
  ctx.CONFIG.showInternalTestBar = true;
  const start = new Date(2026, 0, 1, 12, 0, 0);
  store[TRIAL_STORE_KEY] = start.toISOString();
  ctx.Tracker.data = {
    attempt: 1,
    calendarDay: 16,
    simulatedToday: new Date(2026, 0, 16, 12, 0, 0).toISOString(),
  };
  if (isTrialActive(ctx.Tracker.data)) {
    throw new Error('trial should end when simulated calendar passes 15 days from install');
  }
});

ok('internal test bar alone does not grant Premium after trial ends', () => {
  ctx.CONFIG.showTestUI = false;
  ctx.CONFIG.showInternalTestBar = true;
  const past = new Date(Date.now() - ((16) * 86400000));
  store[TRIAL_STORE_KEY] = past.toISOString();
  store[PREMIUM_KEY] = JSON.stringify({ active: true, source: 'local-stub' });
  if (typeof reconcileStubPremiumWithTrial === 'function') reconcileStubPremiumWithTrial();
  if (hasPremiumAccess()) throw new Error('expired trial should lock without showTestUI');
});

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
