# Igraonica Mobile — Redesign Plan

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

## Decisions (locked)

| Topic | Decision |
|---|---|
| Palette | `#7c9fc9` (dusty blue, primary) + `#f8b653` (warm amber, accent). **Replaces `#4A3AFF` purple everywhere.** |
| Tabs | 5: Moj paket · Jelovnik · **QR (pop-out, icon only)** · Raspored · Galerija |
| QR tab | 1 child → open QR directly. 2+ → picker sheet → QR. 0 → prompt to add child. |
| Galerija | Placeholder "coming soon" — no backend exists |
| Canva | Unbranded (no brand kit). App icon + Play Store graphics only. |
| Design skill | `emil-design-eng` principles, translated CSS → React Native `Animated` |

## Constraints discovered

- Expo 56 / RN 0.85 / React Navigation v7. `AGENTS.md` requires checking versioned docs before coding.
- `react-native-qrcode-svg` + `@expo/vector-icons` already installed — **no new deps needed**.
- No tab navigator exists today; `AppNavigator.js` is a pure native-stack. Tab bar is new construction.
- QR is **per-child** (`child.qrCode`), which is why the center tab needs the picker.
- App language is Serbian throughout. Keep it.
- `#f8b653` is ~1.9:1 on white — **fails WCAG for text**. Use as surface/fill only; darkened variant for amber text.

## Backend reality

| Tab | Endpoint | Status |
|---|---|---|
| Moj paket | `/api/packages/my` | ✅ working |
| Jelovnik | `/api/menu`, `/api/menu/week` | ✅ working — `MealType`: BREAKFAST, SNACK_MORNING, LUNCH, SNACK_AFTERNOON |
| QR | `child.qrCode` via `/api/children` | ✅ working |
| Raspored | `/api/schedule`, `/day/:dayOfWeek`, `/events` | ✅ working — `Activity` has `color`, `dayOfWeek`, `startTime`, `ageGroup` |
| Galerija | — | ❌ no model, no list route |

## Steps

- [x] **1. `src/theme.js`** — tokens: color, radius, spacing, type scale, motion durations, font families.
- [x] **2. `src/components/QrTabButton.js`** — pop-out circular FAB, amber fill, `qr-code` icon, `scale(0.94)` press feedback @ 140ms.
- [x] **3. `src/navigation/AppNavigator.js`** — `MainTabs` (5 tabs) nested inside `MainStack` so ChildDetail/AddChild still push over the bar.
- [x] **4. `src/screens/QrScreen.js`** — auto/picker/empty per decision above, staggered picker rows.
- [x] **5. `src/screens/MenuScreen.js`** — week strip, 4 meal slots in enum order, allergen chips.
- [x] **6. `src/screens/ScheduleScreen.js`** — day strip (0=Mon), activity cards using `Activity.color` as stripe.
- [x] **7. `src/screens/GalleryScreen.js`** — honest "Uskoro" empty state, no fake data.
- [x] **8. `src/screens/HomeScreen.js`** — restyled, amber progress bar for remaining hours.
- [x] **9. Sweep** — 16 `#4A3AFF` refs replaced across 5 legacy screens; 0 remaining.
- [x] **10. Montserrat** — `useFonts` gate in `App.js`; all 23 `fontWeight` decls mapped to font families (RN ignores fontWeight for custom fonts).
- [x] **11. Canva** — 4 app icon + 4 feature graphic candidates generated (unbranded).

## Verification done

- All 15 app files parse cleanly via `@babel/parser` (jsx plugin).
- 0 stray `fontWeight`, 0 stray `#4A3AFF`, all `font.` references have theme imports.
- **App builds and serves.** `npx expo start --web` → `Web Bundled 2310ms index.js (721 modules)`,
  bundle request returns HTTP 200 (3.9 MB), no errors in Metro log.
- Bundle contains all five tab labels, both palette colors, Montserrat weights,
  `qr-code` icon, the "Ko ulazi?" picker, and the Galerija "Uskoro" state.

## Dependencies added

| Package | Version | Why |
|---|---|---|
| `expo-font` | `~56.0.7` | `useFonts`. npm first resolved v57 (wrong for SDK 56) — repinned via `expo install`. |
| `@expo-google-fonts/montserrat` | `^0.4.2` | Montserrat 500/600/700 |
| `@expo/vector-icons` | `15.1.1` | **Was already imported but never declared** — only surfaced once node_modules existed. |

Socket CLI blocks installs over medium CVEs in `uuid@7.0.3` / `postcss@8.5.15` (build-time Expo
deps, not shipped to device). Installs need `SOCKET_CLI_ACCEPT_RISKS=1`.

## Local dev credentials (seeded 2026-08-05)

| Role | Email | Password |
|---|---|---|
| **Parent** (use this for the app) | `roditelj@igraonica.com` | `roditelj123` |
| Admin | `admin@igraonica.com` | `admin123` |

Seeded data: 2 children (Mila `IGR-F012E1A8`, Luka `IGR-C03332A6`), 20 menu items across the
week, 6 activities, 1 active package (20h / 30 days).

Run order:
1. Postgres: `brew services start postgresql@16` (already running)
2. Backend: `cd backend && node src/server.js` → :3001
3. Mobile: `cd mobile && SOCKET_CLI_ACCEPT_RISKS=1 npx expo start --web` → :8081

## Fixed along the way

- **`expo-secure-store` crashes on web** (`deleteValueWithKeyAsync is not a function`) — it's a
  native keychain API. Added `src/utils/storage.js`: `localStorage` on web, SecureStore on device.
  `AuthContext` and `api.js` now go through it. Pre-existing bug, blocked login on web entirely.
- `.env` set `PORT=3001` (not the example's 5000) to match `api.js`.

## Open items

1. **No simulator on this machine.** Only `/Library/Developer/CommandLineTools` is installed —
   no Xcode.app, no `simctl`, no Android SDK. `expo start --ios` cannot run until Xcode is
   installed from the App Store (~7GB). The pop-out button's negative offset and iOS safe-area
   padding remain unverified on a real device; alternative is Expo Go on a physical phone.
2. **`storage.js` uses `localStorage` on web** — fine for dev preview, but it is not secure
   storage. Native builds still use the keychain via SecureStore, so this only affects web.
2. **Pre-existing version drift** (untouched): `expo@56.0.12` wants `~56.0.18`,
   `react-native-screens@4.25.2` wants `~4.26.0`.
3. **Canva candidates are not saved** — they expire unless promoted via `create-design-from-candidate`.
4. **Galerija** is a placeholder; needs Prisma model + list route to become real.
5. `HomeScreen` still links to `Children` in the stack — consider whether that belongs in a tab now.
6. `api.js` points at `http://localhost:3001/api` — fine for web, but a physical device needs a LAN IP.

## Motion rules (from emil-design-eng, translated to RN)

- Press feedback: `scale 0.96`, 140ms — every pressable.
- Never `scale(0)` entry — start `0.95` + opacity.
- Entrances ease-out; exits faster than entrances.
- Stagger list items 40ms.
- Nothing over 300ms.
- Respect `AccessibilityInfo.isReduceMotionEnabled` — keep opacity, drop movement.
