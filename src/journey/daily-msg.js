/* ===== src/journey/daily-msg.js ===== */
'use strict';

// Toast copy after logging a sober day
function _dailyMsg(streak, score) {
  // Journey ratio reaction (sober vs drinking)
  const s = score.success, f = score.failures;
  if (f > 0) {
    const ratio = Math.floor(s / f);
    const prevRatio = Math.floor((s - 1) / f);
    if (ratio !== prevRatio) {
      if (ratio === 2) return `${s} sober, ${f} drinking. Twice as many sober days. You are winning. 🟢`;
      if (ratio === 3) return `3 to 1. Three sober days for every drinking day. You are in control. 💪`;
      if (ratio === 4) return `4 to 1. Four sober days for every drinking day. This is becoming who you are. 🌟`;
      if (ratio === 5) return `5 to 1. Five sober days for every drinking day. The numbers do not lie. 🏆`;
      if (ratio >= 6) return `${ratio} to 1. You are rewriting your relationship with alcohol. 💎`;
    }
  }

  // Streak momentum (fallback)
  const STREAK_MSG = [
    'One more day won. Quietly unstoppable. 🌱',
    'Streak alive. Keep the momentum. 🔥',
    'Another day, another win. Your future self is grateful. 💚',
    'Consistency is the compound interest of self-improvement. ⚡',
    'You showed up again. That is the whole game. 🎯',
    'Small wins build the life you want. 🌟',
    'The discipline you build today is the freedom you feel tomorrow. 💎',
    'Steady. Strong. Unbroken. 🏔️',
  ];
  return STREAK_MSG[streak % STREAK_MSG.length];
}
