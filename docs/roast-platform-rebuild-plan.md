# Roast AI scoring and reliable scanning implementation plan

Status: implementation in progress, 30 October 2026. The isolated V2 preview now includes a durable worker, measured scores, provisional studio rubric, progress UI, report downloads and explicit Office lead-report attachment. See [setup and actual release status](durable-scanner-setup.md). Infrastructure, live acceptance, rubric calibration and the public paid V2 cutover remain outstanding; this roadmap does not mark the application as fully rebuilt, deployed or accepted.

## Objective

Support at least 20 Office outreach reports per working day with useful, company-specific findings, clear scores, honest progress and saved results. Restore the older report's useful scorecard and detail while retaining the current evidence discipline and roast voice. A slow or unavailable subsystem must not erase successful work from other checks.

The Mount Sheba reference demonstrates the desired compact score layout, but its description of a hotel as a camping-power-supplies business and its generic quote recommendations are failures to prevent, not a baseline to reproduce. Existing HTML-derived SEO hints must not be presented as measured Lighthouse scores.

## Product decisions

- One collection and scoring engine serves Office and the public app. Access, payment and report depth remain separate. Office staff do not pay the public R49 unlock charge.
- Office outreach includes meaningful technical, visual and business findings, a scorecard and a two-page client PDF. The paid product adds deeper page and journey coverage, detailed diagnostics and implementation guidance; it does not manufacture more problems.
- Automated checks collect facts and calculate repeatable technical scores. AI interprets supported evidence, identifies business-specific priorities and writes the roast; it does not invent technical measurements.
- Every accepted scan has a durable record and an explicit outcome. An unreachable or blocked website cannot be guaranteed a complete audit. Return completed checks, unassessed categories and the reason for missing coverage rather than an empty results panel or invented report.
- No scanner can guarantee immunity from website blocking, host outages or provider limits. Implement polite bounded collection, reuse, permitted fallbacks and recovery; do not bypass access controls or CAPTCHAs.
- Keep the US$0.10 application AI cap per report until measured evaluation justifies an explicit change. Browser infrastructure costs and third-party quotas are tracked separately. No automatic paid regeneration loops.
- Keep authorized Office staff free of public daily scan allowances and shared public cooldowns. Retain authentication, duplicate-job protection and bounded worker concurrency; these must not silently become a ten-reports-per-day staff limit.
- Do not copy the competitor's average score, issue count, percentile or revenue claims. Show comparison figures only after collecting a suitable real dataset and naming its scope.

## Measurement and scoring contract

Show two clearly labelled groups, with new scores consistently displayed out of 100.

| Group | Categories | Source and interpretation |
| --- | --- | --- |
| Technical measurements | Performance, SEO, Accessibility, Best Practices | Actual Lighthouse results, labelled by URL, device, timestamp and engine version. Store raw audit results and measured values. These scores describe the tested page and conditions, not the entire business. |
| Studio assessment | Design and UX, Mobile usability, Content clarity, Trust and proof, Customer journey and CTA | Published criteria tied to screenshots, visible content, business evidence and safely exercised interactions. Store supporting observations and confidence. These are studio assessments, not Google scores. |

Use Lighthouse on the homepage first. Add representative service, product, booking or contact pages according to the scan profile and record precisely which pages were tested. Discovery and content sampling can cover additional pages without pretending each received a full Lighthouse run.

Calculate the overall score in code from validated category inputs. AI must not overwrite Lighthouse results or invent an overall score. High technical scores do not automatically imply attractive design, clear navigation or an effective customer journey. Accessibility scores cover automated checks, not a complete accessibility or legal-compliance assessment.

Use mobile technical measurements by default for an outreach scan, with desktop and mobile visual captures. Offer Desktop, Mobile and Both explicitly; a combined paid scan can include both technical profiles and additional journeys. Never present a desktop screenshot as proof of a desktop Lighthouse result. Keep real-user Core Web Vitals separate from lab metrics; show insufficient field data where appropriate.

