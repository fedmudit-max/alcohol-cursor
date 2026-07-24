/* ===== src/journey/daily-msg.js ===== */
'use strict';

// Toast copy after logging a sober day
function _dailyMsg(streak, score) {

  // Layer 1 — Science-backed health fact on specific streak days
  const HEALTH_FACTS = {
    2:  'Day 2. Alcohol has cleared your bloodstream. Your body is already recovering. 🫀',
    3:  'Day 3. Blood alcohol is zero. Liver enzymes already improving. Keep going. 🌿',
    4:  'Day 4. Sleep architecture is repairing. REM sleep returning to normal. 💤',
    5:  'Day 5. Blood pressure dropping measurably. Heart working less hard. ❤️',
    6:  'Day 6. Most people quit by now. You did not. That gap is everything. ⚡',
    8:  'Day 8. Dehydration reversing. Brain fog lifting. You will notice the clarity. 🧠',
    9:  'One day from Day 10. Do not stop now. You are so close. 🎯',
    11: 'Day 11. Liver is actively repairing damaged cells. The science is on your side. 🌱',
    12: 'Day 12. Anxiety and irritability from withdrawal — gone by now. Your baseline is rising. ✨',
    13: 'Day 13. Two weeks tomorrow. Immune system measurably stronger. 💪',
    15: 'Day 15. More sober days than drinking days this journey. You are ahead. 🏆',
    16: 'Day 16. Skin hydration improving. Inflammation reducing. It shows. 🌟',
    17: 'Day 17. Gut microbiome recovering. Digestion normalising. 🌿',
    18: 'Day 18. Three weeks in two days. The habit is forming underneath the surface. 🔥',
    19: 'Day 19. Dopamine system recalibrating. Natural pleasure returning. 💚',
    22: 'Day 22. Three weeks done. Brain neuroplasticity actively rewiring. 🧠',
    23: 'Day 23. Cholesterol levels improving. Heart disease risk dropping. ❤️',
    25: 'Day 25. Cognitive function measurably sharper than when you started. ⚡',
    26: 'Day 26. Almost a month. Liver fat content reducing significantly. 🌱',
    27: 'Day 27. Three days from Day 30. One of the hardest milestones. You are almost there. 🎯',
    29: 'Day 29. Tomorrow is Day 30. One month. Do not stop tonight. 🏔️',
  };

  if (HEALTH_FACTS[streak]) return HEALTH_FACTS[streak];

  // Layer 2 — Journey ratio reaction (sober vs drinking)
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
  } else if (s > 0) {
    // No drinking days yet — pure streak
    if (s === 2)  return 'Day 2. Back again. The streak is alive. 🔥';
    if (s === 4)  return 'Day 4. Four days. You are building something real. 🌱';
    if (s === 6)  return 'Day 6. Six days without a drink. Your body is noticing. 💚';
    if (s === 8)  return 'Day 8. Eight days. The habit is forming. ⚡';
    if (s === 9)  return 'Day 9. One day from Day 10. Do not stop now. 🎯';
    if (s === 11) return 'Day 11. Keep building. Every day compounds. 🌿';
    if (s === 12) return 'Day 12. Twelve days strong. You are not the same person who started. 🌟';
    if (s === 13) return 'Day 13. Two weeks tomorrow. Almost there. 💪';
  }

  // Layer 3 — Streak momentum (fallback for all other days)
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
