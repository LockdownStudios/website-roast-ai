# Durable scanner V2 — operator setup and release status

Updated 30 October 2026. This is an internal preview, not a production acceptance certificate. The legacy public R49 flow and existing Office roast action remain available. No production migration, worker deployment or public cutover was performed as part of this source implementation.

## Current choice: local development only

The user chose the local computer for development testing. No hosted worker will be provisioned at this stage. After the new SQL migration is applied, from the `web-roast` folder run:

```powershell
npm run check:scanner
npm run dev:scanner
```

The launcher starts local Roast AI on port 3000, Office on 3001 and the worker, using a temporary shared local secret without editing either project's saved secret. It points the local Office proxy to the local Roast API, never the production scan endpoint. Close older dev servers for these same projects first. Open `http://localhost:3001/office/scanner?batch=1` and sign in normally.

This first mode collects measurements with **paid AI disabled**, using **local Lighthouse** by default. It does not call the PageSpeed API or need a Google API key. `npm run dev:scanner -- --pagespeed` explicitly selects the Google API instead. The standalone worker still defaults to PageSpeed unless `ROAST_V2_MEASUREMENT_PROVIDER=local` is configured. No production environment was changed.

Local measurements use Lighthouse 13.6.0 in an isolated Chromium profile, with simulated mobile/desktop settings. Results identify `local lab` in the web/PDF output; they are lab measurements, not real-user field data or an identical substitute for Google's hosted measurement environment. Browser work shares a slot with capture to reduce simultaneous CPU contention. Each audit has a 120-second deadline and closes its own browser. The engine runs in a native Node child process to avoid TypeScript transpiler helpers breaking browser-evaluated Lighthouse functions. It inherits only OS/browser paths, not Supabase, email or AI credentials. Public-target and resource checks remain enabled; production network egress isolation is still required.

Once collection/recovery is verified, stop the launcher with Ctrl+C and run `npm run dev:scanner -- --ai` for an explicitly metered AI test. It enforces a US$0.10 per-run ceiling and may consume credits for authorized queued jobs. Keep the terminal/computer running. This is not a production worker deployment.

## What is implemented

- Separate, service-only Supabase job records, owner-scoped status/download endpoints, persisted stages and checkpoints, worker leases and heartbeat recovery.
- Independent content/browser collection and real mobile PageSpeed/Lighthouse measurements. Office can request both mobile and desktop measurements. Missing scores remain unknown; a failed subsystem does not erase other measurements.
- The existing evidence writer and independent corrective editor, now able to use measured technical facts and a five-category studio rubric within the same two generation calls. Office retains the existing per-run application cost controls and US$0.10 default ceiling; public daily limits are not applied to authenticated Office jobs.
- Studio levels are mapped to 0/25/50/75/100 in code. Design/mobile require screenshot evidence, mobile requires the mobile screenshot, and text references must resolve to the exact page/evidence catalogue. Missing mandatory categories withhold the overall. Mobile is the declared primary technical device for the weighted overall, even when desktop measurements are also available.
- The studio rubric is **provisional** pending human calibration. Its anchors are in `lib/scan-v2/rubric.ts`; weights are in `lib/scan-v2/contract.ts`. These are studio judgements, not Google scores or proven conversion outcomes.
- Batches of up to 20 Office URLs or selected leads, active-job deduplication, six-hour reuse scoped to owner/profile/result version, explicit fresh scan, saved-job selection, queued-job prioritization, refresh/resume and stop-after-current-check. Selected-lead jobs create idempotent saved scan links in the lead activity history.
- A dark scanner with actual capture previews when available, restrained animation, reduced-motion support, real persisted progress and elapsed time. It never fabricates granular Lighthouse check progress or benchmark averages.
- Shared compact HTML/PDF presentation, actual technical and studio scorecards, numerical unknowns, two-page PDF preflight and separate authenticated raw diagnostics export. Screenshots are not embedded in client PDFs.
- Office lead details link to the preview. An approved, terminal scan with checked PDF layout can be saved to its matching lead. The report UUID makes repeated saves idempotent, previous reports are retained, unknown scores stay missing and no email is sent automatically. The saved canonical report is used by existing download/email rendering and existing suppression/confirmation/tracking flows.

## Setup, in order

