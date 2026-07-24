/* ===== src/data/local-storage.js ===== */
'use strict';
const AuditSession = {
  clearFields(data) {
    data.auditQ1      = null;
    data.auditQ2      = null;
    data.auditQ3      = null;
    data.auditAnswers = null;
    data.auditScore   = null;
    data.auditDate    = null;
  },

  forPersist(data) {
    return {
      ...data,
      auditQ1: null,
      auditQ2: null,
      auditQ3: null,
      auditAnswers: null,
      auditScore: null,
      auditDate: null,
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// DATA MANAGER
// ═══════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────
// DATA MANAGER
// Handles all reading and writing to localStorage.
// If you want to switch to Firebase later, only change this object.
// ─────────────────────────────────────────────
const DataManager = {
  KEY: 'soberJourney_v1',

  defaults() {
    return {
      lastDayCheck:               new Date().toISOString(),
      calendarDay:                1,
      attempt:                    1,
      currentScore:               { success:0, failures:0 },
      currentStreak:              0,
      todayStatus:                'none', // 'none' | 'success' | 'failed'
      todaySuccessLogged:         false,
      totalSuccessfulDays:        0,  // all-time sober days across every journey (persisted)
      totalFailures:              0,  // all-time drinking days across every journey (persisted)
      highestScore:               { success:0, failures:0 },
      nextJourneyTarget:          0,    // sober days to beat in the next journey (best journey score)
      longestStreak:              0,  // all-time best consecutive sober days — never resets between journeys
      streakPeakAtRunStart:       0,  // best streak to beat when current run began (after drink or new journey)
      inPersonalBest:             false,
      personalBestCelebrated:     false,
      journeyTrophies:            { 5:0,10:0,15:0,20:0,30:0,40:0,50:0,60:0,80:0,100:0,150:0,200:0 },
      journeyMilestonesRevealed:  { 150:false, 200:false },
      journeyPendingReset:        false,
      celebratedStreakMilestones: {},
      celebratedTrophies:         {},
      celebratedScienceMilestones: {},
      journeyBeatTarget:            0,
      journeyTargetChain:           [],
      journeyTargetStartShown:      false,
      celebratedJourneyTargets:     {},
      auditQ1:                    null,
      auditQ2:                    null,
      auditQ3:                    null,
      auditAnswers:               null,
      auditScore:                 null,
      auditDate:                  null,
      dailyLog:                   {},   // { 'YYYY-MM-DD': 'sober' | 'drinking' }
      scoredDays:                 {},   // { 'YYYY-MM-DD': true } — dates counted in currentScore (current journey)
      journeyStartKey:            null, // date key when current journey began — streak only counts scoredDays
      completedJourneys:          [],   // [{ attempt, score:{success,failures}, date }]
      bodyTimelineInstallAt:      null, // legacy first-open timestamp (timeline uses calendar noon)
      bodyTimelineWeekBlock:      0,    // streak milestone (7,14,21) — which week strip is held
      bodyTimelineWeekHoldCal:    0,    // calendar day through which that strip stays visible
      drinkDayFrozenStreak:       0,    // achieved streak held on the drinking calendar day
      drinkDayFrozenKey:          '',   // date key for drinkDayFrozenStreak
      drinkDayFrozenProgress:     0,    // 0 or 0.5 — timeline half-progress when drink was logged
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      return this._migrate(JSON.parse(raw));
    } catch(e) {
      console.warn('SoberJourney: localStorage data corrupted — starting fresh.');
      return this.defaults();
    }
  },

  // Debounced save — batches rapid writes into one localStorage operation
  _saveTimer: null,
  _pendingData: null,
  save(data) {
    this._pendingData = data;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.saveNow(this._pendingData);
      this._pendingData = null;
    }, 50);
  },

  // Flush a pending debounced save (e.g. on page hide) — does not write stale in-memory state
  flush() {
    if (this._saveTimer && this._pendingData) {
      this.saveNow(this._pendingData);
      this._pendingData = null;
    }
  },

  // Immediate write — use after catch-up so reload/timer can't read stale data
  saveNow(data) {
    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    try {
      localStorage.setItem(this.KEY, JSON.stringify(AuditSession.forPersist(data)));
    } catch(e) {
      if (!window._storageWarningShown) {
        window._storageWarningShown = true;
        const warn = document.getElementById('storageWarning');
        if (warn) warn.style.display = 'block';
      }
    }
  },

  _migrate(data) {
    const def = this.defaults();
    // Ensure all keys exist
    for (const k in def) {
      if (!(k in data)) data[k] = def[k];
    }
    if (!data.currentScore || typeof data.currentScore !== 'object' || Array.isArray(data.currentScore)) {
      data.currentScore = { success: 0, failures: 0 };
    }
    if (!data.highestScore || typeof data.highestScore !== 'object' || Array.isArray(data.highestScore)) {
      data.highestScore = { success: 0, failures: 0 };
    }
    if (!data.journeyTrophies) data.journeyTrophies = def.journeyTrophies;
    if (!data.journeyMilestonesRevealed) data.journeyMilestonesRevealed = { 150: false, 200: false };
    if ((data.journeyTrophies[150] || 0) > 0) data.journeyMilestonesRevealed[150] = true;
    if ((data.journeyTrophies[200] || 0) > 0) data.journeyMilestonesRevealed[200] = true;
    if ((data.highestScore?.success || 0) >= 80)  data.journeyMilestonesRevealed[150] = true;
    if ((data.highestScore?.success || 0) >= 100) data.journeyMilestonesRevealed[200] = true;
    if (!data.celebratedStreakMilestones) data.celebratedStreakMilestones = {};
    if (!data.celebratedTrophies)        data.celebratedTrophies        = {};
    if (!data.celebratedScienceMilestones) data.celebratedScienceMilestones = {};
    if (!data.dailyLog)         data.dailyLog         = {};
    if (!data.scoredDays)       data.scoredDays       = {};
    if (!data.completedJourneys) data.completedJourneys = [];
    if (!data.bodyTimelineInstallAt) data.bodyTimelineInstallAt = new Date().toISOString();
    data.bodyTimelineWeekBlock   = Math.max(0, parseInt(data.bodyTimelineWeekBlock,   10) || 0);
    data.bodyTimelineWeekHoldCal = Math.max(0, parseInt(data.bodyTimelineWeekHoldCal, 10) || 0);
    data.drinkDayFrozenStreak      = Math.max(0, parseInt(data.drinkDayFrozenStreak,      10) || 0);
    if (typeof data.drinkDayFrozenKey !== 'string') data.drinkDayFrozenKey = '';
    data.drinkDayFrozenProgress = Number(data.drinkDayFrozenProgress) >= 0.5 ? 0.5 : 0;

    // Coerce number fields — guard against string corruption from manual edits
    data.calendarDay           = Math.max(1, parseInt(data.calendarDay)           || 1);
    data.attempt               = Math.max(1, parseInt(data.attempt)               || 1);
    data.currentStreak         = Math.max(0, parseInt(data.currentStreak)         || 0);
    data.longestStreak         = Math.max(0, parseInt(data.longestStreak)         || 0);
    if (typeof data.streakPeakAtRunStart !== 'number') {
      data.streakPeakAtRunStart = (data.currentStreak | 0) > 0 ? 0 : (data.longestStreak | 0);
    } else {
      data.streakPeakAtRunStart = Math.max(0, parseInt(data.streakPeakAtRunStart, 10) || 0);
    }
    data.totalSuccessfulDays   = Math.max(0, parseInt(data.totalSuccessfulDays)   || 0);
    data.totalFailures         = Math.max(0, parseInt(data.totalFailures)         || 0);
    data.currentScore.success  = Math.max(0, parseInt(data.currentScore.success,  10) || 0);
    data.currentScore.failures = Math.max(0, parseInt(data.currentScore.failures, 10) || 0);
    data.highestScore.success  = Math.max(0, parseInt(data.highestScore.success,  10) || 0);
    data.highestScore.failures = Math.max(0, parseInt(data.highestScore.failures, 10) || 0);
    if (typeof data.nextJourneyTarget !== 'number') {
      data.nextJourneyTarget = data.highestScore.success;
    } else {
      data.nextJourneyTarget = Math.max(0, parseInt(data.nextJourneyTarget, 10) || 0);
    }
    // Keep target aligned with all-time best (target never drops below best)
    if (data.nextJourneyTarget < data.highestScore.success) {
      data.nextJourneyTarget = data.highestScore.success;
    }

    // Rebuild scoredDays from score + dailyLog — fixes stale flags that block catch-up scoring
    this._rebuildScoredDays(data);
    if (reconcileDrinkLogToScore(data)) this._rebuildScoredDays(data);

    // Coerce and clamp AUDIT-C scores — prevent corrupted values affecting meter
    if (data.auditQ1 !== null && data.auditQ1 !== undefined)
      data.auditQ1 = Math.min(4, Math.max(0, parseInt(data.auditQ1) || 0));
    if (data.auditQ2 !== null && data.auditQ2 !== undefined)
      data.auditQ2 = Math.min(4, Math.max(0, parseInt(data.auditQ2) || 0));
    if (data.auditQ3 !== null && data.auditQ3 !== undefined)
      data.auditQ3 = Math.min(4, Math.max(0, parseInt(data.auditQ3) || 0));

    // Audit results are session-only — never restore from localStorage
    AuditSession.clearFields(data);

    return data;
  },

  // Mark which dailyLog dates are already reflected in currentScore (prevents double-count)
  _rebuildScoredDays(data) {
    const log = data.dailyLog || {};
    const startKey = data.journeyStartKey || null;
    const needSober = Math.max(0, parseInt(data.currentScore.success, 10) || 0);
    const needDrink = Math.max(0, parseInt(data.currentScore.failures, 10) || 0);
    const scored = {};

    // Drinking days — newest first within this journey
    const keysDesc = Object.keys(log)
      .filter(k => !startKey || k >= startKey)
      .sort()
      .reverse();
    let drinkMarked = 0;
    for (const k of keysDesc) {
      if (log[k] === 'drinking' && drinkMarked < needDrink) {
        scored[k] = true;
        drinkMarked++;
      }
    }

    // Sober days — consecutive chain ending at today (or yesterday), so streak matches score
    let soberMarked = 0;
    if (needSober > 0) {
      let cursor = getAppToday(data);
      if (log[dateKey(cursor)] !== 'sober') {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (soberMarked < needSober) {
        const key = dateKey(cursor);
        if (startKey && key < startKey) break;
        if (log[key] === 'sober') {
          scored[key] = true;
          soberMarked++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Fallback: non-consecutive score (reclaimed dates) — newest N sober in journey
    if (soberMarked < needSober) {
      for (const k of keysDesc) {
        if (log[k] === 'sober' && soberMarked < needSober) {
          scored[k] = true;
          soberMarked++;
        }
      }
    }

    data.scoredDays = scored;
  },

  _updateBestFromData(data) {
    applyBestScore(data, data.currentScore);
  }
};


// ─────────────────────────────────────────────────────────────
// CONFIG — single place to control environment behaviour
//
// CONFIG — personal PWA defaults (flip showTestUI for dev testing)
