/* ===== src/journey/streak.js ===== */
'use strict';

// Streak engine — consecutive sober days from explicit dailyLog only (gaps = unlogged, break streak)

function isDrinkingDayToday(data) {
  if (!data) return false;
  const todayKey = dateKey(getAppToday(data));
  const log = data.dailyLog || {};
  return log[todayKey] === 'drinking';
}

function isPostDrinkRestartDay(data) {
  if (!data || (data.currentStreak | 0) > 0) return false;
  if (isDrinkingDayToday(data)) return false;
  const today = getAppToday(data);
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12, 0, 0);
  const yestKey = dateKey(yest);
  const todayKey = dateKey(today);
  const log = data.dailyLog || {};
  return log[yestKey] === 'drinking' && log[todayKey] !== 'sober';
}

function inferStreakBeforeTodayDrink(data) {
  if (!data?.dailyLog) return 0;
  const today = getAppToday(data);
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12, 0, 0);
  const startKey = data.journeyStartKey || null;
  let streak = 0;
  while (true) {
    const key = dateKey(cursor);
    if (startKey && key < startKey) break;
    if (data.dailyLog[key] === 'sober') {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getDisplayStreak(data) {
  if (!data) return 0;
  if (isDrinkingDayToday(data)) {
    const todayKey = dateKey(getAppToday(data));
    if (data.drinkDayFrozenKey === todayKey) {
      const frozen = data.drinkDayFrozenStreak | 0;
      if (frozen > 0) return frozen;
    }
    const inferred = inferStreakBeforeTodayDrink(data);
    if (inferred > 0) return inferred;
  }
  return data.currentStreak | 0;
}

function getScienceTimelineStreak(data) {
  if (!data) return 0;
  if (isDrinkingDayToday(data)) return 0;
  return getDisplayStreak(data);
}

function clearDrinkDayFrozenStreak(d) {
  if (!d) return;
  d.drinkDayFrozenStreak = 0;
  d.drinkDayFrozenKey = '';
}

function longestSoberRunInLog(d, fromKey, toKey) {
  if (!d?.dailyLog) return 0;
  const log = d.dailyLog;
  const start = fromKey || toKey;
  const end = toKey || fromKey;
  if (!start || !end) return 0;
  let cursor = noonFromDateKey(start);
  const endDate = noonFromDateKey(end);
  let max = 0;
  let run = 0;
  while (cursor.getTime() <= endDate.getTime()) {
    const k = dateKey(cursor);
    if (log[k] === 'sober') {
      run++;
      if (run > max) max = run;
    } else {
      run = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return max;
}

function longestSoberRunAllTime(d) {
  if (!d?.dailyLog) return 0;
  const keys = Object.keys(d.dailyLog).sort();
  if (!keys.length) return 0;
  const todayKey = dateKey(getAppToday(d));
  const endKey = keys[keys.length - 1] > todayKey ? todayKey : keys[keys.length - 1];
  return longestSoberRunInLog(d, keys[0], endKey);
}

// Current streak: consecutive sober days ending at today if today sober, else ending at yesterday if yesterday sober
function recalculateStreakFromLog(d) {
  if (!d) return 0;
  if (!d.dailyLog) d.dailyLog = {};
  ensureScoreNumbers(d);
  normalizeTodaySession(d);

  const today = getAppToday(d);
  const todayKey = dateKey(today);
  const log = d.dailyLog;

  if (log[todayKey] === 'drinking') {
    d.currentStreak = 0;
    d.inPersonalBest = false;
    const allTime = longestSoberRunAllTime(d);
    d.longestStreak = Math.max(d.longestStreak | 0, allTime);
    return 0;
  }

  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
  if (log[todayKey] !== 'sober') {
    cursor.setDate(cursor.getDate() - 1);
  }

  const startKey = d.journeyStartKey || calendarJourneyFloorKey(d);
  let streak = 0;
  while (true) {
    const key = dateKey(cursor);
    if (startKey && key < startKey) break;
    if (log[key] === 'sober') {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  d.currentStreak = streak;
  const allTime = longestSoberRunAllTime(d);
  d.longestStreak = Math.max(d.longestStreak | 0, allTime, streak);
  d.inPersonalBest = streak > 0 && streak >= (d.longestStreak | 0);
  return streak;
}

function isStreakTabBroken(data) {
  if (!data) return false;
  return isDrinkingDayToday(data) || data.todayStatus === 'failed';
}

function syncStreakTabChrome(data) {
  const streakBtn = document.querySelectorAll('.seg-btn')[0];
  if (streakBtn) streakBtn.classList.toggle('seg-streak-broken', isStreakTabBroken(data));
}

function refreshStreakUI(data) {
  recalculateStreakFromLog(data);
  if (typeof UI !== 'undefined' && UI.renderStreakMilestones) {
    UI.renderStreakMilestones(data);
  }
  syncStreakTabChrome(data);
}

function getNextStreakMilestone(data) {
  const currentStreak = typeof data === 'number' ? data : getDisplayStreak(data);
  return STREAK_MILESTONES.find(m => currentStreak < m.days) || null;
}
