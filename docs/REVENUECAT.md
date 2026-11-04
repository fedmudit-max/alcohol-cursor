# RevenueCat — 10Drinks (Android)

Store billing uses [RevenueCat](https://www.revenuecat.com/) on native Android when `premiumBilling` is `store` and `REVENUECAT_ANDROID_API_KEY` is set in `src/config/app.config.js`.

RevenueCat validates Google Play receipts server-side and exposes entitlements to the app. You do **not** need a custom verify API for the MVP.

## RevenueCat dashboard

1. Create a project for **10Drinks** (`com.tendrinks.app`).
2. **Apps → Android** — add the app with the same package name as Play Console.
3. **Google Play** — connect the Play service account (RevenueCat docs: *Google Play Store* integration). Required for subscription status and renewals.
4. **Google Play subscriptions** — one subscription product with two auto-renewing base plans (Play’s subscription + base plan model):

   | Plan | Subscription ID | Base plan ID | Offering `product.identifier` |
   |------|-----------------|--------------|-------------------------------|
   | Monthly | `ten_drinks_premium` | `monthly` | `ten_drinks_premium:monthly` |
   | Yearly | `ten_drinks_premium` | `yearly` | `ten_drinks_premium:yearly` |

   `PLAY_SUBSCRIPTION_ID` and `PLAY_BILLING_PRODUCT_IDS` in `app.config.js` must match Play. Import products in RevenueCat after Play is linked.

   **CustomerInfo entitlements (Android):** RevenueCat may expose either composite `productIdentifier` (`ten_drinks_premium:monthly`) or split `productIdentifier` = subscription id plus `productPlanIdentifier` = base plan id. The app accepts both when granting Premium.
5. **Entitlements** — create entitlement identifier **`premium`** (must match `REVENUECAT_ENTITLEMENT_ID`).
6. Attach both store products to the `premium` entitlement.
7. **Offerings** — set a **current** offering with packages:
   - Prefer package types **MONTHLY** and **ANNUAL**, or
   - Package identifiers `monthly` and `annual` (see `REVENUECAT_PACKAGE_IDENTIFIERS` in config).

## API key in the app

1. RevenueCat → **Project settings → API keys** → copy the **Android** public key (`goog_…`).
2. In `src/config/app.config.js`:

```javascript
const REVENUECAT_ANDROID_API_KEY = 'goog_xxxxxxxxxxxxxxxxxxxxxxxx';
```

Never commit a secret key; the `goog_` public SDK key is intended for the client.

## Enable billing in the app

For internal testing builds only (production defaults stay trial-only):

```javascript
const PREMIUM_BILLING_MODE = 'store';
```

And in `CONFIG`:

```javascript
showPremiumInApp: true,
showPremiumSubscribe: true,
showPremiumInSettings: true,
```

Then:

```bash
npm run build:native-bridge
npm run cap:sync
```

For a Play upload with billing enabled:

```bash
npm run android:bundle:store
```

(`preflight-release.sh --store` verifies config without printing the API key.)

Ship an **Internal testing** AAB from Play Console — testers install from Play, not sideload.

## Runtime behavior

| When | What happens |
|------|----------------|
| Cold start / journey init | `bootstrapStoreEntitlement()` → RevenueCat `getCustomerInfo()` → in-memory entitlement (not localStorage) |
| App foreground | Native bridge syncs customer info again |
| Subscribe | Validated package on current offering (`MONTHLY`/`ANNUAL` or `monthly`/`annual` IDs) → Play product must match `PLAY_BILLING_PRODUCT_IDS` |
| Paywall prices | `getOfferings` → `product.priceString` (no hardcoded reference prices on native store builds) |
| Restore | `restorePurchases()` — same entitlement apply path |
| Import backup / Delete all data | Clear local premium mirror + `bootstrapStoreEntitlement()` (same anonymous RC user; Play sub returns on sync) |

Store Premium is **not** read from `localStorage` (forged records are ignored). Access follows in-memory state updated from `CustomerInfo` only.

| Rule | Behavior |
|------|----------|
| Configure | `entitlementVerificationMode: INFORMATIONAL` (RevenueCat Capacitor SDK) |
| Grant | `entitlements.verification` is `VERIFIED` or `VERIFIED_ON_DEVICE`, dated payload, `premium` active, plan resolved via composite `productIdentifier` or `PLAY_SUBSCRIPTION_ID` + `productPlanIdentifier`, valid `expirationDate` |
| Revoke | Same verification states on a **complete** inactive snapshot; `FAILED` revokes; malformed or undated payloads are ignored |
| Ordering | **`requestDate` monotonic apply** — stale syncs cannot undo a newer snapshot |
| Purchase / restore | Single in-flight billing op; failed sync does not clear premium |

`RevenueCatBilling.configure()` is single-flight (shared promise + one listener).

## JS bundle

`@revenuecat/purchases-capacitor` is bundled to `src/capacitor/revenuecat.bundle.js` via `npm run build:native-bridge`. Capacitor sync registers the native Purchases plugin on Android.

**Android:** `MainActivity` uses `launchMode="singleTop"` (RevenueCat requirement for Play bank-verification redirects). After entitlement or bridge changes, run `npm run cap:sync` before building an AAB so `android/app/src/main/assets/public/` matches `dist/`.
