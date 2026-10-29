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

ROAST_AI_PROVIDER=openai

DEEPSEEK_API_KEY=

ROAST_AI_ENABLED=0

ROAST_AI_ALLOW_LOCAL=0

ROAST_AI_MODEL=gpt-4o-mini

ROAST_AI_ALLOWED_MODELS=gpt-4o-mini

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



For a direct DeepSeek key, see `DEEPSEEK-SETUP.txt`. Set `ROAST_AI_PROVIDER=deepseek`

and both model settings to `deepseek-flash`. Both the writer and evidence reviewer

use the selected provider; there is no automatic fallback or retry. Generation

remains disabled until explicitly enabled with the existing shared usage controls.



4. If you want database persistence, run the SQL schema in Supabase:

- `supabase/schema.sql`

- For existing databases, also run new migration files in `supabase/migrations/`.



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

- `POST /api/reports/unlock` -> disabled legacy mock unlock endpoint; paid public unlocks must use Paystack

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

- Full report unlock is R49 and exposes score breakdown, lost-customer analysis, quick fixes, and high-impact plan.

- Unlock checkout now uses Paystack (`/api/paystack/initialize` -> Paystack Checkout -> `/api/paystack/verify`).

- Configure Paystack webhook to `POST /api/paystack/webhook` for robust async confirmation.

- Payment attempts are recorded in `payment_transactions` after running `supabase/migrations/20260902_payment_transactions.sql`.

- Internal `/analytics` shows recent checkout, paid unlock, and failed/pending payment activity.



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



### Evidence-reviewed reports



- Public and Office scans share the same client-ready gate. AI/hybrid fallbacks and unreviewed cache entries are not published as new reports.

- Generation uses observed page-level evidence, business journeys and screenshots, not a preset diagnosis. A separate structured AI review checks the final narrative and proposed fixes; one revision is allowed before the scan stops.

- Citations must match exact text on the stated page. A matching quote is necessary, not sufficient: the reviewer must also support the conclusion.

- Unavailable visual capture is shown as not assessed, not given a guessed visual score.

- Existing paid reports remain available; unreviewed legacy teasers cannot start a new checkout.

- Both writing and reviewing use the explicitly allowlisted `ROAST_AI_MODEL`. Generation is disabled by default and requires the shared usage migration. See `AI-USAGE-SETUP.txt` for limits, model permissions and safe enablement. The legacy `OPENAI_MODEL` no longer selects a generation model.



Local offline replay (no paid requests; choose an existing saved test name):



```bash

node --conditions react-server --import tsx scripts/smoke-reviewed-roast.ts https://www.tashascafe.com/ --name tashas-v31

```



This saves only `tmp/reviewed-smoke-result.json`, never Supabase or client emails. While running `npm run dev`, inspect `/dev-review` and its PDF download. These inspection routes return 404 outside development. Failed scans show the review error, not a client report.



Run `npm run test:quality` for fail-closed review/cache regression checks. Mock tests do not establish real-world factual accuracy; review live reports across industries before a production release.



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





### Complimentary outreach mini-audits



Private Office scans now generate a distinct outreach mini-audit (cache suffix `outreach-v1`), not a paid full report. The analysis uses two settled homepage screenshots; the client PDF is text-only and follows the established branded report layout. It includes specific strengths, 3–5 evidence-backed observations and fixes, an honest refresh/remodel recommendation and sampling limitations. No heuristic score is displayed to the recipient. Public full-report generation and payment unlocking remain separate; checkout rejects mini-audits.



Both writer and reviewer receive two bounded low-detail JPEG captures. Outreach uses at most 36,000 text bytes per request, 2,400 writer output tokens, 800 reviewer output tokens and an 8,192 image-token reservation across both calls. Existing actor/global budgets and the per-run USD ceiling still apply. Failed validations are never automatically retried or replaced with a generic client report. Citations use zero-based evidence/page IDs; the server restores exact quotations and checks page ownership.



Office downloads and email attachments retrieve the reviewed canonical mini-audit PDF through the shared-secret endpoint. Deploy Roast AI before Office when releasing this integration. Existing reports keep their existing renderer. No new SQL migration is needed for these JSON report fields.



Verification: `npm run test:outreach` is offline and tests contracts, source IDs and spending guards. `scripts/verify-outreach-flow.ts` uses local saved evidence/captures and mocked provider responses, never paid calls. Its PDF is an INTERNAL LAYOUT DRAFT, not an approved audit. `scripts/smoke-outreach.ts --live` is a deliberately paid, opt-in local diagnostic with no retry. Do not use it to bypass daily limits.



28 October live test: desktop/mobile Tashas captures settled successfully. One writer call used 6,231 input / 774 output tokens; exact-quote citation validation stopped the report before review. Citation IDs were then implemented and tested offline. A successful live run of the revised ID contract is still required before release. Do not treat the mocked layout PDF as a client-ready report.





### Combined visual and technical evidence



The approved branded PDF now presents visual/UX priorities alongside an explicit technical review. Screenshots remain internal evidence and are not embedded in the document. Technical observations come from sampled page HTML: title/description presence, device-width viewport, canonical declarations, noindex meta directives and image alt attributes. These are observations, not guarantees of rankings, security, accessibility or mobile quality. Missing signals are review items, not automatically defects; performance/Core Web Vitals and transactional submissions are explicitly untested.



Terra full-report writer AND reviewer receive two settled low-detail homepage captures. Missing/unsettled captures block generation before a paid request. Full visual runs reserve 60,000 text bytes per request and 8,192 image tokens across both calls, preserving the existing USD ceiling. Legacy optional providers remain text-only. Outreach stays a shorter complimentary deliverable and now includes the technical observations too, within its separate budget. The cache engine is v33, so old reports cannot satisfy a new combined scan.



