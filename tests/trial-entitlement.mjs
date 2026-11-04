#!/usr/bin/env node
/**
 * Trial tier gates + import trial policy + history display caps (Node VM).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScript(relativePath, context) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

const store = {};
const ctx = vm.createContext({
  CONFIG: {
    showTestUI: false,
    isProduction: true,
    premiumBilling: 'local-stub',
    enforceTrialEntitlement: true,
  },
  console,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  document: { getElementById: () => null, body: { classList: { add: () => {}, remove: () => {} } } },
  Tracker: { data: null },
});

runScript('src/config/app.config.js', ctx);
vm.runInContext('this.__TRIAL_DURATION_MS = TRIAL_DAYS * MS_PER_DAY;', ctx);
runScript('src/utils/dates.js', ctx);
runScript('src/premium/premium.js', ctx);

const {
  isCalendarLocked,
  isBestScoreCardLocked,
  isBestScoreLocked,
  hasPremiumAccess,
  isAuditSafetyGuidanceLocked,
  completedJourneysForDisplay,
  journeyHistoryCap,
} = ctx;

const TRIAL_KEY = 'sj_trialStartedAt';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function trialExpiredAnchorIso() {
  return new Date(Date.now() - ctx.__TRIAL_DURATION_MS - 3600000).toISOString();
}

function trialEndedData(attempt, extra = {}) {
  store[TRIAL_KEY] = trialExpiredAnchorIso();
  return { attempt, journeyPendingReset: false, ...extra };
}

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

console.log('Trial entitlement tiers (post-trial)\n');

ok('post-trial — AUDIT-C / withdrawal safety guidance never premium-locked', () => {
  store[TRIAL_KEY] = trialExpiredAnchorIso();
  if (hasPremiumAccess(trialEndedData(2))) throw new Error('premium access should be false');
  if (isAuditSafetyGuidanceLocked()) throw new Error('audit safety must stay unlocked');
});

ok('J1–J2: calendar locked, Best Score tile free, History free', () => {
  const d = trialEndedData(2);
  ctx.Tracker.data = d;
  if (!isCalendarLocked(d)) throw new Error('calendar should lock');
  if (isBestScoreCardLocked(d)) throw new Error('best score tile should stay open on J2');
  if (isBestScoreLocked(d)) throw new Error('history tier should stay open on J2');
});

ok('J3: calendar + Best Score tile locked, History free until journey ends', () => {
  const d = trialEndedData(3);
  ctx.Tracker.data = d;
  if (!isCalendarLocked(d)) throw new Error('calendar should lock on J3');
  if (!isBestScoreCardLocked(d)) throw new Error('best score tile should lock on J3');
  if (isBestScoreLocked(d)) throw new Error('history should stay open during J3');
});

ok('J3 ended (pending reset): History tier locks', () => {
  const d = trialEndedData(3, { journeyPendingReset: true });
  ctx.Tracker.data = d;
  if (!isBestScoreLocked(d)) throw new Error('history should lock when J3 ended');
});

ok('J4+: History / Best Scores tier locked', () => {
  const d = trialEndedData(4);
  ctx.Tracker.data = d;
  if (!isBestScoreLocked(d)) throw new Error('history should lock from J4');
});

ok('active trial unlocks all tiers', () => {
  store[TRIAL_KEY] = new Date(Date.now() - 3 * 86400000).toISOString();
  const d = { attempt: 5, journeyPendingReset: false };
  ctx.Tracker.data = d;
  if (!hasPremiumAccess(d)) throw new Error('trial should grant access');
  if (isCalendarLocked(d)) throw new Error('calendar open during trial');
  if (isBestScoreLocked(d)) throw new Error('history open during trial');
});

console.log('\nJourney history display cap\n');

ok('completedJourneysForDisplay slices UI only', () => {
  vm.runInContext("CONFIG.premiumBilling = 'local-stub'", ctx);
  store[TRIAL_KEY] = daysAgo(30);
  ctx.Tracker.data = { attempt: 1 };
  const cap = journeyHistoryCap();
  const rows = Array.from({ length: cap + 5 }, (_, i) => ({
    attempt: i + 1,
    score: { success: 1, failures: 0 },
  }));
  const data = { completedJourneys: rows };
  const shown = completedJourneysForDisplay(data);
  if (shown.length !== cap) throw new Error(`expected ${cap} visible, got ${shown.length}`);
  if (data.completedJourneys.length !== cap + 5) throw new Error('stored array must not shrink');
});

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll trial entitlement checks passed.\n');
process.exit(failed ? 1 : 0);
