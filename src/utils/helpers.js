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
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), TOAST_DURATION_MS);
}

// ═══════════════════════════════════════════════════════════════
// MILESTONE DATA
// ═══════════════════════════════════════════════════════════════
