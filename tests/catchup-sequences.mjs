#!/usr/bin/env node
/**
 * Catch-up state-machine tests (lock before Capacitor).
 * Run: node tests/catchup-sequences.mjs  OR  node tests/catchup-check.js
 */
import { createTrackerContext, key, noon } from './lib/load-tracker.mjs';

const ctx = createTrackerContext();
const { Tracker, DataManager, shouldAskYesterday, unwindTodayIfYesterdayPending } = {
  Tracker: ctx.Tracker,
  DataManager: ctx.DataManager,
  shouldAskYesterday: ctx.shouldAskYesterday,
  unwindTodayIfYesterdayPending: ctx.unwindTodayIfYesterdayPending,
};

let failed = 0;

function assert(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(` FAIL ${name}:`, e.message);
  }
}

function freshData(y, m, d) {
  const data = DataManager.defaults();
  const start = noon(y, m, d);
  data.journeyStartKey = key(y, m, d);
  data.lastDayCheck = start.toISOString();
  data.simulatedToday = start.toISOString();
  data.attempt = 1;
  data.gapSimCount = 0;
  return data;
}

function setSimDay(data, y, m, d) {
  const t = noon(y, m, d);
  data.simulatedToday = t.toISOString();
}

function runCatchUp(data) {
  Tracker.data = data;
  Tracker._catchUp();
  return Tracker.data;
}

// ── Test A: gap → no auto-log for missed days, yesterday prompt, today open ──
assert('Test A — Day 2 unlogged, Day 3 yesterday prompt, Day 4 unlogged', () => {
  const d = freshData(2026, 1, 1);
  Tracker.data = d;
  Tracker._recordSoberDay(d, key(2026, 1, 1));
  d.lastDayCheck = noon(2026, 1, 1).toISOString();

  setSimDay(d, 2026, 1, 4);
  runCatchUp(d);

  if (d.dailyLog[key(2026, 1, 2)]) {
    throw new Error('Day 2 should stay unlogged (no auto-sober)');
  }
  if (!shouldAskYesterday(d)) {
    throw new Error('Day 3 should need yesterday popup');
  }
  if (d.scoredDays[key(2026, 1, 3)]) {
    throw new Error('Day 3 should not be scored yet');
  }
  if (d.dailyLog[key(2026, 1, 4)]) {
    throw new Error('Day 4 should be unlogged');
  }
  if (d.currentScore.success !== 1) {
    throw new Error(`Expected score 1–0 sober side, got ${d.currentScore.success}–${d.currentScore.failures}`);
  }
});

// ── Test B: log today before yesterday → unwind, no extra sober count ──
assert('Test B — today sober unwound when yesterday pending', () => {
  const d = freshData(2026, 1, 1);
  Tracker.data = d;
  Tracker._recordSoberDay(d, key(2026, 1, 1));
  d.lastDayCheck = noon(2026, 1, 1).toISOString();
  setSimDay(d, 2026, 1, 4);
  runCatchUp(d);

  const before = d.currentScore.success;
  Tracker._recordSoberDay(d, key(2026, 1, 4));
  if (d.currentScore.success !== before + 1) {
    throw new Error('Today should increment score before unwind');
  }
  const unwound = unwindTodayIfYesterdayPending(d);
  if (!unwound) throw new Error('unwindTodayIfYesterdayPending should return true');
  if (d.currentScore.success !== before) {
    throw new Error(`Score should return to ${before}, got ${d.currentScore.success}`);
  }
  if (d.dailyLog[key(2026, 1, 4)]) {
    throw new Error('Day 4 log should be cleared after unwind');
  }
  if (!shouldAskYesterday(d)) {
    throw new Error('Yesterday popup should still be required');
  }
});

// ── Test C: yesterday drink → failure + streak reset ──
assert('Test C — yesterday drink increments failures and resets streak', () => {
  const d = freshData(2026, 1, 1);
  Tracker.data = d;
  Tracker._recordSoberDay(d, key(2026, 1, 1));
  Tracker._recordSoberDay(d, key(2026, 1, 2));
  Tracker._recordSoberDay(d, key(2026, 1, 3));
  d.currentStreak = 3;
  d.lastDayCheck = noon(2026, 1, 3).toISOString();
  setSimDay(d, 2026, 1, 4);
  d.todayStatus = 'none';

  const failuresBefore = d.currentScore.failures;
  Tracker.logYesterday('fail');

  if (d.currentScore.failures !== failuresBefore + 1) {
    throw new Error(`failures expected ${failuresBefore + 1}, got ${d.currentScore.failures}`);
  }
  if ((d.currentStreak | 0) !== 0) {
    throw new Error(`streak should reset to 0, got ${d.currentStreak}`);
  }
  if (d.dailyLog[key(2026, 1, 3)] !== 'drinking') {
    throw new Error('yesterday should be logged as drinking');
  }
});

// ── Test D: 10th drink ends journey; same day still ended; next day new journey ──
assert('Test D — 10th drink ends journey; next calendar day starts 0–0', () => {
  const d = freshData(2026, 2, 1);
  Tracker.data = d;
  for (let day = 1; day <= 9; day++) {
    Tracker._recordDrinkDay(d, key(2026, 2, day));
  }
  const drinkKey = key(2026, 2, 10);
  Tracker._recordDrinkDay(d, drinkKey);
  if (d.currentScore.failures >= ctx.JOURNEY_MAX_FAILURES) Tracker._endJourney();

  if (!d.journeyPendingReset) throw new Error('journey should be pending reset after 10th drink');
  if (d.currentScore.failures !== 10) throw new Error('expected 10 failures');

  setSimDay(d, 2026, 2, 10);
  d.lastDayCheck = noon(2026, 2, 10).toISOString();
  runCatchUp(d);
  if (!Tracker.data.journeyPendingReset) {
    throw new Error('same-day reopen should keep journey ended');
  }

  setSimDay(Tracker.data, 2026, 2, 11);
  Tracker.data.lastDayCheck = noon(2026, 2, 10).toISOString();
  runCatchUp(Tracker.data);
  const d2 = Tracker.data;
  if (d2.journeyPendingReset) throw new Error('next day should clear pending reset');
  if (d2.currentScore.success !== 0 || d2.currentScore.failures !== 0) {
    throw new Error(`new journey should be 0–0, got ${d2.currentScore.success}–${d2.currentScore.failures}`);
  }
  if ((d2.attempt | 0) < 2) throw new Error('attempt should advance for new journey');
});

console.log(failed ? `\n${failed} test(s) failed.\n` : '\nAll catch-up sequence tests passed.\n');
process.exit(failed ? 1 : 0);
