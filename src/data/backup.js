/* ===== src/data/backup.js ===== */
'use strict';

// Export / import / delete local progress (load after journey.js — attaches to Tracker)

const BACKUP_FORMAT = '10drinks-backup';
const LEGACY_BACKUP_FORMAT = 'sober-journey-backup';
const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = 'sj_lastBackupAt';

let pendingImportBackup = null;
let pendingExportPayload = null;

function isShareCancelled(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  const msg = String(err.message || err.errorMessage || err);
  return /cancel/i.test(msg);
}

function trialAnchorIsSameCalendarDay(anchorDate, refDate) {
  if (!anchorDate || Number.isNaN(anchorDate.getTime())) return false;
  const ref = refDate || new Date();
  const a = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate(), 12, 0, 0);
  const b = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12, 0, 0);
  return a.getTime() === b.getTime();
}

/** Journey storage still at defaults — no meaningful progress on this device yet. */
function isPristineDeviceJourney(data) {
  if (!data) return true;
  const log = data.dailyLog || {};
  if (Object.keys(log).length > 0) return false;
  if ((data.attempt | 0) > 1) return false;
  if ((data.completedJourneys || []).length > 0) return false;
  if ((data.totalSuccessfulDays | 0) > 0) return false;
  if ((data.totalFailures | 0) > 0) return false;
  return true;
}

/** Trial stamped by Tracker.init() before first import — not an established device anchor. */
function isBootstrapTrialOnly(data, trialDate) {
  if (!trialDate || Number.isNaN(trialDate.getTime())) return false;
  if (!isPristineDeviceJourney(data)) return false;
  return trialAnchorIsSameCalendarDay(trialDate);
}

/** Existing device: keep local trial unless it is only today's bootstrap from init(). */
function deviceTrialAnchorShouldWin(data, localTrialDate, existingDataTrialDate) {
  if (localTrialDate && !Number.isNaN(localTrialDate.getTime())) {
    if (!isBootstrapTrialOnly(data, localTrialDate)) return true;
  }
  if (existingDataTrialDate && !Number.isNaN(existingDataTrialDate.getTime())) {
    if (!isBootstrapTrialOnly(data, existingDataTrialDate)) return true;
  }
  return false;
}

function isNativeCapacitor() {
  try {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform());
  } catch (e) {
    return false;
  }
}

function isAndroidNative() {
  try {
    const Cap = window.Capacitor;
    return isNativeCapacitor() && Cap.getPlatform && Cap.getPlatform() === 'android';
  } catch (e) {
    return false;
  }
}

function getCapacitorPlugin(name) {
  const Cap = window.Capacitor;
  if (!Cap) return null;
  if (Cap.Plugins && Cap.Plugins[name]) return Cap.Plugins[name];
  if (typeof Cap.registerPlugin === 'function') {
    try {
      return Cap.registerPlugin(name);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getTenDrinksBackupExportPlugin() {
  return getCapacitorPlugin('TenDrinksBackupExport');
}

function openExportChoiceModal(payload) {
  pendingExportPayload = payload;
  const modal = el('exportChoiceModal');
  if (!modal) return;
  if (typeof openAppModal === 'function') openAppModal(modal);
  else modal.classList.add('active');
}

function closeExportChoiceModal() {
  pendingExportPayload = null;
  const modal = el('exportChoiceModal');
  if (!modal) return;
  modal.classList.remove('active');
  if (typeof syncModalOpenBodyClass === 'function') syncModalOpenBodyClass();
}

function finishBackupExport(iso) {
  recordLastBackupAt(iso);
  renderBackupStatus();
}

function runAndroidNativeExport(mode) {
  const payload = pendingExportPayload;
  if (!payload) return;
  closeExportChoiceModal();

  const Export = getTenDrinksBackupExportPlugin();
  if (!Export) {
    downloadBackupFile(payload.json, payload.filename);
    finishBackupExport(payload.exportedAt);
    showToast('Export saved.');
    return;
  }

  const opts = {
    content: payload.json,
    filename: payload.filename,
    mimeType: 'application/json',
  };

  Promise.resolve()
    .then(() => mode === 'downloads'
      ? Export.saveToDownloads(opts)
      : Export.saveAs(opts)
    )
    .then((result) => {
      finishBackupExport(payload.exportedAt);
      const savedName = (result && result.filename) || payload.filename;
      if (mode === 'downloads') {
        showToast(`Saved to Downloads: ${savedName}`);
      } else {
        showToast(`Backup saved: ${savedName}`);
      }
    })
    .catch((err) => {
      if (isShareCancelled(err)) return;
      console.error('[10Drinks] native export failed:', err);
      downloadBackupFile(payload.json, payload.filename);
      finishBackupExport(payload.exportedAt);
      showToast('Could not use folder picker — file downloaded instead.');
    });
}

function shareWebBackupFile(json, filename, exportedAt) {
  const file = new File([json], filename, { type: 'application/json' });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: '10Drinks export' })
      .then(() => {
        finishBackupExport(exportedAt);
        showToast('Export ready — save to Files or Drive.');
      })
      .catch((e) => {
        if (isShareCancelled(e)) return;
        downloadBackupFile(json, filename);
        finishBackupExport(exportedAt);
        showToast('Export saved.');
      });
    return;
  }

  downloadBackupFile(json, filename);
  finishBackupExport(exportedAt);
  showToast('Export saved.');
}

