/* ===== src/dev/next-day-test.js ===== */
'use strict';

/**
 * Dev-only: bottom bar with **Next calendar day** only.
 * Logic: calendar-day-advance.js (not loaded in release dist/).
 */
const ENABLE_NEXT_DAY_TEST_BAR = true;

(function () {
  if (!ENABLE_NEXT_DAY_TEST_BAR) return;

  if (typeof CONFIG === 'object' && CONFIG) {
    CONFIG.showInternalTestBar = true;
    if (CONFIG.buildTag === 'production') CONFIG.buildTag = 'dev';
  }

  function trialHintForBar() {
    if (typeof trialDaysLeft !== 'function' || typeof isTrialActive !== 'function') return '';
    if (!isTrialActive()) return ' · Trial ended — locks on';
    const left = trialDaysLeft();
    if (left <= 1) return ' · Trial: last day';
    return ` · Trial: ${left}d left (app calendar)`;
  }

  function ensureAdvanceHook() {
    if (typeof installCalendarDayAdvance === 'function') {
      return installCalendarDayAdvance();
    }
    return !!(typeof Tracker !== 'undefined' && Tracker.autoAdvanceDay);
  }

  const TEST_BAR_STYLES = `
#testBtns {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 4990;
  background: #1c1c1e;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.25);
  max-width: 480px;
  margin: 0 auto;
}
body.test-ui-active .scroll-view {
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}
body.test-ui-active .toast.show {
  bottom: calc(88px + env(safe-area-inset-bottom));
}
#testBuildTag {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  margin-bottom: 6px;
}
#testBtns button {
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 12px 8px;
  font-size: 13px;
  font-weight: 700;
  color: white;
  cursor: pointer;
  font-family: inherit;
  background: #007aff;
}
`;

  function onNextCalendarDayClick(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    if (!ensureAdvanceHook()) {
      if (typeof showToast === 'function') showToast('Calendar advance helper not loaded.');
      btn.disabled = false;
      return;
    }
    Tracker.autoAdvanceDay();
    setTimeout(() => { btn.disabled = false; }, 600);
  }

  function mountNextDayTestBar() {
    if (document.getElementById('testBtns')) return;
    ensureAdvanceHook();

    const style = document.createElement('style');
    style.id = 'nextDayTestBarStyles';
    style.textContent = TEST_BAR_STYLES;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'testBtns';
    root.style.display = 'none';

    const tag = document.createElement('div');
    tag.id = 'testBuildTag';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = 'Next calendar day';
    nextBtn.addEventListener('click', () => onNextCalendarDayClick(nextBtn));

    root.appendChild(tag);
    root.appendChild(nextBtn);
    document.body.appendChild(root);
  }

  window.syncNextDayTestBar = function syncNextDayTestBar(active) {
    if (!ENABLE_NEXT_DAY_TEST_BAR) {
      document.body.classList.remove('test-ui-active');
      return;
    }
    mountNextDayTestBar();
    const tb = el('testBtns');
    if (!tb) return;
    const on = !!(active || CONFIG.showInternalTestBar || ENABLE_NEXT_DAY_TEST_BAR);
    document.body.classList.toggle('test-ui-active', on);
    tb.style.display = on ? 'block' : 'none';
    const tag = el('testBuildTag');
    if (tag) {
      tag.textContent = on
        ? ('Build: ' + (CONFIG.buildTag || 'dev') + trialHintForBar())
        : '';
    }
  };

  function showBarWhenReady() {
    syncNextDayTestBar(true);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBarWhenReady);
  } else {
    showBarWhenReady();
  }
})();
