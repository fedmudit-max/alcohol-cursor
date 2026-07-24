/* ===== src/journey/catchup.js ===== */
'use strict';

// Missed-day catch-up: auto-sober older gaps, ask about yesterday, test helpers

function shouldAskYesterday(data) {
  if (!data || data.journeyPendingReset) return false;
  if (!data.scoredDays) data.scoredDays = {};
  const yestKey = calendarYesterdayKey(data);
  const startKey = data.journeyStartKey;
  if (startKey && yestKey < startKey) return false;
  return !data.scoredDays[yestKey];
}

function promptYesterdayIfNeeded(data, delayMs = 1000) {
  if (!shouldAskYesterday(data)) return;
  setTimeout(() => el('yesterdayModal').classList.add('active'), delayMs);
}

// Dev-only catch-up trace (visible when CONFIG.showTestUI is true)
function catchUpLog(label, detail) {
  if (!CONFIG.showTestUI) return;
  console.log('[SoberJourney catch-up]', label, detail || '');
}

// --- CATCHUP ---
// Checks if days have passed since last open and advances accordingly.
// Rule: older missed days → auto-sober; calendar yesterday → always ask if not logged.
Tracker._catchUp = function() {
  if (!this.data) this.data = DataManager.load();
  const appToday = getAppToday(this.data);
  const days = daysSince(this.data.lastDayCheck, appToday);
  const scoreBefore = this.data.currentScore ? this.data.currentScore.success : 0;

  catchUpLog('start', {
    days,
    lastDayCheck: this.data.lastDayCheck,
    todayStatus: this.data.todayStatus,
    scoreBefore,
    logKeys: Object.keys(this.data.dailyLog || {}),
  });

  // Clock set back or same day — re-ask yesterday if still unscored
  if (days <= 0) {
    catchUpLog('skip', days === 0 ? 'same day — use Simulate 3-Day Gap to test' : 'clock set back');
    if (days < 0) {
      this.data.lastDayCheck = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate(), 12, 0, 0).toISOString();
      DataManager.saveNow(this.data);
    }
    recalculateStreakFromLog(this.data);
    promptYesterdayIfNeeded(this.data);
    return;
  }

  // Journey ended — start fresh; do not advance calendar or ask about pre-journey days
  if (days > 0 && this.data.journeyPendingReset) {
    this._startNew();
    DataManager.saveNow(this.data);
    UI.renderAll(this.data);
    return;
  }

  this._autoSoberMissedDaysBeforeYesterday(this.data, days);

  if (this.data.journeyPendingReset) {
    DataManager.saveNow(this.data);
    UI.renderAll(this.data);
    return;
  }

  // Advance to today — never auto-log yesterday; ask the user instead
  this.data.calendarDay++;
  this.data.todayStatus = 'none';
  this.data.todaySuccessLogged = false;
  clearDrinkDayFrozenStreak(this.data);
  if (!this.data.dailyLog) this.data.dailyLog = {};

  const yestKey = calendarYesterdayKey(this.data);
  if (!this.data.scoredDays) this.data.scoredDays = {};
  const askYesterday = shouldAskYesterday(this.data);

  this.data.lastDayCheck = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate(), 12, 0, 0).toISOString();
  if (!CONFIG.showTestUI) delete this.data.simulatedToday;

  DataManager._rebuildScoredDays(this.data);

  const added = this.data.currentScore.success - scoreBefore;
  DataManager.saveNow(this.data);
  recalculateStreakFromLog(this.data);
  refreshStreakUI(this.data);
  UI.renderAll(this.data);
  catchUpLog('done', {
    build: CONFIG.buildTag,
    scoreAfter: this.data.currentScore.success,
    currentStreak: this.data.currentStreak,
    autoSoberAdded: added,
    dailyLog: Object.keys(this.data.dailyLog || {}).sort(),
    askYesterday,
  });
  if (CONFIG.showTestUI && added > 0) {
    showToast(`Catch-up: +${added} sober · ${this.data.currentStreak | 0} day streak`);
  }

  if (askYesterday) {
    promptYesterdayIfNeeded(this.data);
  }
};

