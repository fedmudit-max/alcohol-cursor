/* ===== src/dev/calendar-day-advance.js ===== */
'use strict';

/**
 * Dev-only: advance one in-app calendar day (simulatedToday + calendarDay).
 * Loaded only from repo index.html — omitted from release dist/.
 * Does not change the 15-day install trial clock.
 */
(function () {
  function installCalendarDayAdvance() {
    if (typeof Tracker === 'undefined') return false;
    if (Tracker.autoAdvanceDay) return true;

    Tracker.autoAdvanceDay = function autoAdvanceDay(batchMode = false) {
      if (typeof isSimulatedDayEnabled === 'function' && !isSimulatedDayEnabled()) return;
      const d = this.data;
      if (!d) return;
      if (!d.dailyLog) d.dailyLog = {};

      if (d.journeyPendingReset) {
        const appToday = getAppToday(d);
        const nextDay = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate() + 1, 12, 0, 0);
        d.simulatedToday = nextDay.toISOString();
        this._startNew();
        if (!batchMode) {
          DataManager.saveNow(d);
          refreshStreakUI(d);
          UI.renderAll(d);
          showToast(`Journey ${d.attempt} · Day 1 · ${dateKey(getAppToday(d))}`);
        }
        return;
      }

      if (d.currentScore.failures >= JOURNEY_MAX_FAILURES) {
        this._endJourney();
        return;
      }

      const appToday = getAppToday(d);
      const nextDay = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate() + 1, 12, 0, 0);
      d.simulatedToday = nextDay.toISOString();
      d.lastDayCheck = nextDay.toISOString();
      d.calendarDay++;
      d.todayStatus = 'none';
      d.todaySuccessLogged = false;
      clearDrinkDayFrozenStreak(d);

      DataManager._rebuildScoredDays(d);
      recalculateStreakFromLog(d);
      if (!batchMode) {
        DataManager.saveNow(d);
        refreshStreakUI(d);
        if (typeof UI !== 'undefined' && UI.renderAll) UI.renderAll(d);
        if (typeof refreshEntitlementIfChanged === 'function') refreshEntitlementIfChanged(d);
        showToast(`Calendar day: ${dateKey(nextDay)} — log sober or drink below`);
        promptYesterdayIfNeeded(d, 300);
      }
    };
    return true;
  }

  window.installCalendarDayAdvance = installCalendarDayAdvance;
})();
