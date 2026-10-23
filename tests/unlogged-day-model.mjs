#!/usr/bin/env node
/**
 * Three-state day model: Unlogged | Sober | I Drank (no auto-sober).
 * Run: node tests/unlogged-day-model.mjs
 */
import { createTrackerContext, key, noon } from './lib/load-tracker.mjs';

const ctx = createTrackerContext();
const {
  Tracker,
  DataManager,
  applyDayLogStatus,
  recalculateJourneyScoreFromLog,
  recalculateStreakFromLog,
  JOURNEY_MAX_FAILURES,
  shouldAskYesterday,
  canRecordCalendarDay,
} = ctx;

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

function fresh(y, m, d) {
  const data = DataManager.defaults();
  data.journeyStartKey = key(y, m, d);
  data.simulatedToday = noon(y, m, d).toISOString();
  data.lastDayCheck = data.simulatedToday;
  Tracker.data = data;
  return data;
}

assert('1 — missed day stays unlogged after catch-up', () => {
  const d = fresh(2026, 4, 1);
  applyDayLogStatus(d, key(2026, 4, 1), 'sober');
  d.lastDayCheck = noon(2026, 4, 1).toISOString();
  d.simulatedToday = noon(2026, 4, 4).toISOString();
  Tracker._catchUp();
  if (d.dailyLog[key(2026, 4, 2)]) throw new Error('day 2 should be unlogged');
});

assert('2 — unlogged gap does not increase sober streak', () => {
  const d = fresh(2026, 4, 7);
  applyDayLogStatus(d, key(2026, 4, 7), 'sober');
  applyDayLogStatus(d, key(2026, 4, 9), 'sober');
  d.simulatedToday = noon(2026, 4, 9).toISOString();
  recalculateStreakFromLog(d);
  if ((d.currentStreak | 0) !== 1) throw new Error(`expected streak 1, got ${d.currentStreak}`);
});

assert('3 — unlogged gap does not increase journey score', () => {
  const d = fresh(2026, 4, 10);
  applyDayLogStatus(d, key(2026, 4, 10), 'sober');
  recalculateJourneyScoreFromLog(d);
  if (d.currentScore.success !== 1) throw new Error(`expected 1 sober, got ${d.currentScore.success}`);
});

assert('4 — mark unlogged day sober updates score and streak', () => {
  const d = fresh(2026, 4, 14);
  applyDayLogStatus(d, key(2026, 4, 14), 'sober');
  applyDayLogStatus(d, key(2026, 4, 16), 'sober');
  d.simulatedToday = noon(2026, 4, 16).toISOString();
  applyDayLogStatus(d, key(2026, 4, 15), 'sober');
  recalculateStreakFromLog(d);
  if (d.currentScore.success !== 3) throw new Error(`score ${d.currentScore.success}`);
  if ((d.currentStreak | 0) !== 3) throw new Error(`streak ${d.currentStreak}`);
});

assert('5 — mark unlogged day drink updates score and breaks streak', () => {
  const d = fresh(2026, 4, 20);
  applyDayLogStatus(d, key(2026, 4, 20), 'sober');
  applyDayLogStatus(d, key(2026, 4, 22), 'sober');
  d.simulatedToday = noon(2026, 4, 22).toISOString();
  applyDayLogStatus(d, key(2026, 4, 21), 'drinking');
  if (d.currentScore.failures !== 1) throw new Error(`failures ${d.currentScore.failures}`);
  recalculateStreakFromLog(d);
  if ((d.currentStreak | 0) !== 1) throw new Error(`streak should be 1 from Wed only, got ${d.currentStreak}`);
});

assert('6 — backfill sober connects Mon and Wed streak', () => {
  const d = fresh(2026, 5, 1);
  const mon = key(2026, 5, 5);
  const wed = key(2026, 5, 7);
  const tue = key(2026, 5, 6);
  applyDayLogStatus(d, mon, 'sober');
  applyDayLogStatus(d, wed, 'sober');
  d.simulatedToday = noon(2026, 5, 7).toISOString();
  recalculateStreakFromLog(d);
  if ((d.currentStreak | 0) !== 1) throw new Error(`before fill streak ${d.currentStreak}`);
  applyDayLogStatus(d, tue, 'sober');
  recalculateStreakFromLog(d);
  if ((d.currentStreak | 0) !== 3) throw new Error(`after fill streak ${d.currentStreak}`);
});

assert('7 — backfill drink breaks streak', () => {
  const d = fresh(2026, 5, 10);
  applyDayLogStatus(d, key(2026, 5, 10), 'sober');
  applyDayLogStatus(d, key(2026, 5, 12), 'sober');
  d.simulatedToday = noon(2026, 5, 12).toISOString();
  applyDayLogStatus(d, key(2026, 5, 11), 'drinking');
  recalculateStreakFromLog(d);
  if ((d.currentStreak | 0) !== 1) throw new Error(`streak ${d.currentStreak}`);
});

