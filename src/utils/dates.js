/* ===== src/utils/dates.js ===== */
'use strict';
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function noonFromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function calendarYesterdayKey(data) {
  const yest = getAppToday(data);
  yest.setDate(yest.getDate() - 1);
  return dateKey(yest);
}


// Test "Next Day" advances simulatedToday; logging/streak use this instead of real clock
function getAppToday(data) {
  if (CONFIG.showTestUI && data && data.simulatedToday) {
    const t = new Date(data.simulatedToday);
    if (!isNaN(t.getTime())) {
      return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12, 0, 0);
    }
  }
  return getRealToday();
}

// Wall-clock today (noon local) — calendar UI never follows the test simulator
function getRealToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0);
}

// Sober days to beat — always the all-time best journey score (never drops)
function getNextJourneyTarget(data) {
  if (!data) return 0;
  ensureScoreNumbers(data);
  return Math.max(0, data.highestScore.success | 0);
}

// Popup copy when a journey ends — score this run + target for the next one
function buildJourneyEndCelebration(d, prevBestSober) {
  ensureScoreNumbers(d);
  const attempt   = d.attempt;
  const thisSober = d.currentScore.success | 0;
  const nextTarget = Math.max(0, d.highestScore.success | 0);
  const isNewBest  = attempt > 1 && thisSober > (prevBestSober | 0);

  const dayWord = (n) => n === 1 ? 'day' : 'days';
  const title = `Journey ${attempt} Complete!`;

  let msg = `Your journey score: ${thisSober} sober ${dayWord(thisSober)}.\n\n`;
  if (isNewBest) {
    msg += `New personal best! Your next target is to beat ${nextTarget} sober ${dayWord(nextTarget)} in your next journey.`;
  } else {
    msg += `Your next target is to beat ${nextTarget} sober ${dayWord(nextTarget)} in your next journey.`;
  }
  msg += '\n\nNew journey starts tomorrow.';

  return { title, msg, nextTarget, isNewBest };
}

// Keep lastDayCheck aligned with app today; preserve simulated timeline in test mode
function syncSessionCheckpoint(d) {
  const appToday = getAppToday(d);
  const noon = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate(), 12, 0, 0);
  d.lastDayCheck = noon.toISOString();
  if (CONFIG.showTestUI) {
    d.simulatedToday = noon.toISOString();
  } else {
    delete d.simulatedToday;
  }
}

// Coerce score fields to integers — string "0" breaks strict failures === 0 checks
function ensureScoreNumbers(d) {
  if (!d) return;
  if (!d.currentScore || typeof d.currentScore !== 'object' || Array.isArray(d.currentScore)) {
    d.currentScore = { success: 0, failures: 0 };
  }
  d.currentScore.success  = Math.max(0, parseInt(d.currentScore.success,  10) || 0);
  d.currentScore.failures = Math.max(0, parseInt(d.currentScore.failures, 10) || 0);
}

// Clear stale session flags when the calendar day no longer matches the log
function normalizeTodaySession(d) {
  if (!d) return;
  const todayKey = dateKey(getAppToday(d));
  const entry = d.dailyLog && d.dailyLog[todayKey];
  if (d.todayStatus === 'success' && entry !== 'sober') {
    d.todayStatus = 'none';
    d.todaySuccessLogged = false;
  }
  if (d.todayStatus === 'failed' && entry !== 'drinking') {
    d.todayStatus = 'none';
  }
}

function journeyDrinkLogKeys(d) {
  const log = d.dailyLog || {};
  const startKey = d.journeyStartKey || null;
  return Object.keys(log)
    .filter(k => log[k] === 'drinking' && (!startKey || k >= startKey))
    .sort();
}

// Score one drinking day into currentScore.failures (Tracker + load reconcile)
function recordDrinkDay(d, key) {
  if (!d) return false;
  ensureScoreNumbers(d);
  if (!d.currentScore) d.currentScore = { success: 0, failures: 0 };
  if (!d.dailyLog) d.dailyLog = {};
  if (!d.scoredDays) d.scoredDays = {};
  if (d.journeyStartKey && key < d.journeyStartKey) return false;

  recalculateStreakFromLog(d);
  const streakBeforeDrink = d.currentStreak | 0;
  d.streakPeakAtRunStart = Math.max(d.longestStreak | 0, streakBeforeDrink);

  if (d.dailyLog[key] === 'drinking' && d.scoredDays[key]) return false;

  if (d.dailyLog[key] === 'sober' && d.scoredDays[key]) {
    d.currentScore.success = Math.max(0, d.currentScore.success - 1);
    d.totalSuccessfulDays  = Math.max(0, d.totalSuccessfulDays - 1);
    delete d.scoredDays[key];
  } else if (d.scoredDays[key]) {
    return false;
  }

  if ((d.currentScore.failures | 0) >= JOURNEY_MAX_FAILURES) return false;

  d.dailyLog[key] = 'drinking';
  d.scoredDays[key] = true;
  d.drinkDayFrozenStreak = streakBeforeDrink;
  d.drinkDayFrozenKey = key;
  d.drinkDayFrozenProgress = getHalfProgressAtTime(new Date());
  d.currentScore.failures++;
  d.totalFailures++;
  d.celebratedStreakMilestones = {};
  d.celebratedScienceMilestones = {};
  applyBestScore(d, d.currentScore);
  ensureScoreNumbers(d);
  return true;
}

// Heal drift on load (product rule A): if dailyLog has more drinks than failures,
// score unscored log entries — user should not fix code bugs mentally.
function reconcileDrinkLogToScore(d) {
  if (!d || !d.dailyLog) return false;
  if (!d.scoredDays) d.scoredDays = {};
  let changed = false;
  for (const key of journeyDrinkLogKeys(d)) {
    if (d.scoredDays[key]) continue;
    if (journeyDrinkLogKeys(d).length <= (d.currentScore.failures | 0)) break;
    if (recordDrinkDay(d, key)) changed = true;
  }
  return changed;
}



// Shorthand for document.getElementById — saves typing
