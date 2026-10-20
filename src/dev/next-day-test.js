/* ===== src/dev/next-day-test.js ===== */
'use strict';

/**
 * Dev-only: bottom "Next Day (journey)" bar — simulates the next calendar day in-app.
 * Not loaded in production index.html — add before main.js when testing locally:
 *   <script src="src/dev/next-day-test.js"></script>
 * Optional: also load trial-test-bar.js for trial clock controls.
 */
const ENABLE_NEXT_DAY_TEST_BAR = true;

(function () {
  if (!ENABLE_NEXT_DAY_TEST_BAR) return;

  if (typeof CONFIG === 'object' && CONFIG) {
    CONFIG.showTestUI = true;
    CONFIG.showInternalTestBar = true;
    if (CONFIG.buildTag === 'production') CONFIG.buildTag = 'dev';
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
body.test-ui-active.trial-test-ui-active .scroll-view {
  padding-bottom: calc(158px + env(safe-area-inset-bottom));
}
body.test-ui-active.trial-test-ui-active .toast.show {
  bottom: calc(158px + env(safe-area-inset-bottom));
}
#testBuildTag {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  margin-bottom: 6px;
}
#testBtns .test-bar-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
#testBtns button {
  border: none;
  border-radius: 8px;
  padding: 10px 6px;
  font-size: 11px;
  font-weight: 700;
  color: white;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.2;
}
#testBtns .test-btn-next { background: #007aff; }
`;

  function onNextDayClick(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    if (typeof Tracker !== 'undefined' && Tracker.autoAdvanceDay) {
      Tracker.autoAdvanceDay();
    }
    setTimeout(() => { btn.disabled = false; }, 600);
  }

  function mountNextDayTestBar() {
    if (document.getElementById('testBtns')) return;

    const style = document.createElement('style');
    style.id = 'nextDayTestBarStyles';
    style.textContent = TEST_BAR_STYLES;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'testBtns';
    root.style.display = 'none';

    const tag = document.createElement('div');
    tag.id = 'testBuildTag';

    const grid = document.createElement('div');
    grid.className = 'test-bar-grid';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'test-btn-next';
    btn.textContent = 'Next Day (journey)';
    btn.addEventListener('click', () => onNextDayClick(btn));

    grid.appendChild(btn);
    root.appendChild(tag);
    root.appendChild(grid);
    document.body.appendChild(root);
  }

  window.syncNextDayTestBar = function (active) {
    if (!ENABLE_NEXT_DAY_TEST_BAR) {
      document.body.classList.remove('test-ui-active');
      return;
    }
    mountNextDayTestBar();
    const tb = el('testBtns');
    if (!tb) return;
    const on = !!(active || ENABLE_NEXT_DAY_TEST_BAR);
    document.body.classList.toggle('test-ui-active', on);
    tb.style.display = on ? 'block' : 'none';
    const tag = el('testBuildTag');
    if (tag) tag.textContent = on ? ('Build: ' + (CONFIG.buildTag || 'dev')) : '';
  };
})();
