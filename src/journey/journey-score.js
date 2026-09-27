/* ===== src/journey/journey-score.js ===== */
'use strict';

// Journey score + scoredDays derived only from explicit dailyLog entries (Unlogged ≠ Sober).

function journeyLogKeysInRange(d) {
  const log = d.dailyLog || {};
  const startKey = calendarJourneyFloorKey(d);
  return Object.keys(log)
    .filter(k => k >= startKey)
    .sort();
}

function recalculateJourneyScoreFromLog(d) {
  if (!d) return;
  ensureScoreNumbers(d);
  if (!d.dailyLog) d.dailyLog = {};
  const startKey = calendarJourneyFloorKey(d);
  const scored = {};
  let success = 0;
  let failures = 0;
  for (const k of journeyLogKeysInRange(d)) {
    const entry = d.dailyLog[k];
    if (entry === 'sober') {
      success++;
      scored[k] = true;
    } else if (entry === 'drinking') {
      failures++;
      scored[k] = true;
    }
  }
  d.currentScore = { success, failures };
  d.scoredDays = scored;
  applyBestScore(d, d.currentScore);
  ensureScoreNumbers(d);
}

function recalculateLifetimeTotalsFromLog(d) {
  if (!d || !d.dailyLog) return;
  let sober = 0;
  let drink = 0;
  for (const k of Object.keys(d.dailyLog)) {
    if (d.dailyLog[k] === 'sober') sober++;
    else if (d.dailyLog[k] === 'drinking') drink++;
  }
  d.totalSuccessfulDays = sober;
  d.totalFailures = drink;
}

function applyDayLogStatus(d, key, status) {
  if (!d || !key || (status !== 'sober' && status !== 'drinking')) return false;
  ensureScoreNumbers(d);
  if (!d.dailyLog) d.dailyLog = {};
  if (typeof ensureJourneyStartKey === 'function') ensureJourneyStartKey(d);
  healOrphanScoredDay(d, key);
  const floor = calendarJourneyFloorKey(d);
  if (key < floor) return false;

  const prev = d.dailyLog[key];
  if (prev === status) return false;

  if (status === 'drinking') {
    recalculateStreakFromLog(d);
    const streakBefore = d.currentStreak | 0;
    d.streakPeakAtRunStart = Math.max(d.longestStreak | 0, streakBefore);
    d.drinkDayFrozenStreak = streakBefore;
    d.drinkDayFrozenKey = key;
    d.celebratedStreakMilestones = {};
    d.celebratedScienceMilestones = {};
  }

  d.dailyLog[key] = status;
  recalculateJourneyScoreFromLog(d);
  recalculateLifetimeTotalsFromLog(d);

  if ((d.currentScore.failures | 0) > JOURNEY_MAX_FAILURES) {
    if (prev === undefined || prev === null) delete d.dailyLog[key];
    else d.dailyLog[key] = prev;
    recalculateJourneyScoreFromLog(d);
    recalculateLifetimeTotalsFromLog(d);
    return false;
  }

  recalculateStreakFromLog(d);
  applyBestScore(d, d.currentScore);
  return true;
}

function reconcileLogsToJourneyScore(d) {
  if (!d) return false;
  const before = `${d.currentScore?.success}|${d.currentScore?.failures}`;
  recalculateJourneyScoreFromLog(d);
  recalculateLifetimeTotalsFromLog(d);
  const after = `${d.currentScore?.success}|${d.currentScore?.failures}`;
  return before !== after;
}
