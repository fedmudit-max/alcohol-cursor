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

function isFirstJourneyInProgress(data) {
  if (!data || data.journeyPendingReset) return false;
  return (data.attempt | 0) === 1 && !(data.completedJourneys || []).length;
}

function isValidJourneyScore(score) {
  if (!score || typeof score !== 'object' || Array.isArray(score)) return false;
  const f = score.failures | 0;
  return f >= 0 && f <= JOURNEY_MAX_FAILURES;
}

function recomputeBestFromValidSources(data) {
  let best = { success: 0, failures: 0 };
  for (const j of (data?.completedJourneys || [])) {
    if (!j?.score || !isValidJourneyScore(j.score)) continue;
    const s = { success: j.score.success | 0, failures: j.score.failures | 0 };
    best = pickBetterScore(s, best);
  }
  if (data?.currentScore && isValidJourneyScore(data.currentScore)) {
    const cur = { success: data.currentScore.success | 0, failures: data.currentScore.failures | 0 };
    best = pickBetterScore(cur, best);
  }
  return best;
}

function healInvalidHighestScore(data) {
  if (!data) return false;
  ensureScoreNumbers(data);
  if (isValidJourneyScore(data.highestScore)) return false;
  data.highestScore = recomputeBestFromValidSources(data);
  return true;
}

function pickBetterScore(candidate, best) {
  if (!best || typeof best !== 'object') {
    return { success: candidate.success | 0, failures: candidate.failures | 0 };
  }
  return isScoreBetterThan(candidate, best)
    ? { success: candidate.success | 0, failures: candidate.failures | 0 }
    : { success: best.success | 0, failures: best.failures | 0 };
}

// Best Score card — laotzu101: J1 mirrors current; J2+ shows better of live score vs stored best journey.
function getDisplayBestScore(data) {
  ensureScoreNumbers(data);
  const cur = { success: data.currentScore.success | 0, failures: data.currentScore.failures | 0 };
  if (isFirstJourneyInProgress(data)) return cur;
  const stored = isValidJourneyScore(data.highestScore)
    ? { success: data.highestScore.success | 0, failures: data.highestScore.failures | 0 }
    : recomputeBestFromValidSources(data);
  return pickBetterScore(cur, stored);
}

/** Permanent best (highestScore) — laotzu101: J1 tracks live; J2+ commits only when journey ends (10 drinks). */
function applyBestScore(data, cur) {
  if (!isValidJourneyScore(cur)) return;
  if (!data.highestScore || typeof data.highestScore !== 'object') {
    data.highestScore = { success: 0, failures: 0 };
  }
  if (isFirstJourneyInProgress(data)) {
    data.highestScore = { success: cur.success | 0, failures: cur.failures | 0 };
    return;
  }
  if ((cur.failures | 0) < JOURNEY_MAX_FAILURES) return;
  if (!isValidJourneyScore(data.highestScore)) {
    data.highestScore = recomputeBestFromValidSources(data);
  }
  if (!isScoreBetterThan(cur, data.highestScore)) return;
  data.highestScore = { success: cur.success | 0, failures: cur.failures | 0 };
}

function getBestCompletedJourneyScore(data) {
  let best = { success: 0, failures: 0 };
  for (const j of (data?.completedJourneys || [])) {
    if (!j?.score || !isValidJourneyScore(j.score)) continue;
    const s = { success: j.score.success | 0, failures: j.score.failures | 0 };
    best = isScoreBetterThan(s, best) ? s : best;
  }
  return best;
}

