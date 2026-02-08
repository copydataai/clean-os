# Environment Variables

## Convex + Clerk
- `CLERK_WEBHOOK_SIGNING_SECRET` - Clerk webhook signing secret for `/clerk-webhook`.
- `CLERK_JWT_ISSUER_DOMAIN` - Clerk JWT issuer domain for Convex auth.

## Stripe
- `STRIPE_SECRET_KEY` - Stripe secret key used in `packages/convex/convex/stripeActions.ts` and `packages/convex/convex/cardWebhooks.ts`.
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret for `/stripe-webhook`.

## Tally
- `TALLY_WEBHOOK_SECRET` - Webhook signing secret used to verify Tally requests.
- `TALLY_REQUEST_FORM_ID` - Form ID for the initial request form.
- `TALLY_CONFIRM_FORM_ID` - Form ID for the confirmation form.
- `TALLY_CARD_FORM_ID` - Optional form ID for the card-capture form.

## App URLs
- `NEXT_PUBLIC_APP_URL` - Base URL used to build redirects and payment links.
- `NEXT_PUBLIC_TALLY_REQUEST_URL` - Public URL for the Tally request form (used in cancel/resume flows).
- `NEXT_PUBLIC_TALLY_CONFIRM_URL` - Public URL for the Tally confirmation form (used for operator copy link).

## Dispatch Map
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Public token used by the dashboard schedule map.
- `MAPBOX_GEOCODING_TOKEN` - Server-side token used by Convex dispatch geocoding backfill.
