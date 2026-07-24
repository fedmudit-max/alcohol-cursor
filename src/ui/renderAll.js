/* ===== src/ui/renderAll.js ===== */
'use strict';

// Orchestrates a full UI refresh — implementations live in dashboard / timeline / history-views
UI.renderAll = function(data) {
  ensureScoreNumbers(data);
  normalizeTodaySession(data);
  DataManager._rebuildScoredDays(data);
  recalculateStreakFromLog(data);
  this.renderPrimary(data);
  this.renderStreakMilestones(data);
  renderBodyTimeline(data);
  renderScienceTimeline(getDisplayStreak(data));
  this.renderButtons(data);
  this.renderJourneyTrophies(data);
  renderMonthGrid(data);
  renderJourneyChart(data);
  renderJourneyEndCard(data);
  renderLifetimeStats(data);
  renderPremiumLocks(data);
  // Note: MeterController.updateFromJourney is NOT called here.
  // AUDIT-C score only changes when user takes the test — not on daily logging.
  // updateFromJourney is called directly from AuditOnboarding._save() instead.
};
