/* ===== src/journey/midnight.js ===== */
'use strict';

// Polls for calendar-day rollover and triggers catch-up when needed

const MidnightTimer = {
  _id: null,
  start() { this._id = setInterval(() => this._check(), MIDNIGHT_CHECK_MS); this._check(); },
  stop()  { if (this._id) { clearInterval(this._id); this._id = null; } },
  _check() {
    const data = Tracker.data || DataManager.load();
    normalizeTodaySession(data);
    const diff = daysSince(data.lastDayCheck, getAppToday(data));
    if (diff > 0) {
      if (!Tracker.data) Tracker.data = data;
      Tracker._catchUp();
    } else {
      recalculateStreakFromLog(data);
      if (Tracker.data) UI.renderAll(Tracker.data);
    }
  }
};
