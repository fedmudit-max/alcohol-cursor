/* ===== src/assessment/questions.js ===== */
'use strict';

const AuditOnboarding = {
  answers: [null, null, null], // q1, q2, q3
  step: 1,

  show() {
    this.answers = [null, null, null];
    this.step = 1;
    this._showStep(1);
    ['q1Options','q2Options','q3Options'].forEach(id => {
      const container = el(id);
      if (!container) return;
      container.querySelectorAll('.audit-opt').forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
        b.style.opacity = '1';
        b.style.cursor = 'pointer';
      });
    });
    this._setBtn(false, 'Next →');
    // Reset score tally
    const tally = el('auditScoreTally');
    const scoreEl = el('auditRunningScore');
    if (tally) tally.style.display = 'none';
    if (scoreEl) { scoreEl.textContent = '0'; scoreEl.style.color = '#34c759'; }
    el('auditModal').classList.add('open');
  },

  select(step, val) {
    this.answers[step - 1] = val;
    const optId = `q${step}Options`;
    el(optId).querySelectorAll('.audit-opt').forEach(b => {
      const isSelected = parseInt(b.dataset.val) === val;
      b.classList.toggle('selected', isSelected);
      const badge = b.querySelector('.audit-badge');
      if (badge) badge.textContent = b.dataset.val;
    });
    // Update running score tally
    const tally = el('auditScoreTally');
    const scoreEl = el('auditRunningScore');
    if (tally && scoreEl) {
      const running = this.answers.reduce((s,a) => s + (a||0), 0);
      scoreEl.textContent = running;
      // Colour by zone
      const zi = MeterController.getZoneIdx(running);
      const zoneColor = MeterController.ZONES[zi]?.color || '#34c759';
      scoreEl.style.color = zoneColor;
      tally.style.display = 'flex';
    }
    if (step === 1 && val === 0) {
      this._setBtn(true, 'See My Score');
    } else if (step === 3) {
      this._setBtn(true, 'See My Score');
    } else {
      this._setBtn(true, 'Next →');
    }
  },

  toggleBeer(panelId, arrId) {
    const p = document.getElementById(panelId);
    const a = document.getElementById(arrId);
    if (!p) return;
    const open = p.style.display !== 'none';
    p.style.display = open ? 'none' : 'block';
    if (a) a.textContent = open ? '▸' : '▾';
  },

  next() {
    const stepAnswer = this.answers[this.step - 1];
    if (stepAnswer === null) return;

    // Q1 = Never → score 0, save immediately
    if (this.step === 1 && stepAnswer === 0) {
      this.answers[1] = 0; this.answers[2] = 0;
      this._save(); return;
    }

    if (this.step < 3) {
      this.step++;
      this._showStep(this.step);
      if (this.step === 3) {
        this._filterQ3();
        this._setBtn(false, 'See My Score');
      } else {
        this._setBtn(false, 'Next →');
      }
    } else {
      this._save();
    }
  },

  _filterQ3() {
    const q2  = this.answers[1] ?? 0;

    // Q2-based minimum only: if already drinking binge-level quantities per session,
    // low Q3 answers are logically impossible — but high ones are always valid.
    // Q2=3 (7-9 pegs)  → min Q3 = 1 (at least less than monthly)
    // Q2=4 (10+ pegs)  → min Q3 = 2 (at least monthly)
    let min = 0;
    if (q2 >= 4) min = 2;
    else if (q2 >= 3) min = 1;

    el('q3Options').querySelectorAll('.audit-opt').forEach(b => {
      const val = parseInt(b.dataset.val);
      const blocked = val < min;
      b.disabled      = blocked;
      b.style.opacity = blocked ? '0.25' : '1';
      b.style.cursor  = blocked ? 'not-allowed' : 'pointer';
      if (blocked) b.classList.remove('selected');
    });
  },

  _showStep(s) {
    [1,2,3].forEach(i => {
      const stepEl = el(`audit-step-${i}`);
      const dotEl  = el(`step-dot-${i}`);
      if (stepEl) stepEl.style.display = i === s ? 'block' : 'none';
      if (dotEl)  dotEl.style.background = i <= s ? '#34c759' : '#e0e0e0';
    });
  },

  _setBtn(enabled, label) {
    const btn = el('auditNavBtn');
    if (!btn) return;
    btn.textContent   = label;
    btn.style.opacity = enabled ? '1' : '0.4';
    btn.style.cursor  = enabled ? 'pointer' : 'default';
  },

  _save() {
    // Session-only: written to Tracker.data + meter UI; stripped from localStorage via AuditSession.forPersist.
    const [q1, q2, q3] = this.answers;
    if (q1 === null || q2 === null || q3 === null) return;
    const d = Tracker.data || DataManager.load();
    d.auditQ1      = q1;
    d.auditQ2      = q2;
    d.auditQ3      = q3;
    d.auditAnswers = [q1, q2, q3];
    d.auditScore   = q1 + q2 + q3;
    d.auditDate    = new Date().toISOString();
    Tracker.data   = d;
    DataManager.save(d);
    el('auditModal').classList.remove('open');
    const zn = getAuditZoneName(d);
    const zi = zn ? DYK_FACTS.findIndex(f => f.type === 'zone' && f.zoneName === zn) : -1;
    d.dykIndex = zi >= 0 ? zi : 0;
    MeterController.updateFromJourney(d);
    renderReductionTarget(d);
    scrollToPostTestView();
  }
};