Proposed Lockdown overall score weights, to validate during Phase 1: Design and UX 20%, Mobile usability 15%, Customer journey and CTA 15%, Content clarity 10%, Trust and proof 10%, Performance 10%, Accessibility 10%, SEO 5%, Best Practices 5%. This is our score, not a Lighthouse overall score. Publish and version the final rubric. Do not silently renormalize missing categories; withhold the overall score when mandatory evidence or the agreed coverage threshold is missing. Missing is not zero.

Keep historical scores with their original rubric/version. A numerical change between old and new methods must not be labelled a website improvement. Prevent overlapping or contradictory score drivers from penalizing and rewarding the same observation without explanation.

## Phase 1 Contract and evaluation baseline

Source implementation evidence (distinct from live acceptance):

- [x] Isolated versioned result contract, deterministic weighted overall and evidence-cited provisional studio rubric.
- [x] Durable worker source, private measurement artifacts, checkpoint/lease recovery, authentication and partial-result handling.
- [x] Honest progress preview, 20-lead selection, saved lead scan links, prioritization, cancellation, report download/import and local launcher.
- [x] Passing local fixture checks for score parsing, missing scores, recovery, visual-failure isolation, cross-owner access and writer/editor cost controls. Browser fixture checks cover mobile width and refresh without resubmission; PDF fixtures were rendered and visually inspected.
- [ ] New migration applied and verified in real Postgres. A read-only check on 30 October found the legacy AI ledger healthy and the new V2 tables absent.
- [ ] Human rubric calibration, controlled live worker/site tests, real Office lifecycle validation and the representative 20-site acceptance batch.
- [ ] Production/public paid V2 cutover. Current execution is local development only, per the user's choice.

Deliverables:

- [ ] Record the current Office and Roast AI release versions and preserve existing fixtures and approved reports.
- [ ] Define a shared, versioned scan-result schema containing business identity, pages attempted/reviewed, actual measurements, studio assessments, findings, evidence, confidence and limitations.
- [ ] Define each scoring criterion, supported inputs and rules for unavailable evidence. Calibrate the proposed weights against human-reviewed samples before finalizing them.
- [ ] Define Complete, Partial and Unable to assess outcomes, separately from AI narrative status and client-report readiness.
- [ ] Establish fixtures for accommodation, restaurants, construction, professional services, ecommerce and other businesses. Include Mount Sheba, Fuller, Hydro Power Systems, Prop Services, Tashas and examples of strong sites.
- [ ] Add cases for blocked pages, JavaScript-heavy sites, missing images/fonts, Lighthouse failure, AI outage and payment/Office entitlement separation.

Acceptance: known business identity and appropriate customer actions are correct in the baseline set; missing evidence never becomes a factual criticism; fixed snapshots produce repeatable rule-based scores. The old Mount Sheba industry/CTA error is a mandatory regression test.

## Phase 2 Durable measurement pipeline

Deliverables:

- [ ] Extend the existing scan-job concept into a durable pipeline with channel, report profile, lead/user ownership, stages, attempts, timestamps, progress events, checkpoint references, error reasons and cost accounting. The existing worker calls the public roast route; it cannot be assumed to handle Office jobs correctly without redesign.
- [ ] Move long browser/Lighthouse work to a dedicated bounded worker runtime. Keep Vercel as the user interface and orchestration API rather than depending on one long browser-to-Office-to-Roast HTTP request.
- [ ] Choose the worker host and validate its cost, browser stability and concurrency before provisioning production. Run a local worker for development; do not rely on a staff laptop staying online for production jobs.
- [ ] Collect normal page content, business evidence, safe navigation observations and desktop/mobile captures. Add Lighthouse Performance, SEO, Accessibility and Best Practices measurements.
- [ ] Save each completed stage immediately. Store JSON measurements in shared storage and large artifacts separately with controlled access and retention.
- [ ] Use bounded HTTP concurrency and coordinated browser resources. Reuse artifacts where test conditions permit; do not run duplicate full audits simply to obtain a screenshot.
- [ ] Use one bounded retry for transient non-AI collection failures where appropriate. Continue other independent checks when one provider fails. A failed font or image download is a capture limitation, not an automatic accusation about the business.
- [ ] Add leases, heartbeat/stalled-job recovery, idempotency and deduplication by normalized URL, scan profile and engine version. Resume checkpoints rather than restarting paid work.

