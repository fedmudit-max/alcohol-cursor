# 10Drinks

Static PWA for GitHub Pages: `https://fedmudit-max.github.io/alcohol-cursor/`

## Project structure

```text
src/
├── main.js                 — boot
├── config/app.config.js
├── data/local-storage.js   — DataManager
├── journey/journey.js      — Tracker (TenDrinksTracker / legacy SoberTracker alias)
├── ui/renderAll.js
├── assessment/          — AUDIT-C meter + questions
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

**Catch-up / journey sequences (before Capacitor):** `node tests/catchup-check.js` (runs `tests/catchup-sequences.mjs`) — multi-day gaps leave missed days unlogged, yesterday prompt, `unwindTodayIfYesterdayPending`, and 10th-drink journey reset.

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

## Android (Capacitor + Android Studio)

**Prerequisites:** [Node.js](https://nodejs.org/) 20+, [Android Studio](https://developer.android.com/studio) (SDK 34+, JDK 17).

```bash
npm install
npm run android          # build web assets, sync, open Android Studio
```

Or step by step:

```bash
npm run build            # dist/ + native Capacitor bridge
npx cap sync android
npx cap open android     # opens android/ in Android Studio
```

In Android Studio: wait for Gradle sync → **Run** on a device or emulator (API 24+).

- **App ID:** `com.tendrinks.app` (`capacitor.config.json`)
- **Web assets:** `dist/` (regenerate with `npm run build` before each native release)
- **Service worker** is disabled inside the native WebView; the PWA shell still uses it on GitHub Pages.
- **Daily reminder** (Settings): same hour/minute/AM–PM UI as laotzu101; Android uses `AlarmManager` + local notifications (`TenDrinksReminder` plugin). Allow notifications and “alarms & reminders” when prompted.

**Play internal testing:** see [docs/PLAY_INTERNAL_TESTING.md](docs/PLAY_INTERNAL_TESTING.md). Signed AAB: configure `android/keystore.properties`, then `npm run android:bundle`.

Or in Android Studio: **Build → Generate Signed Bundle / APK** (same upload keystore).

## Naming (Capacitor / store metadata)

- **App:** `10Drinks` (`APP_DISPLAY_NAME` + `manifest.json`)
- **Feature:** Journey — UI labels **Current Journey**, **Best Score**, **Streak**, **Science**
- **Unchanged (data compat):** `localStorage` key `soberJourney_v1`, HTML `SoberTracker` onclick alias; imports still accept legacy `sober-journey-backup` format

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

**Missed days (current behavior):** If a user forgets to log on the 2nd, 3rd and 4th and today is the 5th, the missed days remain **unlogged**. The user can tap each unlogged day on the **Calendar** and choose **Mark Sober** or **I Drank**. **Yesterday** may also be prompted separately when they return. **Unlogged days never automatically affect the journey score or streak** — only explicit log entries (today’s buttons, yesterday modal, or calendar backfill) update score and streak.

**Catch-up (`Tracker._catchUp`):** Advances the in-app calendar to today and may show the yesterday modal; it does **not** auto-fill `dailyLog` or auto-count sober/drinking days. See `src/journey/catchup.js` and `src/journey/journey-score.js`.


When drinking day 10 is used, the journey ends, scores freeze, new journey starts fresh with score 0 - 0 from next calendar day.
MUST: journeyTrophies -50,100,150,200 counts persist across journeys; celebratedTrophies resets each journey.


