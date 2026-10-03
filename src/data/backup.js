/* ===== src/data/backup.js ===== */
'use strict';

// Export / import / delete local progress (load after journey.js — attaches to Tracker)

const BACKUP_FORMAT = 'sober-journey-backup';
const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = 'sj_lastBackupAt';

let pendingImportBackup = null;

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

  if (parsed.format === BACKUP_FORMAT) {
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
  const filename = `sober-journey-backup-${dateKey(getAppToday(this.data))}.json`;
  const file = new File([json], filename, { type: 'application/json' });
  const exportedAt = payload.exportedAt;

  const finish = () => {
    recordLastBackupAt(exportedAt);
    renderBackupStatus();
  };

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: '10Drinks export' })
      .then(() => {
        finish();
        showToast('Export ready — save to Files or iCloud.');
      })
      .catch((e) => {
        if (e && e.name === 'AbortError') return;
        downloadBackupFile(json, filename);
        finish();
        showToast('Export saved to downloads.');
      });
    return;
  }

  downloadBackupFile(json, filename);
  finish();
  showToast('Export saved to downloads.');
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
  DataManager.flush();
  this.data = DataManager._migrate(JSON.parse(JSON.stringify(backup.state)));
  AuditSession.clearFields(this.data);
  if (backup.onboardingComplete === true) {
    try { localStorage.setItem('sj_onboarded', '1'); } catch (e) {}
  } else if (backup.onboardingComplete === false) {
    try { localStorage.removeItem('sj_onboarded'); } catch (e) {}
  }
  if (backup.exportedAt) recordLastBackupAt(backup.exportedAt);
  DataManager.saveNow(this.data);
  this._celebQueue = [];
  this._celebrating = false;
  this.switchTab(0);
  refreshStreakUI(this.data);
  UI.renderAll(this.data);
  renderBackupStatus();
  if (typeof renderWelcomeHint === 'function') renderWelcomeHint(this.data);
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
  try { if (typeof TRIAL_POLICY_KEY !== 'undefined') localStorage.removeItem(TRIAL_POLICY_KEY); } catch (e) {}
  if (typeof ensureTrialStarted === 'function') ensureTrialStarted();
  if (typeof setForcePremiumLocked === 'function') setForcePremiumLocked(false);
  clearLastBackupAt();
  this.data = DataManager.defaults();
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
  document.body.classList.remove('modal-open', 'settings-open');
  DataManager.saveNow(this.data);
  this.switchTab(0);
  refreshStreakUI(this.data);
  UI.renderAll(this.data);
  renderBackupStatus();
  if (typeof renderWelcomeHint === 'function') renderWelcomeHint(this.data);
  if (typeof renderPremiumEntry === 'function') renderPremiumEntry();
  if (typeof MeterController !== 'undefined' && MeterController.init) {
    try { MeterController.init(); } catch (e) {}
  }
  showToast('All data deleted.');
  if (typeof Onboarding !== 'undefined' && Onboarding.show) {
    Onboarding.current = 0;
    Onboarding.show();
  }
};
