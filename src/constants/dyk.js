/* ===== src/constants/dyk.js ===== */
'use strict';
const DYK_FACTS = [
  {text:"The WHO AUDIT-C is a 3-question clinical screening tool used by doctors in over 50 countries to identify hazardous and harmful drinking patterns.",source:"WHO AUDIT Guidelines 2001"},
  {text:"Home pours are typically 40-60% larger than bar pegs. What feels like 2 drinks at home could be 3-4 standard drinks. The glass size is the illusion.",source:"NIAAA Drink Size Research"},
  {text:"Needing more drinks to feel the same effect is not a badge of honour — it is a clinical warning sign. Tolerance means your liver and brain have adapted to alcohol as a baseline.",source:"NIAAA, DSM-5"},
  {text:"Feeling anxious, restless, or unable to sleep on days you do not drink can have many causes. These can be symptoms of alcohol withdrawal. If they occur when you reduce or stop drinking, consider speaking with a healthcare professional.",source:"NIAAA — alcohol withdrawal"},
  {text:"Heavy alcohol use can involve overlapping changes in brain reward, stress, and withdrawal-related pathways. Researchers describe these processes in broad terms, but the underlying biology is more complicated and differs from person to person.",source:"Koob & Volkow, Neurobiological Theories of Addiction 2010"},
  {text:"Alcohol can influence dopamine signalling in brain reward pathways. Some people notice stronger urges or anticipation around drinking over time — but responses vary widely.",source:"NIAAA, Neuroscience of Addiction"},
  {text:"Alcohol also affects signalling systems involved in stress and arousal (including GABA-related pathways). Some people drink because it briefly feels calming; with regular heavy use, nervous-system responses can change.",source:"NIAAA"},
  {text:"Alcohol use disorder is not simply a lack of willpower. Repeated heavy drinking can change how the brain handles reward and stress over time. Support and treatment can help.",source:"NIAAA"},
  {text:"If someone chooses sobriety, honour that choice. Never push a sober person to drink. True respect means accepting people as they are.",source:"\u2728 Values"},
  {text:"Many regular drinkers remember early drinks feeling especially pleasurable. Over time, that experience often changes — and drinking more does not reliably bring the same feeling back.",source:"NIAAA, Neuroscience of Addiction"},
  {text:"Some people who drink heavily every day describe later drinking as easing discomfort rather than pure enjoyment. If drinking feels necessary to get through the day, consider speaking with a healthcare professional.",source:"NIAAA"},
  {text:"Wine glasses have grown 7 times larger over the past 300 years. A modern large wine glass holds what a full bottle held in the 1700s \u2014 making it easy to dramatically underestimate how much you drink.",source:"BMJ, University of Cambridge 2017"},
  {who:true,text:"No level of alcohol consumption is safe for our health.",type:"who"},
  {text:"Low Risk is not Risk Free. The less you drink, the lower the risk. Any alcohol carries some health risk.",source:"WHO Global Status Report on Alcohol, 2023"},
  {myth:"I only drink on weekends, so I\u2019m safe.",fact:"Risk depends on how much and how often you drink. Weekend bingeing can be more harmful than daily moderate drinking.",type:"myth"},
  {myth:"Coffee sobers you up.",fact:"Coffee makes you feel more alert \u2014 but it does not remove alcohol from your blood. Only time does that. A wide-awake drunk is still drunk.",type:"myth"},
  {myth:"Alcohol warms you up.",fact:"Alcohol dilates blood vessels near the skin, making you feel warm \u2014 but actually causing your body to lose heat faster. It lowers your core temperature, not raises it.",type:"myth"},
  {myth:"I can handle my drink \u2014 I have a high tolerance.",fact:"Tolerance means your body has adapted to alcohol \u2014 not that you are unaffected. You need more to feel the same effect because your brain has changed. That is a warning sign, not a skill.",type:"myth"},
  {type:"topic",title:"Why does alcohol sometimes feel less effective over time?",text:"With repeated drinking, the brain and body can adapt to alcohol. This can lead to **tolerance**, meaning more alcohol may be needed to produce the same effects.",source:"Tolerance"},
  {type:"topic",title:"Why can drinking become harder to control?",text:"Alcohol affects brain systems involved in reward, stress, and self-control. With repeated heavy drinking, these systems can adapt, which may make reducing alcohol use more difficult for some people.",source:"Alcohol and the brain"},
  {type:"topic",title:"Why can stopping suddenly be difficult?",text:"After prolonged heavy drinking, the brain can adapt to regular alcohol exposure. Suddenly stopping can cause withdrawal symptoms in some people, ranging from anxiety and sleep problems to more serious complications.\n\nIf you drink heavily every day or have experienced withdrawal symptoms, seek medical advice before stopping suddenly or making a major reduction.",source:"Withdrawal"},
  {type:"topic",title:"Why can reducing alcohol make a difference?",text:"Reducing how often and how much you drink lowers alcohol exposure. Having more alcohol-free days and avoiding heavy-drinking occasions can reduce alcohol-related risks over time.",source:"Drinking less"},
  {type:"topic",title:"Why are alcohol-free days useful?",text:"Alcohol-free days reduce your overall alcohol exposure and can help you build a more consistent drinking pattern. Adding more alcohol-free days can be a practical step toward reducing your alcohol use.",source:"Alcohol-free days"},
  {type:"topic",title:"Why focus on heavy-drinking occasions?",text:"Drinking a large amount on one occasion can increase short-term risks such as accidents, injuries, and alcohol poisoning. Reducing heavy-drinking occasions is an important part of reducing alcohol-related harm.",source:"Heavy-drinking occasions"},
  {type:"topic",title:"What happens when alcohol exposure decreases?",text:"The liver can recover from some alcohol-related changes when alcohol exposure is reduced or stopped. How much recovery occurs and how quickly it happens depends on the person and the extent of previous alcohol-related damage.",source:"The liver"},
  {type:"topic",title:"Why can sleep change when you reduce alcohol?",text:"Alcohol can affect sleep quality and sleep patterns. When drinking decreases, sleep may improve over time, although some people experience temporary sleep disruption while their body adjusts.",source:"Sleep"},
  {type:"topic",title:"Can reducing alcohol affect blood pressure?",text:"Reducing alcohol can help lower blood pressure in people who drink heavily. The amount and timing of improvement vary between individuals.",source:"Blood pressure"},
  {type:"topic",title:"Does the brain adapt after reducing alcohol?",text:"Yes. The brain can continue adapting as alcohol exposure decreases. Changes in sleep, mood, attention, and other functions can occur over time, but recovery varies from person to person.",source:"Brain recovery"},
  {type:"topic",title:"Can alcohol affect the gut?",text:"Alcohol can affect the gut and the microorganisms that live there. Reducing alcohol exposure may support improvements in gut health, although the timing and extent of these changes vary.",source:"The microbiome"},
  {type:"topic",title:"Can reducing alcohol support the immune system?",text:"Heavy alcohol use can affect immune function. Reducing alcohol exposure can support overall health and may allow some alcohol-related effects on immune function to improve over time.",source:"Immune function"},
  {type:"topic",title:"Every alcohol-free day counts",text:"You don't need to change everything at once. More alcohol-free days, fewer heavy-drinking occasions, and smaller amounts when drinking can all reduce your overall alcohol exposure.",source:"A simple principle"},
  {text:"Beat your last journey score. Each journey \u2014 can you score more sober days than the last? Progress is not always linear. One better journey changes everything.",source:"\ud83c\udfc6 Ways You Are Winning",winning:true},
  {text:"Set a new personal best streak. How many consecutive sober days can you reach? Your streak is proof of what you are capable of \u2014 one day at a time.",source:"\ud83c\udfc6 Ways You Are Winning",winning:true},
  {text:"Eliminate binge sessions. Avoid heavy drinking occasions \u2014 alcohol per volume depends on ABV. For 40% whisky, 180 ml is approximately 5.7 standard drinks of 10 g alcohol each.",source:"\ud83c\udfc6 Ways You Are Winning",winning:true},
  {text:"One bad day cannot erase weeks of effort. The shelf refills next journey. The streak resets but the learning does not.",source:"\ud83d\udeb6 Keep Going",winning:true},
  {type:"craving",title:"\u23f3 Cravings last minutes \u2014 not hours",subtitle:"The goal is to get through the next 10-30 minutes, not win forever.",steps:[{icon:"\ud83e\udde0",text:"Tell yourself: Not now. I will decide in 30 minutes."},{icon:"\ud83d\udccc",text:"Most cravings fade on their own if you do not immediately act on them."},{icon:"\ud83c\udfaf",text:"The goal is delay \u2014 not forever. Just 30 minutes."}]},
  {type:"craving",title:"\ud83d\udeb6 Move \u2014 change your location",subtitle:"A change of environment breaks the craving loop.",steps:[{icon:"\ud83d\udeb6",text:"Go outside or walk around the block."},{icon:"\u2615",text:"Visit a caf\u00e9 or public place."},{icon:"\ud83c\udfe0",text:"Move to a different room."}]},
  {type:"craving",title:"\ud83d\udca7 Occupy the mouth",subtitle:"Many cravings are partly ritual.",steps:[{icon:"\ud83d\udca7",text:"Drink a full glass of water."},{icon:"\ud83e\udee7",text:"Soda water \u2014 the fizz helps."},{icon:"\ud83c\udf75",text:"Tea or coffee."},{icon:"\ud83c\udf4b",text:"Eat fruit or chew gum."}]},
  {type:"craving",title:"\ud83c\udfb5 Distract fully",subtitle:"Anything that completely captures your attention works.",steps:[{icon:"\ud83c\udfb5",text:"Music \u2014 put on something you love."},{icon:"\ud83c\udfae",text:"Video game or YouTube."},{icon:"\ud83d\udcda",text:"Reading \u2014 even a few pages."}]},
  {type:"craving",title:"\ud83c\udd98 Craving right now? Do this",subtitle:"Five things. Pick any one.",steps:[{icon:"\ud83d\udeb6",text:"Move \u2014 go somewhere different."},{icon:"\ud83d\udca7",text:"Drink water or soda water."},{icon:"\ud83d\udcde",text:"Call or message someone."},{icon:"\ud83c\udfb5",text:"Distract yourself fully."},{icon:"\u23f3",text:"Wait 30 minutes. Decide then."}]},
  {text:"You win here in five ways. Add one more sober day than last time. Don't increase your intake. Lower your AUDIT-C score by even one point. Beat your personal best. Reach a milestone you haven't hit before. Any one of these is a victory. You don't have to quit. You just have to be slightly better than yesterday.",source:"10Drinks · Harm Reduction Framework"}
];