1. In the **Roast AI Supabase project**, run the complete contents of `supabase/migrations/20261030_durable_scans_v2.sql`. This creates new V2 tables/functions and does not rewrite legacy reports. **The user applied this successfully on 30 October; live table reads and the worker heartbeat have passed. Do not rerun it just to solve the PageSpeed quota error.** Concurrent claim/recovery and RLS acceptance still need the planned broader validation.
2. For current development, use the local launcher above. Future production requires an always-on process, browser support, automatic restart and network-level denial of private/link-local/metadata destinations. The application checks URLs, redirects and browser requests, but DNS checks alone do not eliminate DNS-rebinding risk. Production host selection/cost approval remains outstanding; no hosting purchase was made.
3. Configure the **worker**, privately, with the existing Roast AI `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, OpenAI provider/model settings and AI usage ledger configuration. Add `PAGESPEED_API_KEY` for your Google PageSpeed project if available. Do not put these in public Next.js variables. Start with `ROAST_V2_AI_ENABLED=0` to test measurements without paid AI calls.
4. Local development worker: from `web-roast`, run `npm run worker:v2`. It loads `.env.local`, claims one job at a time and forces its outbound request guard on. This keeps working after a browser tab closes only while that computer/process remains running. Production must use a process supervisor or container host. `Dockerfile.scan-worker` provides packaging; the container image/build and host firewall still need validation on the selected host.
5. After the migration and a healthy worker are confirmed, set **Roast AI Vercel** `ROAST_V2_ENABLED=1` and redeploy that project. Leave `ROAST_V2_PUBLIC_ENABLED=0`. No worker heartbeat means no new job is accepted. Already saved jobs remain readable. Preserve the existing shared Office secret on both projects.
6. Open the **Office** `/office/scanner` page while signed in. A lead's “Durable scanner preview” action pre-fills its URL and enables saving the reviewed result back to that lead. Directly pasted URL batches persist as scans; they do not automatically attach to leads or send emails.
7. Once measured collection/recovery is verified, set **worker** `ROAST_V2_AI_ENABLED=1`, preserve `ROAST_AI_MAX_RUN_USD=0.10`, and restart the worker. A previously technical-only cached result can be deliberately replaced by selecting Fresh scan. This can incur a new metered generation.
8. Run a controlled single-site test, inspect actual measurements, business identity, studio citations, final PDF and cost ledger, then the planned representative 20-site acceptance batch. One isolated Property Services narrative test is now verified below. The real Office save/download/email-to-test-mailbox path and broader acceptance remain outstanding; no email was sent.

The browser UI, orchestration API and worker are different processes. Redeploying Vercel alone does not start the persistent worker. Do not enable the new default workflow until the worker is supervised and acceptance passes.

## Retention and recovery

- Normalized measured results and approved narrative remain in the durable job and, after explicit import, in the Office report history.
- Raw Lighthouse artifacts live separately in private `roast_artifacts_v2`, not in normal polling responses. The worker invokes housekeeping daily: raw artifacts and terminal-job screenshot/content checkpoints expire after 30 days. Result summaries are retained. Monitor real storage usage before increasing volume.
- Before AI authorization, one stale job can resume its saved checkpoints (at most two worker attempts). After AI authorization, an interrupted job ends with retained results and **no automatic paid generation retry**. A provider may still bill a request whose response was lost; the UI must not claim zero cost for it.
- Stop is cooperative. An in-flight browser/measurement/AI request may finish. Completed measurements are retained and later stages stop when the cancellation checkpoint is observed.
- Technical-only and partial downloads are labelled. Unapproved AI prose is never imported as a client report. A PDF layout failure retains the web results and diagnostics rather than clipping text.

## Local verification evidence - 30 October

- Local Office emailed sign-in was confirmed working by the user after the callback fix.
- Real database table reads and an active worker heartbeat passed. Local launcher runs on ports 3000/3001 with `ROAST_V2_MEASUREMENT_PROVIDER=local` and paid AI disabled.
- Real local mobile audit of Property Services returned Performance 26, SEO 92, Accessibility 96 and Best Practices 77. This is one simulated lab run, not field performance or a complete visual assessment.
- An isolated worker job for example.com completed mobile and desktop measurements, content/capture stages and a checked two-page PDF. It correctly finished as partial with no AI narrative/overall studio score. No Office lead was attached or emailed.
- An isolated Property Services worker job retained real mobile results and a checked PDF in 36 seconds. Neither test authorized AI. No production environment or default Roast Lab action was changed. This timing excludes AI generation and is not a performance guarantee for other sites.
- Typecheck, targeted lint, production build, V2 regression tests and local-request-guard checks passed. The control PDF was rendered and visually inspected; this was technical-only QA, not approval of a client narrative.
- Known live limitation: the studio homepage loads in a normal browser but Lighthouse navigation returns `FAILED_DOCUMENT_REQUEST / net::ERR_ABORTED`. The implementation does not manufacture scores for that outcome. Content/visual collection and supported narrative can still be retained independently.
- The user authorized one Property Services visual-plus-written test capped at US$0.10. It reused the saved measurements/captures, made exactly two generation requests (writer/editor), returned three approved findings and a provisional overall 73/100, and passed two-page PDF generation/visual QA. Recorded conservative AI cost estimate: US$0.056525; narrative processing: 27 seconds. This is not a provider invoice or a combined fresh-scan timing. No automatic retry occurred.
- The test ran under a development actor without creating an Office session or changing a lead. The regular worker remains AI-disabled. A run marker prevents repeating this paid test under the same approval. The real Office save/download/test-email journey and 20-site acceptance are still outstanding.
- The PDF now states the sampled coverage (10 public pages, desktop/mobile homepage captures, no form/booking/payment submission). Office and Roast AI presentation copies include the same scope and local measurement source. Display keeps a completed explanation sentence when an incomplete second sentence hit its field limit; approved raw source evidence is retained.

## Still required before release

- Execute and verify the migration, including concurrent claims, RLS, crash recovery and retention against real Postgres.
- Provision/validate the chosen persistent worker, private-network egress controls, supervised restart, resource use and running cost.
- Calibrate the provisional studio rubric and weights against human-reviewed snapshots across the agreed business types. Scores are not yet a validated industry benchmark.
- Test the hosted PageSpeed quota/API configuration if that provider is selected. Local development now uses local Lighthouse. Complete the worker-to-Office save/download/test-email journey.
- Complete the 20-site acceptance run, measure latency/useful-result rate/cost, inspect representative PDFs and resolve failures.
- Complete the production cutover from the existing tab-based queue after validating the new selected-lead durable batch preview. Associations and high-priority/stop controls now exist in source; validate them with real Office records and resolve partial failures before changing the default action.
- Integrate the public paid V2 lifecycle, deeper full-report coverage, entitlement/recovery and payment tests before enabling the public V2 flag. Existing legacy R49 payments are unchanged.
- Commit/deploy only after this review. Source changes and passing fixture checks are not evidence of a live deployment.
