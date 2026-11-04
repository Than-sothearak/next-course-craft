# Verification baseline

## Presentation video revisit checks: 2026-11-05

Passed 60 focused tests across `slide-playback`, `slide-media-duration`, `required-media-playback`, `slide-media-controls-progress`, `media-playback`, and `media-progress-scorm`. New coverage checks the default Restart option, saved Continue configuration and editor/SCORM serialization, exact retained native playback positions across slide changes, paused revisits after completion, completion restoration before autoplay, initial partial-checkpoint resume, late metadata after revisiting, preserved checkpoints and forward-seek protection. The duration follow-up reproduces missing menu durations when native metadata is already available without a new event; it verifies cached durations for paused, unvisited and cropped video players and their course total before playback and after navigation. Two stale duration-label expectations in the existing playback suite were updated to include the menu's existing slide number and minute suffix.

`npm.cmd run typecheck`, zero-warning ESLint on changed modules/tests/browser script, and `npm.cmd run build:export` passed. The export build retains its existing module-directive/sourcemap and chunk-size warnings. `node scripts/testing/slide-video-revisit-browser.mjs` passed real Chromium checks in compiled single-file HTML on `file://`, using native media playback and played ranges. It covers default rewind, exact Continue positions, cropped timeline display, Previous/Next/keyboard/outline navigation, finished-video revisits, persisted completion before autoplay, explicit Restart, forward-seek protection and zero external requests. The duration follow-up also checks each video menu duration and the course total, including an unvisited video, after navigation and after reload. `node scripts/testing/required-media-browser.mjs` passed the existing standard/presentation checkpoint, partial-resume and skip-protection checks before the duration follow-up. No full repository, production-authenticated, or live LMS run was performed.

## Dashboard mobile responsiveness checks: 2026-11-03

Passed 40 focused tests across `dashboard-loading.test.tsx`, `course-card.test.ts`, and `folder-card.test.tsx`, strict TypeScript (`npx.cmd tsc --noEmit`), and zero-warning ESLint on changed dashboard modules, tests, and the browser script. New checks cover mobile folder expansion/navigation, folder creation, filter-preserving workspace switches, viewer restrictions, and dismissal on desktop resizing.

`node scripts/testing/dashboard-responsive-browser.mjs` checks the actual dashboard components with isolated fixture data and mocked routing at 320, 390, 640, 768, 844, 1024, 1280, and 1536 pixels, including phone landscape. It verifies no horizontal page overflow, readable cards and aligned metadata, nonoverlapping card actions, card popovers, navbar Publish/profile menus, nested folder touch navigation, creation actions, workspace switching with long names, scroll restoration, Escape/focus restoration, desktop resize, and loading skeletons. Screenshots are written to `test-results/dashboard-responsive-*.png` and `test-results/dashboard-mobile-folders.png`. These are focused component/browser checks; no production-authenticated or database integration run was performed for this UI fix.

## Presentation text and LaTeX checks: 2026-11-03

Passed 68 focused tests across seven files: `presentation-text-settings`, `export-font-assets`, `pdf-handout`, `code-example`, `slide-text-insertion`, `slide-selection-editor`, and `interaction-button-editor`. Coverage includes selected/whole-object font formatting, mutually exclusive super/subscript, all six formula templates, invalid and bounded LaTeX, accessible math, HTML/save/clipboard round trips, source-preserving PDF handouts, equation cancellation and undo, and existing slide/popup behavior.

`npm.cmd run typecheck`, zero-warning ESLint on changed text/export modules, and `npm.cmd run build:export` passed. The export build retains its existing module-directive/sourcemap and chunk-size warnings. `node scripts/testing/presentation-text-browser.mjs` passed real Chromium checks for main-slide font controls, inline/display equation dialogs, syntax validation, editing, undo, reload, learner preview, popup Apply/Cancel, and nested Escape; its dialog also fits a 390-pixel phone viewport. Screenshots are written under `test-results/presentation-equation-*.png`. `node scripts/testing/html-export-browser.mjs` verifies compiled single-file HTML on `file://`, with rendered inline/display formulas, loaded embedded KaTeX fonts, formatting, and no external requests. SCORM continues to package this same static runtime and local assets; a new SCORM/LMS browser run was not performed for this text slice.

