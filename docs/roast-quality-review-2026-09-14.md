# Roast AI quality review and change plan

Date: 2026-09-14
Scope: local Roast AI generation pipeline, scoring, collection, validation, caching, tests, and Office integration. This is an investigation and proposal, not a production release. Live deployment settings and historical report payloads were not verified. No paid generations or client emails were sent.

Implementation status: Phases 1-4 and the core of Phase 5 were implemented after this review. Phase 2 now preserves balanced page evidence, follows navigation/sitemap/second-level links, records coverage and failures, uses representative sampling, and applies bounded concurrency, timeouts, and retries. Phase 3 now stores exact CTA destinations, builds evidence-linked offerings/audiences/revenue intents, preserves mixed-business journeys, and supplies desktop/mobile plus selected conversion-page screenshots to vision-capable generation. Phase 4 now requires model claim contracts to include a reviewed source URL, matching evidence text, a report target, and observed/inference certainty; missing coverage for the first impression, main leak, or mistakes makes a public result incomplete. Phase 5 now stamps new reports with contract version `2026-09-v1`; Office preserves canonical AI wording in its adapter and HTML/PDF renderer, while legacy payloads remain readable as `legacy-v0`. An opt-in durable scan queue now persists queued/running/succeeded/failed scans and exposes a protected worker endpoint; it still needs its Supabase migration and a production scheduler. Active reachability checks for external handoffs, full visual web/PDF parity snapshots, and a human-reviewed release evaluation set remain planned.

## Conclusion

The current pipeline decides too much before the AI reads the website. It classifies industries using keywords, assigns some problems unconditionally, constrains the model to that diagnosis, and then replaces some generated content with deterministic criticism. More industry exceptions or harsher prompts will not resolve this architecture.

Keep a consistent report layout, but derive business context, findings, priorities, and fixes from evidence for the individual site. Deterministic logic remains appropriate for measurable checks, access control, caching, validation, and repeatable scoring rubrics. It should not manufacture criticism.

No system can promise a perfect report for every URL. A defensible release standard is company-specific, evidence-backed advice, an explicit review scope, and no definitive claims about things the scanner could not inspect.

## How it currently works

1. Public `/api/roast` or authenticated `/api/internal/office-roast` accepts a URL.
2. `lib/scrape.ts` fetches the submitted page, discovers same-origin links and sitemap entries, and samples up to nine additional pages. Browser rendering is a fallback for selected weak extractions.
3. Text, headings, CTA phrases, trust phrases, and contacts are combined. `lib/siteFacts.ts` extracts offerings using predefined patterns. `lib/siteContext.ts` infers a niche.
4. `lib/visual.ts` renders the submitted URL on desktop and mobile and calculates DOM/CSS metrics. It does not send screenshots to the model or walk through a customer journey.
5. `lib/scoring.ts`, `lib/designScoring.ts`, and related scoring modules compute scores. `lib/diagnosis.ts` and `lib/implementationGuide.ts` choose goals, problems, and suggested actions.
6. `lib/ai.ts` supplies those conclusions and a short content excerpt to one model request. The model writes JSON, constrained to the predetermined diagnosis and a score within 0.4 of the calculated score.
7. Normalization, roast-intensity enforcement, and sanitization can replace or rewrite the generated content. API errors also return deterministic fallback reports.
8. Reports are stored and reused using a content hash and manually maintained engine version. Public access/payment is separate from generation; Office receives an unlocked response.
9. Office adapts the response and can rewrite its meaning again. If the connected service fails, Office can generate its own fallback. Office and Roast AI render separate PDFs.

## Confirmed findings

### 1. Industry membership becomes a diagnosis

Location: `lib/diagnosis.ts:291` (`inferPainPoints`).

- Ecommerce always adds `poor_product_discovery`.
- Professional services and healthcare always add process and FAQ problems.
- Hospitality always adds `thin_authority_proof` and `wrong_cta_for_intent`.
- If too few issues are found, the function adds clarity, trust, and CTA problems to fill the list.
- Strong sites are also assigned `underused_trust_assets` without a dedicated check establishing that finding.

