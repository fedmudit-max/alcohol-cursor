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

function syncModalOpenBodyClass() {
  if (!document.body || !document.querySelector) return;
  const open = document.querySelector('.modal.active');
  if (open) document.body.classList.add('modal-open');
  else document.body.classList.remove('modal-open');
}

function openAppModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.zIndex = '';
  modalEl.classList.add('active');
  if (document.body) document.body.classList.add('modal-open');
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
