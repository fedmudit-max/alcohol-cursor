/* ===== src/onboarding/onboarding.js ===== */
'use strict';
const Onboarding = {
  TOTAL: 2,
  current: 0,
  _skipTimer: null,

  _showOverlay() {
    const overlay = el('onboardingOverlay');
    if (!overlay) return;
    clearTimeout(this._skipTimer);
    this._skipTimer = null;
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'auto';
    overlay.style.transition = '';
  },

  hideImmediate() {
    clearTimeout(this._skipTimer);
    this._skipTimer = null;
    const overlay = el('onboardingOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'none';
    overlay.style.transition = '';
    overlay.classList.remove('onboarding-overlay--journey');
    overlay.style.background = '#1e9e3e';
  },

  /** True while onboarding intercepts taps (not during fade-out). */
  isBlocking() {
    const overlay = el('onboardingOverlay');
    if (!overlay || overlay.style.display === 'none') return false;
    return overlay.style.display === 'flex' && overlay.style.pointerEvents !== 'none';
  },

  _onComplete() {
    if (typeof dismissAppSplash === 'function') dismissAppSplash();
    document.body.classList.remove('modal-open', 'settings-open');
    const data = (typeof Tracker !== 'undefined' && Tracker.data)
      ? Tracker.data
      : (typeof DataManager !== 'undefined' ? DataManager.load() : null);
    if (data && typeof UI !== 'undefined' && UI.renderAll) {
      UI.renderAll(data);
    }
    if (data && typeof promptYesterdayIfNeeded === 'function') {
      promptYesterdayIfNeeded(data, 150);
    }
  },

  show() {
    const done = localStorage.getItem('sj_onboarded');
    if (done) return;

    if (typeof dismissAppSplash === 'function') dismissAppSplash();
    this.current = 0;
    this._showSlide(0);
    this._showOverlay();
  },

  reset() {
    localStorage.removeItem('sj_onboarded');
    this.current = 0;
  },

  _showSlide(idx) {
    for (let i = 0; i < this.TOTAL; i++) {
      const slide = el(`ob-${i}`);
      const dot = el(`ob-dot-${i}`);
      if (slide) slide.style.display = i === idx ? 'block' : 'none';
      if (dot) dot.classList.toggle('active', i === idx);
    }
    const overlay = el('onboardingOverlay');
    const onJourney = idx === 1;
    if (overlay) {
      overlay.classList.toggle('onboarding-overlay--journey', onJourney);
      overlay.style.background = onJourney ? '#f5f5f7' : '#1e9e3e';
    }
    const btn = el('obNextBtn');
    const skip = overlay && overlay.querySelector('button[onclick="Onboarding.skip()"]');
    if (btn) {
      btn.textContent = idx === this.TOTAL - 1 ? 'Start →' : 'Next';
      if (onJourney) {
        btn.style.background = 'linear-gradient(180deg, #34c759, #30d158)';
        btn.style.color = 'white';
        btn.style.boxShadow = '0 4px 16px rgba(52,199,89,0.4)';
      } else {
        btn.style.background = 'white';
        btn.style.color = '#1e9e3e';
        btn.style.boxShadow = 'none';
      }
    }
    if (skip) {
      skip.style.color = onJourney ? 'rgba(60,60,67,0.45)' : 'rgba(255,255,255,0.45)';
    }
    const dots = overlay && overlay.querySelector('.onboarding-dots');
    if (dots) dots.classList.toggle('onboarding-dots--journey', onJourney);
  },

  next() {
    if (this.current < this.TOTAL - 1) {
      this.current++;
      this._showSlide(this.current);
    } else {
      this.skip();
    }
  },

  skip() {
    localStorage.setItem('sj_onboarded', '1');
    const overlay = el('onboardingOverlay');
    if (!overlay) {
      this._onComplete();
      return;
    }
    clearTimeout(this._skipTimer);
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    this._skipTimer = setTimeout(() => {
      this._skipTimer = null;
      this.hideImmediate();
      this._onComplete();
    }, 400);
  }
};
