/* ===== src/ui/reminder-native.js ===== */
/* Android daily reminder — AlarmManager via TenDrinksReminder (same model as laotzu101). */
'use strict';

const REMINDER_AWAITING_EXACT_KEY = 'sj_reminderAwaitingExact';
const REMINDER_EXACT_ALARM_EXPLAIN =
  'To remind you near your chosen time, Android needs permission to schedule alarms and reminders.';
const REMINDER_EXACT_ALARM_DENIED =
  'Precise reminders need that permission. The reminder stays off until you allow it.';

let reminderNativeStatus = null;

function getTenDrinksReminderPlugin() {
  const Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) return null;
  if (typeof Cap.getPlatform === 'function' && Cap.getPlatform() !== 'android') return null;
  if (Cap.Plugins && Cap.Plugins.TenDrinksReminder) return Cap.Plugins.TenDrinksReminder;
  if (typeof Cap.registerPlugin === 'function') {
    try {
      return Cap.registerPlugin('TenDrinksReminder');
    } catch (e) {
      return null;
    }
  }
  return null;
}

function reminderNativeAvailable() {
  return !!getTenDrinksReminderPlugin();
}

function callReminderPlugin(method, args) {
  const plugin = getTenDrinksReminderPlugin();
  if (!plugin || typeof plugin[method] !== 'function') {
    return Promise.reject(new Error('unavailable'));
  }
  return plugin[method](args || {});
}

function rememberReminderStatus(status) {
  if (status) reminderNativeStatus = status;
}

function remindersFromData(data) {
  normalizeReminders(data);
  const clock = parseDailyTime24(data.reminders.dailyTime);
  const hour = clock ? clock.hour : 20;
  const minute = clock ? clock.minute : 0;
  return {
    enabled: !!data.reminders.dailyEnabled,
    hour,
    minute,
  };
}

function todayLoggedDateKey(data) {
  if (!data) return '';
  if (data.todayStatus === 'success' || data.todayStatus === 'failed') {
    return dateKey(getAppToday(data));
  }
  const todayKey = dateKey(getAppToday(data));
  const log = data.dailyLog || {};
  if (log[todayKey] === 'sober' || log[todayKey] === 'drinking') return todayKey;
  return '';
}

function syncReminderLoggedDate(data) {
  if (!reminderNativeAvailable()) return;
  const d = data || (typeof Tracker !== 'undefined' && Tracker.data) || DataManager.load();
  const dateKeyStr = todayLoggedDateKey(d);
  callReminderPlugin('setLoggedDate', { dateKey: dateKeyStr }).catch(() => {});
}

function reminderUsesInexactSchedule(status) {
  return status && status.scheduleMode === 'inexact';
}

function reminderNeedsReliableSchedule(status) {
  if (!status) return true;
  if (status.exactAlarmsAllowed === false) return true;
  return reminderUsesInexactSchedule(status);
}

function reminderStatusLine(data) {
  if (!reminderNativeAvailable()) return '';
  const settings = remindersFromData(data);
  if (!settings.enabled) return '';
  if (reminderNativeStatus && reminderNativeStatus.notificationsAllowed === false) {
    return 'Allow notifications for 10Drinks in system settings to use the daily reminder.';
  }
  const timeLine = `${formatReminderTime12(data.reminders.dailyTime)} every day.`;
  if (reminderNativeStatus && reminderNativeStatus.exactAlarmsAllowed === false) {
    return timeLine + ' ' + REMINDER_EXACT_ALARM_EXPLAIN;
  }
  if (reminderNativeStatus && reminderNativeStatus.scheduleMode === 'inexact') {
    return timeLine + ' Allow scheduled alarms for 10Drinks for on-time reminders.';
  }
  return timeLine;
}

function turnReminderOffNative(message) {
  const d = Tracker.data || DataManager.load();
  d.reminders.dailyEnabled = false;
  DataManager.save(d);
  Tracker.data = d;
  try {
    localStorage.removeItem(REMINDER_AWAITING_EXACT_KEY);
  } catch (e) {}
  return callReminderPlugin('cancel', { disable: true }).then((status) => {
    rememberReminderStatus(status);
    renderRemindersTab(d);
    if (message && typeof showToast === 'function') showToast(message);
  }).catch(() => {
    renderRemindersTab(d);
  });
}

function scheduleReminderOnNative(hour, minute) {
  return callReminderPlugin('schedule', { hour, minute }).then((status) => {
    rememberReminderStatus(status);
    return status;
  });
}

function ensureNotificationPermission() {
  return callReminderPlugin('getStatus').then((status) => {
    rememberReminderStatus(status);
    if (status && status.notificationsAllowed !== false) return true;
    return callReminderPlugin('requestPermissions').then((perm) => {
      const granted = perm && String(perm.notifications).toLowerCase() === 'granted';
      if (!granted && typeof showToast === 'function') {
        showToast('Allow notifications for 10Drinks in system settings.');
      }
      return granted;
    });
  }).catch(() => false);
}