function bindExportChoiceUi() {
  const modal = el('exportChoiceModal');
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = '1';
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeExportChoiceModal();
  });
  modal.querySelectorAll('[data-export-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-export-action');
      if (action === 'cancel') closeExportChoiceModal();
      else if (action === 'downloads') runAndroidNativeExport('downloads');
      else if (action === 'folder') runAndroidNativeExport('folder');
    });
  });
}

bindExportChoiceUi();

function buildBackupPayload(data) {
  const state = AuditSession.forPersist(data || Tracker.data || DataManager.load());
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    onboardingComplete: localStorage.getItem('sj_onboarded') === '1',
    state: JSON.parse(JSON.stringify(state)),
  };
}

function parseBackupJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'invalid-json' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'invalid-json' };

  let saved = parsed;
  let exportedAt = null;
  let onboardingComplete = null;

  if (parsed.format === BACKUP_FORMAT || parsed.format === LEGACY_BACKUP_FORMAT) {
    if (!parsed.state || typeof parsed.state !== 'object') return { ok: false, error: 'missing-state' };
    saved = parsed.state;
    exportedAt = parsed.exportedAt || null;
    onboardingComplete = parsed.onboardingComplete;
  }

  if (typeof saved.attempt !== 'number' || !saved.currentScore || typeof saved.currentScore !== 'object') {
    return { ok: false, error: 'not-backup' };
  }

  return {
    ok: true,
    state: DataManager._migrate(saved),
    exportedAt,
    onboardingComplete,
  };
}

function recordLastBackupAt(iso) {
  try { localStorage.setItem(LAST_BACKUP_KEY, iso || new Date().toISOString()); } catch (e) {}
}

function clearLastBackupAt() {
  try { localStorage.removeItem(LAST_BACKUP_KEY); } catch (e) {}
}

function formatLastBackupLabel() {
  let raw = null;
  try { raw = localStorage.getItem(LAST_BACKUP_KEY); } catch (e) {}
  if (!raw) return 'Never';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderBackupStatus() {
  const label = el('lastBackupLabel');
  if (label) label.textContent = 'Last exported: ' + formatLastBackupLabel();
}

function downloadBackupFile(json, filename) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function formatImportConfirmMessage(backup) {
  if (!backup) return 'Restore this export? Current progress on this device will be replaced.';
  const when = backup.exportedAt
    ? new Date(backup.exportedAt).toLocaleString()
    : 'an earlier save';
  const journey = (backup.state && backup.state.attempt) || 1;
  return `Restore progress exported ${when}? (Journey ${journey}) This replaces your current progress on this device.`;
}

Tracker.toggleBackupPanel = function() {
  this.openSettings();
};

Tracker.exportBackup = function() {
  const payload = buildBackupPayload(this.data);
  const json = JSON.stringify(payload, null, 2);
  const filename = `10drinks-backup-${dateKey(getAppToday(this.data))}.json`;
  const exportedAt = payload.exportedAt;
  const exportPayload = { json, filename, exportedAt };

  if (isAndroidNative() && getTenDrinksBackupExportPlugin()) {
    openExportChoiceModal(exportPayload);
    return;
  }

  shareWebBackupFile(json, filename, exportedAt);
};

Tracker.importBackup = function() {
  const picker = el('importFileInput');
  if (!picker) return;
  picker.onchange = (e) => this._onImportFileSelected(e);
  picker.click();
};

Tracker._onImportFileSelected = function(e) {
  const input = e.target;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = parseBackupJson(String(reader.result || ''));
    if (!result.ok) {
      showToast(result.error === 'invalid-json'
        ? 'That file is not valid JSON.'
        : 'That is not a valid 10Drinks export.');
      return;
    }
    pendingImportBackup = result;
    this.showConfirmModal('import');
  };
  reader.onerror = () => showToast('Could not read that file.');
  reader.readAsText(file);
};

Tracker.requestDeleteData = function() {
  if (typeof this.closeSettings === 'function') this.closeSettings();
  if (typeof this.closePrivacyPolicy === 'function') this.closePrivacyPolicy();
  this.showConfirmModal('reset');
};

