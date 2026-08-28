# Website Roast AI

Conversion-focused website roast app built with Next.js App Router + Tailwind.

## Local setup

1. Install dependencies:
```bash
npm install
```

Optional but recommended for deterministic visual scoring:
```bash
npx playwright install chromium
```

2. Create `.env.local` (or copy from `.env.example`) and set:
```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OFFICE_ROAST_API_SECRET=
PAYSTACK_SECRET_KEY=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
ADMIN_DASH_USER=
ADMIN_DASH_PASSWORD=
```

3. Run:
```bash
npm run dev
```

Open `http://localhost:3000`.

4. If you want database persistence, run the SQL schema in Supabase:
- `supabase/schema.sql`

## Main routes

- `/analytics` -> internal dashboard for funnel + scrape quality diagnostics
- `/auth` -> magic-link login page
- `/my-reports` -> signed-in user report history
- `POST /api/roast` -> scrape + score + AI roast
- `GET /api/roast?id=<reportId>` -> fetch stored report
- `POST /api/feedback` -> save per-report feedback (score accuracy + tone accuracy + notes)
- `POST /api/auth/magic-link` -> send Supabase magic link
- `POST /api/auth/exchange` -> exchange token hash callback into access/refresh tokens
- `POST /api/auth/otp/start` -> send email OTP code
- `POST /api/auth/otp/verify` -> verify OTP code and return auth session
- `GET /api/auth/me` -> resolve current auth user from bearer token
- `GET /api/reports/mine` -> fetch current user reports
- `GET /api/reports/download?id=<reportId>` -> download a stored report PDF
- `POST /api/reports/unlock` -> temporary mock unlock for full report (payment-ready hook point)
- `POST /api/paystack/initialize` -> initialize Paystack checkout for full report unlock
- `GET /api/paystack/verify` -> verify Paystack callback and unlock report
- `POST /api/paystack/webhook` -> Paystack webhook endpoint for async unlock confirmation
- `POST /api/track` -> tracking events (landing, submit, success, error, result view)
- `GET /api/track/summary` -> compact analytics summary
- `POST /api/internal/office-roast` -> private full roast endpoint for the secure office app (bypasses public Paystack unlock)
- `GET /api/internal/benchmarks` -> deterministic scoring benchmark suite (26-case gold set)
- `POST /api/internal/calibrate` -> live scoring calibration (defaults to built-in 24-site preset when no `sites` are provided)

## Core logic files

- `lib/scrape.ts` -> lightweight multi-page signal extraction + merged crawl signals
- `lib/scoring.ts` -> deterministic pre-AI scoring + evidence + biggest leak
- `lib/visual.ts` -> deterministic desktop/mobile render audit (CTA/readability/hierarchy/style/motion)
- `lib/visualScoring.ts` -> visual-signal adjustments that feed scoring penalties/bonuses
- `lib/siteContext.ts` -> site niche detection + context snapshot + niche-specific visual thresholds
- `lib/ai.ts` -> strict roast prompt + claim contract + anti-generic rejection + fallback roast generator
- `lib/store.ts` -> local file storage for reports with legacy normalization
- `lib/analytics.ts` -> local analytics event store/summary
- `lib/supabase.ts` -> Supabase persistence layer for roasts + analytics
- `lib/benchmark.ts` -> benchmark fixtures for scoring consistency checks

## Tuning guide

- Roast tone: edit `SYSTEM_PROMPT` and `SOFT_PHRASES` in `lib/ai.ts`.
- Phrase detection: update CTA/trust/generic phrase arrays in `lib/scrape.ts`.
- Score behavior: adjust thresholds/caps in `lib/scoring.ts`.
- Category weights and scaling: `lib/scoringConfig.ts`.
- Gold calibration fixtures: `lib/benchmarkCases.ts`.
- Cache invalidation: bump `ROAST_ENGINE_VERSION` in `lib/fingerprint.ts`.

## Calibration workflow

1. Tune scoring logic in `lib/scoring.ts`.
2. Run benchmark suite:
```bash
npm run test:benchmark
```
3. Verify:
- `summary.scorePassRate` and `summary.repeatabilityPassRate`
- `diagnostics.scoreBuckets` spread
- `diagnostics.failingCases` empty or expected

### Live calibration batch (real URLs)

POST request example:

```bash
curl -X POST http://localhost:3000/api/internal/calibrate \
  -H "Content-Type: application/json" \
  -d "{\"sites\":[
    \"https://example.com\",
    {\"url\":\"https://acme.com\",\"label\":\"Acme\",\"expectedScoreRange\":[4.5,7.0]}
  ]}"
```

Run against the built-in 24-site preset:

```bash
curl -X POST http://localhost:3000/api/internal/calibrate \
  -H "Content-Type: application/json" \
  -d "{}"
```

## Persistence behavior

- If Supabase env vars are configured, app reads/writes `roast_reports`, `analytics_events`, and `roast_feedback` in Supabase first.
- If Supabase is unavailable or not configured, app falls back to local `.data/*.json` storage automatically.

## Monetization flow (current)

- New reports default to `free_teaser` access.
- Free teaser shows score + first impression + biggest leak + top mistakes.
- Full report unlock exposes score breakdown, lost-customer analysis, quick fixes, and high-impact plan.
- Unlock checkout now uses Paystack (`/api/paystack/initialize` -> Paystack Checkout -> `/api/paystack/verify`).
- Configure Paystack webhook to `POST /api/paystack/webhook` for robust async confirmation.

## Paystack setup (test mode)

- In Paystack dashboard, use test keys first:
  - `PAYSTACK_SECRET_KEY=sk_test_...`
  - `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...`
- Set callback base URL via `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000`).
- Add webhook URL:
  - `http://localhost:3000/api/paystack/webhook` (local tunnel required for live webhook tests)
  - production: `https://yourdomain.com/api/paystack/webhook`
- For local testing without webhook, callback verification route still unlocks after successful checkout redirect.

## Secure office integration

- Set `OFFICE_ROAST_API_SECRET` in this app.
- Set the same value as `WEB_ROAST_API_SECRET` in `lockdown-office-secure`.
- The office calls `POST /api/internal/office-roast` with `Authorization: Bearer <secret>`.
- Office roasts return full unlocked report data to the office only. Public report pages still use the normal teaser + Paystack unlock flow.

## Supabase auth setup

- In Supabase Auth settings, set Site URL to `NEXT_PUBLIC_SITE_URL`.
- Add redirect URL: `http://localhost:3000/auth/callback` (and your production `/auth/callback` URL).
- Ensure Email provider is enabled.
- For OTP sign-in, update the Magic Link email template to show the code (not only a link), e.g.:
```html
<h2>Your sign-in code</h2>
<p>{{ .Token }}</p>
```

## Admin protection

- `/analytics` and `GET /api/track/summary` are protected by HTTP Basic Auth.
- Set `ADMIN_DASH_USER` and `ADMIN_DASH_PASSWORD` in `.env.local`.
- Restart `npm run dev` after updating env vars.

## Quality Checks

Run the same checks used by CI:

```bash
npm run ci
```

Useful focused checks:

```bash
npm run test:benchmark
npm run test:reports
```

`test:reports` generates a fixed fixture PDF at `tmp/pdfs/roast-report-fixture.pdf` so report design regressions are easy to spot before deployment.
