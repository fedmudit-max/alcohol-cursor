/* ===== src/ui/renderAll.js ===== */
'use strict';

// Orchestrates a full UI refresh — implementations live in dashboard / timeline / history-views
UI.renderAll = function(data) {
  if (!data) return;
  try {
    ensureScoreNumbers(data);
    normalizeTodaySession(data);
    DataManager._rebuildScoredDays(data);
    syncTodaySessionFromLog(data);
    recalculateStreakFromLog(data);
    this.renderPrimary(data);
    renderChances(data);
    this.renderStreakMilestones(data);
    renderScienceTimeline(data);
    this.renderButtons(data);
    this.renderJourneyTrophies(data);
    renderMonthGrid(data);
    renderJourneyChart(data);
    renderBestPerformances(data);
    renderLifetimeStats(data);
    renderPremiumLocks(data);
    renderRemindersTab(data);
    if (typeof TenDrinksReminderNative !== 'undefined' && TenDrinksReminderNative.syncLoggedDate) {
      TenDrinksReminderNative.syncLoggedDate(data);
    }
    if (typeof MeterController !== 'undefined') {
      if (MeterController.syncHeaderTeaser) MeterController.syncHeaderTeaser(data);
      if (MeterController.syncFromData) MeterController.syncFromData(data);
    }
  } catch (err) {
    console.error('[10Drinks] renderAll failed:', err);
  }
  // Note: MeterController.updateFromJourney is NOT called here.
  // AUDIT-C score only changes when user takes the test — not on daily logging.
  // updateFromJourney is called directly from AuditOnboarding._save() instead.
};
