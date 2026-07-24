/* ===== src/journey/streak.js ===== */
'use strict';

// Streak engine — consecutive sober days from dailyLog (single source of truth)

function isDrinkingDayToday(data) {
  if (!data) return false;
  const todayKey = dateKey(getAppToday(data));
  const log = data.dailyLog || {};
  const scored = data.scoredDays || {};
  return log[todayKey] === 'drinking' && !!scored[todayKey];
}

// First calendar day after a logged drink — Day 1 copy before sober is logged
function isPostDrinkRestartDay(data) {
  if (!data || (data.currentStreak | 0) > 0) return false;
  if (isDrinkingDayToday(data)) return false;
  const today = getAppToday(data);
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12, 0, 0);
  const yestKey = dateKey(yest);
  const todayKey = dateKey(today);
  const log = data.dailyLog || {};
  const scored = data.scoredDays || {};
  return log[yestKey] === 'drinking' && log[todayKey] !== 'sober';
}

function inferStreakBeforeTodayDrink(data) {
  if (!data?.dailyLog || !data.scoredDays) return 0;
  const today = getAppToday(data);
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12, 0, 0);
  const startKey = data.journeyStartKey || null;
  let streak = 0;
  while (true) {
    const key = dateKey(cursor);
    if (startKey && key < startKey) break;
    const entry = data.dailyLog[key];
    if (entry === 'sober' && data.scoredDays[key]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Achieved streak shown in UI — frozen on the drinking day, resets next calendar day
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

function clearDrinkDayFrozenStreak(d) {
  if (!d) return;
  d.drinkDayFrozenStreak = 0;
  d.drinkDayFrozenKey = '';
  d.drinkDayFrozenProgress = 0;
}

// Rebuild consecutive sober-day streak from dailyLog (single source of truth for streak + body timeline)
function recalculateStreakFromLog(d) {
  if (!d) return 0;
  if (!d.dailyLog) d.dailyLog = {};
  ensureScoreNumbers(d);
  normalizeTodaySession(d);

  const today    = getAppToday(d);
  const todayKey = dateKey(today);
  const todayEntry = d.dailyLog[todayKey];
  const scored   = d.scoredDays || {};

  if (todayEntry === 'drinking' && scored[todayKey]) {
    d.currentStreak  = 0;
    d.inPersonalBest = false;
    return 0;
  }

  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);

  if (todayEntry === 'sober') {
    // Count backward from today
  } else {
    const yest = new Date(cursor);
    yest.setDate(yest.getDate() - 1);
    const yestKey = dateKey(yest);
    const yestEntry = d.dailyLog[yestKey];

    if (yestEntry === 'drinking') {
      const sk = d.journeyStartKey || null;
      if (!sk || yestKey >= sk) {
        d.currentStreak  = 0;
        d.inPersonalBest = false;
        return 0;
      }
    }

    if (yestEntry === 'sober') {
      const startKeyEarly = d.journeyStartKey || null;
      if (!scored[yestKey] && startKeyEarly && yestKey < startKeyEarly) {
        d.currentStreak  = 0;
        d.inPersonalBest = false;
        return 0;
      }
      cursor = yest;
    } else {
      // Yesterday not logged yet (catch-up modal pending) — count auto-sober run before it
      cursor.setDate(cursor.getDate() - 2);
    }
  }

  let streak = 0;
  const yestKey = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12, 0, 0));
  const startKey = d.journeyStartKey || null;

  while (true) {
    const key = dateKey(cursor);
    if (startKey && key < startKey) break;

    const entry = d.dailyLog[key];

    if (entry === 'sober') {
      if (startKey && key < startKey) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (entry === 'drinking' && scored[key]) {
      break;
    } else if (entry === 'drinking' && startKey && key >= startKey) {
      break;
    } else if (entry === undefined && key === yestKey) {
      // Yesterday not logged yet (catch-up modal) — keep counting earlier sober days
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  d.currentStreak = streak;
  if (streak > d.longestStreak) {
    d.longestStreak  = streak;
    d.inPersonalBest = true;
  } else {
    d.inPersonalBest = streak > 0 && streak >= d.longestStreak;
  }
  return streak;
}

function refreshStreakUI(data) {
  recalculateStreakFromLog(data);
  syncBodyTimelineWeekHold(data);
  if (typeof UI !== 'undefined' && UI.renderStreakMilestones) {
    UI.renderStreakMilestones(data);
  }
  renderBodyTimeline(data);
  renderScienceTimeline(getDisplayStreak(data));
}


// Returns the next unachieved streak milestone, or null if all done
function getNextStreakMilestone(currentStreak) {
  return STREAK_MILESTONES.find(m => currentStreak < m.days) || null;
}

function isStreakBroken(data) {
  if (!data || !data.currentScore) return false;
  ensureScoreNumbers(data);
  if ((data.currentStreak | 0) > 0) return false;
  if ((data.currentScore.success | 0) === 0) return false;
  const log = data.dailyLog || {};
  const scored = data.scoredDays || {};
  const todayKey = dateKey(getAppToday(data));
  return log[todayKey] === 'drinking' && !!scored[todayKey];
}
