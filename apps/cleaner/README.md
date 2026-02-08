# Cleaner Mobile (Expo + Clerk)

A React Native app in the monorepo for the **Cleaner** product, built with Expo and authenticated with Clerk.

## What is included

- Expo TypeScript app in `apps/cleaner`
- Clerk authentication with:
  - Continue with Google (OAuth)
  - Email + password sign in
  - Email + password sign up
  - Email code verification
  - Signed-in cleaner workspace + sign out
- Secure Clerk session token storage using Expo Secure Store
- Convex live data integration for cleaner operations

## Requirements

- Bun `>=1.3`
- Expo-compatible iOS Simulator, Android Emulator, or Expo Go
- A Clerk account and publishable key

## Environment setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Add your keys in `.env.local`:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

## Run the app

From the monorepo root:

```bash
bun run --filter cleaner dev
```

Or from this directory:

```bash
bun run dev
```

Then press:

- `i` for iOS
- `a` for Android
- `w` for web

## Design direction for Cleaner

Use this as the visual/product brief for next UI iterations:

- Tone: calm, clean, practical
- Color system: mirrored from `apps/web/app/globals.css` tokens
  - `background`: `#f5fcfc`
  - `foreground`: `#192b39`
  - `primary`: `#007fa0`
  - `secondary`: `#e3f1f6`
  - `accent`: `#d2eef1`
  - `destructive`: `#df2225`
- Supports light and dark token sets consistent with web theme values
- UX direction:
  - Keep forms short and obvious
  - Prefer one primary action per screen
  - Avoid visual clutter and dense blocks of text
- Current production-oriented areas:
  - Overview validation (qualification coverage, availability, pay rate, readiness checks)
  - Service qualification and skill management
  - Weekly availability editor with time validation
  - Assignment action workflow (accept/decline, confirm, clock in/out)

## Notes

- Convex runtime wiring is now configured with Clerk auth integration.
- Shared Convex API/types are now available via `@clean-os/convex`.
- Mobile uses:
  - `import { api } from "@clean-os/convex/api"`
  - `useQuery(api.dashboard.getTodaysSchedule)` for the first live panel on Home
- If `EXPO_PUBLIC_CONVEX_URL` is missing, app remains usable and shows a non-blocking setup warning.
- Current app is a cleaner-first operational UI (not mock flow screens).
- Expo deep link scheme is set to `cleaner` for OAuth redirects.
