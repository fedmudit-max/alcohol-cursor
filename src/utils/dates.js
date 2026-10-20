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

function formatCalendarDayLabel(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey || '';
  const dt = noonFromDateKey(dayKey);
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// First calendar day of the current journey (from journey day counter + app today)
function inferJourneyStartFromCalendarDay(data) {
  const appToday = getAppToday(data);
  const cal = Math.max(1, parseInt(data && data.calendarDay, 10) || 1);
  const start = new Date(
    appToday.getFullYear(),
    appToday.getMonth(),
    appToday.getDate() - (cal - 1),
    12, 0, 0
  );
  return dateKey(start);
}

// Keep journey day counter aligned with journeyStartKey and app today (multi-day gaps).
function syncCalendarDayFromJourneyStart(data) {
  if (!data) return;
  const floor = data.journeyStartKey || inferJourneyStartFromCalendarDay(data);
  if (!floor) return;
  const start = noonFromDateKey(floor);
  const today = getAppToday(data);
  const spanDays = Math.max(0, Math.round((today.getTime() - start.getTime()) / MS_PER_DAY));
  data.calendarDay = spanDays + 1;
}

// Older builds could collapse journeyStartKey to “today” and hide missed days — restore span.
function healJourneyStartForMissedDays(data) {
  if (!data || data.journeyPendingReset) return false;
  let changed = false;
  const cal = Math.max(1, parseInt(data.calendarDay, 10) || 1);
  const inferredStart = inferJourneyStartFromCalendarDay(data);
  const todayKey = dateKey(getAppToday(data));

  if (cal > 1) {
    const start = data.journeyStartKey;
    if (!start || start > inferredStart) {
      data.journeyStartKey = inferredStart;
      changed = true;
    }
  }

  // Stale calendarDay=1 but last open was before today — journey still includes those days.
  const lastKey = data.lastDayCheck ? dateKey(new Date(data.lastDayCheck)) : '';
  if (lastKey && lastKey < todayKey) {
    const start = data.journeyStartKey;
    if (!start || start > lastKey) {
      data.journeyStartKey = lastKey;
      changed = true;
    }
  }

  if (changed && typeof syncCalendarDayFromJourneyStart === 'function') {
    syncCalendarDayFromJourneyStart(data);
  }
  return changed;
}

function healOrphanScoredDay(d, dayKey) {
  if (!d || !dayKey) return;
  if (!d.scoredDays) d.scoredDays = {};
  if (d.scoredDays[dayKey] && !d.dailyLog?.[dayKey]) delete d.scoredDays[dayKey];
}

function healAllOrphanScoredDays(d) {
  if (!d?.scoredDays) return;
  const log = d.dailyLog || {};
  for (const k of Object.keys(d.scoredDays)) {
    if (!log[k]) delete d.scoredDays[k];
  }
}

function calendarJourneyFloorKey(d) {
  if (typeof ensureJourneyStartKey === 'function') ensureJourneyStartKey(d);
  if (typeof healJourneyStartForMissedDays === 'function') healJourneyStartForMissedDays(d);
  return d.journeyStartKey || inferJourneyStartFromCalendarDay(d);
}

// Oldest explicit log entry (all journeys) — for calendar history display
function earliestDailyLogKey(data) {
  const log = data?.dailyLog || {};
  let min = null;
  for (const k of Object.keys(log)) {
    if (log[k] !== 'sober' && log[k] !== 'drinking') continue;
    if (!min || k < min) min = k;
  }
  return min;
}

// Earliest month the calendar should allow navigating to (prior journeys stay visible)
function calendarHistoryAnchorKey(data) {
  const journeyFloor = data?.journeyStartKey || inferJourneyStartFromCalendarDay(data);
  const earliest = earliestDailyLogKey(data);
  if (!earliest) return journeyFloor;
  return earliest < journeyFloor ? earliest : journeyFloor;
}

// Shared rules for calendar tap + actually writing the log
function canRecordCalendarDay(data, dayKey, appToday) {
  if (!data || !dayKey || data.journeyPendingReset) return false;
  const todayKey = dateKey(appToday);
  if (dayKey > todayKey) return false;
  // Same rule as main buttons: answer yesterday before logging today
  if (
    dayKey === todayKey &&
    typeof shouldAskYesterday === 'function' &&
    shouldAskYesterday(data)
  ) {
    return false;
  }
  healOrphanScoredDay(data, dayKey);
  const floor = calendarJourneyFloorKey(data);
  if (dayKey < floor) return false;
  return true;
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

// Wall-clock today (noon local)
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

// Keep main buttons in sync with today's dailyLog (e.g. after logging yesterday)
function syncTodaySessionFromLog(d) {
  if (!d) return;
  const todayKey = dateKey(getAppToday(d));
  const scored = d.scoredDays || {};
  const entry = d.dailyLog && d.dailyLog[todayKey];
  if (entry === 'sober' && scored[todayKey]) {
    d.todayStatus = 'success';
    d.todaySuccessLogged = true;
    return;
  }
  if (entry === 'drinking' && scored[todayKey]) {
    d.todayStatus = 'failed';
    d.todaySuccessLogged = false;
  }
}

// Shorthand for document.getElementById — saves typing
