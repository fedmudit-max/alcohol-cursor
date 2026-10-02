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

function parseDailyTime24(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function toDailyTime24(hour, minute) {
  const h = Math.min(23, Math.max(0, hour | 0));
  const m = Math.min(59, Math.max(0, minute | 0));
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
}

function splitReminderClock(hour24, minute) {
  let h = hour24 % 12;
  if (h === 0) h = 12;
  return {
    hour12: h,
    minute,
    ampm: hour24 >= 12 ? 'PM' : 'AM',
  };
}

function joinReminderClock(hour12, minute, ampm) {
  let h = parseInt(hour12, 10);
  const m = parseInt(minute, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  h = Math.min(12, Math.max(1, h));
  const mm = Math.min(59, Math.max(0, m));
  if (ampm === 'AM') {
    h = h === 12 ? 0 : h;
  } else {
    h = h === 12 ? 12 : h + 12;
  }
  return { hour: h, minute: mm };
}

function remindClockFieldValue(el) {
  if (!el) return '';
  if (el.dataset && el.dataset.value != null && el.dataset.value !== '') return el.dataset.value;
  return String(el.textContent || '').trim();
}

function setRemindClockField(el, value, label) {
  if (!el) return;
  el.dataset.value = String(value);
  el.textContent = label != null ? String(label) : String(value);
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

function setReminderClockDisabled(disabled) {
  const hourEl = el('remindHour');
  const minuteEl = el('remindMinute');
  const ampmEl = el('remindAmPm');
  const row = el('reminderTimeRow');
  [hourEl, minuteEl, ampmEl].forEach((node) => {
    if (node) node.disabled = !!disabled;
  });
  if (row) row.classList.toggle('is-disabled', !!disabled);
}

function readReminderClockFromDom() {
  return joinReminderClock(
    remindClockFieldValue(el('remindHour')),
    remindClockFieldValue(el('remindMinute')),
    remindClockFieldValue(el('remindAmPm')),
  );
}

function closeRemindTimePicker() {
  const picker = el('remindTimePicker');
  if (!picker) return;
  picker.classList.remove('active');
  picker.setAttribute('aria-hidden', 'true');
}

function openRemindTimePicker(field) {
  const picker = el('remindTimePicker');
  const title = el('remindTimePickerTitle');
  const list = el('remindTimePickerList');
  if (!picker || !list) return;

  let items = [];
  let current = '';
  let heading = 'Time';
  if (field === 'hour') {
    heading = 'Hour';
    current = remindClockFieldValue(el('remindHour'));
    for (let h = 1; h <= 12; h++) items.push({ value: String(h), label: String(h) });
  } else if (field === 'minute') {
    heading = 'Minute';
    current = remindClockFieldValue(el('remindMinute'));
    for (let m = 0; m < 60; m++) {
      items.push({ value: String(m), label: m < 10 ? '0' + m : String(m) });
    }
  } else {
    heading = 'AM / PM';
    current = remindClockFieldValue(el('remindAmPm'));
    items = [{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }];
  }

  if (title) title.textContent = heading;
  list.innerHTML = '';
  let selectedBtn = null;
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'remind-time-picker-option';
    btn.setAttribute('role', 'option');
    btn.dataset.value = item.value;
    btn.textContent = item.label;
    if (String(item.value) === String(current)) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-selected', 'true');
      selectedBtn = btn;
    } else {
      btn.setAttribute('aria-selected', 'false');
    }
    btn.addEventListener('click', () => applyRemindTimePickerChoice(field, item.value, item.label));
    list.appendChild(btn);
  });

  picker.classList.add('active');
  picker.setAttribute('aria-hidden', 'false');
  if (selectedBtn && typeof selectedBtn.scrollIntoView === 'function') {
    selectedBtn.scrollIntoView({ block: 'center' });
  }
}

function applyRemindTimePickerChoice(field, value, label) {
  const hourEl = el('remindHour');
  const minuteEl = el('remindMinute');
  const ampmEl = el('remindAmPm');
  if (field === 'hour') setRemindClockField(hourEl, value, label);
  else if (field === 'minute') setRemindClockField(minuteEl, value, label);
  else setRemindClockField(ampmEl, value, label);
  closeRemindTimePicker();
  onRemindTimeChange();
}

function onRemindTimeChange() {
  const parsed = readReminderClockFromDom();
  if (!parsed) return;
  Tracker.setReminderDailyTime(toDailyTime24(parsed.hour, parsed.minute));
}

function renderRemindersTab(data) {
  normalizeReminders(data);
  const enabledEl = el('reminderDailyEnabled');
  const statusEl = el('reminderStatusText');
  const on = data.reminders.dailyEnabled;
  const clock = parseDailyTime24(data.reminders.dailyTime);
  const parts = clock ? splitReminderClock(clock.hour, clock.minute) : splitReminderClock(20, 0);

  if (enabledEl) enabledEl.checked = on;
  setRemindClockField(el('remindHour'), parts.hour12, String(parts.hour12));
  setRemindClockField(
    el('remindMinute'),
    parts.minute,
    parts.minute < 10 ? '0' + parts.minute : String(parts.minute),
  );
  setRemindClockField(el('remindAmPm'), parts.ampm, parts.ampm);
  setReminderClockDisabled(!on);

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

function bindReminderSettingsUi() {
  const toggle = el('reminderDailyEnabled');
  const hourEl = el('remindHour');
  const minuteEl = el('remindMinute');
  const ampmEl = el('remindAmPm');
  const picker = el('remindTimePicker');
  const closeBtn = el('remindTimePickerClose');

  if (toggle && !toggle.dataset.bound) {
    toggle.dataset.bound = '1';
    toggle.addEventListener('change', () => {
      Tracker.setReminderDailyEnabled(toggle.checked);
    });
  }
  if (hourEl && !hourEl.dataset.bound) {
    hourEl.dataset.bound = '1';
    hourEl.addEventListener('click', () => openRemindTimePicker('hour'));
  }
  if (minuteEl && !minuteEl.dataset.bound) {
    minuteEl.dataset.bound = '1';
    minuteEl.addEventListener('click', () => openRemindTimePicker('minute'));
  }
  if (ampmEl && !ampmEl.dataset.bound) {
    ampmEl.dataset.bound = '1';
    ampmEl.addEventListener('click', () => openRemindTimePicker('ampm'));
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeRemindTimePicker);
  }
  if (picker && !picker.dataset.bound) {
    picker.dataset.bound = '1';
    picker.addEventListener('click', (e) => {
      if (e.target === picker) closeRemindTimePicker();
    });
  }
}

bindReminderSettingsUi();