Acceptance: a scan continues after the user closes the browser; worker interruption does not lose completed measurements or duplicate AI charges; every accepted job reaches a recorded terminal outcome after recovery. Reachable-site runs produce usable Complete or Partial results rather than losing all collected data.

## Phase 3 Site specific interpretation and report readiness

Deliverables:

- [ ] Establish company identity, actual offerings and customer journeys from attributable page evidence before generating recommendations. Support mixed businesses and uncertainty.
- [ ] Respect observed CTAs: hotels may need availability/booking, restaurants menus/reservations/location, shops product discovery/purchasing, and service businesses consultations or enquiries. Industry is context, not an automatic diagnosis.
- [ ] Supply measured issues, scoped screenshots, observations and coverage to a bounded writer/editor workflow. Prioritize a few high-value findings with a witty headline, observation, possible consequence and practical fix.
- [ ] Correct or remove unsupported narrative in the editor pass while retaining valid findings. Validate the final wording and citations. Never release the rejected original draft.
- [ ] Save technical results independently of AI review. If AI fails, retain the measurements and offer a clearly labelled technical-only report when sufficient evidence exists. Unreviewed AI prose remains unavailable for client sending.
- [ ] Allow a partial client report only when its included statements are supported and missing areas are obvious. A wholly inaccessible site receives an Unable to assess outcome rather than a fabricated roast or confident overall score.
- [ ] Keep Office data, public report entitlement, paid unlocks, report recovery and staff-only diagnostics distinct. Do not reveal private Office reports through a public cache or predictable job ID.

Acceptance: refusing one speculative sentence does not discard measured scores; technical-only and partial reports cannot masquerade as a completed full visual audit; there is no generic “Request a Quote” recommendation for every industry. Provider failure does not trigger an automatic paid rescan.

## Phase 4 Real scan progress and scanner interface

Deliverables:

- [ ] Add a branded dark scanner with the actual captured website preview, a restrained scanning sweep, stage cards and a progress bar. Respect reduced motion and keyboard/screen-reader access.
- [ ] Present persisted stages: queued; connecting; discovering pages; collecting desktop/mobile evidence; running technical audits; evaluating business and UX; checking narrative; compiling and saving the report.
- [ ] Show counts only when backed by returned audit data. When an upstream audit exposes no granular progress, show an active indeterminate state instead of invented completed checks or percentages.
- [ ] Distinguish queued, running, completed, partial, unavailable and failed stages. Show elapsed time and a useful failure reason. Do not invent an ETA until observed timings support one.
- [ ] Resume the same job on refresh using its saved ID. Poll authenticated job state at a modest interval; event streaming is optional, not required for correctness.
- [ ] Reveal completed measurement cards progressively, even while the narrative is still being checked. Keep completed work visible on partial failure.

Acceptance: the progress display never reaches Complete before saving succeeds, never claims unrun checks and never stalls indefinitely at a decorative 97%. Refresh resumes the existing scan rather than authorizing a second paid generation.

## Phase 5 Reports and Office daily workflow

Deliverables:

