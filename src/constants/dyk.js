/* ===== src/constants/dyk.js ===== */
'use strict';
const DYK_FACTS = [
  {text:"The WHO AUDIT-C is a 3-question clinical screening tool used by doctors in over 50 countries to identify hazardous and harmful drinking patterns.",source:"WHO AUDIT Guidelines 2001"},
  {text:"WHO defines Low Risk drinking as no more than 4 standard drinks on any single occasion and no more than 14 per week for men, 7 for women.",source:"WHO Global Status Report 2018"},
  {text:"1 peg = 1 drink = 30ml whisky ≈ 10g pure alcohol. This is the WHO standard drink — the global unit for measuring alcohol consumption. All AUDIT-C scores are based on this unit.",source:"WHO AUDIT-C guidelines"},
  {text:"A 650ml bottle of strong beer (7.5% ABV) contains as much alcohol as 4 pegs of whisky — 38.5g. A regular 650ml beer = 2.5 pegs. The drink type matters less than total alcohol consumed.",source:"WHO standard drink guidelines"},
  {text:"Alcohol raises cortisol — the stress hormone. Drinking to relax actually increases anxiety the next day, creating a cycle that feels impossible to break.",source:"Alcohol Research, NIAAA 2012"},
  {text:"Alcohol disrupts REM sleep — the most restorative phase. Even moderate drinking reduces deep sleep by up to 25%, leaving you more tired than if you had not drunk at all.",source:"Colrain et al., Alcohol Research 2014"},
  {text:"Your liver processes roughly 1 peg per hour — regardless of coffee, water, food, or exercise. Nothing speeds it up. Time is the only thing that clears alcohol from your blood.",source:"NIAAA, WHO"},
  {text:"Home pours are typically 40-60% larger than bar pegs. What feels like 2 drinks at home could be 3-4 standard drinks. The glass size is the illusion.",source:"NIAAA Drink Size Research"},
  {text:"Needing more drinks to feel the same effect is not a badge of honour — it is a clinical warning sign. Tolerance means your liver and brain have adapted to alcohol as a baseline.",source:"NIAAA, DSM-5"},
  {text:"Feeling anxious, restless, or unable to sleep on days you do not drink — these are withdrawal symptoms. Your body is signalling that it expects alcohol. That is dependency territory.",source:"DSM-5 Alcohol Use Disorder criteria"},
  {text:"Alcohol is addictive because three traps work together. Dopamine makes you want it. GABA makes you need it for calm. Withdrawal makes you need it to function. Each trap reinforces the others.",source:"Koob & Volkow, Neurobiological Theories of Addiction 2010"},
  {text:"Alcohol triggers dopamine in the brain\u2019s reward centre. The brain registers \u2014 this felt good, do it again. Over time it starts craving the hit before the drink even happens.",source:"NIAAA, Neuroscience of Addiction"},
  {text:"Alcohol enhances GABA \u2014 the brain\u2019s calming chemical. It suppresses anxiety and creates relaxation. For someone stressed, alcohol works \u2014 fast and reliably. The brain learns: when uncomfortable, drink.",source:"NIAAA, DSM-5"},
  {text:"With regular drinking, the brain reduces its own GABA production to compensate. Now without alcohol \u2014 anxiety, restlessness, poor sleep. You are no longer drinking to feel good. You are drinking to feel normal.",source:"DSM-5, Alcohol Withdrawal Criteria"},
  {text:"Dependency does not come from weakness. It comes from brain chemistry adapting to a substance that is very good at hijacking the brain\u2019s reward and calm systems simultaneously.",source:"NIAAA"},
  {text:"The rare drinker has no tolerance. One drink produces genuine pleasure above their baseline. The secret is to drink rarely \u2014 so every drink feels like the first one.",source:"NIAAA, Neuroscience of Alcohol Tolerance"},
  {text:"A rare drinker gets more pleasure from one drink than a regular drinker gets from five. Tolerance does not mean strength \u2014 it means your brain has adapted to need more just to feel normal.",source:"NIAAA, Neuroscience of Addiction"},
  {text:"Less alcohol. More pleasure. That is efficiency \u2014 not deprivation. Drink rarely, keep your receptors fresh, and one drink delivers what five used to. Your brain works better. So does the drink.",source:"NIAAA, Neuroscience of Dopamine Tolerance"},
  {text:"Alcohol causes approximately 70% of road trauma cases in India. Even one peg raises reaction time and impairs judgment \u2014 the effect begins with the first drink.",source:"NIMHANS National Survey, WHO"},
  {text:"In India, 14.6% of the population uses alcohol. Of these, 5.7 crore show signs of harmful or dependent use.",source:"NIMHANS National Survey 2019"},
  {text:"If someone chooses sobriety, honour that choice. Never push a sober person to drink. True respect means accepting people as they are.",source:"\u2728 Values"},
  {text:"Regular drinkers often chase the feeling from their first drinks \u2014 when alcohol felt genuinely pleasurable. That feeling is gone. The brain has changed. More alcohol cannot recreate it.",source:"NIAAA, Neuroscience of Addiction"},
  {text:"After months of daily drinking, the first drink of the day no longer brings pleasure \u2014 it brings relief. The drinker is not enjoying alcohol. He is correcting a deficit that alcohol itself created.",source:"DSM-5, Koob & Volkow 2010"},
  {text:"Wine glasses have grown 7 times larger over the past 300 years. A modern large wine glass holds what a full bottle held in the 1700s \u2014 making it easy to dramatically underestimate how much you drink.",source:"BMJ, University of Cambridge 2017"},
  {who:true,text:"No level of alcohol consumption is safe for our health.",type:"who"},
  {text:"Low Risk is not Risk Free. The cited limit of 1-2 drinks per day is a low risk threshold — not a safe one. The less you drink, the lower the risk. Any alcohol carries some health risk.",source:"WHO Global Status Report on Alcohol, 2023"},
  {myth:"I only drink on weekends, so I\u2019m safe.",fact:"Risk depends on how much and how often you drink. Weekend bingeing can be more harmful than daily moderate drinking.",type:"myth"},
  {myth:"Beer is safer than liquor.",fact:"A 650ml bottle of strong beer (7.5% ABV) contains as much alcohol as 4 pegs of whisky (38.5g). The type of drink matters less than the total alcohol consumed.",type:"myth"},
  {myth:"Coffee sobers you up.",fact:"Coffee makes you feel more alert \u2014 but it does not remove alcohol from your blood. Only time does that. A wide-awake drunk is still drunk.",type:"myth"},
  {myth:"Alcohol warms you up.",fact:"Alcohol dilates blood vessels near the skin, making you feel warm \u2014 but actually causing your body to lose heat faster. It lowers your core temperature, not raises it.",type:"myth"},
  {myth:"I can handle my drink \u2014 I have a high tolerance.",fact:"Tolerance means your body has adapted to alcohol \u2014 not that you are unaffected. You need more to feel the same effect because your brain has changed. That is a warning sign, not a skill.",type:"myth"},
  {text:"Beat your last journey score. Each journey \u2014 can you score more sober days than the last? Progress is not always linear. One better journey changes everything.",source:"\ud83c\udfc6 Ways You Are Winning",winning:true},
  {text:"Set a new personal best streak. How many consecutive sober days can you reach? Your streak is proof of what you are capable of \u2014 one day at a time.",source:"\ud83c\udfc6 Ways You Are Winning",winning:true},
  {text:"Eliminate binge sessions. Never go over 180ml whisky in one sitting. This is the WHO Heavy Episodic Drinking threshold \u2014 the single most impactful change you can make.",source:"\ud83c\udfc6 Ways You Are Winning",winning:true},
  {text:"One bad day cannot erase weeks of effort. The shelf refills next journey. The streak resets but the learning does not.",source:"\ud83d\udeb6 Keep Going",winning:true},
  {type:"craving",title:"\u23f3 Cravings last minutes \u2014 not hours",subtitle:"The goal is to get through the next 10-30 minutes, not win forever.",steps:[{icon:"\ud83e\udde0",text:"Tell yourself: Not now. I will decide in 30 minutes."},{icon:"\ud83d\udccc",text:"Most cravings fade on their own if you do not immediately act on them."},{icon:"\ud83c\udfaf",text:"The goal is delay \u2014 not forever. Just 30 minutes."}]},
  {type:"craving",title:"\ud83d\udeb6 Move \u2014 change your location",subtitle:"A change of environment breaks the craving loop.",steps:[{icon:"\ud83d\udeb6",text:"Go outside or walk around the block."},{icon:"\u2615",text:"Visit a caf\u00e9 or public place."},{icon:"\ud83c\udfe0",text:"Move to a different room."}]},
  {type:"craving",title:"\ud83d\udca7 Occupy the mouth",subtitle:"Many cravings are partly ritual.",steps:[{icon:"\ud83d\udca7",text:"Drink a full glass of water."},{icon:"\ud83e\udee7",text:"Soda water \u2014 the fizz helps."},{icon:"\ud83c\udf75",text:"Tea or coffee."},{icon:"\ud83c\udf4b",text:"Eat fruit or chew gum."}]},
  {type:"craving",title:"\ud83c\udfb5 Distract fully",subtitle:"Anything that completely captures your attention works.",steps:[{icon:"\ud83c\udfb5",text:"Music \u2014 put on something you love."},{icon:"\ud83c\udfae",text:"Video game or YouTube."},{icon:"\ud83d\udcda",text:"Reading \u2014 even a few pages."}]},
  {type:"craving",title:"\ud83c\udd98 Craving right now? Do this",subtitle:"Five things. Pick any one.",steps:[{icon:"\ud83d\udeb6",text:"Move \u2014 go somewhere different."},{icon:"\ud83d\udca7",text:"Drink water or soda water."},{icon:"\ud83d\udcde",text:"Call or message someone."},{icon:"\ud83c\udfb5",text:"Distract yourself fully."},{icon:"\u23f3",text:"Wait 30 minutes. Decide then."}]},
  {type:"strategy",title:"\ud83d\udd11 The right order of reduction",subtitle:"Most people get this wrong \u2014 and relapse because of it.",steps:[{icon:"\u274c",text:"Wrong: Stop suddenly \u2192 cravings hit \u2192 back to drinking."},{icon:"\u2705",text:"Step 1 \u2014 Stop binge sessions. Never go over 180ml whisky in one sitting."},{icon:"\u2705",text:"Step 2 \u2014 Reduce quantity. Fewer pegs per session."},{icon:"\u2705",text:"Step 3 \u2014 Reduce frequency. Drink less often."}],note:"Zero to hero does not work. One step at a time does. The sequence matters."},
  {type:"strategy",title:"\ud83d\udcc5 Drink daily? Reduce by one drink each day",subtitle:"Gradual reduction is clinically safer than stopping suddenly.",steps:[{icon:"1\ufe0f\u20e3",text:"If you currently drink 4 pegs daily \u2014 target 3 pegs today."},{icon:"\ud83d\udcc9",text:"Each day, reduce by 1 drink. Your body adjusts gradually."}],note:"One less drink per day. Small change, measurable impact on your liver overnight."},
  {type:"strategy",title:"\ud83c\udf7a Beer drinker? Step down the bottle",subtitle:"Small packaging changes make a measurable difference.",steps:[{icon:"1\ufe0f\u20e3",text:"650ml strong \u2192 650ml regular. Same size, same ritual \u2014 30% less alcohol."},{icon:"2\ufe0f\u20e3",text:"650ml regular \u2192 500ml strong. Smaller bottle, fewer pegs."},{icon:"3\ufe0f\u20e3",text:"500ml strong \u2192 500ml regular. Same size, 2 fewer pegs."},{icon:"\ud83d\udcc9",text:"2 bottles \u2192 1 bottle. Halves your intake in one decision."}],note:"You do not have to stop drinking beer. Just drink less of it, less strong."},
  {text:"2 bottles of strong beer (650ml, 7.5% ABV) = 8 pegs of alcohol. That crosses the WHO binge threshold of 6 pegs. Switch to 2 regular beers (650ml, 5% ABV) and you get the same ritual — same number of bottles, same evening — but only 5 pegs. One swap, no binge.",source:"WHO standard drink guidelines · ABV calculations"},
  {text:"The secret of enjoying alcohol is simple: control either how much you drink, or how often. Do one well and alcohol stays a pleasure. Lose control of both — and what once felt like enjoyment becomes a daily obligation you never chose.",source:"WHO Global Status Report on Alcohol 2023"},
  {text:"Heavy drinkers don't fall in all at once. The rabbit hole is entered one extra drink at a time — a slightly larger pour, one more occasion per week. Each step feels small. The destination does not.",source:"DSM-5 Alcohol Use Disorder"},
  {text:"With alcohol, less is more — and more is less. Drink rarely and a single peg delivers genuine pleasure. Drink heavily every day and ten pegs barely feel like anything. The body adapts ruthlessly: it builds tolerance and raises the baseline just to feel normal.",source:"Koob & Volkow, Neurobiological Theories of Addiction 2010"},
  {text:"A heavy drinker who once felt euphoria from two drinks now needs six to feel anything at all — and still wakes up worse. Less alcohol preserves the experience. More alcohol destroys it. The pleasure was never in the quantity.",source:"WHO Global Status Report on Alcohol 2023"},
  {text:"You win here in six ways. Add one more sober day than last time. Drink one fewer peg per session. Don't increase your intake. Lower your AUDIT-C score by even one point. Beat your personal best. Reach a milestone you haven't hit before. Any one of these is a victory. You don't have to quit. You just have to be slightly better than yesterday.",source:"Sober Journey · Harm Reduction Framework"}
];

