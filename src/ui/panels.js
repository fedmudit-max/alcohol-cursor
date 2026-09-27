/* ===== src/ui/panels.js ===== */
'use strict';

// Collapsible panel toggles + calendar/chart nav (load after journey.js + history-views.js)

Tracker.toggleMonthGrid = function() {
  const body = el('monthGridBody');
  const btn  = el('monthGridToggleBtn');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? 'Show \u25be' : 'Hide \u25b4';
};

Tracker.calendarPrev = function() {
  const data = Tracker.data || DataManager.load();
  const appToday = getAppToday(data);
  let y = _calYear ?? appToday.getFullYear();
  let m = (_calMonth ?? appToday.getMonth()) - 1;
  if (m < 0) { m = 11; y--; }
  renderMonthGrid(data, y, m);
};

Tracker.calendarNext = function() {
  const data = Tracker.data || DataManager.load();
  const appToday = getAppToday(data);
  let y = _calYear ?? appToday.getFullYear();
  let m = (_calMonth ?? appToday.getMonth()) + 1;
  if (m > 11) { m = 0; y++; }
  if (y > appToday.getFullYear() || (y === appToday.getFullYear() && m > appToday.getMonth())) return;
  renderMonthGrid(data, y, m);
};

Tracker.toggleJourneyChart = function() {
  const body     = el('journeyChartBody');
  const btn      = el('journeyChartToggleBtn');
  const subLabel = el('journeyChartSubLabel');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (btn)      btn.textContent        = open ? 'Show ▾' : 'Hide ▴';
  if (subLabel) subLabel.style.display = open ? 'none' : 'block';
  // Re-render chart when opening — SVG won't draw correctly in display:none
  if (!open) renderJourneyChart(Tracker.data || DataManager.load());
};

Tracker.journeyChartOlder = function() {
  _journeyChartOffset++;
  renderJourneyChart(Tracker.data);
};

Tracker.journeyChartNewer = function() {
  _journeyChartOffset = Math.max(0, _journeyChartOffset - 1);
  renderJourneyChart(Tracker.data);
};

Tracker.toggleLifetimeStats = function() {
  const body = el('lifetimeStatsBody');
  const btn  = el('lifetimeStatsToggleBtn');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? 'Show \u25be' : 'Hide \u25b4';
};

Tracker.toggleBestPerformances = function() {
  const body = el('bestPerformancesBody');
  const btn  = el('bestPerformancesToggleBtn');
  const header = el('bestPerformancesPanelToggle');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? 'Show \u25be' : 'Hide \u25b4';
  if (header) header.setAttribute('aria-expanded', open ? 'false' : 'true');
  if (!open) renderBestPerformances(this.data || DataManager.load());
};

Tracker.toggleReminderPanel = function() {
  // Reminder lives in Settings sheet (always visible when settings is open).
  this.openSettings();
};

Tracker._setRiskMeterOpen = function(open) {
  const body = el('riskMeterBody');
  const btn = el('riskMeterToggleBtn');
  const header = el('riskMeterToggle');
  if (!body) return;
  body.style.display = open ? 'block' : 'none';
  if (btn) btn.textContent = open ? 'Hide \u25b4' : 'Show \u25be';
  if (header) header.setAttribute('aria-expanded', open ? 'true' : 'false');
};

Tracker.toggleRiskMeter = function() {
  const body = el('riskMeterBody');
  if (!body) return;
  const open = body.style.display !== 'none';
  this._setRiskMeterOpen(!open);
  if (!open) {
    if (typeof MeterController !== 'undefined') {
      if (!MeterController.initialized) MeterController.init();
      const data = this.data || DataManager.load();
      if (data && data.auditQ1 != null && data.auditQ2 != null && data.auditQ3 != null) {
        MeterController.updateFromJourney(data);
      }
    }
  }
};

Tracker.expandRiskMeter = function() {
  this._setRiskMeterOpen(true);
};

Tracker.toggleSettings = function() {
  const overlay = el('appSettingsOverlay');
  if (overlay && overlay.classList.contains('active')) this.closeSettings();
  else this.openSettings();
};

Tracker.openSettings = function() {
  const overlay = el('appSettingsOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  document.body.classList.add('settings-open');
  if (typeof renderBackupStatus === 'function') renderBackupStatus();
  if (typeof renderPremiumEntry === 'function') renderPremiumEntry();
  const data = this.data || (typeof DataManager !== 'undefined' ? DataManager.load() : null);
  if (data && typeof renderRemindersTab === 'function') renderRemindersTab(data);
};

Tracker.closeSettings = function() {
  const overlay = el('appSettingsOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  document.body.classList.remove('settings-open');
};

Tracker.openTenDrinksGuideFromSettings = function() {
  this.closeSettings();
  this.openTenDrinksGuide();
};

Tracker.openPrivacyPolicy = function() {
  const overlay = el('privacyPolicyOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
};

Tracker.closePrivacyPolicy = function() {
  const overlay = el('privacyPolicyOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  if (!el('appSettingsOverlay')?.classList.contains('active')
    && !el('tenDrinksGuideModal')?.classList.contains('open')) {
    document.body.classList.remove('modal-open');
  }
};

Tracker.openTenDrinksGuide = function() {
  const m = el('tenDrinksGuideModal');
  if (m) {
    m.classList.add('open');
    document.body.classList.add('modal-open');
  }
};

Tracker.closeTenDrinksGuide = function() {
  const m = el('tenDrinksGuideModal');
  if (m) {
    m.classList.remove('open');
    document.body.classList.remove('modal-open');
  }
};