assert('8 — edit sober to drink recalculates score', () => {
  const d = fresh(2026, 5, 15);
  const k = key(2026, 5, 15);
  applyDayLogStatus(d, k, 'sober');
  applyDayLogStatus(d, k, 'drinking');
  if (d.currentScore.success !== 0 || d.currentScore.failures !== 1) {
    throw new Error(`score ${d.currentScore.success}-${d.currentScore.failures}`);
  }
});

assert('9 — edit drink to sober recalculates score', () => {
  const d = fresh(2026, 5, 18);
  const k = key(2026, 5, 18);
  applyDayLogStatus(d, k, 'drinking');
  applyDayLogStatus(d, k, 'sober');
  if (d.currentScore.success !== 1 || d.currentScore.failures !== 0) {
    throw new Error(`score ${d.currentScore.success}-${d.currentScore.failures}`);
  }
});

assert('10 — unlogged day does not count toward 10 drinks', () => {
  const d = fresh(2026, 6, 1);
  for (let i = 0; i < JOURNEY_MAX_FAILURES; i++) {
    const dt = noon(2026, 6, 1 + i);
    applyDayLogStatus(d, key(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()), 'drinking');
  }
  if (d.currentScore.failures !== JOURNEY_MAX_FAILURES) throw new Error('should have 10 drinks');
  const gap = key(2026, 6, 20);
  if (d.dailyLog[gap]) throw new Error('gap should be unlogged');
  if ((d.currentScore.failures | 0) > JOURNEY_MAX_FAILURES) throw new Error('unlogged inflated drinks');
});

assert('11 — reload preserves unlogged/sober/drink', () => {
  const d = fresh(2026, 6, 25);
  const a = key(2026, 6, 25);
  const b = key(2026, 6, 26);
  applyDayLogStatus(d, a, 'sober');
  applyDayLogStatus(d, b, 'drinking');
  const store = {};
  const json = JSON.stringify(d);
  const loaded = DataManager._migrate(JSON.parse(json));
  ctx.reconcileLogsToJourneyScore(loaded);
  if (loaded.dailyLog[a] !== 'sober' || loaded.dailyLog[b] !== 'drinking') throw new Error('log mismatch');
  if (loaded.dailyLog[key(2026, 6, 27)]) throw new Error('should stay unlogged');
  if (loaded.currentScore.success !== 1 || loaded.currentScore.failures !== 1) {
    throw new Error(`score ${loaded.currentScore.success}-${loaded.currentScore.failures}`);
  }
});

assert('12b — corrupt stored best (failures > 10) does not display', () => {
  const d = fresh(2026, 7, 20);
  applyDayLogStatus(d, key(2026, 7, 20), 'sober');
  for (let i = 0; i < 10; i++) {
    const dt = noon(2026, 7, 21 + i);
    applyDayLogStatus(d, key(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()), 'drinking');
  }
  d.highestScore = { success: 11, failures: 16 };
  d.attempt = 2;
  d.completedJourneys = [{ attempt: 1, score: { success: 7, failures: 6 }, date: '' }];
  const display = ctx.getDisplayBestScore(d);
  if (display.failures > JOURNEY_MAX_FAILURES) {
    throw new Error(`display best ${display.success}-${display.failures}`);
  }
  if (display.success === 11 && display.failures === 16) {
    throw new Error('should not show corrupt 11-16');
  }
});

assert('12c — best score display = better of current vs stored best (laotzu101)', () => {
  const d = fresh(2026, 8, 1);
  d.attempt = 2;
  d.completedJourneys = [{ attempt: 1, score: { success: 25, failures: 10 }, date: '' }];
  d.currentScore = { success: 11, failures: 10 };
  d.highestScore = { success: 25, failures: 10 };
  const behind = ctx.getDisplayBestScore(d);
  if (behind.success !== 25 || behind.failures !== 10) {
    throw new Error(`11-10 vs 25-10 should show 25-10 got ${behind.success}-${behind.failures}`);
  }
  d.currentScore = { success: 30, failures: 8 };
  const ahead = ctx.getDisplayBestScore(d);
  if (ahead.success !== 30 || ahead.failures !== 8) {
    throw new Error(`30-8 should beat 25-10 got ${ahead.success}-${ahead.failures}`);
  }
  d.currentScore = { success: 11, failures: 10 };
  d.highestScore = { success: 11, failures: 4 };
  const tieBreak = ctx.getDisplayBestScore(d);
  if (tieBreak.success !== 11 || tieBreak.failures !== 4) {
    throw new Error(`same sober days → fewer drinks wins (11-4) got ${tieBreak.success}-${tieBreak.failures}`);
  }
});

assert('12 — best score updates from recalculated journey score', () => {
  const d = fresh(2026, 7, 1);
  for (let i = 0; i < 5; i++) {
    const dt = noon(2026, 7, 1 + i);
    applyDayLogStatus(d, key(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()), 'sober');
  }
  recalculateJourneyScoreFromLog(d);
  if ((d.highestScore.success | 0) < 5) throw new Error(`best ${d.highestScore.success}`);
});

