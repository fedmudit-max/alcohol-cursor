/**
 * Minimal browser stubs + script load order for Node catch-up tests.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const MS_PER_DAY = 86400000;

function readScript(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runScript(ctx, rel) {
  vm.runInContext(readScript(rel), ctx, { filename: rel });
}

export function createTrackerContext() {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };

  const modalStub = () => ({
    classList: { remove: () => {}, add: () => {}, contains: () => false, toggle: () => {} },
    style: {},
    textContent: '',
    hidden: false,
    querySelector: () => null,
  });
  const el = (id) => modalStub();

  const ctx = vm.createContext({
    MS_PER_DAY,
    CONFIG: {
      isProduction: false,
      showTestUI: true,
      showOnboarding: false,
      buildTag: 'test',
      premiumBilling: 'local-stub',
    },
    console,
    localStorage,
    document: {
      getElementById: (id) => el(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      body: { classList: { add: () => {}, remove: () => {}, toggle: () => {} } },
    },
    window: {},
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    UI: {
      renderAll: () => {},
      showModal: () => {},
      hideModal: () => {},
    },
    el,
    launchConfetti: () => {},
    showToast: () => {},
    refreshStreakUI: () => {},
    daysSince(isoString, refDate) {
      const last = new Date(isoString);
      if (Number.isNaN(last.getTime())) return 0;
      const ref = refDate || new Date();
      const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      return Math.round((refDay - lastDay) / MS_PER_DAY);
    },
    hasPremiumAccess: () => true,
    journeyHistoryCap: () => 100,
    ensureTrialStarted: () => {},
  });

  const chain = [
    'src/config/app.config.js',
    'src/utils/dates.js',
    'src/constants/milestones.js',
    'src/constants/science-nodes.js',
    'src/journey/streak.js',
    'src/journey/journey-score.js',
    'src/journey/best-performances.js',
    'src/data/local-storage.js',
    'src/journey/journey.js',
    'src/journey/catchup.js',
  ];
  runScript(ctx, chain[0]);
  vm.runInContext(`
    CONFIG.showTestUI = true;
    CONFIG.isProduction = false;
    CONFIG.buildTag = 'test';
  `, ctx);
  for (const rel of chain.slice(1)) runScript(ctx, rel);

  runScript(ctx, 'src/utils/helpers.js');

  vm.runInContext(`
    renderScienceTimeline = function() {};
    markStreakOwnedScienceCelebrated = function() {};
    this.DataManager = DataManager;
    this.Tracker = Tracker;
    this.shouldAskYesterday = shouldAskYesterday;
    this.unwindTodayIfYesterdayPending = unwindTodayIfYesterdayPending;
    this.JOURNEY_MAX_FAILURES = JOURNEY_MAX_FAILURES;
    this.applyDayLogStatus = applyDayLogStatus;
    this.recalculateJourneyScoreFromLog = recalculateJourneyScoreFromLog;
    this.recalculateStreakFromLog = recalculateStreakFromLog;
    this.reconcileLogsToJourneyScore = reconcileLogsToJourneyScore;
    this.ensureJourneyStartKey = ensureJourneyStartKey;
    this.syncCalendarDayFromJourneyStart = syncCalendarDayFromJourneyStart;
    this.canRecordCalendarDay = canRecordCalendarDay;
    this.getDisplayBestScore = getDisplayBestScore;
  `, ctx);
  return ctx;
}

export function noon(y, m, d) {
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function key(y, m, d) {
  const dt = noon(y, m, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
