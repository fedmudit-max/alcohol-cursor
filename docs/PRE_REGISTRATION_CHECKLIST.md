# Pre-registration checklist — 10Drinks (Google Play + RevenueCat)

Use this before **Internal testing** with subscriptions, and again before **Production**.  
App id: **`com.tendrinks.app`**. Billing architecture matches `src/config/app.config.js` and [REVENUECAT.md](REVENUECAT.md).

---

## A. Repo build (your machine)

- [ ] `npm ci`
- [ ] `npm test` (includes `release-config.mjs` billing invariants)
- [ ] **Trial track only:** `npm run android:bundle` → upload `app-release-vc*-trial.aab`
- [ ] **Subscriptions enabled:** set store config in `app.config.js` (see [REVENUECAT.md](REVENUECAT.md)), then `npm run android:bundle:store` → upload `app-release-vc*-store.aab`
- [ ] Do **not** upload a `-trial` build to a monetized track

**Store config must include:**

| Setting | Value |
|---------|--------|
| `PREMIUM_BILLING_MODE` | `'store'` |
| `REVENUECAT_ANDROID_API_KEY` | Public `goog_…` key |
| `REVENUECAT_ENTITLEMENT_ID` | `premium` |
| `PLAY_SUBSCRIPTION_ID` | `ten_drinks_premium` |
| Base plans (Play) | `monthly`, `yearly` |
| RC/Play product ids | `ten_drinks_premium:monthly`, `ten_drinks_premium:yearly` |
| `showPremiumInApp` / `showPremiumSubscribe` / `showPremiumInSettings` | `true` |

Preflight: `bash scripts/preflight-release.sh --store` on `dist/src/config/app.config.js` (runs automatically in `android:bundle:store`).

---

## B. Google Play Console

### App setup

- [ ] App created with package **`com.tendrinks.app`**
- [ ] **Privacy policy URL** matches app (`PRIVACY_POLICY_URL` in config — currently Netlify policy)
- [ ] **Data safety** form: local journey data, backup export/import, no backend account for MVP; **no Google Auto Backup** (`allowBackup=false` + data extraction rules — user JSON export is the backup path)
- [ ] **Health apps** declaration matches reality (alcohol tracking, AUDIT-C screening — not a medical device; accurate wording per Play policy)
- [ ] Content rating questionnaire completed
- [ ] Target audience and ads declaration (if applicable)

### Subscriptions (monetization)

- [ ] One subscription product: **`ten_drinks_premium`**
- [ ] Base plan **`monthly`** — auto-renewing, prices set
- [ ] Base plan **`yearly`** — auto-renewing, prices set
- [ ] Subscription benefits / listing text reviewed
- [ ] **License testers** added (Settings → License testing) for purchase testing

### Release

- [ ] Upload **`app-release-vc<versionCode>-store.aab`** to **Internal testing** first
- [ ] Install from Play (not sideload) for billing tests
- [ ] `versionCode` bumped in `android/app/build.gradle` for each upload

Keystore: see [PLAY_INTERNAL_TESTING.md](PLAY_INTERNAL_TESTING.md) — never commit `keystore.properties` or `*.jks`.

---

## C. RevenueCat dashboard

- [ ] Project for **10Drinks** linked to **`com.tendrinks.app`**
- [ ] **Google Play** service account connected (required for subscription status)
- [ ] Products imported / linked with ids:
  - `ten_drinks_premium:monthly`
  - `ten_drinks_premium:yearly`
- [ ] Entitlement **`premium`** created; both products attached
- [ ] **Current offering** with packages (MONTHLY/ANNUAL or package ids `monthly` / `annual` per `REVENUECAT_PACKAGE_IDENTIFIERS`)
- [ ] Android public API key (`goog_…`) copied into `REVENUECAT_ANDROID_API_KEY` for store builds only

---

## D. On-device validation (licensed tester)

Install the **Internal testing** build from Play, same Google account as license tester.

- [ ] Cold start: trial locks behave; paywall/settings entry visible (store build)
- [ ] **Subscribe** monthly or yearly — Play sheet completes
- [ ] Premium unlocks (history/calendar tiers per trial + premium rules)
- [ ] **Restore purchase** on same device (or reinstall + restore)
- [ ] **Cancel** subscription in Play → app still Premium until period end (optional: log `CustomerInfo` once to confirm field shape)
- [ ] After expiry (or sandbox accelerated time if available): Premium locks again after RC sync
- [ ] Airplane mode / RC error on resume: existing Premium **not** revoked (then sync when online)

---

## E. Store listing copy (accuracy)

Confirm listing and in-app text align with behavior:

- [ ] Alcohol consumption **journey tracking** (local storage)
- [ ] **AUDIT-C** self-assessment (educational screening; not a diagnosis)
- [ ] **15-day trial** for Premium features (local clock; see config comments)
- [ ] **Premium subscription** via Google Play; processed by RevenueCat (client SDK, no custom receipt server in MVP)
- [ ] **Backup/restore** JSON export — user-controlled; trial anchor rules documented in app/policy

---

## F. What preflight cannot check

- [ ] RevenueCat offering actually returns packages on device
- [ ] Play base plan ids match imported RC products
- [ ] Real `CustomerInfo` uses composite vs split `productIdentifier` (app supports both)
- [ ] Tax / pricing / country availability in Play

These require **D** above.

---

## Quick reference

| Build command | Preflight | AAB filename pattern |
|---------------|-----------|----------------------|
| `npm run android:bundle` | `--trial` | `app-release-vc*-trial.aab` |
| `npm run android:bundle:store` | `--store` | `app-release-vc*-store.aab` |

Review/source zip for external audit: `bash scripts/make-review-zip.sh` (excludes `.tools`, `dist`, `node_modules`).