// AUDIT-C zone body-impact cards — two cards per zone (positions 10–19)
(function() {
  const zoneOrder = ['Dependent', 'Harmful', 'Hazardous', 'Low Risk', 'Sober'];
  const zoneCards = [];
  for (const zoneName of zoneOrder) {
    if (!ZONE_DETAILS[zoneName]) continue;
    zoneCards.push({ type: 'zone', zoneName, part: 1 });
    zoneCards.push({ type: 'zone', zoneName, part: 2 });
  }
  DYK_FACTS.splice(9, 0, ...zoneCards);
})();

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

// ── DID YOU KNOW RENDERER ─────────────────────────────────────
function renderDidYouKnow(data) {
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
    if (fact.type==='zone')        barEl.style.background=`linear-gradient(90deg,${ZONE_DETAILS[fact.zoneName].color},${ZONE_DETAILS[fact.zoneName].color}cc)`;
    else if (fact.type==='craving')    barEl.style.background='linear-gradient(90deg,#FF8C00,#cc6600)';
    else if (fact.type==='myth')  barEl.style.background='linear-gradient(90deg,#ff3b30,#cc2200)';
    else if (fact.type==='strategy') barEl.style.background='linear-gradient(90deg,#007aff,#0055cc)';
    else if (fact.winning)        barEl.style.background='linear-gradient(90deg,#34c759,#248a3d)';
    else if (fact.who)            barEl.style.background='linear-gradient(90deg,#ff9500,#cc6600)';
    else                          barEl.style.background='linear-gradient(90deg,#34c759,#248a3d)';
  }
  if (titleEl) {
    if (fact.type==='zone')        { titleEl.textContent = fact.zoneName + ' zone' + (fact.part ? ` (${fact.part}/2)` : ''); titleEl.style.color = ZONE_DETAILS[fact.zoneName].color; }
    else if (fact.type==='craving')    {titleEl.textContent='\u23f3 Craving Support';titleEl.style.color='#cc6600';}
    else if (fact.type==='myth')  {titleEl.textContent='\u274c Myth vs Fact';    titleEl.style.color='#cc2200';}
    else if (fact.type==='strategy'){titleEl.textContent='\ud83d\udccb Strategy';titleEl.style.color='#007aff';}
    else if (fact.winning)        {titleEl.textContent='\ud83c\udfc6 Winning';   titleEl.style.color='#248a3d';}
    else                          {titleEl.textContent='\ud83d\udca1 Knowledge'; titleEl.style.color='#1c1c1e';}
  }
  if (!bodyEl) return;
  if (fact.type === 'zone') {
    const zd = ZONE_DETAILS[fact.zoneName];
    const mid = Math.ceil(zd.items.length / 2);
    const items = fact.part === 2 ? zd.items.slice(mid) : zd.items.slice(0, mid);
    bodyEl.innerHTML = `<div style="background:${zd.bg};border-radius:10px;padding:8px 12px;">${renderZoneDetailHtml(zd, items)}</div>`;
  } else if (fact.who) {
    bodyEl.innerHTML=`<div style="background:rgba(255,149,0,0.06);border:1.5px solid rgba(255,149,0,0.25);border-radius:12px;padding:14px 16px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:18px;">🌍</span><span style="font-size:11px;font-weight:700;color:#cc6600;letter-spacing:0.5px;text-transform:uppercase;">WHO Position · 2023</span></div><div style="font-size:15px;font-weight:700;color:rgba(28,28,30,0.9);line-height:1.5;font-style:italic;margin-bottom:10px;">"No level of alcohol consumption is safe for our health."</div><div style="height:1px;background:rgba(255,149,0,0.2);margin-bottom:10px;"></div><div style="font-size:12px;color:rgba(60,60,67,0.6);line-height:1.6;">Low Risk means <em>lower</em> risk — not zero risk. Any alcohol carries some health risk. The less you drink, the lower the risk.</div></div>`;
  } else if (fact.type==='myth') {
    bodyEl.innerHTML=`<div style="margin-bottom:10px;padding:10px 12px;background:rgba(255,59,48,0.05);border-radius:10px;border-left:3px solid rgba(255,59,48,0.4);"><div style="font-size:11px;font-weight:700;color:rgba(255,59,48,0.8);margin-bottom:4px;">\u274c Myth</div><div style="font-size:13px;color:rgba(60,60,67,0.75);line-height:1.6;font-style:italic;">"${fact.myth}"</div></div><div style="padding:10px 12px;background:rgba(52,199,89,0.06);border-radius:10px;border-left:3px solid rgba(52,199,89,0.4);"><div style="font-size:11px;font-weight:700;color:#248a3d;margin-bottom:4px;">\u2705 Fact</div><div style="font-size:13px;color:rgba(60,60,67,0.8);line-height:1.6;">${fact.fact}</div></div>`;
  } else if (fact.type==='craving'||fact.type==='strategy') {
    const steps=(fact.steps||[]).map(s=>`<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(60,60,67,0.06);"><span style="font-size:15px;flex-shrink:0;">${s.icon}</span><div style="font-size:12px;color:rgba(60,60,67,0.8);line-height:1.55;">${s.text}</div></div>`).join('');
    const bg=fact.type==='craving'?'rgba(255,149,0,0.05)':'rgba(0,122,255,0.04)';
    const col=fact.type==='craving'?'#cc6600':'#007aff';
    bodyEl.innerHTML=`<div style="background:${bg};border-radius:10px;padding:12px 14px;"><div style="font-size:13px;font-weight:600;color:${col};margin-bottom:2px;">${fact.title}</div><div style="font-size:11px;color:rgba(60,60,67,0.45);margin-bottom:10px;">${fact.subtitle||''}</div>${steps}${fact.note?`<div style="margin-top:10px;font-size:11px;color:rgba(60,60,67,0.4);line-height:1.6;font-style:italic;">${fact.note}</div>`:''}</div>`;
  } else if (fact.winning) {
    bodyEl.innerHTML=`<div style="border-left:3px solid rgba(52,199,89,0.6);background:rgba(52,199,89,0.05);border-radius:0 8px 8px 0;padding:12px 14px;"><div style="font-size:13px;color:rgba(28,28,30,0.85);line-height:1.7;margin-bottom:6px;">${fact.text}</div><div style="font-size:11px;color:#248a3d;font-weight:600;">${fact.source}</div></div>`;
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

