/* ===== src/ui/panels.js ===== */
'use strict';

// Collapsible panel toggles + calendar/chart nav (load after journey.js + history-views.js)

function journeyTierBestLocked(data) {
  return typeof isBestScoreLocked === 'function' && isBestScoreLocked(data);
}

function isTrialGatedFeatureLocked() {
  const data = (typeof Tracker !== 'undefined' && Tracker.data) || null;
  if (typeof isTrialGatedPremiumLocked === 'function') return isTrialGatedPremiumLocked(data);
  return typeof isTrialEntitlementEnforced === 'function'
    && isTrialEntitlementEnforced()
    && typeof hasPremiumAccess === 'function'
    && !hasPremiumAccess(data);
}

function isCollapsibleOpen(bodyEl) {
  if (!bodyEl) return false;
  return bodyEl.classList.contains('panel-open') || bodyEl.style.display === 'block';
}

function setCollapsibleOpen(bodyEl, open) {
  if (!bodyEl) return;
  bodyEl.classList.toggle('panel-open', open);
  bodyEl.style.display = open ? 'block' : 'none';
}

function clearCollapsibleCardLock(cardId, bodyId, bodyLocked) {
  if (typeof clearPremiumLockUi !== 'function') return;
  clearPremiumLockUi(el(cardId));
  if (!bodyLocked) clearPremiumLockUi(el(bodyId));
}

/** Shared open/close — Lifetime and Best Scores use this exact path. */
function toggleCollapsibleJourneyPanel(config) {
  const data = Tracker.data || DataManager.load();
  const journeyTierLocked = journeyTierBestLocked(data);
  if (journeyTierLocked && config.cardId === 'bestPerformancesCard') {
    if (typeof renderPremiumLocks === 'function') renderPremiumLocks(data);
    return;
  }
  const preserveBodyLock = journeyTierLocked && config.cardId === 'lifetimeStatsCard';
  clearCollapsibleCardLock(config.cardId, config.bodyId, preserveBodyLock);
  const body = el(config.bodyId);
  const btn = el(config.btnId);
  const header = el(config.headerId);
  if (!body) return;
  const open = isCollapsibleOpen(body);
  if (!open && !journeyTierLocked && config.renderFn) config.renderFn(data);
  setCollapsibleOpen(body, !open);
  if (btn) btn.textContent = open ? 'Show \u25be' : 'Hide \u25b4';
  if (header) header.setAttribute('aria-expanded', open ? 'false' : 'true');
}

function isCalendarFeatureLocked() {
  const data = (typeof Tracker !== 'undefined' && Tracker.data) || null;
  if (typeof isCalendarLocked === 'function') return isCalendarLocked(data);
  return isTrialGatedFeatureLocked();
}

Tracker.toggleMonthGrid = function() {
  if (isCalendarFeatureLocked()) {
    if (typeof renderPremiumLocks === 'function') renderPremiumLocks(this.data || DataManager.load());
    return;
  }
  clearCollapsibleCardLock('monthGridCard', 'monthGridBody', false);
  const body = el('monthGridBody');
  const btn  = el('monthGridToggleBtn');
  if (!body) return;
  const open = isCollapsibleOpen(body);
  setCollapsibleOpen(body, !open);
  if (btn) btn.textContent = open ? 'Show \u25be' : 'Hide \u25b4';
};

Tracker.calendarPrev = function() {
  if (isCalendarFeatureLocked()) return;
  const data = Tracker.data || DataManager.load();
  const appToday = getAppToday(data);
  let y = _calYear ?? appToday.getFullYear();
  let m = (_calMonth ?? appToday.getMonth()) - 1;
  if (m < 0) { m = 11; y--; }
  renderMonthGrid(data, y, m);
};

Tracker.calendarNext = function() {
  if (isCalendarFeatureLocked()) return;
  const data = Tracker.data || DataManager.load();
  const appToday = getAppToday(data);
  let y = _calYear ?? appToday.getFullYear();
  let m = (_calMonth ?? appToday.getMonth()) + 1;
  if (m > 11) { m = 0; y++; }
  if (y > appToday.getFullYear() || (y === appToday.getFullYear() && m > appToday.getMonth())) return;
  renderMonthGrid(data, y, m);
};

Tracker.toggleJourneyChart = function() {
  const data = this.data || DataManager.load();
  const tierLocked = journeyTierBestLocked(data);
  if (tierLocked) {
    if (typeof renderPremiumLocks === 'function') renderPremiumLocks(data);
    return;
  }
  clearCollapsibleCardLock('journeyChartCard', 'journeyChartBody', false);
  const body     = el('journeyChartBody');
  const btn      = el('journeyChartToggleBtn');
  const subLabel = el('journeyChartSubLabel');
  if (!body) return;
  const open = isCollapsibleOpen(body);
  setCollapsibleOpen(body, !open);
  if (btn)      btn.textContent        = open ? 'Show \u25be' : 'Hide \u25b4';
  if (subLabel) subLabel.style.display = open ? 'none' : 'block';
  const header = el('journeyChartPanelToggle');
  if (header) header.setAttribute('aria-expanded', open ? 'false' : 'true');
  if (!open && !tierLocked) renderJourneyChart(Tracker.data || DataManager.load());
};