This is focused verification, not a full repository test run. PDF equations are retained as LaTeX source rather than typeset formulas. Advanced spacing and the general symbol picker are deferred. The existing thumbnail footer-position failure recorded below remains separate.

## Faster Presentation Editing checks: 2026-11-03

Focused geometry/editor tests cover multi-selection, flat grouping, batch clipboard compatibility, atomic history, proportional resizing, locks, editor-only visibility, and popup Apply/Cancel. `node scripts/testing/slide-selection-browser.mjs` exercises real mouse/touch gestures at 50% and 150% zoom. `node scripts/testing/html-export-browser.mjs` checks the compiled static learner, including grouped media hidden in authoring remaining visible to learners.

Passed: 168 focused Vitest tests across 13 files, strict TypeScript (`npx tsc --noEmit`), zero-warning ESLint on the changed selection/editor modules, the static learner build, and both browser scripts above. This is focused verification rather than a full repository test run. Older interaction-button assertions were aligned with the previously requested 20-pixel button, 18-pixel icon, and 2-pixel radar defaults.

An existing failure is tracked separately in `tests/slide-thumbnails.test.tsx`, "renders actual blocks, backgrounds, frames, alignment, and branding at slide scale". Its legacy-coordinate expectation hardcodes a 368-pixel object region, corresponding to a 64-pixel footer. The current default footer is 48 pixels, so the actual region is 384 pixels: the test expects a top position of approximately 33.6296%, while the renderer gives approximately 34.2222%. This discrepancy predates the selection tools; this feature does not change the footer default or legacy coordinate conversion.

The requested Phase 15 work establishes repeatable checks, separates the large AI/editor modules, and measures 100 concurrent authors browsing and editing. It keeps the existing Next.js application and static learner export boundaries.

## Running checks

Use Node.js 24 and install the locked dependencies with `npm ci`. The full test suite needs MongoDB transactions. Install a local MongoDB 7 `mongod` binary on PATH, set `TEST_MONGOD_PATH` to its executable, or explicitly set `RBAC_TEST_MONGODB_URI` to a dedicated test replica set. Windows installations under `Program Files/MongoDB/Server` are detected automatically. The runner fails if MongoDB cannot start; it does not silently omit integration tests.

```sh
npm run check
npm run build:export
npx playwright install chromium
npm run test:e2e
```

On PowerShell installations that block `npm.ps1`, use `npm.cmd` and `npx.cmd`.

| Command | Coverage |
| --- | --- |
| `npm run check` | Zero-warning ESLint, generated route types, strict TypeScript, all Vitest tests including transactional administration tests |
| `npm run test:unit` | Explicit database-free subset, excluding `admin-integration.test.ts` |
| `npm test -- --reporter=dot` | Full suite with compact output; additional arguments pass to Vitest |
| `npm run build:export` | Standalone learner HTML/CSS/JS build |
| `npm run test:e2e` | Production build, anonymous access, workspace creation, editor autosave/reload, and private-course isolation |
| `npm run perf:authors -- --authors 100 --duration 60` | Production build followed by concurrent authenticated HTTP journeys |

Browser and performance commands build with webpack, then start the existing application on a randomly allocated loopback port. `--skip-build` reuses a previously verified production build; use it only when source files have not changed since that build. Build before deployment with the normal deployment configuration separately.

## Isolation and cleanup

`scripts/testing/mongodb.mjs` starts an owned single-node replica set with its own temporary directory and loopback port. It never loads `.env.local` or reuses application `MONGODB_URI`. It shuts down the process and removes only the temporary directory it created after completion or a handled failure. An explicit `RBAC_TEST_MONGODB_URI` remains operator-controlled: point it only at a dedicated test server. The runner does not stop that external server.

Integration tests create and drop a random `coursecraft_rbac_test_*` database. Browser/performance runners similarly own a random `coursecraft_verification_*` database. They seed synthetic users and short-lived Auth.js database sessions rather than depending on external OAuth. The child application receives a synthetic authentication secret and provider settings, the test database URI, and empty AI/cloud credentials. No real users or paid AI calls are part of these journeys. Reports contain aggregate measurements and no authentication cookies.

Generated reports, browser traces, coverage, and learner build assets remain ignored by Git and lint. Browser traces use `test-results/browser/` and workload reports use `test-results/performance/`, so rerunning browser tests preserves performance reports. CI stores `test-results/` as a short-lived artifact. These checks do not require changing `.env.local`.