// Auto-sober every unlogged calendar day from lastDayCheck up to (not including) yesterday.
Tracker._autoSoberMissedDaysBeforeYesterday = function(d, days) {
  if (!d.dailyLog) d.dailyLog = {};
  if (!d.scoredDays) d.scoredDays = {};
  this._ensureScore(d);
  if (d.journeyPendingReset) return;

  const appToday = getAppToday(d);
  const yesterday = new Date(appToday);
  yesterday.setDate(yesterday.getDate() - 1);
  const yestNoon = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 12, 0, 0);

  const lastOpen = new Date(d.lastDayCheck);
  let cursorStart = new Date(lastOpen.getFullYear(), lastOpen.getMonth(), lastOpen.getDate(), 12, 0, 0);
  if (days > CATCHUP_MAX_DAYS) {
    const capped = new Date(appToday);
    capped.setDate(capped.getDate() - CATCHUP_MAX_DAYS);
    const cappedNoon = new Date(capped.getFullYear(), capped.getMonth(), capped.getDate(), 12, 0, 0);
    if (cappedNoon.getTime() > cursorStart.getTime()) cursorStart = cappedNoon;
  }
  // Include orphaned days before calendar yesterday (e.g. skipped yesterday prompt last session)
  if (d.journeyStartKey) {
    let probe = noonFromDateKey(d.journeyStartKey);
    while (probe.getTime() < yestNoon.getTime()) {
      if (!d.scoredDays[dateKey(probe)] && probe.getTime() < cursorStart.getTime()) {
        cursorStart = new Date(probe.getTime());
      }
      probe.setDate(probe.getDate() + 1);
    }
  }
  let cursor = cursorStart;

  while (cursor.getTime() < yestNoon.getTime()) {
    if (d.journeyPendingReset) break;

    const key = dateKey(cursor);
    if (d.journeyStartKey && key < d.journeyStartKey) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }
    this._processMissedCatchUpDay(d, key);

    if (d.currentScore.failures >= JOURNEY_MAX_FAILURES) { this._endJourney(); return; }

    d.calendarDay++;
    cursor.setDate(cursor.getDate() + 1);
    d.todayStatus = 'none';
    d.todaySuccessLogged = false;
  }
  recalculateStreakFromLog(d);
};

// Auto-sober missed days before yesterday. Pre-logged drinks must score via _recordDrinkDay, not a silent flag.
Tracker._processMissedCatchUpDay = function(d, key) {
  if (d.scoredDays[key]) return;
  if (d.dailyLog[key] === 'drinking') {
    if (journeyDrinkLogKeys(d).length > (d.currentScore.failures | 0)) {
      this._recordDrinkDay(d, key);
    }
    return;
  }
  if (this._recordSoberDay(d, key)) {
    this._checkTrophies();
    this._checkJourneyTargets();
  }
};

window.SJ_testCatchUp = function(gapDays) {
  gapDays = gapDays || 3;
  const d = Tracker.data || DataManager.load();
  const scoreBefore = d.currentScore ? d.currentScore.success : 0;

  const prevAppToday = getAppToday(d);
  const newToday = new Date(prevAppToday);
  // 2nd+ click: move simulated timeline forward so new sober days are added (not reset)
  if ((d.gapSimCount || 0) > 0) {
    newToday.setDate(newToday.getDate() + gapDays);
  } else if (d.journeyStartKey && dateKey(newToday) <= d.journeyStartKey) {
    // First gap on a new journey start day — jump forward so days count in this journey
    newToday.setDate(newToday.getDate() + gapDays);
  }
  d.gapSimCount = (d.gapSimCount || 0) + 1;
  newToday.setHours(12, 0, 0, 0);
  d.simulatedToday = newToday.toISOString();

  // Connect timeline: if previous gap's yesterday was never answered, auto-sober it
  if (d.gapSimCount > 1) {
    const prevYest = new Date(prevAppToday);
    prevYest.setDate(prevYest.getDate() - 1);
    const pk = dateKey(prevYest);
    if (d.dailyLog[pk] !== 'drinking' && !d.scoredDays[pk]) {
      if (Tracker._recordSoberDay(d, pk)) {
        Tracker._checkTrophies();
        Tracker._checkJourneyTargets();
      }
    }
  }

  const yest = new Date(newToday);
  yest.setDate(yest.getDate() - 1);
  const yestKey = dateKey(yest);
  const yestNoon = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 12, 0, 0);
  const todayKey = dateKey(newToday);

  const rewindTo = new Date(newToday);
  rewindTo.setDate(rewindTo.getDate() - gapDays);
  rewindTo.setHours(12, 0, 0, 0);
  d.lastDayCheck = rewindTo.toISOString();

  if (d.journeyStartKey) {
    const [y, m, day] = d.journeyStartKey.split('-').map(Number);
    const startNoon = new Date(y, m - 1, day, 12, 0, 0);
    if (rewindTo.getTime() < startNoon.getTime()) {
      rewindTo.setTime(startNoon.getTime());
      d.lastDayCheck = rewindTo.toISOString();
    }
  }

  if (!d.dailyLog) d.dailyLog = {};
  if (!d.scoredDays) d.scoredDays = {};

  // Clear only yesterday on the NEW timeline (for modal) — never wipe older log
  if (d.dailyLog[yestKey] !== 'drinking') {
    if (d.dailyLog[yestKey] === 'sober' && d.scoredDays[yestKey]) {
      d.currentScore.success = Math.max(0, d.currentScore.success - 1);
      d.totalSuccessfulDays = Math.max(0, (d.totalSuccessfulDays || 0) - 1);
    }
    delete d.dailyLog[yestKey];
    delete d.scoredDays[yestKey];
  }

  // Clear new "today" session only
  if (d.dailyLog[todayKey] === 'sober' && d.scoredDays[todayKey]) {
    d.currentScore.success = Math.max(0, d.currentScore.success - 1);
    d.totalSuccessfulDays = Math.max(0, (d.totalSuccessfulDays || 0) - 1);
  }
  delete d.dailyLog[todayKey];
  delete d.scoredDays[todayKey];
  d.todayStatus = 'none';
  d.todaySuccessLogged = false;

  // Add auto-sober for missed days before yesterday (only days not already logged)
  let autoAdded = 0;
  let cursor = new Date(rewindTo.getFullYear(), rewindTo.getMonth(), rewindTo.getDate(), 12, 0, 0);
  while (cursor.getTime() < yestNoon.getTime()) {
    const key = dateKey(cursor);
    if (d.journeyStartKey && key < d.journeyStartKey) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }
    if (d.dailyLog[key] !== 'drinking' && Tracker._recordSoberDay(d, key)) {
      autoAdded++;
      Tracker._checkTrophies();
      Tracker._checkJourneyTargets();
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  d.calendarDay = (parseInt(d.calendarDay, 10) || 1) + gapDays;
  d.lastDayCheck = newToday.toISOString();

  DataManager._rebuildScoredDays(d);
  recalculateStreakFromLog(d);
  DataManager.saveNow(d);
  Tracker.data = d;
  refreshStreakUI(d);
  UI.renderAll(d);

  catchUpLog('testGap', {
    gapSimCount: d.gapSimCount,
    appToday: dateKey(newToday),
    autoAdded,
    scoreAfter: d.currentScore.success,
  });
  showToast(`3-day gap #${d.gapSimCount}: +${autoAdded} sober · ${dateKey(newToday)} · yesterday +1 more`);

  setTimeout(() => el('yesterdayModal').classList.add('active'), 800);
};

