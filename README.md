# 10Drinks

Static PWA for GitHub Pages: `https://fedmudit-max.github.io/alcohol-cursor/`

## Project structure

```text
src/
├── main.js                 — boot
├── config/app.config.js
├── data/local-storage.js   — DataManager
├── firebase.js, data/firestore.js — sync placeholders (not in index.html until wired)
├── journey/journey.js      — Tracker (TenDrinksTracker / legacy SoberTracker alias)
├── ui/renderAll.js
├── assessment/audit.js
├── premium/premium.js
├── onboarding/onboarding.js
├── constants/
└── utils/
css/base.css
index.html                  — app shell (HTML + script tags)
```

## Deploy

Push these files to GitHub (branch **main**, Pages source **/ root**):

- `index.html`, `manifest.json`, `sw.js`, `css/`, `src/`, `assets/`
- `d3.min.js`
- `.nojekyll` (must be committed — do not gitignore it)

**Release folder (generated, not in git):** Run `./scripts/build-release.sh` when you need a clean tree for Capacitor `www`. It copies from the repo root (including one `d3.min.js`) into `dist/`, which is gitignored — do not commit or ship `dist/` in zips; regenerate on the machine that builds native or deploys.

**Before native (Capacitor):** Keep journey/streak/storage logic frozen; fix web issues first. Production web uses trial only — `local-stub` unlock runs only when `showTestUI: true` (dev). Set `premiumBilling: 'store'` when native IAP is wired.

**Storage sanity:** `node scripts/storage-sanity.mjs`

**Catch-up / journey sequences (before Capacitor):** `node tests/catchup-check.js` — locks down multi-day gaps, `unwindTodayIfYesterdayPending`, yesterday drink, and 10th-drink journey reset.

## Install on phone

1. Open **https://fedmudit-max.github.io/alcohol-cursor/** in Chrome (Android) or Safari (iPhone).
2. **Android:** Menu → **Install app** (or **Add to Home screen**).
3. **iPhone:** Share → **Add to Home Screen**.

## Android 404 or old icon?

This usually means an **old install** or **old service worker** is still on the phone.

1. **Remove** the old home-screen shortcut (long-press → Uninstall / Remove).
2. Chrome → **Settings → Site settings → All sites** → find `fedmudit-max.github.io` → **Clear & reset**.
3. Open the URL again in Chrome (not the old shortcut).
4. Install again.

After pushing updates to GitHub, wait ~1 minute, then repeat step 2 if the icon or page still looks wrong.

## If you rename the GitHub repo

`manifest.json` uses relative `start_url`, `scope`, and icon paths so the same file works on GitHub Pages, a custom domain, and Capacitor. If you fork to a new repo, you may still want to update `id` (currently the canonical Pages URL) so installed PWAs are treated as a distinct app identity.

## Local preview

Use Live Server or `npx serve .` — open the folder URL. Service worker needs `http://`, not `file://`.

## Naming (Capacitor / store metadata)

- **App:** `10Drinks` (`APP_DISPLAY_NAME` + `manifest.json`)
- **Feature:** Journey — UI labels **Current Journey**, **Best Score**, **Streak**, **Science**
- **Unchanged (data compat):** `localStorage` key `soberJourney_v1`, backup format `sober-journey-backup`, HTML `SoberTracker` onclick alias

## Config (`src/config/app.config.js`)

```javascript
const CONFIG = {
  isProduction:   true,
  showTestUI:     false,   // true only for local dev (test bar, sim day, SJ_status)
  showOnboarding: true,
  buildTag:       'production',
  premiumBilling: 'local-stub', // non-production until Capacitor store billing
};
```



The app is for users who are addicted to alcohol. We don't want to log quantity, as we are suggesting it via drinking risk test. 
A user will take a journey and will track his sober days and drinking days.
Journey = sober days + drinking days.

Drinking days has condition. Only 10 drinking days allowed. Like 10 wickets in cricket.
Against 10 drinking days , a user will have a sober day score. Let say x.

There are two journeys.
Current journey and Best Score.
Best Score is best of all the journeys previously taken.
For the first journey, there is no previous journey, so best score will be better than current journey.
Logic here, less drinking days if sober days score is same. else current journey = sober journey.

Second journey onwards , first journey will become the Best Score
and user will have the target to beat his best score.

There are 2 types of achievements.
Streak and Journey
Streak is continuous sober days
Journey is sober days until user consumes 10 drinking days.

**Science** is a tab (body recovery timeline on streak basis). **Streak** and **Milestone** are separate tabs.

If a user forgets to log on 2nd, 3rd, 4th and if today is 5th.
For 5th , he is expected to log today, for 4th he will be asked about the yesterday via popup
and 2nd , 3rd will be considered as sober days.

MUST NOT: Catch-up must never increment failures except via logYesterday('failed') or user logging today.


When drinking day 10 is used, the journey ends, scores freeze, new journey starts fresh with score 0 - 0 from next calendar day.
MUST: journeyTrophies -50,100,150,200 counts persist across journeys; celebratedTrophies resets each journey.


