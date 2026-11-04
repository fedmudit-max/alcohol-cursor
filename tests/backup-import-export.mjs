#!/usr/bin/env node
/**
 * Backup import/export policy tests (Node, no browser).
 * Keep parseBackupJson in sync with src/data/backup.js.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const BACKUP_FORMAT = '10drinks-backup';
const LEGACY_BACKUP_FORMAT = 'sober-journey-backup';

function runScript(relativePath, context) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

function parseBackupJson(text, DataManager) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'invalid-json' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'invalid-json' };

  let saved = parsed;
  let exportedAt = null;
  let onboardingComplete = null;

  if (parsed.format === BACKUP_FORMAT || parsed.format === LEGACY_BACKUP_FORMAT) {
    if (!parsed.state || typeof parsed.state !== 'object') return { ok: false, error: 'missing-state' };
    saved = parsed.state;
    exportedAt = parsed.exportedAt || null;
    onboardingComplete = parsed.onboardingComplete;
  }

  if (typeof saved.attempt !== 'number' || !saved.currentScore || typeof saved.currentScore !== 'object') {
    return { ok: false, error: 'not-backup' };
  }

  return {
    ok: true,
    state: DataManager._migrate(saved),
    exportedAt,
    onboardingComplete,
  };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function setupContext() {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };

  const modalStub = () => ({
    dataset: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    hidden: false,
  });

  const ctx = vm.createContext({
    CONFIG: {
      showTestUI: false,
      isProduction: true,
      premiumBilling: 'local-stub',
      enforceTrialEntitlement: true,
    },
    console,
    localStorage,
    document: {
      getElementById: () => modalStub(),
      body: { classList: { add: () => {}, remove: () => {} } },
    },
    window: {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    UI: { renderAll: () => {}, hideModal: () => {} },
    refreshStreakUI: () => {},
    el: () => modalStub(),
    ensureJourneyStartKey: () => false,
  });

  runScript('src/config/app.config.js', ctx);
  runScript('src/utils/dates.js', ctx);
  runScript('src/journey/journey-score.js', ctx);
  runScript('src/utils/helpers.js', ctx);
  runScript('src/data/local-storage.js', ctx);
  vm.runInContext('this.DataManager = DataManager; this.AuditSession = AuditSession;', ctx);

  ctx.Tracker = {
    data: null,
    switchTab: () => {},
    _celebQueue: [],
    _celebrating: false,
    _currentStreaks: [],
    pendingAction: null,
  };
  runScript('src/premium/premium.js', ctx);
  runScript('src/data/backup.js', ctx);
  vm.runInContext(`
    this.Tracker = Tracker;
    showToast = function(msg) { __lastToast = String(msg || ''); };
    renderPremiumEntry = function() {};
    renderWelcomeHint = function() {};
  `, ctx);
  ctx.__lastToast = '';

  return {
    ctx,
    store,
    getLastToast: () => ctx.__lastToast || '',
    clearToast: () => { ctx.__lastToast = ''; },
  };
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

console.log('Backup import / export\n');

const { ctx, store, getLastToast, clearToast } = setupContext();
const DM = ctx.DataManager;
const Tracker = ctx.Tracker;
const TRIAL_KEY = 'sj_trialStartedAt';
const PREMIUM_KEY = 'sj_premium';
const { isTrialActive } = ctx;

function clearStore() {
  Object.keys(store).forEach((k) => delete store[k]);
  clearToast();
}

function sampleState(overrides = {}) {
  return {
    attempt: 2,
    journeyStartKey: '2026-04-01',
    currentScore: { success: 3, failures: 1 },
    highestScore: { success: 5, failures: 2 },
    dailyLog: {
      '2026-04-01': 'sober',
      '2026-04-02': 'sober',
      '2026-04-03': 'drinking',
    },
    trialStartedAt: daysAgo(10),
    lastDayCheck: new Date().toISOString(),
    calendarDay: 3,
    currentStreak: 0,
    todayStatus: 'none',
    todaySuccessLogged: false,
    totalSuccessfulDays: 3,
    totalFailures: 1,
    completedJourneys: [],
    journeyPendingReset: false,
    reminders: { dailyEnabled: false, dailyTime: '20:00' },
    ...overrides,
  };
}

function restoreFromState(state, meta = {}) {
  return Tracker._restoreImportBackup({
    state: DM._migrate(JSON.parse(JSON.stringify(state))),
    exportedAt: meta.exportedAt || '2026-05-01T12:00:00.000Z',
    onboardingComplete: meta.onboardingComplete ?? false,
  });
}

ok('parseBackupJson — valid 10drinks-backup envelope', () => {
  const trial = daysAgo(8);
  const json = JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: '2026-05-01T10:00:00.000Z',
    state: sampleState({ trialStartedAt: trial }),
  });
  const r = parseBackupJson(json, DM);
  if (!r.ok) throw new Error('expected ok');
  if (r.state.attempt !== 2) throw new Error('attempt missing');
  if (r.state.trialStartedAt !== trial) throw new Error('trial in state');
  if (r.exportedAt !== '2026-05-01T10:00:00.000Z') throw new Error('exportedAt');
});

ok('parseBackupJson — legacy sober-journey-backup format', () => {
  const json = JSON.stringify({
    format: LEGACY_BACKUP_FORMAT,
    state: sampleState(),
  });
  const r = parseBackupJson(json, DM);
  if (!r.ok || r.state.attempt !== 2) throw new Error('legacy envelope should parse');
});

ok('parseBackupJson — rejects invalid JSON and non-backup', () => {
  if (parseBackupJson('{', DM).error !== 'invalid-json') throw new Error('bad json');
  if (parseBackupJson('{"format":"10drinks-backup"}', DM).error !== 'missing-state') {
    throw new Error('missing state');
  }
  if (parseBackupJson('{"attempt":1}', DM).error !== 'not-backup') throw new Error('not-backup');
});

ok('export payload shape — trialStartedAt in persisted state', () => {
  clearStore();
  const trial = daysAgo(4);
  const data = DM.defaults();
  data.trialStartedAt = trial;
  data.dailyLog = { '2026-06-01': 'sober' };
  data.attempt = 2;
  data.currentScore = { success: 1, failures: 0 };
  const persisted = ctx.AuditSession.forPersist(data);
  if (persisted.trialStartedAt !== trial) throw new Error('trial must be exported in state');
  if (!persisted.dailyLog['2026-06-01']) throw new Error('dailyLog exported');
  if (persisted.auditScore !== undefined && persisted.auditScore !== null) {
    throw new Error('audit fields should be stripped on persist');
  }
});

ok('import — restores journey progress and trial from backup', () => {
  clearStore();
  const backupTrial = daysAgo(12);
  Tracker.data = DM.defaults();
  store[TRIAL_KEY] = new Date().toISOString();
  restoreFromState(sampleState({ trialStartedAt: backupTrial }));
  const saved = DM.load();
  if (saved.attempt !== 2) throw new Error(`attempt ${saved.attempt}`);
  if (saved.dailyLog['2026-04-03'] !== 'drinking') throw new Error('dailyLog not restored');
  if (store[TRIAL_KEY] !== backupTrial) throw new Error('trial anchor should follow backup on bootstrap device');
  if (Tracker.data.trialStartedAt !== backupTrial) throw new Error('Tracker.data trial mismatch');
});

ok('import — clears local premium mirror (store sub re-syncs via RevenueCat)', () => {
  clearStore();
  store[PREMIUM_KEY] = JSON.stringify({
    active: true,
    source: 'revenuecat',
    entitlementId: 'premium',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  Tracker.data = DM.defaults();
  restoreFromState(sampleState());
  if (store[PREMIUM_KEY]) throw new Error('premium record should clear on import');
});

ok('import — rejects backup with missing or invalid trialStartedAt', () => {
  clearStore();
  Tracker.data = DM.defaults();
  DM.saveNow(Tracker.data);
  restoreFromState(sampleState({ trialStartedAt: null }));
  if (DM.load().attempt !== 1) throw new Error('should not restore without trial');
  if (!/trial date/i.test(getLastToast())) throw new Error(`expected trial toast, got: ${getLastToast()}`);

  clearToast();
  restoreFromState(sampleState({ trialStartedAt: 'not-a-date' }));
  if (DM.load().attempt !== 1) throw new Error('invalid trial should not restore');
});

ok('import — pristine device (bootstrap trial today) uses backup trial anchor', () => {
  clearStore();
  const todayTrial = new Date();
  todayTrial.setHours(8, 0, 0, 0);
  store[TRIAL_KEY] = todayTrial.toISOString();
  Tracker.data = DM.defaults();
  Tracker.data.trialStartedAt = todayTrial.toISOString();
  const backupTrial = daysAgo(14);
  restoreFromState(sampleState({ trialStartedAt: backupTrial }));
  if (store[TRIAL_KEY] !== backupTrial) {
    throw new Error('bootstrap local trial should lose to backup trial');
  }
});

ok('import — uses earliest trial anchor (never extends local trial)', () => {
  clearStore();
  const localTrial = daysAgo(5);
  store[TRIAL_KEY] = localTrial;
  Tracker.data = DM.load();
  Tracker.data.trialStartedAt = localTrial;
  Tracker.data.dailyLog = { '2026-03-01': 'sober' };
  Tracker.data.attempt = 1;
  DM.saveNow(Tracker.data);
  const backupTrial = daysAgo(20);
  restoreFromState(sampleState({ trialStartedAt: backupTrial, attempt: 3 }));
  if (store[TRIAL_KEY] !== backupTrial) throw new Error('older backup anchor should win over newer local');
  if (DM.load().attempt !== 3) throw new Error('progress should still come from backup');
});

ok('import — blocks delete-all trial re-up with old backup', () => {
  clearStore();
  const freshTrial = new Date().toISOString();
  store[TRIAL_KEY] = freshTrial;
  Tracker.data = DM.load();
  Tracker.data.trialStartedAt = freshTrial;
  Tracker.data.dailyLog = { '2026-06-01': 'sober' };
  DM.saveNow(Tracker.data);
  const oldBackupTrial = daysAgo(12);
  restoreFromState(sampleState({ trialStartedAt: oldBackupTrial, attempt: 4 }));
  if (store[TRIAL_KEY] === freshTrial) throw new Error('fresh post-delete trial must not beat older backup');
  if (store[TRIAL_KEY] !== oldBackupTrial) throw new Error('backup trial anchor should apply');
});

ok('import — rejects future trialStartedAt', () => {
  clearStore();
  Tracker.data = DM.defaults();
  DM.saveNow(Tracker.data);
  const future = new Date(Date.now() + 86400000 * 400).toISOString();
  restoreFromState(sampleState({ trialStartedAt: future }));
  if (DM.load().attempt !== 1) throw new Error('future trial must not restore');
  if (!/trial date/i.test(getLastToast())) throw new Error(`expected trial toast, got: ${getLastToast()}`);
});

ok('import — records last backup time from exportedAt', () => {
  clearStore();
  Tracker.data = DM.defaults();
  store[TRIAL_KEY] = daysAgo(3);
  const exportedAt = '2026-07-04T09:30:00.000Z';
  restoreFromState(sampleState({ trialStartedAt: daysAgo(3) }), { exportedAt });
  if (store.sj_lastBackupAt !== exportedAt) throw new Error('sj_lastBackupAt not set');
});

ok('delete all data — fresh journey and new active trial', () => {
  clearStore();
  store[TRIAL_KEY] = daysAgo(30);
  store[PREMIUM_KEY] = JSON.stringify({ active: true, source: 'local-stub' });
  Tracker.data = sampleState({ attempt: 4 });
  DM.saveNow(Tracker.data);
  Tracker._deleteAllData();
  const saved = DM.load();
  if (saved.attempt !== 1) throw new Error('should reset attempt');
  if (Object.keys(saved.dailyLog || {}).length > 0) throw new Error('dailyLog should clear');
  if (!store[TRIAL_KEY]) throw new Error('new trial should be written to LS');
  if (store[PREMIUM_KEY]) throw new Error('premium record should clear');
  ctx.Tracker.data = saved;
  if (!isTrialActive()) throw new Error('new trial should be active after delete all');
});

ok('roundtrip — export JSON parse then restore preserves dailyLog + trial', () => {
  clearStore();
  const trial = daysAgo(7);
  const envelope = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    onboardingComplete: true,
    state: sampleState({ trialStartedAt: trial }),
  };
  const parsed = parseBackupJson(JSON.stringify(envelope), DM);
  if (!parsed.ok) throw new Error('parse failed');
  Tracker.data = DM.defaults();
  store[TRIAL_KEY] = new Date().toISOString();
  Tracker._restoreImportBackup(parsed);
  const saved = DM.load();
  if (saved.dailyLog['2026-04-01'] !== 'sober') throw new Error('roundtrip log');
  if (store[TRIAL_KEY] !== trial) throw new Error('roundtrip trial from backup on bootstrap');
});

console.log(failed ? `\n${failed} backup check(s) failed.\n` : '\nAll backup checks passed.\n');
process.exit(failed ? 1 : 0);
