/* ===== src/journey/catchup.js ===== */
'use strict';

// Missed-day catch-up: ask about yesterday (no auto-logging missed days), test helpers

function shouldAskYesterday(data) {
  if (!data || data.journeyPendingReset) return false;
  if (!data.scoredDays) data.scoredDays = {};
  const yestKey = calendarYesterdayKey(data);
  const startKey = data.journeyStartKey;
  if (startKey && yestKey < startKey) return false;
  const log = data.dailyLog || {};
  return !log[yestKey];
}

// Catch-up opens today fresh; logging today before answering yesterday double-counts (2–0).
function unwindTodayIfYesterdayPending(d) {
  if (!d || !shouldAskYesterday(d)) return false;
  if (!d.dailyLog) d.dailyLog = {};
  if (!d.scoredDays) d.scoredDays = {};
  const todayKey = dateKey(getAppToday(d));
  const yestKey = calendarYesterdayKey(d);
  if (todayKey === yestKey) return false;
  if (shouldAskYesterday(d) && d.dailyLog[todayKey] === 'sober') {
    delete d.dailyLog[todayKey];
    d.todayStatus = 'none';
    d.todaySuccessLogged = false;
    recalculateJourneyScoreFromLog(d);
    recalculateLifetimeTotalsFromLog(d);
    recalculateStreakFromLog(d);
    return true;
  }
  return false;
}

function showYesterdayModal() {
  const d = typeof Tracker !== 'undefined' ? Tracker.data : null;
  if (d && unwindTodayIfYesterdayPending(d)) {
    DataManager.saveNow(d);
    recalculateStreakFromLog(d);
    refreshStreakUI(d);
    UI.renderAll(d);
  }
  const ym = el('yesterdayModal');
  if (!ym) return;
  // Celebrations must wait — they steal the same z-index layer if shown first
  const cm = el('celebrationModal');
  if (cm) cm.classList.remove('active');
  if (typeof Tracker !== 'undefined') Tracker._celebrating = false;
  if (typeof openAppModal === 'function') openAppModal(ym);
  else ym.classList.add('active');
}

function promptYesterdayIfNeeded(data, delayMs = 400) {
  if (!shouldAskYesterday(data)) return;
  setTimeout(() => {
    if (!shouldAskYesterday(data)) return;
    const ob = el('onboardingOverlay');
    if (ob && ob.style.display === 'flex') {
      promptYesterdayIfNeeded(data, 500);
      return;
    }
    showYesterdayModal();
  }, delayMs);
}

// Dev-only catch-up trace (visible when CONFIG.showTestUI is true)
function catchUpLog(label, detail) {
  if (!CONFIG.showTestUI) return;
  console.log('[10Drinks catch-up]', label, detail || '');
}

// --- CATCHUP ---
// User returns after n calendar days (daysSince(lastOpen → today) === n):
//   • Missed days stay unlogged (no auto-sober)
//   • Day (today − 1) = yesterday → popup ask (never auto-log)
//   • Today → left open for the user to log
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

  // Land on today — never auto-log yesterday; ask the user instead
  this.data.calendarDay++;
  this.data.todayStatus = 'none';
  this.data.todaySuccessLogged = false;
  clearDrinkDayFrozenStreak(this.data);
  if (!this.data.dailyLog) this.data.dailyLog = {};

  if (!this.data.scoredDays) this.data.scoredDays = {};
  const askYesterday = shouldAskYesterday(this.data);

  this.data.lastDayCheck = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate(), 12, 0, 0).toISOString();
  if (!CONFIG.showTestUI) delete this.data.simulatedToday;

  DataManager._rebuildScoredDays(this.data);

  DataManager.saveNow(this.data);
  recalculateStreakFromLog(this.data);
  refreshStreakUI(this.data);
  UI.renderAll(this.data);
  catchUpLog('done', {
    build: CONFIG.buildTag,
    scoreAfter: this.data.currentScore.success,
    currentStreak: this.data.currentStreak,
    dailyLog: Object.keys(this.data.dailyLog || {}).sort(),
    askYesterday,
    yesterdayKey: calendarYesterdayKey(this.data),
  });

  // Always prefer the yesterday prompt over milestone celebrations after a gap
  if (askYesterday) {
    promptYesterdayIfNeeded(this.data, 200);
  }
};

window.SJ_testCatchUp = function(gapDays) {
  gapDays = gapDays || 3;
  const d = Tracker.data || DataManager.load();

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
    scoreAfter: d.currentScore.success,
  });
  showToast(`3-day gap #${d.gapSimCount}: ${dateKey(newToday)} · log yesterday`);

  // Show yesterday prompt first (before deferred celebrations)
  setTimeout(() => showYesterdayModal(), 100);
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
