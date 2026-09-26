/* ===== src/ui/reminders.js ===== */
'use strict';

function formatReminderTime12(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return hhmm || '';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

function normalizeReminders(data) {
  const def = DataManager.defaults().reminders;
  if (!data.reminders || typeof data.reminders !== 'object') {
    data.reminders = { ...def };
    return;
  }
  if (typeof data.reminders.dailyEnabled !== 'boolean') data.reminders.dailyEnabled = false;
  if (!/^\d{2}:\d{2}$/.test(data.reminders.dailyTime || '')) data.reminders.dailyTime = def.dailyTime;
}

function renderRemindersTab(data) {
  normalizeReminders(data);
  const enabledEl = el('reminderDailyEnabled');
  const timeEl = el('reminderDailyTime');
  const statusEl = el('reminderStatusText');
  const timeRow = el('reminderTimeRow');
  const on = data.reminders.dailyEnabled;

  if (enabledEl) enabledEl.checked = on;
  if (timeEl) {
    timeEl.value = data.reminders.dailyTime;
    timeEl.disabled = !on;
  }
  if (timeRow) {
    timeRow.classList.toggle('reminder-row--disabled', !on);
    timeRow.style.opacity = on ? '' : '0.45';
    timeRow.style.pointerEvents = on ? '' : 'none';
  }
  if (statusEl) {
    if (on) {
      statusEl.hidden = false;
      statusEl.textContent = `On · ${formatReminderTime12(data.reminders.dailyTime)}`;
    } else {
      statusEl.hidden = true;
      statusEl.textContent = '';
    }
  }
}

Tracker.setReminderDailyEnabled = function(checked) {
  const d = this.data || DataManager.load();
  normalizeReminders(d);
  d.reminders.dailyEnabled = !!checked;
  DataManager.save(d);
  this.data = d;
  renderRemindersTab(d);
  if (checked) {
    showToast('Reminder saved — notifications coming in the mobile app.');
  }
};

Tracker.setReminderDailyTime = function(value) {
  const d = this.data || DataManager.load();
  normalizeReminders(d);
  if (!/^\d{2}:\d{2}$/.test(value || '')) return;
  d.reminders.dailyTime = value;
  DataManager.save(d);
  this.data = d;
  renderRemindersTab(d);
};