- [ ] Restore the compact scorecard, useful summary, primary opportunity, top findings, paired quick wins, recommended next step and coverage details, with the established navy/orange branding and roast voice.
- [ ] Make page 1 immediately useful: business/site identity, scorecard, concise roast and top priorities. Use page 2 for the strongest findings, concrete fixes, supporting measurements and next action. No mostly empty cover page and no screenshots embedded in the default client PDF.
- [ ] Use one presentation model for the web report, PDF and Office email attachment. Keep the complete audit breakdown available online; make optional detailed technical exports separate from the two-page client summary.
- [ ] Move the existing tab-based 20-lead queue onto durable server-side jobs. Add per-lead progress, ready/partial/needs-review outcomes, manual prioritization, stop-after-current and safe resume.
- [ ] Preserve approved-report reuse with timestamps and an explicit fresh-rescan control. Validate profile, rubric/engine version and ownership when reusing results.
- [ ] Keep email sending a separate explicit action with the existing confirmation and unsubscribe checks. Never move a lead to Roast Sent merely because it was queued, scanned or dismissed.
- [ ] Preserve the R49 public full-report unlock and free authorized Office use. Do not quietly substitute a limited report for a purchased full one.

Acceptance: staff can prepare 20 leads without manually waiting on each request, close the tab and return to saved outcomes, then open/download/send each eligible report from the lead. Failed or partial scans do not overwrite an earlier approved report or falsely advance the sales pipeline.

## Phase 6 Acceptance tests and rollout

- [ ] Run fixed-snapshot tests for scoring, report content, citations and missing-data rules.
- [ ] Run browser tests for real progress events, desktop/mobile labels, refresh/resume, safe cancellation and authentication.
- [ ] Exercise blocked-site, missing-font, worker-crash, Lighthouse-timeout, AI-quota and failed-save scenarios. Verify no duplicate generation charges and no fabricated result.
- [ ] Run a controlled live batch across at least 20 representative sites and inspect failures. Target at least 95% of reachable test sites returning a useful supported report; account for every accepted job. This is an acceptance target, not a guarantee that every external website is auditable.
- [ ] Record first-results time, total completion time, usable-report rate, AI cost, collection/worker cost and reviewer correction/refusal rate. Separate cache hits from fresh scans and outreach from full scans.
- [ ] Set advertised timing only after those measurements. Lighthouse is real work; do not promise a complete two-device AI audit in a few seconds. Deliver early technical results and allow unattended processing.
- [ ] Compare PDF and web layouts on the reference set. Verify the report is genuinely usable for accommodation, restaurants, ecommerce, professional services and construction.
- [ ] Deploy first to internal Office use. Validate public scanning, payment/recovery and entitlement isolation before public promotion. Version the new engine and provide rollback without rewriting historical reports.

At 20 newly generated Office reports per day, a US$0.10 per-report application cap permits up to US$2/day in AI spend, or US$44 for 22 working days. This excludes browser hosting and other services and is not a promise that every report consumes the full allowance. Cache reuse and technical-only collection must be visible in cost reporting.

## Execution rules

Finish each phase's acceptance checks before proceeding to release-dependent work. Keep a phase checklist and an evidence log of actual test outcomes. Do not call mock tests a live acceptance run, or a local change a deployment. Keep the current production system available while the rebuilt pipeline is evaluated in isolation. This planning task does not itself authorize a paid infrastructure purchase or a live batch of AI generations.

The original planning-only step has been superseded by the user's implementation request. Checklist acceptance remains incomplete until supported by actual test evidence; no production rollback or paid infrastructure purchase is implied.

## References

- User reference: Mount Sheba Rainforest Hotel and Resort roast PDF, two pages, dated 11 September 2026. Design reference and negative business-classification example.
- User reference: competitor scanning screenshot and supplied copy. Interaction inspiration only; its issue counts, scores and benchmark average are not our measurements.
- [Lighthouse overview](https://developer.chrome.com/docs/lighthouse/overview)
- [Lighthouse performance scoring and variability](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
- [PageSpeed Insights lab and field data](https://developers.google.com/speed/docs/insights/v5/about)
- [Lighthouse accessibility scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)
