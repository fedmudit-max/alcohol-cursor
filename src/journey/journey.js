/* ===== src/journey/journey.js ===== */
'use strict';

// ═══════════════════════════════════════════════════════════════
// TRACKER (main app controller)
// Handles logging, milestones, celebrations, journey management.
// Backup/import lives in src/data/backup.js (attaches after load).
// ═══════════════════════════════════════════════════════════════

// Returns true if journeyStartKey was changed (caller may persist)
function ensureJourneyStartKey(data) {
  if (!data) return false;
  const before = data.journeyStartKey;
  const appToday = getAppToday(data);
  const appTodayKey = dateKey(appToday);
  const calendarStart = inferJourneyStartFromCalendarDay(data);
  const calField = Math.max(1, parseInt(data.calendarDay, 10) || 1);

  if (typeof syncCalendarDayFromJourneyStart === 'function') {
    syncCalendarDayFromJourneyStart(data);
  }

  if (!data.journeyStartKey) {
    data.journeyStartKey = calendarStart;
  } else if (data.journeyStartKey > appTodayKey) {
    data.journeyStartKey = appTodayKey;
  }
  // Legacy infer used “oldest sober in score window” — pull start back to full journey span for backfill
  // Only pull start backward within the current journey span — never into prior journeys' logs
  const earliest = earliestDailyLogKey(data);
  const pullBackFloor = earliest && earliest < appTodayKey ? earliest : null;
  // Only infer an earlier start from calendarDay when logs prove days before journeyStartKey
  if (data.journeyStartKey > calendarStart && pullBackFloor) {
    const next = calendarStart;
    if (next >= pullBackFloor) {
      data.journeyStartKey = next;
    }
  }

  // Fresh journey day 1 on this open (lastDayCheck is today): stale start from reset/wipe → today.
  const lastKey = data.lastDayCheck ? dateKey(new Date(data.lastDayCheck)) : '';
  const openedToday = lastKey === appTodayKey;
  if (
    calField === 1 &&
    openedToday &&
    !earliestDailyLogKey(data) &&
    data.journeyStartKey &&
    data.journeyStartKey < appTodayKey &&
    !(lastKey && lastKey < appTodayKey)
  ) {
    data.journeyStartKey = appTodayKey;
  }

  if (typeof syncCalendarDayFromJourneyStart === 'function') {
    syncCalendarDayFromJourneyStart(data);
  }

  return before !== data.journeyStartKey;
}