Tracker._restoreImportBackup = function(backup) {
  if (!backup || !backup.state) {
    showToast('Nothing to restore.');
    return;
  }

  const backupTrialStart = backup.state.trialStartedAt;
  const backupTrialDate = typeof backupTrialStart === 'string'
    ? new Date(backupTrialStart)
    : null;

  if (!backupTrialDate || Number.isNaN(backupTrialDate.getTime())) {
    showToast('This backup is missing a valid trial date and cannot be restored.');
    return;
  }

  DataManager.flush();

  const preImportData = this.data
    || (typeof DataManager !== 'undefined' ? DataManager.load() : null);

  const localTrialDate =
    typeof getTrialStartedAt === 'function'
      ? getTrialStartedAt()
      : null;

  const existingDataTrialDate = preImportData && preImportData.trialStartedAt
    ? new Date(preImportData.trialStartedAt)
    : null;

  let trialStartToUse = backupTrialDate.toISOString();
  if (deviceTrialAnchorShouldWin(preImportData, localTrialDate, existingDataTrialDate)) {
    if (localTrialDate && !Number.isNaN(localTrialDate.getTime())) {
      trialStartToUse = localTrialDate.toISOString();
    } else if (existingDataTrialDate && !Number.isNaN(existingDataTrialDate.getTime())) {
      trialStartToUse = existingDataTrialDate.toISOString();
    }
  }

  this.data = DataManager._migrate(
    JSON.parse(JSON.stringify(backup.state))
  );

  AuditSession.clearFields(this.data);

  this.data.trialStartedAt = trialStartToUse;

  if (typeof setTrialStartedAtISO === 'function') {
    setTrialStartedAtISO(trialStartToUse);
  } else {
    try {
      localStorage.setItem(TRIAL_KEY, trialStartToUse);
    } catch (e) {}
  }

  if (backup.onboardingComplete === true) {
    try { localStorage.setItem('sj_onboarded', '1'); } catch (e) {}
  } else if (backup.onboardingComplete === false) {
    try { localStorage.removeItem('sj_onboarded'); } catch (e) {}
  }

  if (
    typeof backup.exportedAt === 'string' &&
    !Number.isNaN(new Date(backup.exportedAt).getTime())
  ) {
    recordLastBackupAt(backup.exportedAt);
  }

  DataManager.saveNow(this.data);

  this._celebQueue = [];
  this._celebrating = false;

  this.switchTab(0);
  refreshStreakUI(this.data);
  UI.renderAll(this.data);
  renderBackupStatus();

  if (typeof renderWelcomeHint === 'function') {
    renderWelcomeHint(this.data);
  }

  showToast('Progress restored.');
};

Tracker._deleteAllData = function() {
  if (typeof DataManager.cancelPendingSave === 'function') DataManager.cancelPendingSave();
  try { localStorage.removeItem(DataManager.KEY); } catch (e) {}
  try { localStorage.removeItem('sj_onboarded'); } catch (e) {}
  try { localStorage.removeItem('sj_welcome_dismissed'); } catch (e) {}
  try { localStorage.removeItem('sj_welcome_step1_done'); } catch (e) {}
  if (typeof clearPremiumRecord === 'function') clearPremiumRecord();
  if (typeof setTrialStartedAtISO === 'function') setTrialStartedAtISO(null);
  if (this.data) this.data.trialStartedAt = null;
  try { localStorage.removeItem('sj_trialPolicyDays'); } catch (e) {}
  if (typeof setForcePremiumLocked === 'function') setForcePremiumLocked(false);
  clearLastBackupAt();
  this.data = DataManager.defaults();
  if (typeof reconcileTrialClock === 'function') {
    reconcileTrialClock(this.data);
  } else if (typeof ensureTrialStarted === 'function') {
    ensureTrialStarted(this.data);
  }
  AuditSession.clearFields(this.data);
  const resetToday = getAppToday(this.data);
  this.data.lastDayCheck = new Date(
    resetToday.getFullYear(),
    resetToday.getMonth(),
    resetToday.getDate(),
    12, 0, 0
  ).toISOString();
  this.data.journeyStartKey = dateKey(resetToday);
  this.data.calendarDay = 1;
  if (typeof ensureJourneyStartKey === 'function') ensureJourneyStartKey(this.data);
  this._celebQueue = [];
  this._celebrating = false;
  this._currentStreaks = [];
  this.pendingAction = null;
  if (typeof UI !== 'undefined' && UI.hideModal) UI.hideModal();
  if (typeof forceUnlockBodyScroll === 'function') forceUnlockBodyScroll();
  else document.body.classList.remove('modal-open');
  document.body.classList.remove('settings-open');
  DataManager.saveNow(this.data);
  this.switchTab(0);
  refreshStreakUI(this.data);
  UI.renderAll(this.data);
  renderBackupStatus();
  if (typeof renderWelcomeHint === 'function') renderWelcomeHint(this.data);
  if (typeof renderPremiumEntry === 'function') renderPremiumEntry();
  if (typeof MeterController !== 'undefined' && MeterController.clearDisplay) {
    try { MeterController.clearDisplay(); } catch (e) {}
  }
  showToast('All data deleted.');
  if (typeof Onboarding !== 'undefined' && Onboarding.show) {
    Onboarding.current = 0;
    Onboarding.show();
  }
};