assert('13b — score never exceeds 10 drinks when log has more in one journey', () => {
  const d = fresh(2026, 9, 1);
  for (let i = 0; i < 16; i++) {
    const dt = noon(2026, 9, 1 + i);
    d.dailyLog[key(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())] = 'drinking';
  }
  recalculateJourneyScoreFromLog(d);
  if ((d.currentScore.failures | 0) !== JOURNEY_MAX_FAILURES) {
    throw new Error(`failures ${d.currentScore.failures} should cap at ${JOURNEY_MAX_FAILURES}`);
  }
});

assert('14b — multi-day gap: only yesterday logged, earlier days tappable unlogged', () => {
  const d = DataManager.defaults();
  d.attempt = 1;
  d.journeyStartKey = key(2026, 4, 1);
  d.simulatedToday = noon(2026, 4, 1).toISOString();
  d.lastDayCheck = d.simulatedToday;
  Tracker.data = d;

  d.simulatedToday = noon(2026, 4, 5).toISOString();
  d.lastDayCheck = noon(2026, 4, 1).toISOString();
  Tracker._catchUp();
  const k1 = key(2026, 4, 1);
  const k2 = key(2026, 4, 2);
  const k3 = key(2026, 4, 3);
  const k4 = key(2026, 4, 4);
  if (d.journeyStartKey !== k1) throw new Error(`start ${d.journeyStartKey}`);
  Tracker.logYesterday('success');
  if (d.dailyLog[k4] !== 'sober') throw new Error('Apr 4 should be sober');
  for (const k of [k1, k2, k3]) {
    if (d.dailyLog[k]) throw new Error(`${k} must stay unlogged`);
    if (!canRecordCalendarDay(d, k, noon(2026, 4, 5))) throw new Error(`${k} should be tappable`);
  }
});

assert('15 — collapsed start healed: every unlogged day before yesterday is tappable', () => {
  const d = DataManager.defaults();
  d.attempt = 1;
  d.journeyStartKey = key(2026, 5, 10);
  d.calendarDay = 1;
  d.simulatedToday = noon(2026, 5, 10).toISOString();
  d.lastDayCheck = noon(2026, 5, 7).toISOString();
  Tracker.data = d;
  Tracker._catchUp();
  if (d.journeyStartKey !== key(2026, 5, 7)) {
    throw new Error(`journey floor should be May 7, got ${d.journeyStartKey}`);
  }
  for (let day = 7; day <= 9; day++) {
    const k = key(2026, 5, day);
    if (d.dailyLog[k]) throw new Error(`${k} must stay unlogged`);
    if (!canRecordCalendarDay(d, k, noon(2026, 5, 10))) {
      throw new Error(`${k} should be loggable from the calendar`);
    }
  }
});

assert('14 — yesterday sober does not auto-mark earlier missed days', () => {
  const d = DataManager.defaults();
  d.attempt = 1;
  d.journeyStartKey = key(2026, 4, 1);
  d.simulatedToday = noon(2026, 4, 1).toISOString();
  d.lastDayCheck = d.simulatedToday;
  Tracker.data = d;

  d.simulatedToday = noon(2026, 4, 2).toISOString();
  d.lastDayCheck = noon(2026, 4, 1).toISOString();
  Tracker._catchUp();
  if (d.journeyStartKey !== key(2026, 4, 1)) {
    throw new Error(`journey start should stay Apr 1, got ${d.journeyStartKey}`);
  }
  if ((d.calendarDay | 0) !== 2) throw new Error(`expected calendar day 2, got ${d.calendarDay}`);
  if (!shouldAskYesterday(d)) throw new Error('day 2 should prompt for yesterday');
  if (d.dailyLog[key(2026, 4, 1)]) throw new Error('day 1 should stay unlogged on day 2');

  d.simulatedToday = noon(2026, 4, 3).toISOString();
  d.lastDayCheck = noon(2026, 4, 2).toISOString();
  Tracker._catchUp();
  Tracker.logYesterday('success');
  const k1 = key(2026, 4, 1);
  const k2 = key(2026, 4, 2);
  if (d.dailyLog[k2] !== 'sober') throw new Error('yesterday (Apr 2) should be sober');
  if (d.dailyLog[k1]) throw new Error(`Apr 1 must stay unlogged, got ${d.dailyLog[k1]}`);
  if (!canRecordCalendarDay(d, k1, noon(2026, 4, 3))) {
    throw new Error('Apr 1 should remain tappable on the calendar');
  }
});

assert('13 — new journey keeps prior dailyLog entries on calendar', () => {
  const d = fresh(2026, 8, 1);
  const oldKey = key(2026, 8, 5);
  applyDayLogStatus(d, oldKey, 'sober');
  d.journeyPendingReset = true;
  d.simulatedToday = noon(2026, 8, 15).toISOString();
  Tracker.data = d;
  Tracker._startNew();
  if (!Tracker.data.dailyLog[oldKey]) throw new Error('prior journey log was removed');
  if (Tracker.data.journeyStartKey <= oldKey) throw new Error('new journey should start after old logs');
  recalculateJourneyScoreFromLog(Tracker.data);
  if (Tracker.data.currentScore.success !== 0) {
    throw new Error('prior sober must not count in new journey score');
  }
});

console.log(failed ? `\n${failed} test(s) failed.\n` : '\nAll unlogged-day model tests passed.\n');
process.exit(failed ? 1 : 0);
