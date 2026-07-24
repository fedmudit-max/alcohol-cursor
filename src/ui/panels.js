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
  const today = getRealToday();
  let y = _calYear ?? today.getFullYear();
  let m = (_calMonth ?? today.getMonth()) - 1;
  if (m < 0) { m = 11; y--; }
  renderMonthGrid(data, y, m);
};

Tracker.calendarNext = function() {
  const data = Tracker.data || DataManager.load();
  const today = getRealToday();
  let y = _calYear ?? today.getFullYear();
  let m = (_calMonth ?? today.getMonth()) + 1;
  if (m > 11) { m = 0; y++; }
  if (y > today.getFullYear() || (y === today.getFullYear() && m > today.getMonth())) return;
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
  if (!open) renderJourneyChart(Tracker.data);
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