The model is explicitly told to match this diagnosis exactly in `lib/ai.ts:454`. Normalization also regenerates the diagnosis instead of accepting an independently reasoned one (`lib/ai.ts:1877`).

Controlled reproduction: a synthetic lodge with Check Availability, Book Direct, guest reviews, rates, amenities, and maximum category scores still received `wrong_cta_for_intent`. This reproduces the decision-rule defect; it is not a fresh audit of Mount Sheba.

### 2. Tone enforcement can erase useful analysis

Location: `lib/ai.ts:1290`, `lib/ai.ts:1808`, `lib/ai.ts:1877`.

The prompt targets harshness at 9/10, bans words such as "might" and "consider", and requires minimum issue/fix counts. The validator uses a vocabulary of roast words and simple specificity checks. Content that does not satisfy these rules can be replaced with stock mistakes, hooks, and fixes. Even the business-impact sentence can become an unsupported statement that the business pays for traffic.

Accuracy must decide whether a finding survives. Tone should be applied only after findings have been validated, without changing their meaning or confidence.

### 3. Report provenance is misleading in a fallback path

Location: `lib/ai.ts:1877`, `lib/ai.ts:1963`.

`normalizeRoast` can return the full fallback report. The caller still returns `aiUsed: true, fallbackUsed: false` when the API itself succeeded. The public generation wrapper also discards generation metadata. Cached Office responses do not preserve original generation provenance in their response flags.

Persist the actual result mode, rejected fields, validation reasons, model, prompt version, and engine version with the report. A failed substantive analysis should become a retryable or limited result, not an apparently complete client assessment.

### 4. Collected pages are not fully represented to the model

Location: `lib/scrape.ts:11`, `lib/scrape.ts:1227`, `lib/ai.ts:391`, `lib/ai.ts:454`.

The crawler caps combined content at 12,000 characters and the prompt's content excerpt at 2,200 characters. Those are concatenated in page order, so early pages can dominate. Stored page summaries retain only 650 characters per page; the evidence dossier lists metadata for the first five pages. The prompt receives aggregate headings/signals and URLs, but not a balanced body of evidence from every fetched page.

Discovery is limited to the entry page and sitemaps, rather than recursively following newly discovered page links. External booking systems are not part of the same-origin crawl. All pages are fetched sequentially; some discovery requests have no explicit timeout. Increasing page count alone would compound runtime and context problems.

### 5. Business understanding is a finite keyword catalogue

Location: `lib/siteFacts.ts:35`, `lib/siteContext.ts:515`, `lib/diagnosis.ts:207`.

Patterns cover many previously reviewed industries but cannot describe arbitrary companies reliably. A mention of a sector can mean a customer sector, blog subject, exclusion, or actual offering. The present approach does not consistently preserve those distinctions. A single niche also compresses mixed businesses such as resorts with restaurants and venues, or retailers offering installations.

### 6. Visual scoring is a proxy for actual design review

Location: `lib/visual.ts:144`, `lib/visual.ts:288`, `lib/visual.ts:620`, `lib/designScoring.ts:63`.

The implementation measures CTA count/area, contrast, font statistics, element counts, and animation hints on the submitted page. It does not capture screenshot evidence for model interpretation, test menus/booking paths, or review image suitability. Hierarchy includes distance from a fixed target of 48 above-fold elements, which is not a universal design standard. When visual analysis is unavailable, a fallback design score can still be produced.

A page can therefore score well on these metrics while looking poor. Separate measured checks from visual judgments, and show unassessed dimensions as unavailable.

### 7. Evidence validation does not establish factual support

Location: `lib/ai.ts:797`, `lib/reportSanitizer.ts:149`.

The claim contract mainly checks field shape, counts, and some source-anchor matches. It does not require each claim to point to an exact page observation supporting its meaning. Word substitutions can turn an unrelated recommendation into superficially industry-correct language without fixing its underlying reasoning.

