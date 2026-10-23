/* ===== src/dev/trial-test-bar.js ===== */
'use strict';

/**
 * Dev-only: trial clock controls (+1 day, Expire, Fresh trial).
 * Not loaded in production index.html — add before main.js when testing locally:
 *   <script src="src/dev/trial-test-bar.js"></script>
 * Pair with next-day-test.js for journey day simulation (separate file).
 */
const ENABLE_TRIAL_TEST_BAR = true;

function devJourneyDashboardDay(data) {
  try {
    let d = data;
    if (!d && typeof Tracker !== 'undefined' && Tracker.data) d = Tracker.data;
    if (!d && typeof DataManager !== 'undefined') d = DataManager.load();
    if (!d) return 1;
    if (typeof syncCalendarDayFromJourneyStart === 'function') syncCalendarDayFromJourneyStart(d);
    return Math.max(1, parseInt(d.calendarDay, 10) || 1);
  } catch (e) {
    return 1;
  }
}

(function () {
  if (!ENABLE_TRIAL_TEST_BAR) return;

  if (typeof CONFIG === 'object' && CONFIG) {
    CONFIG.showTestUI = true;
    CONFIG.showInternalTestBar = true;
    CONFIG.enforceTrialEntitlement = true;
    if (CONFIG.buildTag === 'production') CONFIG.buildTag = 'dev-trial';
  }

  const BAR_STYLES = `
#trialTestBtns {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 4991;
  background: #2c2c2e;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.3);
  max-width: 480px;
  margin: 0 auto;
}
body.trial-test-ui-active .scroll-view {
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}
body.trial-test-ui-active .toast.show {
  bottom: calc(88px + env(safe-area-inset-bottom));
}
body.test-ui-active.trial-test-ui-active .scroll-view {
  padding-bottom: calc(158px + env(safe-area-inset-bottom));
}
body.test-ui-active.trial-test-ui-active .toast.show {
  bottom: calc(158px + env(safe-area-inset-bottom));
}
#trialTestTag {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  margin-bottom: 6px;
  line-height: 1.35;
}
#trialTestBtns .trial-test-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}
#trialTestBtns button {
  border: none;
  border-radius: 8px;
  padding: 9px 6px;
  font-size: 10px;
  font-weight: 700;
  color: white;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.25;
}
#trialTestBtns .trial-btn-advance { background: #5856d6; }
#trialTestBtns .trial-btn-expire { background: #ff3b30; }
#trialTestBtns .trial-btn-reset { background: #34c759; }
`;

  function refreshEntitlementUi() {
    if (typeof updatePremiumLockTestBtn === 'function') updatePremiumLockTestBtn();
    if (typeof renderPremiumEntry === 'function') renderPremiumEntry();
    const d = typeof Tracker !== 'undefined' && Tracker.data
      ? Tracker.data
      : (typeof DataManager !== 'undefined' ? DataManager.load() : null);
    if (d && typeof UI !== 'undefined' && UI.renderAll) UI.renderAll(d);
  }

  function trialStatusLine() {
    if (typeof trialDaysLeft !== 'function') return 'Trial test bar';
    const left = trialDaysLeft();
    const jDay = devJourneyDashboardDay();
    const attempt = typeof Tracker !== 'undefined' && Tracker.data
      ? (Tracker.data.attempt | 0)
      : 0;
    const bestLocked = typeof isBestScoreLocked === 'function' && Tracker.data
      ? isBestScoreLocked(Tracker.data)
      : false;
    const mode = typeof getEntitlementTestMode === 'function' ? getEntitlementTestMode() : '';
    const jPart = jDay != null ? ` · Journey day ${jDay} (not trial clock)` : '';
    const aPart = attempt > 0 ? ` · J${attempt}` : '';
    const trialEnded = left <= 0 || mode === 'free';
    if (trialEnded) {
      return `Trial ended (15d since install)${aPart}${bestLocked ? ' · History tier locked' : ''}${jPart}`;
    }
    return `Trial · ${left}d since install${aPart}${bestLocked ? ' · History tier locked' : ''}${jPart}`;
  }

  function advanceTrialOneDay() {
    try {
      if (typeof ensureTrialStarted === 'function') ensureTrialStarted();
      let raw = localStorage.getItem(TRIAL_KEY);
      let start = raw ? new Date(raw) : new Date();
      if (Number.isNaN(start.getTime())) start = new Date();
      start.setTime(start.getTime() - MS_PER_DAY);
      localStorage.setItem(TRIAL_KEY, start.toISOString());
      if (typeof Tracker !== 'undefined' && Tracker.data) {
        Tracker.data.trialStartedAt = start.toISOString();
        if (typeof DataManager !== 'undefined') DataManager.saveNow(Tracker.data);
      }
      if (typeof TRIAL_POLICY_KEY !== 'undefined') {
        localStorage.setItem(TRIAL_POLICY_KEY, String(TRIAL_DAYS));
      }
      if (typeof clearPremiumRecord === 'function') clearPremiumRecord();
    } catch (e) {
      console.warn('[trial-test-bar] advance failed', e);
    }
    refreshEntitlementUi();
    updateTag();
    if (typeof showToast === 'function') showToast(trialStatusLine());
  }

  function expireTrialNow() {
    if (typeof Tracker !== 'undefined' && Tracker.setEntitlementTest) {
      Tracker.setEntitlementTest('free');
    } else {
      try {
        const past = new Date(Date.now() - ((TRIAL_DAYS + 1) * MS_PER_DAY));
        localStorage.setItem(TRIAL_KEY, past.toISOString());
      } catch (e) {}
      refreshEntitlementUi();
    }
    updateTag();
  }

  function resetTrialNow() {
    if (typeof Tracker !== 'undefined' && Tracker.setEntitlementTest) {
      Tracker.setEntitlementTest('trial');
    } else {
      try {
        localStorage.setItem(TRIAL_KEY, new Date().toISOString());
        localStorage.setItem(TRIAL_POLICY_KEY, String(TRIAL_DAYS));
        if (typeof clearPremiumRecord === 'function') clearPremiumRecord();
      } catch (e) {}
      refreshEntitlementUi();
    }
    updateTag();
  }

  function updateTag() {
    const tag = el('trialTestTag');
    if (tag) tag.textContent = trialStatusLine();
  }

  function mountTrialTestBar() {
    if (document.getElementById('trialTestBtns')) return;

    const style = document.createElement('style');
    style.id = 'trialTestBarStyles';
    style.textContent = BAR_STYLES;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'trialTestBtns';

    const tag = document.createElement('div');
    tag.id = 'trialTestTag';

    const grid = document.createElement('div');
    grid.className = 'trial-test-grid';

    const btnAdvance = document.createElement('button');
    btnAdvance.type = 'button';
    btnAdvance.className = 'trial-btn-advance';
    btnAdvance.textContent = '+1 Day (trial)';
    btnAdvance.addEventListener('click', () => advanceTrialOneDay());

    const btnExpire = document.createElement('button');
    btnExpire.type = 'button';
    btnExpire.className = 'trial-btn-expire';
    btnExpire.textContent = 'Expire trial';
    btnExpire.addEventListener('click', () => expireTrialNow());

    const btnReset = document.createElement('button');
    btnReset.type = 'button';
    btnReset.className = 'trial-btn-reset';
    btnReset.textContent = 'Fresh trial';
    btnReset.addEventListener('click', () => resetTrialNow());

    grid.appendChild(btnAdvance);
    grid.appendChild(btnExpire);
    grid.appendChild(btnReset);
    root.appendChild(tag);
    root.appendChild(grid);
    document.body.appendChild(root);
    updateTag();
  }

  window.syncTrialTestBar = function (active) {
    if (!ENABLE_TRIAL_TEST_BAR) {
      document.body.classList.remove('trial-test-ui-active');
      return;
    }
    mountTrialTestBar();
    const bar = el('trialTestBtns');
    if (!bar) return;
    const on = !!(active || ENABLE_TRIAL_TEST_BAR);
    document.body.classList.toggle('trial-test-ui-active', on);
    bar.style.display = on ? 'block' : 'none';
    if (on) updateTag();
  };
})();