function openExactAlarmPermissionFlow(initialStatus) {
  if (typeof showToast === 'function') showToast(REMINDER_EXACT_ALARM_EXPLAIN);
  try {
    localStorage.setItem(REMINDER_AWAITING_EXACT_KEY, '1');
  } catch (e) {}
  return callReminderPlugin('cancel', {}).then(() => callReminderPlugin('openExactAlarmSettings'))
    .then((afterSettings) => {
      rememberReminderStatus(afterSettings);
      if (afterSettings && afterSettings.exactAlarmsAllowed) {
        try {
          localStorage.removeItem(REMINDER_AWAITING_EXACT_KEY);
        } catch (e) {}
        const settings = remindersFromData(Tracker.data || DataManager.load());
        return scheduleReminderOnNative(settings.hour, settings.minute).then((retryStatus) => ({
          status: retryStatus,
          scheduled: !reminderNeedsReliableSchedule(retryStatus),
        }));
      }
      return { status: afterSettings || initialStatus, scheduled: false, awaitingExact: true };
    })
    .catch(() => ({ status: initialStatus, scheduled: false, awaitingExact: true }));
}

function finishReminderSchedule(status, promptExactAlarm) {
  if (!reminderNeedsReliableSchedule(status)) {
    try {
      localStorage.removeItem(REMINDER_AWAITING_EXACT_KEY);
    } catch (e) {}
    return Promise.resolve({ status, scheduled: true });
  }
  if (!promptExactAlarm) {
    return Promise.resolve({ status, scheduled: false, exactAlarmNeeded: true });
  }
  return openExactAlarmPermissionFlow(status);
}

function applyNativeReminderAlarms(options) {
  options = options || {};
  if (!reminderNativeAvailable()) return Promise.resolve({ scheduled: false });

  const d = Tracker.data || DataManager.load();
  const settings = remindersFromData(d);
  const shouldSchedule = !!(settings.enabled || options.intentOn);

  if (!shouldSchedule) {
    const cancelArgs = settings.enabled ? {} : { disable: true };
    return callReminderPlugin('cancel', cancelArgs).then((status) => {
      rememberReminderStatus(status);
      return { scheduled: false };
    }).catch(() => ({ scheduled: false }));
  }

  return ensureNotificationPermission().then((ok) => {
    if (!ok) {
      return turnReminderOffNative('Allow notifications for 10Drinks — reminder stays off until then.')
        .then(() => ({ scheduled: false, notificationsDenied: true }));
    }
    return callReminderPlugin('getStatus').then((status) => {
      rememberReminderStatus(status);
      if (options.promptExactAlarm && status.exactAlarmsAllowed === false) {
        return openExactAlarmPermissionFlow(status).then((result) => ({
          scheduled: !!result.scheduled,
          awaitingExact: !!result.awaitingExact,
        }));
      }
      return scheduleReminderOnNative(settings.hour, settings.minute).then((st) =>
        finishReminderSchedule(st, options.promptExactAlarm).then((result) => ({
          scheduled: !!result.scheduled,
          awaitingExact: !!result.awaitingExact,
          exactAlarmNeeded: !!result.exactAlarmNeeded,
        })),
      );
    });
  });
}

function reconcileReminderEnableState() {
  if (!reminderNativeAvailable()) return;
  const d = Tracker.data || DataManager.load();
  const settings = remindersFromData(d);
  let awaitingExact = false;
  try {
    awaitingExact = localStorage.getItem(REMINDER_AWAITING_EXACT_KEY) === '1';
  } catch (e) {}

  if (!settings.enabled && !awaitingExact) return;

  callReminderPlugin('getStatus').then((status) => {
    rememberReminderStatus(status);
    if (settings.enabled && status.notificationsAllowed === false) {
      turnReminderOffNative('Allow notifications for 10Drinks — reminder stays off until then.');
      return;
    }
    if (settings.enabled && status.exactAlarmsAllowed && reminderUsesInexactSchedule(status)) {
      return scheduleReminderOnNative(settings.hour, settings.minute).then((s) => {
        rememberReminderStatus(s);
        renderRemindersTab(d);
      });
    }
    if (!awaitingExact) {
      if (settings.enabled && status.exactAlarmsAllowed === false) {
        turnReminderOffNative(REMINDER_EXACT_ALARM_DENIED);
      }
      return;
    }
    if (status.exactAlarmsAllowed) {
      try {
        localStorage.removeItem(REMINDER_AWAITING_EXACT_KEY);
      } catch (e) {}
      if (!settings.enabled) {
        d.reminders.dailyEnabled = true;
        DataManager.save(d);
        Tracker.data = d;
      }
      return scheduleReminderOnNative(settings.hour, settings.minute).then((s) => {
        rememberReminderStatus(s);
        renderRemindersTab(d);
        if (typeof showToast === 'function') {
          showToast(`Reminder set for ${formatReminderTime12(d.reminders.dailyTime)}.`);
        }
      });
    }
    turnReminderOffNative(REMINDER_EXACT_ALARM_DENIED);
  }).catch(() => {});
}

function initTenDrinksReminderNative() {
  if (!reminderNativeAvailable()) return;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reconcileReminderEnableState();
  });
  const plugin = getTenDrinksReminderPlugin();
  if (plugin && typeof plugin.addListener === 'function') {
    try {
      plugin.addListener('exactAlarmPermissionChanged', (status) => {
        rememberReminderStatus(status);
        reconcileReminderEnableState();
      });
    } catch (e) {}
  }
  reconcileReminderEnableState();
  applyNativeReminderAlarms();
  syncReminderLoggedDate();
}

window.TenDrinksReminderNative = {
  available: reminderNativeAvailable,
  init: initTenDrinksReminderNative,
  applyAlarms: applyNativeReminderAlarms,
  syncLoggedDate: syncReminderLoggedDate,
  statusLine: reminderStatusLine,
  reconcile: reconcileReminderEnableState,
};
