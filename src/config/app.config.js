/* ===== src/config/app.config.js ===== */
'use strict';
const JOURNEY_MAX_FAILURES   = 10;   // drinking days before journey ends

// Score display — always "sober – drinks" (consistent separator at every failure count)
function formatScoreHTML(score) {
  const s = (score.success | 0);
  const f = (score.failures | 0);
  return `${s} <span class="score-dash">–</span> <span class="score-failures">${f}</span>`;
}

function formatScoreText(score) {
  const s = (score.success | 0);
  const f = (score.failures | 0);
  return `${s} – ${f}`;
}

// Best journey comparison — more sober days wins; same sober → X-10 beats X-9 (journey-end special case); otherwise fewer drinks wins.
function isScoreBetterThan(cur, best) {
  const cs = cur.success | 0, cf = cur.failures | 0;
  const bs = best.success | 0, bf = best.failures | 0;
  if (cs > bs) return true;
  if (cs < bs) return false;
  if (cf === JOURNEY_MAX_FAILURES && bf === (JOURNEY_MAX_FAILURES - 1)) return true;  // X-10 beats X-9
  if (bf === JOURNEY_MAX_FAILURES && cf === (JOURNEY_MAX_FAILURES - 1)) return false; // X-9 does not beat X-10
  return cf < bf;
}

function applyBestScore(data, cur) {
  if (!data.highestScore || typeof data.highestScore !== 'object') {
    data.highestScore = { success: 0, failures: 0 };
  }
  if (!isScoreBetterThan(cur, data.highestScore)) return;
  data.highestScore = { success: cur.success | 0, failures: cur.failures | 0 };
}

function getBestCompletedJourneyScore(data) {
  let best = { success: 0, failures: 0 };
  for (const j of (data?.completedJourneys || [])) {
    if (j?.score) best = isScoreBetterThan(j.score, best) ? { success: j.score.success | 0, failures: j.score.failures | 0 } : best;
  }
  return best;
}

function isBeatingBestScore(data) {
  if (!data || data.journeyPendingReset) return false;
  if (!(data.completedJourneys || []).length) return false;
  return isScoreBetterThan(data.currentScore, getBestCompletedJourneyScore(data));
}
const AUDIT_MAX_SCORE        = 12;   // max possible AUDIT-C score
const AUDIT_DEPENDENT_SCORE  = 9;    // score >= this → Dependent zone
const AUDIT_HARMFUL_SCORE    = 6;    // score >= this → Harmful zone
const AUDIT_HAZARDOUS_SCORE  = 4;    // score >= this → Hazardous zone
const AUDIT_LOW_RISK_SCORE   = 1;    // score >= this → Low Risk zone
const CATCHUP_MAX_DAYS       = 30;   // max missed days processed per catch-up
const MAX_COMPLETED_JOURNEYS = 20;   // free journey history cap
const MAX_COMPLETED_JOURNEYS_PREMIUM = 100; // premium journey history cap
const PREMIUM_KEY = 'sj_premium';
const TRIAL_KEY = 'sj_trialStartedAt';
const TRIAL_DAYS = 14;
const FREE_JOURNEY_MILESTONE_DAYS = 50;
const PREMIUM_PLANS = {
  monthly: { id: 'monthly', label: 'Monthly', priceLabel: '₹149', cta: 'Start Monthly — ₹149', days: 31 },
  yearly:  { id: 'yearly',  label: 'Yearly',  priceLabel: '₹999', cta: 'Start Yearly — ₹999',  days: 366 },
};
const MS_PER_DAY             = 86400000; // milliseconds in one day
const CONFETTI_DURATION_MS   = 4000; // how long confetti stays on screen
const TOAST_DURATION_MS      = 3200; // how long toast message shows
const MIDNIGHT_CHECK_MS      = 5000; // MidnightTimer check interval
const D3_RETRY_MS            = 500;  // d3 load retry interval
const D3_RETRY_MAX           = 20;   // stop retrying after this many attempts

// AUDIT-C results stay in memory only for the current page load.
// Reload or reopening the app clears the test; journey data stays in localStorage.

const CONFIG = {
  isProduction:   true,
  showTestUI:     true,
  showOnboarding: true,
  buildTag:       'personal-v1',
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
// Returns a date as string "YYYY-MM-DD" — used as key in dailyLog
// Call with new Date() for today, or any other date