function normalizeDykIndex(index) {
  const len = DYK_FACTS.length;
  if (!len) return 0;
  let idx = ((index || 0) % len + len) % len;
  if (DYK_FACTS[idx]) return idx;
  for (let i = 0; i < len; i++) {
    if (DYK_FACTS[i]) return i;
  }
  return 0;
}

// ── DYK INDEX STORAGE ─────────────────────────────────────────
if (!('dykIndex' in DataManager.defaults())) {
  const _origDef = DataManager.defaults.bind(DataManager);
  DataManager.defaults = function() { const d=_origDef(); d.dykIndex=0; return d; };
}

function dykFormatTopicText(text) {
  if (!text) return '';
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// ── DID YOU KNOW RENDERER ─────────────────────────────────────
function renderDidYouKnow(data) {
  if (!data) return;
  const card = document.getElementById('didYouKnowCard');
  if (!card) return;
  const idx  = normalizeDykIndex(data.dykIndex);
  if (data.dykIndex !== idx) {
    data.dykIndex = idx;
    DataManager.save(data);
  }
  const fact = DYK_FACTS[idx];
  if (!fact) return;
  const bodyEl = document.getElementById('dykBody');
  const titleEl = document.getElementById('dykTitle');
  const barEl   = document.getElementById('dykTopBar');
  const cntEl   = document.getElementById('dykCounter');
  if (cntEl) cntEl.textContent = `${idx+1} / ${DYK_FACTS.length}`;
  if (barEl) {
    if (fact.type==='craving')    barEl.style.background='linear-gradient(90deg,#FF8C00,#cc6600)';
    else if (fact.type==='myth')  barEl.style.background='linear-gradient(90deg,#ff3b30,#cc2200)';
    else if (fact.winning)        barEl.style.background='linear-gradient(90deg,#34c759,#248a3d)';
    else if (fact.who)            barEl.style.background='linear-gradient(90deg,#ff9500,#cc6600)';
    else                          barEl.style.background='linear-gradient(90deg,#34c759,#248a3d)';
  }
  if (titleEl) {
    if (fact.type==='craving')    {titleEl.textContent='\u23f3 Craving Support';titleEl.style.color='#cc6600';}
    else if (fact.type==='myth')  {titleEl.textContent='\u274c Myth vs Fact';    titleEl.style.color='#cc2200';}
    else if (fact.winning)        {titleEl.textContent='\ud83c\udfc6 Winning';   titleEl.style.color='#248a3d';}
    else                          {titleEl.textContent='\ud83d\udca1 Knowledge'; titleEl.style.color='#1c1c1e';}
  }
  if (!bodyEl) return;
  if (fact.who) {
    bodyEl.innerHTML=`<div style="background:rgba(255,149,0,0.06);border:1.5px solid rgba(255,149,0,0.25);border-radius:12px;padding:14px 16px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:18px;">🌍</span><span style="font-size:11px;font-weight:700;color:#cc6600;letter-spacing:0.5px;text-transform:uppercase;">WHO Position · 2023</span></div><div style="font-size:15px;font-weight:700;color:rgba(28,28,30,0.9);line-height:1.5;font-style:italic;margin-bottom:10px;">"No level of alcohol consumption is safe for our health."</div><div style="height:1px;background:rgba(255,149,0,0.2);margin-bottom:10px;"></div><div style="font-size:12px;color:rgba(60,60,67,0.6);line-height:1.6;">Low Risk means <em>lower</em> risk — not zero risk. Any alcohol carries some health risk. The less you drink, the lower the risk.</div></div>`;
  } else if (fact.type==='myth') {
    bodyEl.innerHTML=`<div style="margin-bottom:10px;padding:10px 12px;background:rgba(255,59,48,0.05);border-radius:10px;border-left:3px solid rgba(255,59,48,0.4);"><div style="font-size:11px;font-weight:700;color:rgba(255,59,48,0.8);margin-bottom:4px;">\u274c Myth</div><div style="font-size:13px;color:rgba(60,60,67,0.75);line-height:1.6;font-style:italic;">"${fact.myth}"</div></div><div style="padding:10px 12px;background:rgba(52,199,89,0.06);border-radius:10px;border-left:3px solid rgba(52,199,89,0.4);"><div style="font-size:11px;font-weight:700;color:#248a3d;margin-bottom:4px;">\u2705 Fact</div><div style="font-size:13px;color:rgba(60,60,67,0.8);line-height:1.6;">${fact.fact}</div></div>`;
  } else if (fact.type==='craving') {
    const steps=(fact.steps||[]).map(s=>`<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(60,60,67,0.06);"><span style="font-size:15px;flex-shrink:0;">${s.icon}</span><div style="font-size:12px;color:rgba(60,60,67,0.8);line-height:1.55;">${s.text}</div></div>`).join('');
    const bg='rgba(255,149,0,0.05)';
    const col='#cc6600';
    bodyEl.innerHTML=`<div style="background:${bg};border-radius:10px;padding:12px 14px;"><div style="font-size:13px;font-weight:600;color:${col};margin-bottom:2px;">${fact.title}</div><div style="font-size:11px;color:rgba(60,60,67,0.45);margin-bottom:10px;">${fact.subtitle||''}</div>${steps}${fact.note?`<div style="margin-top:10px;font-size:11px;color:rgba(60,60,67,0.4);line-height:1.6;font-style:italic;">${fact.note}</div>`:''}</div>`;
  } else if (fact.winning) {
    bodyEl.innerHTML=`<div style="border-left:3px solid rgba(52,199,89,0.6);background:rgba(52,199,89,0.05);border-radius:0 8px 8px 0;padding:12px 14px;"><div style="font-size:13px;color:rgba(28,28,30,0.85);line-height:1.7;margin-bottom:6px;">${fact.text}</div><div style="font-size:11px;color:#248a3d;font-weight:600;">${fact.source}</div></div>`;
  } else if (fact.type === 'topic') {
    const paras = dykFormatTopicText(fact.text).split(/\n\n+/).map((p, i, arr) => {
      const mb = i < arr.length - 1 ? '10px' : '0';
      return `<p style="margin:0 0 ${mb};font-size:13px;color:rgba(60,60,67,0.8);line-height:1.7;">${p}</p>`;
    }).join('');
    bodyEl.innerHTML = `<div style="margin-bottom:10px;font-size:13px;font-weight:700;color:rgba(28,28,30,0.9);line-height:1.5;">${fact.title}</div>${paras}<div style="font-size:11px;color:rgba(60,60,67,0.35);font-style:italic;margin-top:10px;">📄 ${fact.source}</div><div style="font-size:10px;color:rgba(60,60,67,0.25);margin-top:4px;">Summarised from published research. Not a direct quote.</div>`;
  } else {
    bodyEl.innerHTML=`<div style="font-size:13px;color:rgba(60,60,67,0.8);line-height:1.7;margin-bottom:8px;">${fact.text}</div><div style="font-size:11px;color:rgba(60,60,67,0.35);font-style:italic;">📄 ${fact.source}</div><div style="font-size:10px;color:rgba(60,60,67,0.25);margin-top:4px;">Summarised from published research. Not a direct quote.</div>`;
  }
}

// ── DYK NAV ───────────────────────────────────────────────────
SoberTracker.dykNext = function() {
  const d = Tracker.data || DataManager.load();
  d.dykIndex = normalizeDykIndex((d.dykIndex || 0) + 1);
  DataManager.save(d);
  Tracker.data = d;
  renderDidYouKnow(d);
};
SoberTracker.dykPrev = function() {
  const d = Tracker.data || DataManager.load();
  d.dykIndex = normalizeDykIndex((d.dykIndex || 0) - 1);
  DataManager.save(d);
  Tracker.data = d;
  renderDidYouKnow(d);
};

