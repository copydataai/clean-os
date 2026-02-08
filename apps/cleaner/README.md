# Cleaner Mobile (Expo + Clerk)

A React Native app in the monorepo for the **Cleaner** product, built with Expo and authenticated with Clerk.

## What is included

- Expo TypeScript app in `apps/cleaner`
- Clerk authentication with:
  - Continue with Google (OAuth)
  - Email + password sign in
  - Email + password sign up
  - Email code verification
  - Signed-in home state + sign out
- Secure Clerk session token storage using Expo Secure Store

## Requirements

- Bun `>=1.3`
- Expo-compatible iOS Simulator, Android Emulator, or Expo Go
- A Clerk account and publishable key

## Environment setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Add your key in `.env.local`:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
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
- Core future screens:
  - Task list (today, upcoming)
  - Room checklist templates
  - Supplies inventory
  - Cleaning streak/progress summary

## Notes

- Convex is intentionally **not** configured yet.
- Current app is auth-first so product flows can be added behind a signed-in state.
- Expo deep link scheme is set to `cleaner` for OAuth redirects.
