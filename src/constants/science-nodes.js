/* ===== src/constants/science-nodes.js ===== */
'use strict';

const SCIENCE_NODES = [
  {
    day: 1, organ: '🫀', label: 'Day 1',
    title: 'Heart & Blood',
    change: 'Alcohol is being cleared from the body; how long this takes varies with the amount consumed and the individual. The brain begins adapting as alcohol exposure decreases. Heart rate and blood pressure may begin moving toward a person\'s usual levels as alcohol is cleared.',
    cite: '',
    c: { emoji: '🫀', title: 'Day 1 — Heart & Blood', msg: 'Alcohol is being cleared from the body; how long this takes varies with the amount consumed and the individual.\n\nHeart rate and blood pressure may begin moving toward a person\'s usual levels as alcohol is cleared.' }
  },
  {
    day: 3, organ: '🫁', label: 'Day 3',
    title: 'Body Adjusting',
    change: 'Alcohol may be largely cleared from the bloodstream by this stage, depending on how much and when you last drank. The body continues adjusting as alcohol exposure decreases. Withdrawal symptoms can vary widely; if symptoms are severe or concerning, seek medical help.',
    cite: '',
    c: { emoji: '🫁', title: 'Day 3 — Body Adjusting', msg: 'Three days strong. The body continues adjusting to lower alcohol exposure. Withdrawal symptoms can vary widely; if symptoms are severe or concerning, seek medical help.' }
  },
  {
    day: 7, organ: '🧠', label: 'Day 7',
    title: 'Brain Chemistry',
    change: 'Brain reward pathways can begin adapting as alcohol exposure decreases. Sleep and mood may begin to improve as the body adjusts.',
    cite: '',
    c: { emoji: '🧠', title: 'Day 7 — Brain Adapting', msg: 'One week. Brain reward pathways can begin adapting as alcohol exposure decreases.\n\nSleep and mood may begin to improve as the body adjusts.' }
  },
  {
    day: 14, organ: '🌿', label: 'Day 14',
    title: 'Liver & Blood Pressure',
    change: 'Changes in the gut microbiome may begin as alcohol exposure decreases. Reducing alcohol can support healthier blood pressure. The amount and timing of change vary from person to person. Sleep patterns may continue to adjust as alcohol exposure decreases.',
    cite: '',
    c: { emoji: '🌿', title: 'Day 14 — Two Weeks', msg: 'Changes in the gut microbiome may begin as alcohol exposure decreases.\n\nReducing alcohol can support healthier blood pressure. The amount and timing of change vary from person to person.\n\nSleep patterns may continue to adjust as alcohol exposure decreases.' }
  },
  {
    day: 21, organ: '🛡️', label: 'Day 21',
    title: 'Immune System',
    change: 'Immune function may begin to improve as alcohol exposure decreases. Cardiovascular health can begin to improve as alcohol exposure decreases.',
    cite: '',
    c: { emoji: '🛡️', title: 'Day 21 — Immune System', msg: 'Three weeks. Immune function may begin to improve as alcohol exposure decreases.\n\nCardiovascular health can begin to improve as alcohol exposure decreases.' }
  },
  {
    day: 28, organ: '💎', label: 'Day 28',
    title: 'Full Month',
    change: 'Some people notice improvements in sleep, mood, energy, or overall wellbeing by this point. Cardiovascular health can improve with sustained reduction or abstinence; the extent and timing vary by person.',
    cite: '',
    c: { emoji: '💎', title: 'Day 28 — Full Month', msg: 'Four weeks without alcohol.\n\nSome people notice improvements in sleep, mood, energy, or overall wellbeing by this point.\n\nCardiovascular health can improve with sustained reduction or abstinence; the extent and timing vary by person.' }
  },
  {
    day: 30, organ: '🫀', label: 'Day 30',
    title: 'Blood Pressure & Cancer Risk',
    change: 'With continued reduction or abstinence, blood pressure may improve over time. Some cardiovascular and cancer risk factors may begin to improve over time.',
    cite: '',
    hiddenUntil: 28,
    c: { emoji: '🫀', title: 'Day 30 — Blood Pressure', msg: '30 days. With continued reduction or abstinence, blood pressure may improve over time.\n\nSome cardiovascular and cancer risk factors may begin to improve over time.' }
  },
  {
    day: 60, organ: '🧠', label: 'Day 60',
    title: 'Liver & Cognition',
    change: 'For some people, reducing or stopping alcohol can allow fatty changes in the liver to improve. Some people experience improvements in memory, concentration, or thinking as the brain adjusts over time.',
    cite: '',
    hiddenUntil: 30,
    c: { emoji: '🧠', title: 'Day 60 — Liver & Cognition', msg: '60 days. For some people, reducing or stopping alcohol can allow fatty changes in the liver to improve.\n\nSome people experience improvements in memory, concentration, or thinking as the brain adjusts over time.' }
  },
  {
    day: 90, organ: '🧬', label: 'Day 90',
    title: 'Brain, Heart & Gut',
    change: 'The brain continues adapting to lower alcohol exposure. Recovery can continue over months and varies between people. Reducing alcohol can lower some cardiovascular risks over time. The gut microbiome can change as alcohol exposure decreases, although the timing and extent vary between people.',
    cite: '',
    hiddenUntil: 60,
    c: { emoji: '🧬', title: 'Day 90 — Brain, Heart & Gut', msg: '90 days. The brain continues adapting to lower alcohol exposure. Recovery can continue over months and varies between people.\n\nReducing alcohol can lower some cardiovascular risks over time.\n\nThe gut microbiome can change as alcohol exposure decreases, although the timing and extent vary between people.' }
  },
  {
    day: 180, organ: '🫁', label: 'Day 180',
    title: 'Liver Recovery & Immunity',
    change: 'Liver fibrosis may begin to reverse in some early-stage cases with sustained abstinence. Longer periods of reduced alcohol exposure can support immune function and overall health.',
    cite: '',
    hiddenUntil: 60,
    c: { emoji: '🫁', title: 'Day 180 — Liver Recovery', msg: '180 days. Liver fibrosis may begin to reverse in some early-stage cases with sustained abstinence.\n\nLonger periods of reduced alcohol exposure can support immune function and overall health.' }
  },
  {
    day: 365, organ: '💚', label: 'Day 365',
    title: 'Cardiovascular Reset',
    change: 'Cardiovascular health can improve with sustained reduction or abstinence; the extent and timing vary by person (Ronksley et al., BMJ 2011).',
    cite: 'Ronksley et al., BMJ 2011',
    hiddenUntil: 180,
    c: { emoji: '💚', title: 'Day 365 — One Full Year', msg: 'One year sober.\n\nCardiovascular health can improve with sustained reduction or abstinence; the extent and timing vary by person.\n\nThis is not luck. This is who you are.' }
  },
];