// Rewind from current app day so Simulate 3-Day Gap works anytime (incl. after Next Day)
window.SJ_rewindCatchUpWindow = function(d, gapDays) {
  gapDays = gapDays || 3;
  const appToday = getAppToday(d);
  const yesterday = new Date(appToday);
  yesterday.setDate(yesterday.getDate() - 1);
  const yestNoon = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 12, 0, 0);

  const rewindTo = new Date(appToday);
  rewindTo.setDate(rewindTo.getDate() - gapDays);
  rewindTo.setHours(12, 0, 0, 0);

  if (!d.dailyLog) d.dailyLog = {};
  if (!d.scoredDays) d.scoredDays = {};
  if (!d.currentScore) d.currentScore = { success: 0, failures: 0 };

  let calendarDrop = 0;
  let cursor = new Date(rewindTo.getFullYear(), rewindTo.getMonth(), rewindTo.getDate(), 12, 0, 0);
  while (cursor.getTime() < yestNoon.getTime()) {
    const key = dateKey(cursor);
    if (d.dailyLog[key] !== 'drinking') {
      if (d.scoredDays[key]) {
        delete d.scoredDays[key];
        if (d.currentScore.success > 0) d.currentScore.success--;
        if (d.totalSuccessfulDays > 0) d.totalSuccessfulDays--;
        calendarDrop++;
      }
      delete d.dailyLog[key];
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const yestKey = dateKey(yesterday);
  if (d.dailyLog[yestKey] !== 'drinking') {
    if (d.scoredDays[yestKey]) {
      delete d.scoredDays[yestKey];
      if (d.currentScore.success > 0) d.currentScore.success--;
      if (d.totalSuccessfulDays > 0) d.totalSuccessfulDays--;
      calendarDrop++;
    }
    delete d.dailyLog[yestKey];
  }

  d.calendarDay = Math.max(1, (parseInt(d.calendarDay, 10) || 1) - calendarDrop);
  d.currentStreak = 0;
  d.inPersonalBest = false;
  d.lastDayCheck = rewindTo.toISOString();
  d.todayStatus = 'none';
  d.todaySuccessLogged = false;
  d.journeyPendingReset = false;
  if (CONFIG.showTestUI) {
    d.simulatedToday = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate(), 12, 0, 0).toISOString();
  }
  DataManager._rebuildScoredDays(d);
  DataManager._updateBestFromData(d);
  return d;
};