`npm run test:technical` verifies HTML scope and limitations. Mocked full-report tests verify both requests receive images. These changes have not had a new paid live acceptance run; today's approved additional live attempt was already used. The layout sample uses mock narrative and synthetic technical HTML, explicitly marked INTERNAL DRAFT, and must not be sent as an actual audit.



### Two-page roast presentation

The Mogodi v32 report is the voice/style benchmark: sharp opening, single biggest leak, memorable finding headlines, paired fixes and a concise verdict. Visual, UX and relevant technical issues belong in that narrative. Raw technical checklists stay in web evidence and are summarised as scope/review flags in the PDF. Screenshots remain internal. Evidence and sensitivity constraints override humour.

Full and outreach PDFs share a preflighted two-page renderer with readable 9.5-10.5pt body type. Whole findings are balanced between pages; oversized copy is rejected instead of clipped, dropped or pushed onto extra pages. Writer instructions specify concise editorial budgets. Source data and technical evidence remain stored; the short PDF is an editorial presentation. Run `npm run test:compact-report` for pagination and overflow checks. The Mogodi preview edits saved findings and preserves the original score; it is marked INTERNAL DRAFT and is not a new live accuracy test.


### Refinements after the Mogodi live acceptance test

New full reports use atomic `findings` records (headline, observation, fix). Legacy `mistakes` and `quick_fixes` are server projections; only the paired records drive new PDFs. Missing, oversized or duplicate records fail before reviewer spending. The readable two-page layout is also preflighted before the second call. The supplied business diagnosis is retained rather than replaced with a deterministic preset.

Full visual runs now send the same labelled homepage desktop/mobile and up to two settled decision-page images to BOTH writer and reviewer. The text allowance is reduced to 58,000 bytes per request and image reservations increased to 16,384 tokens for the two requests, retaining the USD0.40 ceiling. Outreach remains two images. There is no additional model call, retry or fallback provider. Homepage URL duplicates are excluded from crawl coverage.

Review v3 requires at most five material objections with an exact draft-field JSON pointer, exact quote and reason. Quotes that do not occur at the stated field are flagged and the report remains withheld. Goals are distinguished from completed transactions; figurative roast wording must still have factual support. Missing trust detection is labelled 'Trust Proof Not Observed'; browser readability is labelled a heuristic flag, and CTA captions no longer claim a form or reduced enquiry friction was verified.

`npm run test:refinements` covers pairing/reordering, headline retention, paywall projections, invented review quotes, four-image selection and the cost/call cap. No additional live run was authorised or performed for these changes. The engine cache key is v34 and the shared review version v3, so failed or older scans cannot satisfy a fresh scan.


### Evidence hardening after the cross-industry replay

Full writer citations now use evidenceIndex + pageIndex; the server restores exact source/URL/quotation and validates page ownership. This removes decorative-arrow transcription failures without weakening semantic review. Review pointers using /report/scoring/... are normalised to the actual /scoring/... root, but the exact quote must still occur there. Neither fix automatically approves old failed reports.

CTA detection recognises labelled button-style product actions as well as action words. Unknown candidates cannot generate weak-CTA penalties; clearly measured actions in both viewports override a contradictory low prominence aggregate. Caption wording consistently identifies heuristic measurements rather than claiming missed enquiries, distraction, slow reading or conversions. Desktop/mobile and blank capture limitations are explicit in writer/reviewer instructions.

Default index aliases are normalised. Extensionless/.html page aliases are merged only when title and substantive content match; unrelated paths, case-sensitive paths and functional query variants remain distinct. Alias provenance is stored and used for screenshot selection. Cache engine v35 invalidates stale fresh-scan matches.

`npm run test:evidence-hardening` tests citation-ID ownership, strict reviewer-quote matching with pointer normalisation, alias safety and optional offline replays of the three saved site captures. It does not call OpenAI or regenerate/re-approve the saved narratives. The dated construction benchmark no longer requires a CTA penalty from summary-only visual data with no measured CTA candidates; its numeric score expectations are unchanged.


### Explicit labels after the 29 October acceptance test

The v35 live Lockdown Studios scan reached eight distinct pages with settled captures. Its single writer request used 10,501 input and 1,159 output tokens (estimated USD0.03491 at the recorded rates). It was correctly withheld before reviewer spending because numeric citation indexes referred to the wrong page. No paid retry was made.

Writer and reviewer catalogs now print explicit `e12`/`p0` labels next to the evidence/page, and schemas require `evidenceId`/`pageId` strings. Models copy labels rather than counting array positions. Server resolution still checks exact page membership and inserts the original source/quote/URL. This applies to full and outreach outputs. The cache engine is v36. Offline schema, provenance and mocked flow checks pass; the labelled format has not yet had a new live acceptance run.

The diagnostic script no longer renders a deterministic fallback as though it were the generated report. `scripts/render-rejected-writer.ts` can render the original saved writer text only as an INTERNAL DRAFT, without changing the failed saved report or claiming approval.


### US$0.10 generation budget (29 October 2026)
The default `ROAST_AI_MAX_RUN_USD` is now `0.10`. Terra requests count their actual text, images and response schema through OpenAI input-token preflight before each generation. Budgeting reserves cache-write input pricing, a 10% plus 1,024-token framing margin, and bounded output. At this ceiling the writer is limited to 2,400 output tokens; review remains mandatory. Requests that cannot fit stop without another generation, retry, provider fallback or evidence removal. Failed attempts may still incur the cost of an already completed writer. This is a per-run application safeguard, not an OpenAI account billing limit; taxes and hosting are separate. Earlier US$0.40 figures document the prior worst-case byte policy.
