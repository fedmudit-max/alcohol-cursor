# Sober Journey

Static PWA for GitHub Pages: `https://fedmudit-max.github.io/alcohol-cursor/`

## Project structure

```text
src/
├── main.js                 — boot
├── firebase.js             — Firebase placeholder
├── config/app.config.js
├── data/local-storage.js   — DataManager
├── data/firestore.js       — placeholder
├── journey/journey.js      — Tracker / SoberTracker
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

- `index.html`, `manifest.json`, `sw.js`, `css/`, `src/`
- `icon-180.png`, `icon-192.png`, `icon-512.png`, `d3.min.js`
- `.nojekyll` (must be committed — do not gitignore it)

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

Update full URLs in `manifest.json` (`start_url`, `scope`, `id`, icon `src` paths) to match `/your-new-repo-name/`.

## Local preview

Use Live Server or `npx serve .` — open the folder URL. Service worker needs `http://`, not `file://`.

## Config (`src/config/app.config.js`)

```javascript
const CONFIG = {
  isProduction:   true,
  showTestUI:     false,
  showOnboarding: true,
  buildTag:       'personal-v1',
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

Progress is a tab, which just shows progress on streak basis.

If a user forgets to log on 2nd, 3rd, 4th and if today is 5th.
For 5th , he is expected to log today, for 4th he will be asked about the yesterday via popup
and 2nd , 3rd will be considered as sober days.

MUST NOT: Catch-up must never increment failures except via logYesterday('failed') or user logging today.


When drinking day 10 is used, the journey ends, scores freeze, new journey starts fresh with score 0 - 0 from next calendar day.
MUST: journeyTrophies -50,100,150,200 counts persist across journeys; celebratedTrophies resets each journey.


