/* ===== src/utils/helpers.js ===== */
'use strict';
function el(id) { return document.getElementById(id); }

// ═══════════════════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════════════════
// Creates falling confetti pieces — called on milestone achievements
function launchConfetti(n = 80) {
  const wrap   = el('confettiWrap');
  const colors = ['#34c759','#ff9500','#ff3b30','#007aff','#5856d6','#ff2d55','#ffd60a'];
  // Build all HTML at once — one innerHTML set instead of 80 appendChild calls
  let html = '';
  for (let i = 0; i < n; i++) {
    const sz = Math.random() * 8 + 5;
    html += `<div class="confetti-piece" style="left:${Math.random()*100}vw;top:-12px;width:${sz}px;height:${sz}px;background:${colors[i%colors.length]};animation-duration:${Math.random()*2+1.4}s;animation-delay:${Math.random()*0.7}s;"></div>`;
  }
  wrap.innerHTML = html; // single DOM write
  setTimeout(() => { wrap.innerHTML = ''; }, CONFETTI_DURATION_MS);
}

// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════
let _toastTimer;
// Shows a green toast message at the bottom of screen for 3 seconds
function showToast(msg) {
  const t = el('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), TOAST_DURATION_MS);
}

let _bodyScrollLockY = 0;
let _bodyScrollLocked = false;

function _readScrollY() {
  if (typeof window === 'undefined') return 0;
  if (typeof window.scrollY === 'number') return window.scrollY;
  const docEl = document.documentElement;
  if (docEl && typeof docEl.scrollTop === 'number') return docEl.scrollTop;
  return 0;
}

function _scrollYFromBodyTop(body) {
  if (!body?.style?.top) return null;
  const n = parseInt(String(body.style.top), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, -n);
}

function _restoreScrollY(y) {
  if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') return;
  try {
    window.scrollTo(0, y);
  } catch (e) {
    /* headless tests may lack a full layout engine */
  }
}

function isScrollLockOverlayOpen() {
  if (typeof document === 'undefined' || !document.querySelector) return false;
  if (document.querySelector('.modal.active')) return true;
  const sheetIds = ['auditModal', 'tenDrinksGuideModal', 'acknowledgeModal2'];
  for (const id of sheetIds) {
    const node = el(id);
    if (node && node.classList.contains('open')) return true;
  }
  const overlayIds = ['appSettingsOverlay', 'privacyPolicyOverlay', 'premiumOverlay'];
  for (const id of overlayIds) {
    const node = el(id);
    if (node && node.classList.contains('active')) return true;
  }
  const ob = el('onboardingOverlay');
  if (ob && ob.style.display === 'flex' && ob.style.pointerEvents !== 'none') return true;
  return false;
}

/** Sync body.modal-open with any open modal/sheet (fixes stuck scroll after close). */
function reconcileBodyScrollLock() {
  const body = document.body;
  if (!body || !body.classList || typeof body.classList.add !== 'function') return;
  const shouldLock = isScrollLockOverlayOpen();
  if (shouldLock) {
    if (!_bodyScrollLocked) {
      _bodyScrollLockY = _readScrollY();
      if (body.style) {
        body.style.top = `-${_bodyScrollLockY}px`;
        body.style.left = '0';
        body.style.right = '0';
      }
      _bodyScrollLocked = true;
    }
    body.classList.add('modal-open');
    const html = document.documentElement;
    if (html?.classList) html.classList.add('modal-open');
    return;
  }
  const hasModalClass = typeof body.classList.contains === 'function'
    && body.classList.contains('modal-open');
  if (_bodyScrollLocked || hasModalClass || body.style?.top) {
    const y = _scrollYFromBodyTop(body) ?? _bodyScrollLockY;
    _bodyScrollLocked = false;
    body.classList.remove('modal-open');
    if (document.documentElement?.classList) {
      document.documentElement.classList.remove('modal-open');
    }
    if (body.style) {
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
    }
    _restoreScrollY(y);
  }
}

function healStuckBodyScroll() {
  reconcileBodyScrollLock();
}
if (typeof window !== 'undefined') window.healStuckBodyScroll = healStuckBodyScroll;

function lockBodyScroll() {
  reconcileBodyScrollLock();
}

function unlockBodyScroll() {
  reconcileBodyScrollLock();
}

/** Clears scroll lock when legacy code removed modal-open without unlock. */
function forceUnlockBodyScroll() {
  _bodyScrollLocked = false;
  reconcileBodyScrollLock();
}

function syncModalOpenBodyClass() {
  reconcileBodyScrollLock();
}

function openAppModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.zIndex = '';
  modalEl.classList.add('active');
  reconcileBodyScrollLock();
}

/** After AUDIT-C: anchor viewport on Drinking Risk Meter + Reduction Goal (post modal unlock). */
function scrollToPostTestView() {
  if (typeof window === 'undefined') return;

  function align() {
    const meterCard = el('riskMeterCard');
    if (!meterCard) return;

    const header = el('appTopBar');
    const offset = (header ? header.getBoundingClientRect().height : 52) + 6;
    const y = _readScrollY();
    const meterTop = meterCard.getBoundingClientRect().top + y;
    const target = Math.max(0, meterTop - offset);

    try {
      window.scrollTo({ top: target, behavior: 'smooth' });
    } catch (e) {
      _restoreScrollY(target);
    }
  }

  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(align, 120)));
}

function bindMonthGridCalendarClicks() {
  if (window._monthGridCalendarClickBound) return;
  window._monthGridCalendarClickBound = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#monthGrid [data-cal-key]');
    if (!btn) return;
    const key = btn.getAttribute('data-cal-key');
    if (!key || typeof SoberTracker === 'undefined' || !SoberTracker.promptCalendarDay) return;
    e.preventDefault();
    SoberTracker.promptCalendarDay(key);
  }, true);
}

// Hide boot splash and switch page background off brand green (safe to call multiple times)
function dismissAppSplash() {
  const splash = el('splash');
  if (splash) splash.classList.add('hidden');
  document.body.classList.add('loaded');
  document.documentElement.classList.add('loaded');
}

// ═══════════════════════════════════════════════════════════════
// MILESTONE DATA
// ═══════════════════════════════════════════════════════════════
