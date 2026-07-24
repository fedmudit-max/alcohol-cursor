/* ===== src/journey/journey.js ===== */
'use strict';

// ═══════════════════════════════════════════════════════════════
// TRACKER (main app controller)
// Handles logging, milestones, celebrations, journey management.
// Backup/import lives in src/data/backup.js (attaches after load).
// ═══════════════════════════════════════════════════════════════

const Tracker = {
  data:            null,
  pendingAction:   null,
  _celebQueue:     [],
  _celebrating:    false,
  _currentStreaks: [], // memory-only — not persisted. Used for future analytics.

  init() {
    ensureTrialStarted();
    this.data = DataManager.load();
    if (typeof this.data.dykIndex !== 'number') this.data.dykIndex = 0;
    if (!this.data.journeyStartKey) {
      // Legacy saves: infer journey start from oldest day in current score window
      const keys = Object.keys(this.data.dailyLog || {}).sort().reverse();
      let soberMarked = 0;
      const success = (this.data.currentScore && this.data.currentScore.success) || 0;
      const windowKeys = [];
      for (const k of keys) {
        if (this.data.dailyLog[k] === 'sober' && soberMarked < success) {
          windowKeys.push(k);
          soberMarked++;
        }
      }
      this.data.journeyStartKey = windowKeys.length
        ? windowKeys[windowKeys.length - 1]
        : dateKey(getAppToday(this.data));
    }
    // Self-heal: sim clock cleared but start key still in the future blocks logging
    const appTodayKey = dateKey(getAppToday(this.data));
    if (this.data.journeyStartKey && this.data.journeyStartKey > appTodayKey) {
      this.data.journeyStartKey = appTodayKey;
    }
    DataManager._rebuildScoredDays(this.data);
    if (reconcileDrinkLogToScore(this.data)) {
      DataManager._rebuildScoredDays(this.data);
      DataManager.saveNow(this.data);
    }
    recalculateStreakFromLog(this.data);
    if ((this.data.currentScore.failures | 0) >= JOURNEY_MAX_FAILURES && !this.data.journeyPendingReset) {
      this._endJourney();
    }
    this._catchUp();
    ensureJourneyTargetChain(this.data);
    UI.renderAll(this.data);
    MidnightTimer.start();
    setTimeout(() => {
      el('splash').classList.add('hidden');
      document.body.classList.add('loaded');
    }, 300);
  },


  // --- AUTO ADVANCE ---
  // batchMode=true: skip save/render/celebrations (called from _catchUp loop — saves once after all days)
  autoAdvanceDay(batchMode = false) {
    const d = this.data;
    if (!d.dailyLog) d.dailyLog = {};
    if (d.journeyPendingReset) {
      const appToday = getAppToday(d);
      const nextDay  = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate() + 1, 12, 0, 0);
      if (CONFIG.showTestUI) d.simulatedToday = nextDay.toISOString();
      this._startNew();
      if (!batchMode) {
        DataManager.saveNow(d);
        refreshStreakUI(d);
        UI.renderAll(d);
        if (CONFIG.showTestUI) {
          showToast(`Journey ${d.attempt} · Day 1 · ${dateKey(getAppToday(d))}`);
        }
      }
      return;
    }
    if (d.currentScore.failures >= JOURNEY_MAX_FAILURES) { this._endJourney(); return; }

    const appToday = getAppToday(d);
    const nextDay  = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate() + 1, 12, 0, 0);
    d.simulatedToday = nextDay.toISOString();
    d.lastDayCheck   = nextDay.toISOString();
    d.calendarDay++;
    d.todayStatus = 'none';
    d.todaySuccessLogged = false;
    clearDrinkDayFrozenStreak(d);

    DataManager._rebuildScoredDays(d);
    recalculateStreakFromLog(d);
    if (!batchMode) {
      DataManager.saveNow(d);
      refreshStreakUI(d);
      UI.renderAll(d);
      if (CONFIG.showTestUI) {
        showToast(`Test day: ${dateKey(nextDay)} — log sober or drink below`);
      }
    }
  },

  // --- USER ACTIONS ---

  // --- LOG YESTERDAY ---
  logYesterday(status) {
    el('yesterdayModal').classList.remove('active');
    const d = this.data;
    const appToday = getAppToday(d);
    const yest = new Date(appToday);
    yest.setDate(yest.getDate() - 1);
    const key  = dateKey(yest);

    // Clear today's session flags before recalc so yesterday's entry drives streak
    d.todayStatus = 'none';
    d.todaySuccessLogged = false;

    if (status === 'success') {
      const added = this._recordSoberDay(d, key);
      if (added) {
        recalculateStreakFromLog(d);
        this._checkTrophies();
        for (const m of STREAK_MILESTONES) {
          if (d.currentStreak === m.days && !d.celebratedStreakMilestones[m.id]) {
            d.celebratedStreakMilestones[m.id] = true;
            markStreakOwnedScienceCelebrated(d, m.days);
            launchConfetti(90);
            this._queueCelebration(m.c.emoji, m.c.title, m.c.msg);
            break;
          }
        }
        this._checkScienceMilestones();
        this._checkJourneyTargets();
      }
    } else {
      this._recordDrinkDay(d, key);
      if (d.currentScore.failures >= JOURNEY_MAX_FAILURES) { this._endJourney(); return; }
    }

    recalculateStreakFromLog(d);
    syncSessionCheckpoint(d);
    DataManager.saveNow(d);
    refreshStreakUI(d);
    UI.renderAll(d);
  },

  // Advance lastDayCheck by one calendar day (noon local — avoids DST edge cases)
  _advanceLastDayCheck(d) {
    const last = new Date(d.lastDayCheck);
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1, 12, 0, 0);
    d.lastDayCheck = next.toISOString();
  },

  handleSuccess() {
    if (this.data.todayStatus === 'failed' || this.data.todaySuccessLogged) return;
    this.showConfirmModal('success');
  },

  showConfirmModal(action) {
    this.pendingAction = action;
    const wrap = el('resetConfirmWrap');
    const input = el('resetConfirmInput');
    const btn = el('modalConfirmBtn');
    if (wrap) wrap.style.display = 'none';
    if (input) input.value = '';
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Confirm';
    }

    let msg = 'Log a drink? This uses one chance.';
    if (action === 'success') msg = 'Mark today as sober?';
    else if (action === 'reset') {
      msg = 'Delete all data?';
      if (wrap) wrap.style.display = 'block';
      if (btn) {
        btn.textContent = 'Yes, delete all';
        btn.disabled = true;
        btn.style.opacity = '0.4';
      }
    } else if (action === 'import') {
      msg = formatImportConfirmMessage(pendingImportBackup);
      if (btn) btn.textContent = 'Restore progress';
    }
    UI.showModal(msg);
    if (action === 'reset' && input) setTimeout(() => input.focus(), 80);
  },

  checkResetConfirmInput() {
    const input = el('resetConfirmInput');
    const btn = el('modalConfirmBtn');
    if (!input || !btn || this.pendingAction !== 'reset') return;
    const ok = input.value.trim().toUpperCase() === 'RESET';
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.4';
  },

  closeModal() {
    UI.hideModal();
    this.pendingAction = null;
    pendingImportBackup = null;
    const wrap = el('resetConfirmWrap');
    const input = el('resetConfirmInput');
    const btn = el('modalConfirmBtn');
    if (wrap) wrap.style.display = 'none';
    if (input) input.value = '';
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Confirm';
    }
  },

  confirmAction() {
    const a = this.pendingAction;
    const importBackup = a === 'import' ? pendingImportBackup : null;
    if (a === 'reset') {
      const input = el('resetConfirmInput');
      if (!input || input.value.trim().toUpperCase() !== 'RESET') return;
    }
    this.closeModal();
    if (a === 'success') this._doSuccess();
    else if (a === 'fail') this._doFail();
    else if (a === 'reset') this._deleteAllData();
    else if (a === 'import') this._restoreImportBackup(importBackup);
  },

  closeAcknowledge() { el('acknowledgeModal').classList.remove('active'); },

  switchTab(idx) {
    if (idx === 2 && !hasPremiumAccess()) {
      this.openPremium();
      // Still show the tab (with overlay) so the lock is visible
    }
    document.querySelectorAll('.seg-btn').forEach((b,i)     => b.classList.toggle('active', i === idx));
    document.querySelectorAll('.tab-content').forEach((c,i) => c.classList.toggle('active', i === idx));
  },

  // --- INTERNAL ---

  // Helper: save data and re-render UI in one call
  _saveAndRender() {
    DataManager.save(this.data);
    UI.renderAll(this.data);
  },
  _doSuccess() {
    const d = this.data;
    const key = dateKey(getAppToday(d));
    const isFirst = d.currentScore.success === 0 && d.attempt === 1;
    const prevLongest = d.longestStreak;

    if (!this._recordSoberDay(d, key)) {
      showToast('Could not log this day — please refresh and try again.');
      return;
    }

    d.todayStatus = 'success';
    d.todaySuccessLogged = true;
    recalculateStreakFromLog(d);
    // Popup only when beating a prior streak run (not day 2 of your first ever streak)
    const justBroke = d.currentStreak > prevLongest && prevLongest > 0
      && (d.streakPeakAtRunStart | 0) > 0
      && !d.personalBestCelebrated;
    if (justBroke) d.personalBestCelebrated = true;
    DataManager.saveNow(d);
    refreshStreakUI(d);
    UI.renderAll(d);
    setTimeout(() => {
      if (isFirst) {
        launchConfetti(120);
        markStreakOwnedScienceCelebrated(d, 1);
        this._queueCelebration('🌅','Day 1 — You Showed Up!',"The hardest part is starting. You did it. This is the beginning of everything.");
      } else if (justBroke) {
        launchConfetti(110);
        this._queueCelebration('🏆',`New Personal Best — ${d.currentStreak} Days!`,`You just beat your longest streak ever (${prevLongest} days). Uncharted territory. Keep going!`);
      }
      this._checkTrophies();
      if (!isFirst && !justBroke) {
        for (const m of STREAK_MILESTONES) {
          if (d.currentStreak === m.days && !d.celebratedStreakMilestones[m.id]) {
            d.celebratedStreakMilestones[m.id] = true;
            markStreakOwnedScienceCelebrated(d, m.days);
            DataManager.save(d);
            launchConfetti(90);
            this._queueCelebration(m.c.emoji, m.c.title, m.c.msg);
            break;
          }
        }
      }
      this._checkScienceMilestones();
      this._checkJourneyTargets();
      if (this._celebQueue.length > 0) return;
      showToast(_dailyMsg(d.currentStreak, d.currentScore));
    }, 300);
  },

  _doFail() {
    const d = this.data;
    if (d.todayStatus === 'success') return;
    const key = dateKey(getAppToday(d));
    if (!this._recordDrinkDay(d, key)) return;
    d.todayStatus = 'failed';
    recalculateStreakFromLog(d);
    d.bodyTimelineWeekBlock = 0;
    d.bodyTimelineWeekHoldCal = 0;
    d.personalBestCelebrated = false;
    d.celebratedStreakMilestones = {};
    d.celebratedScienceMilestones = {};
    // Reset Progress tab to default (Streak tab + hide long-term science milestones)
    this.switchTab(0);
    // Reset streak milestone UI
    STREAK_MILESTONES.forEach(m => {
      const row = el(m.el); if (!row) return;
      row.classList.remove('milestone-active');
      const nameEl = row.querySelector('.milestone-name');
      const statEl = row.querySelector('.milestone-status');
      if (nameEl) { nameEl.className = 'milestone-name'; nameEl.textContent = `Day ${m.days}`; }
      if (statEl) { statEl.className = 'milestone-status'; statEl.textContent = '—'; }
    });
    this._updateBest();
    if (d.currentScore.failures >= JOURNEY_MAX_FAILURES) {
      UI.hideModal();
      this._endJourney();
    } else {
      DataManager.saveNow(d);
      UI.renderAll(d);
      UI.hideModal();
      setTimeout(() => el('acknowledgeModal').classList.add('active'), 250);
    }
  },

  _endJourney() {
    const d = this.data;
    // Guard against double-call (e.g. rapid double-tap at exactly 10 failures)
    if (d.journeyPendingReset) return;
    if (!d.completedJourneys) d.completedJourneys = [];
    d.completedJourneys.push({ attempt: d.attempt, score: {...d.currentScore}, date: new Date().toISOString() });
    const histCap = journeyHistoryCap();
    if (d.completedJourneys.length > histCap) {
      d.completedJourneys = d.completedJourneys.slice(-histCap);
    }
    const prevBest = d.highestScore.success | 0;
    this._updateBest();
    d.nextJourneyTarget = d.highestScore.success | 0;
    const celeb = buildJourneyEndCelebration(d, prevBest);
    // Mark journey as pending reset — buttons show "Journey Ended" state
    d.journeyPendingReset = true;
    if ((d.currentStreak | 0) > (d.longestStreak | 0)) d.longestStreak = d.currentStreak | 0;
    d.currentStreak = 0;
    d.inPersonalBest = false;
    const appToday = getAppToday(d);
    d.lastDayCheck = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate(), 12, 0, 0).toISOString();
    DataManager.save(d);
    refreshStreakUI(d);
    this.resetJourneyTabView();
    UI.renderAll(d);
    setTimeout(() => this._queueCelebration('🎯', celeb.title, celeb.msg), 300);
  },

  resetJourneyTabView() {
    this.switchTab(1);
  },

  _startNew() {
    const d = this.data;
    if (!CONFIG.showTestUI) delete d.simulatedToday;
    let appToday = getAppToday(d);
    const todayKey = dateKey(appToday);
    // Prior journey ended with a drink today — new journey starts next calendar day
    if (d.dailyLog && d.dailyLog[todayKey] === 'drinking') {
      appToday = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate() + 1, 12, 0, 0);
      if (CONFIG.showTestUI) d.simulatedToday = appToday.toISOString();
    }
    d.attempt++;
    d.currentScore = { success:0, failures:0 };
    d.scoredDays = {};
    if ((d.currentStreak | 0) > (d.longestStreak | 0)) d.longestStreak = d.currentStreak | 0;
    d.currentStreak = 0;
    d.calendarDay = 1;
    d.bodyTimelineWeekBlock = 0;
    d.bodyTimelineWeekHoldCal = 0;
    clearDrinkDayFrozenStreak(d);
    d.todayStatus = 'none';
    d.todaySuccessLogged = false;
    d.inPersonalBest = false;
    d.personalBestCelebrated = false;
    d.celebratedStreakMilestones = {};
    d.celebratedScienceMilestones = {};
    d.celebratedTrophies = {};
    d.celebratedJourneyTargets = {};
    d.journeyBeatTarget = getBestCompletedJourneyScore(d).success;
    d.journeyTargetChain = buildJourneyTargetChain(d.journeyBeatTarget);
    d.journeyTargetStartShown = false;
    d.journeyPendingReset = false;
    d.gapSimCount = 0;
    d.journeyStartKey = dateKey(appToday);
    d.lastDayCheck = new Date(appToday.getFullYear(), appToday.getMonth(), appToday.getDate(), 12, 0, 0).toISOString();
    d.streakPeakAtRunStart = d.longestStreak | 0;
    this._currentStreaks = [];
    DataManager.save(d);
    refreshStreakUI(d);
    this.resetJourneyTabView();
    UI.renderAll(d);
  },

  // ─── HELPERS ──────────────────────────────────────

  _ensureScore(d) {
    ensureScoreNumbers(d);
    if (!d.highestScore || typeof d.highestScore !== 'object' || Array.isArray(d.highestScore)) {
      d.highestScore = { success: 0, failures: 0 };
    }
  },

  // Record one sober day in dailyLog + currentScore (once per date via scoredDays)
  _recordSoberDay(d, key) {
    this._ensureScore(d);
    if (!d.dailyLog) d.dailyLog = {};
    if (!d.scoredDays) d.scoredDays = {};
    if (d.journeyStartKey && key < d.journeyStartKey) return false;
    if (d.dailyLog[key] === 'drinking') {
      if (d.scoredDays[key]) return false;
      // Prior-journey drink on this date — allow sober once new journey owns this day
    } else if (d.dailyLog[key] === 'sober') {
      if (d.scoredDays[key]) return false;
      // Same calendar day from a prior journey — count toward this journey's score
      d.scoredDays[key] = true;
      d.currentScore.success++;
      d.totalSuccessfulDays++;
      this._updateBest();
      ensureScoreNumbers(d);
      return true;
    }
    if (d.scoredDays[key]) return false;

    d.dailyLog[key] = 'sober';
    d.scoredDays[key] = true;
    d.currentScore.success++;
    d.totalSuccessfulDays++;
    this._updateBest();
    ensureScoreNumbers(d);
    return true;
  },

  // Record one drinking day in dailyLog + currentScore (once per date via scoredDays)
  _recordDrinkDay(d, key) {
    this._ensureScore(d);
    const ok = recordDrinkDay(d, key);
    if (ok && d.currentStreak > 0) this._currentStreaks.push(d.currentStreak);
    return ok;
  },

  _updateBest() {
    applyBestScore(this.data, this.data.currentScore);
  },

  _checkTrophies() {
    const d = this.data;
    const s = d.currentScore.success;
    if (!d.journeyTrophies) d.journeyTrophies = {};
    if (!d.celebratedTrophies) d.celebratedTrophies = {};
    for (const m of JOURNEY_TROPHIES) {
      // s === m.days fires only once per exact day count
      // celebratedTrophies prevents double-fire if called multiple times on same day
      if (isTrophyEarned(s, m.days, d.celebratedTrophies)) {
        d.journeyTrophies[m.days]   = (d.journeyTrophies[m.days] || 0) + 1;
        d.celebratedTrophies[m.days] = true;
        DataManager.save(d);
        launchConfetti(100);
        this._queueCelebration(m.c.emoji, m.c.title, m.c.msg);
      }
    }
  },

  _showJourneyStartTarget(d) {
    if (!d || d.journeyPendingReset) return;
    ensureJourneyTargetChain(d);
    if (d.journeyTargetStartShown) return;
    d.journeyTargetStartShown = true;
    const first = (d.journeyTargetChain && d.journeyTargetChain[0]) || JOURNEY_SOBER_TARGET_DAYS[0] || 10;
    DataManager.save(d);
    this._queueCelebration('🎯', 'Your Target', `Your first target is ${first} sober days.`);
  },

  _checkJourneyTargets() {
    const d = this.data;
    if (!d || d.journeyPendingReset) return;
    ensureJourneyTargetChain(d);
    const chain = d.journeyTargetChain;
    if (!chain || !chain.length) return;
    if (!d.celebratedJourneyTargets) d.celebratedJourneyTargets = {};
    const s = d.currentScore.success | 0;

    // First sober day of the journey — after onboarding / welcome, not at journey start
    if (!d.journeyTargetStartShown && s === 1) {
      this._showJourneyStartTarget(d);
      return;
    }

    if (!chain.includes(s) || d.celebratedJourneyTargets[s]) return;

    d.celebratedJourneyTargets[s] = true;
    const next = chain[chain.indexOf(s) + 1];
    DataManager.save(d);
    if (!next) return;
    this._queueCelebration('🎯', 'Next Target', journeyTargetNextMessage(next, d.journeyBeatTarget));
  },

  _checkScienceMilestones() {
    const d = this.data;
    const streak = d.currentStreak | 0;
    if (!d.celebratedScienceMilestones) d.celebratedScienceMilestones = {};
    for (const node of SCIENCE_NODES) {
      if (!node.c) continue;
      if (STREAK_SCIENCE_OVERLAP_DAYS.has(node.day)) continue;
      if (isScienceMilestoneEarned(streak, node.day, d.celebratedScienceMilestones)) {
        d.celebratedScienceMilestones[node.day] = true;
        DataManager.save(d);
        launchConfetti(90);
        this._queueCelebration(node.c.emoji, node.c.title, node.c.msg);
      }
    }
  },

  // ─── CELEBRATION QUEUE ─────────────────────────────

  _queueCelebration(emoji, title, msg) {
    // If yesterday modal is still showing, wait for it to close first
    const ym = el('yesterdayModal');
    if (ym && ym.classList.contains('active')) {
      setTimeout(() => this._queueCelebration(emoji, title, msg), 600);
      return;
    }
    this._celebQueue.push({ emoji, title, msg });
    if (!this._celebrating) this._showNext();
  },

  _showNext() {
    if (!this._celebQueue.length) { this._celebrating = false; return; }
    this._celebrating = true;
    const { emoji, title, msg } = this._celebQueue.shift();
    el('celebrationEmoji').textContent   = emoji;
    el('celebrationTitle').textContent   = title;
    el('celebrationMessage').textContent = msg;
    el('celebrationModal').classList.add('active');
  },

  closeCelebration() {
    el('celebrationModal').classList.remove('active');
    setTimeout(() => this._showNext(), 200);
  }
};

// Keep SoberTracker as alias for backward compat with onclick handlers
const SoberTracker = Tracker;

// ═══════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────
// ONBOARDING
// 4-slide intro shown only on first app open.
// Stored in localStorage so it never shows again.
// Re-enable in boot() when ready to test with real users.
// ─────────────────────────────────────────────