const Tracker = {
  data:            null,
  pendingAction:   null,
  _celebQueue:     [],
  _celebrating:    false,
  _pendingCalendarDayKey: null,
  init() {
    try {
    this.data = DataManager.load();
    if (typeof this.data.dykIndex !== 'number') this.data.dykIndex = 0;
    if (typeof syncCalendarDayFromJourneyStart === 'function') {
      syncCalendarDayFromJourneyStart(this.data);
    }
    if (ensureJourneyStartKey(this.data)) DataManager.saveNow(this.data);
    if (typeof syncCalendarDayFromJourneyStart === 'function') {
      syncCalendarDayFromJourneyStart(this.data);
    }
    if (typeof healJourneyStartForMissedDays === 'function' && healJourneyStartForMissedDays(this.data)) {
      syncCalendarDayFromJourneyStart(this.data);
      DataManager.saveNow(this.data);
    }
    if (typeof reconcileTrialClock === 'function') {
      const prev = this.data.trialStartedAt;
      reconcileTrialClock(this.data);
      if (this.data.trialStartedAt && this.data.trialStartedAt !== prev) {
        DataManager.saveNow(this.data);
      }
    } else if (typeof ensureTrialStarted === 'function') {
      ensureTrialStarted(this.data);
    }
    if (typeof Tracker !== 'undefined') {
      Tracker._lastPremiumAccess = typeof hasPremiumAccess === 'function' && hasPremiumAccess();
    }
    DataManager._rebuildScoredDays(this.data);
    if (reconcileLogsToJourneyScore(this.data)) {
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
    if (typeof TenDrinksReminderNative !== 'undefined' && TenDrinksReminderNative.init) {
      TenDrinksReminderNative.init();
    }
    } catch (err) {
      console.error('[10Drinks] init failed:', err);
    } finally {
      setTimeout(dismissAppSplash, 300);
    }
  },


  // --- AUTO ADVANCE ---
  // batchMode=true: skip save/render/celebrations (called from _catchUp loop — saves once after all days)
  autoAdvanceDay(batchMode = false) {
    if (!CONFIG.showTestUI) return;
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
      // Previous simulated day is now "yesterday" — ask if it was never logged
      promptYesterdayIfNeeded(d, 300);
    }
  },

  // --- USER ACTIONS ---

  // --- LOG YESTERDAY / CALENDAR BACKFILL ---
  _ensureTrackerData() {
    if (!this.data) this.data = DataManager.load();
    return this.data;
  },

  _logDayForKey(key, status) {
    const d = this._ensureTrackerData();
    if (!d || !key) return false;
    const yestKey = calendarYesterdayKey(d);
    const todayKey = dateKey(getAppToday(d));
    const isCalendarBackfill = key !== yestKey && key !== todayKey;
    if (isCalendarBackfill) {
      healAllOrphanScoredDays(d);
      if (ensureJourneyStartKey(d)) DataManager.saveNow(d);
      if (!canRecordCalendarDay(d, key, getAppToday(d))) {
        if (typeof showToast === 'function') showToast('Could not log this day — try again.');
        return false;
      }
    }
    if (key === todayKey && typeof shouldAskYesterday === 'function' && shouldAskYesterday(d)) {
      if (typeof showToast === 'function') {
        showToast('Log yesterday first — use the popup or tap yesterday on the calendar.');
      }
      return false;
    }

    if (key === todayKey) {
      d.todayStatus = 'none';
      d.todaySuccessLogged = false;
    }

    const isSober = status === 'success' || status === true;
    let recorded = false;
    if (isSober) {
      recorded = this._recordSoberDay(d, key);
    } else {
      recorded = this._recordDrinkDay(d, key);
    }
    if (!recorded) {
      if (typeof showToast === 'function') showToast('Could not log this day — try again.');
      return false;
    }

    if (key === todayKey) {
      if (isSober) {
        d.todayStatus = 'success';
        d.todaySuccessLogged = true;
      } else {
        d.todayStatus = 'failed';
        d.todaySuccessLogged = false;
        d.personalBestCelebrated = false;
        d.celebratedStreakMilestones = {};
        d.celebratedScienceMilestones = {};
      }
    }

    recalculateStreakFromLog(d);
    syncSessionCheckpoint(d);
    DataManager.saveNow(d);
    refreshStreakUI(d);
    UI.renderAll(d);

    if (!isSober && (d.currentScore.failures | 0) >= JOURNEY_MAX_FAILURES) {
      recalculateJourneyScoreFromLog(d);
      this._endJourney();
      return true;
    }

    if (isSober && !isCalendarBackfill) {
      if (!d.celebratedStreakMilestones) d.celebratedStreakMilestones = {};
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
      DataManager.saveNow(d);
    } else if (isSober && isCalendarBackfill && typeof showToast === 'function') {
      showToast(`Logged as sober. Score: ${formatScoreText(d.currentScore)}`);
    }

    syncTodaySessionFromLog(d);
    DataManager.saveNow(d);

    if (this._celebQueue.length && !this._celebrating) this._showNext();
    return true;
  },

  logYesterday(status) {
    const ym = el('yesterdayModal');
    if (ym) ym.classList.remove('active');
    if (typeof syncModalOpenBodyClass === 'function') syncModalOpenBodyClass();
    if (typeof ensureJourneyStartKey === 'function') ensureJourneyStartKey(this.data);
    if (typeof syncCalendarDayFromJourneyStart === 'function') {
      syncCalendarDayFromJourneyStart(this.data);
    }
    if (!shouldAskYesterday(this.data)) return;
    const key = calendarYesterdayKey(this.data);
    const floor = calendarJourneyFloorKey(this.data);
    if (key < floor) return;
    this._logDayForKey(key, status);
  },

  promptCalendarDay(dayKey) {
    if (!dayKey) return;
    this.data = this.data || DataManager.load();
    const d = this._ensureTrackerData();
    if (ensureJourneyStartKey(d)) DataManager.saveNow(d);
    if (!canLogCalendarDay(d, dayKey, getAppToday(d))) {
      if (typeof showToast === 'function') showToast('This day cannot be logged.');
      return;
    }
    this._pendingCalendarDayKey = dayKey;
    const title = el('calendarDayModalTitle');
    const sub = el('calendarDayModalSub');
    const existing = d.dailyLog && d.dailyLog[dayKey];
    if (title) title.textContent = formatCalendarDayLabel(dayKey);
    if (sub) {
      sub.textContent = existing
        ? 'Change this day’s log. Unlogged days are never assumed sober.'
        : 'This day is unlogged — choose what happened. Unlogged ≠ sober.';
    }
    const ym = el('yesterdayModal');
    if (ym) ym.classList.remove('active');
    const cm = el('celebrationModal');
    if (cm) cm.classList.remove('active');
    this._celebrating = false;
    const modal = el('calendarDayModal');
    if (modal) {
      modal.dataset.pendingDayKey = dayKey;
      if (typeof openAppModal === 'function') openAppModal(modal);
      else modal.classList.add('active');
    }
  },

  closeCalendarDayModal() {
    this._pendingCalendarDayKey = null;
    const modal = el('calendarDayModal');
    if (modal) {
      delete modal.dataset.pendingDayKey;
      modal.classList.remove('active');
    }
    if (typeof syncModalOpenBodyClass === 'function') syncModalOpenBodyClass();
  },

  logCalendarDay(status) {
    const modal = el('calendarDayModal');
    const key = this._pendingCalendarDayKey || (modal && modal.dataset.pendingDayKey) || '';
    if (modal) {
      modal.classList.remove('active');
      delete modal.dataset.pendingDayKey;
    }
    this._pendingCalendarDayKey = null;
    if (typeof syncModalOpenBodyClass === 'function') syncModalOpenBodyClass();
    if (!key) {
      if (typeof showToast === 'function') showToast('Could not log — tap the day again.');
      return;
    }
    this._logDayForKey(key, status);
  },

  // Advance lastDayCheck by one calendar day (noon local — avoids DST edge cases)
  _advanceLastDayCheck(d) {
    const last = new Date(d.lastDayCheck);
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1, 12, 0, 0);
    d.lastDayCheck = next.toISOString();
  },

  handleSuccess() {
    if (!this.data) this.data = DataManager.load();
    syncTodaySessionFromLog(this.data);
    if (this.data.todayStatus === 'failed') {
      if (typeof showToast === 'function') showToast('You already logged a drink today.');
      return;
    }
    if (this.data.todaySuccessLogged) return;
    if (shouldAskYesterday(this.data)) {
      if (typeof showToast === 'function') {
        showToast('Answer about yesterday first.');
      }
      showYesterdayModal();
      return;
    }
    this.showConfirmModal('success');
  },

  showConfirmModal(action) {
    if (!this.data) this.data = DataManager.load();
    if ((action === 'success' || action === 'fail') && shouldAskYesterday(this.data)) {
      if (typeof showToast === 'function') {
        showToast('Answer about yesterday first.');
      }
      showYesterdayModal();
      return;
    }
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
    const premiumTab = idx === 0 || idx === 1 || idx === 2;
    if (
      premiumTab &&
      typeof isTrialEntitlementEnforced === 'function' &&
      isTrialEntitlementEnforced() &&
      !hasPremiumAccess()
    ) {
      if (typeof isPremiumSubscribeOffered === 'function' && isPremiumSubscribeOffered()) {
        this.openPremium();
      } else if (typeof showToast === 'function') {
        showToast('Your free trial has ended. Premium subscriptions are coming soon.');
      }
      return;
    }
    document.querySelectorAll('.seg-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
    document.querySelectorAll('.tab-content').forEach((c, i) => c.classList.toggle('active', i === idx));
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
    d.personalBestCelebrated = false;
    d.celebratedStreakMilestones = {};
    d.celebratedScienceMilestones = {};
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
    archiveCurrentJourneyStreaks(d);
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
    d.scoredDays = {};
    if ((d.currentStreak | 0) > (d.longestStreak | 0)) d.longestStreak = d.currentStreak | 0;
    d.currentStreak = 0;
    d.calendarDay = 1;
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
    d.currentJourneyStreaks = [];
    recalculateJourneyScoreFromLog(d);
    recalculateLifetimeTotalsFromLog(d);
    recalculateStreakFromLog(d);
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

  _recordSoberDay(d, key) {
    this._ensureScore(d);
    return applyDayLogStatus(d, key, 'sober');
  },

  _recordDrinkDay(d, key) {
    this._ensureScore(d);
    const ok = applyDayLogStatus(d, key, 'drinking');
    if (ok) pushEndedStreakOnDrink(d);
    return ok;
  },

  _updateBest(data) {
    const d = data || this.data;
    if (!d || !d.currentScore) return;
    applyBestScore(d, d.currentScore);
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
    this._celebQueue.push({ emoji, title, msg });
    const ym = el('yesterdayModal');
    const yesterdayOpen = ym && ym.classList.contains('active');
    // Hold celebrations until yesterday is answered (catch-up / Next Day / 3-Day Gap)
    if (yesterdayOpen || shouldAskYesterday(this.data)) {
      if (!yesterdayOpen) promptYesterdayIfNeeded(this.data, 200);
      return;
    }
    if (!this._celebrating) this._showNext();
  },

  _showNext() {
    if (!this._celebQueue.length) { this._celebrating = false; return; }
    this._celebrating = true;
    const { emoji, title, msg } = this._celebQueue.shift();
    const emojiEl = el('celebrationEmoji');
    const titleEl = el('celebrationTitle');
    const msgEl = el('celebrationMessage');
    const modal = el('celebrationModal');
    if (!emojiEl || !titleEl || !msgEl || !modal) {
      this._celebrating = false;
      return;
    }
    emojiEl.textContent = emoji;
    titleEl.textContent = title;
    msgEl.textContent = msg;
    modal.classList.add('active');
  },

  closeCelebration() {
    el('celebrationModal').classList.remove('active');
    setTimeout(() => this._showNext(), 200);
  }
};

// Legacy onclick alias (HTML). Prefer TenDrinksTracker for new code / Capacitor shell.
const TenDrinksTracker = Tracker;
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
