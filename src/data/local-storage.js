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
      currentJourneyStreaks:      [],   // ended streak lengths in current journey (on each drink)
      pastJourneyStreaks:         [],   // [{ attempt, streaks:[days...], date }]
      drinkDayFrozenStreak:       0,    // achieved streak held on the drinking calendar day
      drinkDayFrozenKey:          '',   // date key for drinkDayFrozenStreak
      reminders:                  { dailyEnabled: false, dailyTime: '20:00' },
      /** ISO — free-trial anchor (mirrors sj_trialStartedAt in localStorage). */
      trialStartedAt:             null,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      const parsed = JSON.parse(raw);
      return this._migrate(parsed);
    } catch (e) {
      console.warn('10Drinks: localStorage data corrupted — starting fresh.');
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

  // Drop a scheduled save without writing (e.g. before wipe)
  cancelPendingSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    this._pendingData = null;
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
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return this.defaults();
    }
    const def = this.defaults();
    if (typeof isSimulatedDayEnabled === 'function' && !isSimulatedDayEnabled()) delete data.simulatedToday;
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
    if (!Array.isArray(data.currentJourneyStreaks)) data.currentJourneyStreaks = [];
    if (!Array.isArray(data.pastJourneyStreaks)) data.pastJourneyStreaks = [];
    data.drinkDayFrozenStreak      = Math.max(0, parseInt(data.drinkDayFrozenStreak,      10) || 0);
    if (typeof data.drinkDayFrozenKey !== 'string') data.drinkDayFrozenKey = '';
    if (!data.reminders || typeof data.reminders !== 'object') {
      data.reminders = { ...def.reminders };
    } else {
      if (typeof data.reminders.dailyEnabled !== 'boolean') data.reminders.dailyEnabled = false;
      if (!/^\d{2}:\d{2}$/.test(data.reminders.dailyTime || '')) data.reminders.dailyTime = def.reminders.dailyTime;
    }

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

    if (typeof healAllOrphanScoredDays === 'function') healAllOrphanScoredDays(data);
    // Rebuild scoredDays from score + dailyLog — fixes stale flags that block catch-up scoring
    this._rebuildScoredDays(data);
    reconcileLogsToJourneyScore(data);
    if (typeof healInvalidHighestScore === 'function' && healInvalidHighestScore(data)) {
      if (typeof applyBestScore === 'function') applyBestScore(data, data.currentScore);
    }

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

  _rebuildScoredDays(data) {
    recalculateJourneyScoreFromLog(data);
  },

  _updateBestFromData(data) {
    applyBestScore(data, data.currentScore);
  }
};


// ─────────────────────────────────────────────────────────────
// CONFIG — single place to control environment behaviour
//
// CONFIG — personal PWA defaults (flip showTestUI for dev testing)
