/* ===== src/onboarding/onboarding.js ===== */
'use strict';
const Onboarding = {
  TOTAL: 3,
  current: 0,

  show() {
    const done = localStorage.getItem('sj_onboarded');
    if (done) return;

    if (this.current !== 0) {
      el(`ob-${this.current}`).style.display = 'none';
      el(`ob-dot-${this.current}`).classList.remove('active');
      this.current = 0;
      el('ob-0').style.display = 'block';
      el('ob-dot-0').classList.add('active');
      el('obNextBtn').textContent = 'Next';
    }

    const overlay = el('onboardingOverlay');
    if (overlay) {
      overlay.style.display       = 'flex';
      overlay.style.flexDirection = 'column';
    }
    setTimeout(() => this._animateBars(), 400);
    setTimeout(() => {
      const footer = el('ob-mechanic-footer');
      if (footer) footer.style.opacity = '1';
    }, 1600);
  },

  reset() {
    localStorage.removeItem('sj_onboarded');
    this.current = 0;
  },

  next() {
    if (this.current < this.TOTAL - 1) {
      el(`ob-${this.current}`).style.display = 'none';
      el(`ob-dot-${this.current}`).classList.remove('active');
      this.current++;
      el(`ob-${this.current}`).style.display = 'block';
      el(`ob-dot-${this.current}`).classList.add('active');
      if (this.current === this.TOTAL - 1) {
        el('obNextBtn').textContent = 'Start →';
      }
      if (this.current === 0) this._animateBars();
    } else {
      this.skip();
    }
  },

  _animateBars() {
    const bars = [
      { id:'1', pct: 28, score:'5',  star:false },
      { id:'2', pct: 67, score:'12', star:true  },
      { id:'3', pct: 50, score:'9',  star:false },
      { id:'4', pct:100, score:'18', star:true  },
    ];
    bars.forEach(b => {
      const bar   = el(`ob-bar-${b.id}`);
      const label = el(`ob-bar-${b.id}-label`);
      const score = el(`ob-score-${b.id}`);
      if (bar)   bar.style.width = `${b.pct}%`;
      if (label) { label.style.opacity = '1'; label.textContent = b.score; }
      if (score) {
        score.textContent = b.star ? '⭐' : '';
        score.style.color = b.star ? '#34c759' : 'rgba(255,255,255,0.4)';
      }
    });
  },

  skip() {
    localStorage.setItem('sj_onboarded', '1');
    const overlay = el('onboardingOverlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.4s ease';
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.display = 'none'; overlay.style.opacity = '1'; }, 400);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────
// AUDIT ONBOARDING (Take Test flow)
// Handles the 3-question AUDIT-C test popup.
// One question at a time, filters impossible Q3 options based on Q2.
// Results live in Tracker.data for this session only — AuditSession.forPersist strips them before localStorage write.
// ─────────────────────────────────────────────