## Automated workflow

[The verification workflow](../.github/workflows/ci.yml) runs on pushes and pull requests. Linux starts an isolated MongoDB 7 replica in Docker, runs `npm run check`, builds static learner assets, and executes production Chromium smoke tests. Windows runs type checking and the database-free suite, including native filesystem boundary checks. Both jobs use Node.js 24 and `npm ci`.

Manual workflow dispatch can enable the same 100-author workload after the other checks. Performance is optional in CI because shared-runner timing varies; request failures and missing author saves fail that run. No latency SLO has been chosen yet. The checked-in workflow still needs its first GitHub Actions execution; the commands were verified locally on Windows.

## Module changes

The AI coordinator shrank from about 3,700 to 1,464 lines. Provider requests, response schemas, source indexing/coverage, seed conversion, prompts, language, and image storage now have separate modules in `lib/ai/generation/`. Existing public entry points and retry/lease behavior remain in place.

The block editor shrank from about 1,688 to 291 lines. Individual settings and the preview live under its child `_components/` directory. Save/history behavior moved from the editor client to `use-editor-draft.ts`, with focused coverage for overlapping saves, returned revisions, conflicts, save-before-navigation, invalid titles, undo, and redo. This separates responsibilities without claiming a bundle-size improvement.

Baseline repairs update stale template/font/catalog expectations, isolate server-only imports in UI tests, and make filesystem tests portable. A learner-progress test now waits for the animation frame scheduled after an interaction commits, instead of assuming a fixed sleep includes that update. The storage guards now reject native filesystem roots on Windows as well as POSIX. Attachments remain manual uploads and are explicitly excluded from generated block seeds.

## Local verification: 2026-10-21

| Check | Result |
| --- | --- |
| `npm run check` | Passed: zero-warning lint, strict types, 687 tests in 80 files; includes all 35 transactional integration tests with no skips |
| Production build and Chromium browser tests | Passed: four authoring/access smoke tests |
| `npm run build:export` | Passed: static learner assets generated |

The learner build still reports existing Rollup directive/sourcemap warnings and a chunk-size warning (about 901 kB minified JavaScript, 281 kB gzip). Those warnings are not resolved by the source module split. The separate ESLint check has zero warnings.

## Local performance result: 2026-10-21

The production HTTP workload ran on Windows, Node.js v24.16.0, a 12th Gen Intel Core i7-12700KF (20 logical CPUs), and 16 GiB RAM, with the application, load generator, and MongoDB on the same machine. It used 100 virtual authors, 10 shared workspaces, 600 courses, 3,600 lessons, and 36,000 rich-text blocks.

Each author repeatedly lists personal courses, reads a course's full editor snapshot, changes a block and saves that snapshot, lists a team workspace, and loads a course preview. Authors rotate through five private courses with one second of think time between actions. The workload checks that another author's private course is inaccessible before timing begins. Concurrent authors represent active sessions; they do not imply 100 requests arrive simultaneously. Shared-course editing conflicts are not modeled.

The latest run completed at 15:15:21 UTC. The requested measurement window was 60 seconds. Journeys already in progress drained to 66.45 seconds total. There were **4,045 requests, 60.87 requests/second, and zero failed requests**. All 100 authors saved successfully; 500 distinct courses had persisted revisions.

| Endpoint | Requests | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
| Personal dashboard API | 809 | 604 ms | 1,096 ms | 1,232 ms |
| Editor read API | 809 | 303 ms | 725 ms | 821 ms |
| Editor save API | 809 | 363 ms | 788 ms | 894 ms |
| Team dashboard API | 809 | 647 ms | 1,025 ms | 1,085 ms |
| Preview page | 809 | 894 ms | 2,314 ms | 2,588 ms |

Latency covers the complete HTTP response body. The machine-readable report is generated at `test-results/performance/authors.json` on each run. Reproduce with:

```sh
npm run perf:authors -- --authors 100 --duration 60
```

This is a local baseline, not a deployment capacity guarantee. It excludes browser rendering and input latency, network/TLS delay, AI providers, media transfers, exports, concurrent editing of the same course, and long-duration behavior. The synthetic courses contain text rather than large media libraries. Preview response time is the first profiling target, followed by dashboard queries; investigate server rendering, query counts, and database timings before choosing optimizations. Deployment-sized measurements should also record resource utilization and a defined latency budget.