function isBeatingBestScore(data) {
  if (!data || data.journeyPendingReset) return false;
  if (!(data.completedJourneys || []).length) return false;
  return isScoreBetterThan(data.currentScore, getBestCompletedJourneyScore(data));
}
const AUDIT_MAX_SCORE        = 12;   // max possible AUDIT-C score
const AUDIT_SEEK_SUPPORT_SCORE = 9;  // score >= this → Seek Support (high-risk screening range)
const AUDIT_HARMFUL_SCORE    = 6;    // score >= this → Harmful zone
const AUDIT_HAZARDOUS_SCORE  = 4;    // score >= this → Hazardous zone
const AUDIT_LOW_RISK_SCORE   = 1;    // score >= this → Low Risk zone
const MAX_COMPLETED_JOURNEYS = 20;   // free journey history cap
const MAX_COMPLETED_JOURNEYS_PREMIUM = 100; // premium journey history cap
const PREMIUM_KEY = 'sj_premium';
const TRIAL_KEY = 'sj_trialStartedAt';
const TRIAL_POLICY_KEY = 'sj_trialPolicyDays'; // last shipped TRIAL_DAYS (for length bumps)
/** Wall-clock days from first app open (not journey “Day” on the dashboard). */
const TRIAL_DAYS = 15;
const LEGACY_TRIAL_DAYS = 14;
/** Dashboard Best Score tile + calendar: lock from this journey # without Premium (trial still counts as access on J1–2 only). */
const BEST_SCORE_CARD_LOCK_FROM_ATTEMPT = 3;
const CALENDAR_LOCK_FROM_ATTEMPT = 3;
/** History, Best Scores, Lifetime — lock from this journey without Premium. */
const BEST_SCORE_LOCK_FROM_ATTEMPT = 4;
const FREE_JOURNEY_MILESTONE_DAYS = 50;
const PREMIUM_PLANS = {
  monthly: { id: 'monthly', label: 'Monthly', days: 31 },
  yearly:  { id: 'yearly',  label: 'Yearly',  days: 366 },
};
const MS_PER_DAY             = 86400000; // milliseconds in one day
const CONFETTI_DURATION_MS   = 4000; // how long confetti stays on screen
const TOAST_DURATION_MS      = 3200; // how long toast message shows
const MIDNIGHT_CHECK_MS      = 5000; // MidnightTimer check interval
const D3_RETRY_MS            = 500;  // d3 load retry interval
const D3_RETRY_MAX           = 20;   // stop retrying after this many attempts

// AUDIT-C results stay in memory only for the current page load.
// Reload or reopening the app clears the test; journey data stays in localStorage.

// User-facing app name (manifest/title/metadata — keep in sync with manifest.json).
const APP_DISPLAY_NAME = '10Drinks';

// Public privacy policy (Google Play, Settings link).
const PRIVACY_POLICY_URL = 'https://10drinksprivacy.netlify.app/';

// Billing mode: 'local-stub' (dev/test via showTestUI) or 'store' (native IAP when wired).
const PREMIUM_BILLING_MODE = 'local-stub';

const CONFIG = {
  isProduction:   true,
  showTestUI:     false,
  /**
   * Set true only when optional dev scripts are loaded (next-day-test.js / trial-test-bar.js).
   * Default false — production index.html does not load those files.
   */
  showInternalTestBar: false,
  showOnboarding: true,
  buildTag:       'production',
  premiumBilling: PREMIUM_BILLING_MODE,
  /**
   * When true, Premium features lock after the free trial unless the user has Premium.
   * Independent of paywall/subscribe UI (use showPremiumInApp for that).
   */
  enforceTrialEntitlement: true,
  /**
   * false = hide paywall sheet and most Premium marketing UI.
   * true = show full entitlement UX; pair with showPremiumSubscribe when billing is live.
   */
  showPremiumInApp: false,
  /** Only applies when showPremiumInApp is true. */
  showPremiumSubscribe: false,
  /** false = hide Premium section in Settings until billing is live. */
  showPremiumInSettings: false,
  privacyPolicyUrl: PRIVACY_POLICY_URL,
};

/** QA bars (Next Day / 3-Day Gap) — separate from trial entitlement / local Premium stub. */
function isSimulatedDayEnabled() {
  return CONFIG.showTestUI === true || CONFIG.showInternalTestBar === true;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
// Returns a date as string "YYYY-MM-DD" — used as key in dailyLog
// Call with new Date() for today, or any other date