An unrecognized CTA is not necessarily absent. An unvisited FAQ is not necessarily missing. A hypothesis about lost enquiries is not measured conversion loss. These distinctions must be represented in the data model.

### 8. Office can change the diagnosis after generation

Locations in Office: `lib/web-roast-client.ts:683`, `lib/report-renderer.ts:1170`, `app/api/roast/route.ts:51`.

The adapter and renderer contain additional company/industry detection, fallbacks, and replacements, including substitutions between quotes, purchases, and bookings. The API can invoke a separate Office roast engine when Roast AI fails. Improving only the Roast AI prompt will therefore not guarantee that the client receives the same findings.

Use one immutable validated report contract. Office should format and brand it, not diagnose it again. Existing reports should remain readable without silently changing their meaning.

### 9. Cache identity omits important analysis inputs

Location: `lib/fingerprint.ts:10`.

The hash includes an engine version but only the first 4,000 content characters, selected page metadata, and no rendered visual audit. Changes to lower-page copy, images/layout, or model/prompt configuration can leave the identity unchanged unless another hashed field changes or the version is manually bumped.

Include per-page evidence hashes, visual evidence identity, analysis configuration versions, and a freshness policy. Provide an explicit Office regenerate action that creates a new version while preserving access to previously paid reports.

### 10. Existing tests measure implementation consistency more than truth

Location: `lib/benchmark.ts:25`, `scripts/verify-report-fixture.ts`.

The 29-case benchmark checks score ranges, repeatability, selected flags, and penalties using synthetic scraped inputs and fallback generation. PDF fixture checks cover generation and several known contamination cases. These are useful but do not validate collection from rendered sites, AI factual accuracy, or customer journeys across industries.

## Proposed analysis contract

Use a staged, persisted pipeline:

`URL -> discovery -> page evidence -> business profile -> journeys -> candidate findings -> verification -> scores/priorities -> report -> shared rendering`

Keep these records separate:

- Scan: submitted/final URL, start/end time, discovered/reviewed/failed/skipped pages, reasons, rendering status, versions, and job status.
- Page evidence: URL, page role, timestamp, exact text, element locator, observed CTA label/destination, screenshot reference, and observed state.
- Business profile: actual offerings and exclusions, audiences, primary/secondary revenue paths, service areas, and confidence, all linked to evidence.
- Journey: entry page, intended task, steps checked, destination/provider, outcome, and unknown steps. Do not submit real enquiries, payments, or reservations during inspection.
- Finding: observation, evidence IDs, affected page/journey, why it matters, certainty, severity, recommended change, effort, and a business-specific example.
- Final report: verified findings, strengths worth keeping, prioritized quick wins, score rationale, scope/limitations, and generation provenance.

Industry knowledge should choose which questions to investigate, not supply the answers. Support multiple paths: a lodge can have accommodation booking, restaurant reservations, and event enquiries. Assess the function and destination of the existing CTA before suggesting a new label.

Retain the current visual identity and consistent section order. Permit fewer findings when that is all the evidence supports. Keep the first page a compact executive summary with the main verified issue and top actions; detailed findings can follow without fixed-count filler.

## Phased implementation

### Phase 1: Stop false conclusions and make failures visible

Remove unconditional painpoints and forced issue counts. Stop lexical harshness checks from replacing findings. Return accurate AI/fallback/limited status, save validation failures, and expose source/freshness in Office. Prevent automatic client-ready status for failed or insufficient analysis. Add the lodge CTA and strong-store reproductions as regressions.

Exit gate: the controlled lodge is not accused of a wrong CTA solely because it is hospitality; a shop is not accused of poor discovery solely because it is ecommerce; fallback provenance is accurate. Keep normal Office/payment access rules intact.

### Phase 2: Preserve evidence and discover the site's scope

Replace lossy aggregate-only collection with page-level records and structured DOM extraction. Discover the sitemap/navigation graph; select representative page types and essential conversion/support pages within a disclosed budget. Render dynamic pages when needed. Record failed pages and limits. Add background scan jobs, bounded concurrency, per-request timeouts, and retries so larger reviews are not held inside one long web request.