Tracker.journeyChartOlder = function() {
  if (journeyTierBestLocked(Tracker.data || DataManager.load())) return;
  _journeyChartOffset++;
  renderJourneyChart(Tracker.data);
};

Tracker.journeyChartNewer = function() {
  if (journeyTierBestLocked(Tracker.data || DataManager.load())) return;
  _journeyChartOffset = Math.max(0, _journeyChartOffset - 1);
  renderJourneyChart(Tracker.data);
};

Tracker.toggleLifetimeStats = function() {
  toggleCollapsibleJourneyPanel({
    cardId: 'lifetimeStatsCard',
    bodyId: 'lifetimeStatsBody',
    btnId: 'lifetimeStatsToggleBtn',
    headerId: 'lifetimeStatsPanelToggle',
    renderFn: typeof renderLifetimeStats === 'function' ? renderLifetimeStats : null,
  });
};

Tracker.toggleBestPerformances = function() {
  toggleCollapsibleJourneyPanel({
    cardId: 'bestPerformancesCard',
    bodyId: 'bestPerformancesBody',
    btnId: 'bestPerformancesToggleBtn',
    headerId: 'bestPerformancesPanelToggle',
    renderFn: typeof renderBestPerformances === 'function' ? renderBestPerformances : null,
  });
};

Tracker.toggleReminderPanel = function() {
  this.openSettings();
};

Tracker._setRiskMeterOpen = function(open) {
  const body = el('riskMeterBody');
  const btn = el('riskMeterToggleBtn');
  const header = el('riskMeterToggle');
  if (!body) return;
  setCollapsibleOpen(body, open);
  if (btn) btn.textContent = open ? 'Hide \u25b4' : 'Show \u25be';
  if (header) header.setAttribute('aria-expanded', open ? 'true' : 'false');
};

Tracker.toggleRiskMeter = function() {
  if (isTrialGatedFeatureLocked()) {
    if (typeof renderPremiumLocks === 'function') renderPremiumLocks(this.data || DataManager.load());
    return;
  }
  clearCollapsibleCardLock('riskMeterCard', 'riskMeterBody', false);
  const body = el('riskMeterBody');
  if (!body) return;
  const open = isCollapsibleOpen(body);
  this._setRiskMeterOpen(!open);
  if (!open) {
    if (typeof MeterController !== 'undefined') {
      const data = this.data || DataManager.load();
      if (MeterController.syncFromData) MeterController.syncFromData(data);
      else if (!MeterController.initialized) MeterController.init();
    }
  }
};

Tracker.expandRiskMeter = function() {
  if (isTrialGatedFeatureLocked()) {
    if (typeof Tracker.openPremium === 'function') Tracker.openPremium();
    return;
  }
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
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  else document.body.classList.add('modal-open');
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
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  else document.body.classList.remove('modal-open');
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
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  else document.body.classList.add('modal-open');
};

Tracker.closePrivacyPolicy = function() {
  const overlay = el('privacyPolicyOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  if (typeof reconcileBodyScrollLock === 'function') reconcileBodyScrollLock();
  else if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
};

Tracker.openTenDrinksGuide = function() {
  const m = el('tenDrinksGuideModal');
  if (m) {
    m.classList.add('open');
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
    else document.body.classList.add('modal-open');
  }
};

Tracker.closeTenDrinksGuide = function() {
  const m = el('tenDrinksGuideModal');
  if (m) {
    m.classList.remove('open');
    if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
    else document.body.classList.remove('modal-open');
  }
};

/** Same tap path for all collapsible headers (Lifetime, Best Scores, etc.). */
function bindCollapsiblePanelToggles() {
  const root = document.querySelector('.scroll-view');
  if (!root || root.dataset.collapsibleBound === '1') return;
  root.dataset.collapsibleBound = '1';
  const handlers = {
    monthGridPanelToggle: () => Tracker.toggleMonthGrid(),
    bestPerformancesPanelToggle: () => Tracker.toggleBestPerformances(),
    riskMeterToggle: () => Tracker.toggleRiskMeter(),
    journeyChartPanelToggle: () => Tracker.toggleJourneyChart(),
    lifetimeStatsPanelToggle: () => Tracker.toggleLifetimeStats(),
  };
  Object.keys(handlers).forEach((id) => {
    const node = el(id);
    if (node) node.classList.add('panel-toggle-header');
  });
  root.addEventListener('click', (e) => {
    const header = e.target.closest('button.panel-toggle-header');
    if (!header || !header.id || !handlers[header.id]) return;
    e.preventDefault();
    handlers[header.id]();
  });
}

if (typeof window !== 'undefined') {
  window.bindCollapsiblePanelToggles = bindCollapsiblePanelToggles;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCollapsiblePanelToggles);
  } else {
    bindCollapsiblePanelToggles();
  }
}
