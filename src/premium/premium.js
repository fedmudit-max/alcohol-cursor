/* ===== src/premium/premium.js ===== */
'use strict';
// PREMIUM — local entitlement (billing wiring later)
// ═══════════════════════════════════════════════════════════════
let selectedPremiumPlan = 'yearly';

function getPremiumRecord() {
  try {
    const raw = localStorage.getItem(PREMIUM_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || typeof rec !== 'object') return null;
    return rec;
  } catch (e) {
    return null;
  }
}

function isPremiumActive() {
  const rec = getPremiumRecord();
  if (!rec || !rec.active) return false;
  if (rec.expiresAt) {
    const exp = new Date(rec.expiresAt).getTime();
    if (!Number.isNaN(exp) && Date.now() > exp) return false;
  }
  return true;
}

function ensureTrialStarted() {
  try {
    if (!localStorage.getItem(TRIAL_KEY)) {
      localStorage.setItem(TRIAL_KEY, new Date().toISOString());
    }
  } catch (e) {}
}

function getTrialStartedAt() {
  try {
    const raw = localStorage.getItem(TRIAL_KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

function isTrialActive() {
  if (isPremiumActive()) return false;
  const start = getTrialStartedAt();
  if (!start) return true; // first session before stamp — treat as trial
  const ends = start.getTime() + (TRIAL_DAYS * MS_PER_DAY);
  return Date.now() <= ends;
}

const FORCE_PREMIUM_LOCKED_KEY = 'sj_forcePremiumLocked';

function isForcePremiumLocked() {
  if (!CONFIG.showTestUI) return false;
  try { return sessionStorage.getItem(FORCE_PREMIUM_LOCKED_KEY) === '1'; } catch (e) { return false; }
}

function setForcePremiumLocked(locked) {
  try {
    if (locked) sessionStorage.setItem(FORCE_PREMIUM_LOCKED_KEY, '1');
    else sessionStorage.removeItem(FORCE_PREMIUM_LOCKED_KEY);
  } catch (e) {}
}

function hasPremiumAccess() {
  if (isForcePremiumLocked()) return false;
  return isPremiumActive() || isTrialActive();
}

function updatePremiumLockTestBtn() {
  const btn = el('testPremiumLockBtn');
  if (!btn) return;
  const locked = isForcePremiumLocked();
  // Button shows the mode you can switch TO
  btn.textContent = locked ? '✓ Default' : '🔒 Locked';
  btn.classList.toggle('is-locked-preview', locked);
  btn.title = locked
    ? 'Showing locked UI — tap for default (unlocked) UI'
    : 'Showing default UI — tap for locked Premium UI';
}

function trialDaysLeft() {
  const start = getTrialStartedAt();
  if (!start) return TRIAL_DAYS;
  const ends = start.getTime() + (TRIAL_DAYS * MS_PER_DAY);
  return Math.max(0, Math.ceil((ends - Date.now()) / MS_PER_DAY));
}

function journeyHistoryCap() {
  return hasPremiumAccess() ? MAX_COMPLETED_JOURNEYS_PREMIUM : MAX_COMPLETED_JOURNEYS;
}

function isJourneyMilestonePremiumLocked(days) {
  return !hasPremiumAccess() && (days | 0) > FREE_JOURNEY_MILESTONE_DAYS;
}

function savePremiumRecord(rec) {
  try { localStorage.setItem(PREMIUM_KEY, JSON.stringify(rec)); } catch (e) {}
}

function clearPremiumRecord() {
  try { localStorage.removeItem(PREMIUM_KEY); } catch (e) {}
}

function makePremiumLockOverlay(title, sub) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'premium-lock-overlay';
  btn.onclick = () => Tracker.openPremium();
  btn.innerHTML = `<span class="lock-icon">🔒</span>
    <span class="lock-title">${title}</span>
    <span class="lock-sub">${sub}</span>
    <span class="lock-cta">Unlock with Premium</span>`;
  return btn;
}

function setFeatureLocked(cardEl, locked, title, sub) {
  if (!cardEl) return;
  cardEl.classList.toggle('feature-locked', !!locked);
  const existing = cardEl.querySelector(':scope > .premium-lock-overlay');
  if (!locked) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  cardEl.appendChild(makePremiumLockOverlay(title, sub));
}

function renderPremiumLocks(data) {
  const unlocked = hasPremiumAccess();

  // Progress tab lock badge on segment button
  const segBtns = document.querySelectorAll('.seg-btn');
  if (segBtns[2]) segBtns[2].classList.toggle('seg-locked', !unlocked);

  const progressTab = el('progressTabContent');
  if (progressTab) {
    progressTab.classList.toggle('feature-locked', !unlocked);
    let ov = progressTab.querySelector(':scope > .premium-lock-overlay');
    if (!unlocked && !ov) {
      progressTab.appendChild(makePremiumLockOverlay(
        'Progress is Premium',
        'See how your body recovers over time after your free trial.'
      ));
    } else if (unlocked && ov) ov.remove();
  }

  setFeatureLocked(el('monthGridCard'), !unlocked, 'Monthly calendar', 'Browse your full month history with Premium.');
  setFeatureLocked(el('journeyChartCard'), !unlocked, 'Journey graphs', 'Compare journeys after your trial with Premium.');
  setFeatureLocked(el('lifetimeStatsCard'), !unlocked, 'Lifetime stats', 'Career totals unlock with Premium.');
  setFeatureLocked(el('didYouKnowCard'), !unlocked, 'Knowledge cards', 'Extra insights are part of Premium.');
  setFeatureLocked(el('riskMeterCard'), !unlocked, 'Risk meter', 'AUDIT-C meter and re-tests are Premium after trial.');

  // Reduce target / low risk can stay tied to meter access
  setFeatureLocked(el('reductionTargetCard'), !unlocked, 'Reduction target', 'Targets unlock with Premium.');
}

function renderPremiumEntry() {
  const status = el('premiumEntryStatus');
  if (!status) return;
  if (isForcePremiumLocked()) {
    status.textContent = 'Locked';
    status.classList.remove('is-premium');
    return;
  }
  if (isPremiumActive()) {
    status.textContent = 'Active';
    status.classList.add('is-premium');
  } else if (isTrialActive()) {
    const left = trialDaysLeft();
    status.textContent = left <= 1 ? 'Trial · last day' : `Trial · ${left}d`;
    status.classList.remove('is-premium');
  } else {
    status.textContent = 'Upgrade';
    status.classList.remove('is-premium');
  }
}

// Paywall sheet + test lock (attached to Tracker for onclick="SoberTracker.…")
// Load this file after journey.js so Tracker exists.
Tracker.togglePremiumLockPreview = function() {
  if (!CONFIG.showTestUI) return;
  const next = !isForcePremiumLocked();
  setForcePremiumLocked(next);
  updatePremiumLockTestBtn();
  if (this.data) UI.renderAll(this.data);
  showToast(next ? 'UI: Locked preview' : 'UI: Default (unlocked)');
};

Tracker.openPremium = function() {
  selectedPremiumPlan = selectedPremiumPlan || 'yearly';
  this.selectPremiumPlan(selectedPremiumPlan);
  const sheet = el('premiumSheet');
  const banner = el('premiumActiveBanner');
  const cta = el('premiumCtaBtn');
  const active = isPremiumActive();
  if (banner) {
    if (active) {
      banner.textContent = 'You’re on Premium';
      banner.classList.add('show');
    } else if (isTrialActive()) {
      const left = trialDaysLeft();
      banner.textContent = left <= 1
        ? 'Free trial ends today'
        : `Free trial · ${left} days left`;
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  }
  if (cta) {
    cta.disabled = active;
    if (active) cta.textContent = 'Premium active';
    else this.selectPremiumPlan(selectedPremiumPlan);
  }
  if (sheet) {
    sheet.classList.add('open');
    document.body.classList.add('modal-open');
  }
};

Tracker.closePremium = function() {
  const sheet = el('premiumSheet');
  if (sheet) sheet.classList.remove('open');
  document.body.classList.remove('modal-open');
};

Tracker.selectPremiumPlan = function(planId) {
  if (!PREMIUM_PLANS[planId]) return;
  selectedPremiumPlan = planId;
  document.querySelectorAll('.premium-plan').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.plan === planId);
  });
  const cta = el('premiumCtaBtn');
  if (cta && !isPremiumActive()) cta.textContent = PREMIUM_PLANS[planId].cta;
};

Tracker.subscribePremium = function() {
  if (isPremiumActive()) {
    showToast('Premium is already active on this device.');
    return;
  }
  const plan = PREMIUM_PLANS[selectedPremiumPlan] || PREMIUM_PLANS.yearly;
  const expires = new Date();
  expires.setDate(expires.getDate() + (plan.days | 0));
  savePremiumRecord({
    active: true,
    plan: plan.id,
    startedAt: new Date().toISOString(),
    expiresAt: expires.toISOString(),
    source: 'local-stub',
  });
  renderPremiumEntry();
  if (this.data) UI.renderAll(this.data);
  this.closePremium();
  showToast(plan.id === 'yearly' ? 'Yearly Premium unlocked' : 'Monthly Premium unlocked');
};

Tracker.restorePremium = function() {
  if (isPremiumActive()) {
    renderPremiumEntry();
    showToast('Premium restored on this device.');
    this.closePremium();
    return;
  }
  showToast('No Premium purchase found on this device yet.');
};