Exit gate: every selected page contributes inspectable evidence; a failed page never becomes proof that its content is absent. Small sites can be fully covered; large sites disclose representative sampling rather than claiming every page was inspected.

### Phase 3: Understand the company and inspect its journeys

Build an evidence-backed business profile before diagnosis. Allow mixed models, unfamiliar offerings, and an unknown state. Preserve names from source content instead of restricting them to a fixed service dictionary. Inspect existing CTA destinations and relevant journeys, including read-only external booking handoffs. Capture desktop/mobile screenshots of key pages and use visual analysis alongside measurable checks.

Exit gate: lodge, restaurant, resort-with-venue, tax firm, ecommerce-with-installation, SaaS, and unfamiliar-industry examples each retain their actual goals. CTA recommendations explain a demonstrated problem with the current path.

### Phase 4: Verify findings, then write and score

Generate candidate findings from the evidence. Validate exact quotation/source references, search relevant evidence for contradictions, distinguish missing from not observed, and reject unsupported company facts. Use structured output schemas and semantic checks. Retry only repairable failures, with a bounded retry budget. Scores should follow verified findings and documented rubrics, with unassessed dimensions excluded or clearly marked.

Write the final report from verified findings only. Keep the voice direct and memorable without inventing paid traffic, actual lost sales, response promises, or absent content. Label impact estimates as judgments. Select the model using evaluation results; do not assume a model upgrade alone resolves these failures.

Exit gate: every published major finding has valid supporting evidence; contradictory observations are resolved or explicitly qualified; a strong site can receive a positive assessment and only a few improvements.

### Phase 5: Share the report contract across Office, web, and PDFs

Version the canonical report schema and support old records through explicit read adapters. Remove semantic rewrites from new-report renderers. Make regenerated reports new versions, preserve paid access and Office access, and align cache identity with analysis configuration and evidence. Let Office preview the exact report that will be emailed.

Exit gate: one report has the same company profile, CTA assessment, scores, findings, and priorities in Roast AI, its PDF, and Office's PDF. Branding and layout may differ without changing substance.

### Phase 6: Prove quality before switching production

Create a captured, human-reviewed evaluation set across at least 30-50 sites, including previous failures, strong sites, unfamiliar industries, mixed businesses, large catalogues, JavaScript sites, blocked pages, and third-party booking engines. Include adversarial website text that attempts to instruct the AI; treat page text as evidence, never instructions.

Measure business-profile accuracy, unsupported major claims, false missing-content claims, valid evidence references, CTA fit, duplicated findings, usefulness, score agreement, cost, and runtime. Run repeat analyses to check substantive stability rather than identical wording. Include tests that alter only a booking link, FAQ, product filter, lower-page content, or visual layout and confirm the corresponding assessment changes.

Roll out behind a version flag, compare old/new results internally, and switch only when reviewed outputs pass. Maintain rollback without rewriting historical reports.

Exit gate: zero unsupported major claims and zero wrong-industry recommendations in the reviewed release set; valid evidence links for all major findings; consistent report contents across renderers. These are release targets, not claims about current performance or guarantees for unseen sites.

## Verification completed for this investigation

- `npm run typecheck`: passed.
- `npm run test:benchmark`: all 29 cases passed; score and repeatability pass rates were 100%.
- Controlled diagnosis probes reproduced automatic ecommerce and hospitality painpoints despite maximum supplied category scores.
- Local repository was clean before the audit. No application code, environment values, production reports, or deployments were changed.
- Production logs, actual deployed model configuration, model-response quality on live sites, browser availability in Vercel, and recent customer PDFs remain unverified in this investigation.

## Implementation reference

Use schema-constrained model output for the evidence/profile/finding contracts instead of relying only on JSON-object mode. Schema shape still needs separate source and semantic validation. Official documentation: https://developers.openai.com/api/docs/guides/structured-outputs
