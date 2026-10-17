# Interactive object canvas verification

## Completed delivery

The revised request's Phase 1 foundation and Phase 2 core content authoring are implemented. The editor supports twelve built-in content layouts, structured content slots, independent theme/design settings, autosave with revision conflicts, content undo/redo, safe template replacement, course-media image selection, and responsive preview. Existing canvas slides remain editable and preserve their objects, states, and actions.

The latest clarification defines schema version 3 compositions as a fixed canvas with freely positioned prebuilt interactive objects. Text, accordion, tabs, flashcards, quizzes, images, audio, video, shapes and buttons can be independently moved, resized, rotated, styled, overlapped, stacked and timed. Prebuilt layouts insert independent editable placeholders. The learner menu retains reading/required-activity completion and browser preview storage. Audio uploads use the existing S3 lifecycle. See `docs/slide-master-plan.md` for the separate master architecture/reference-theme phases.

Slide Masters/Institutional Green, grouping/multiselect, animations, waveform previews, captions, server learning records, full attempt/resume storage, slide HTML/SCORM export, shared templates and slide AI generation remain later-phase work. Publish and Export stay disabled. No LMS/SCORM validation is claimed for the new editor.

## Free object canvas manual checks

1. Add a page and verify it is a blank fixed canvas. Use Add object to insert text, tabs, media, shapes and a button.
2. Drag an object independently. Resize its bottom-right handle; set X/Y, width/height, rotation and appearance in the inspector. Move/resize must stay within the canvas.
3. Overlap objects and change their layer order. Geometry and timeline start/end must stay intact. Hide an object on the timeline; another object's position must stay unchanged.
4. Use a prebuilt object layout on a blank canvas. Heading, body, image/cards/button placeholders must be individually editable and independently positionable.
5. Switch to timing/learner preview. Tabs/accordion/flashcards/quiz/buttons must run without authoring selection overlays. Compare saved placement with thumbnails and HD/Full HD preview.
6. Lock an object and confirm pointer, keyboard and inspector placement changes are disabled. Undo a drag, save/reload, duplicate the slide/course and verify geometry and media remain independent.

## Content composer manual checks

1. Create an Interactive Slide Course. Its Welcome page contains an editable prebuilt layout block. Existing Rise courses still use their original block editor.
2. Use Add block to combine reading text, accordion, tabs, flashcards and quiz on one page. Edit each block independently. Add a prebuilt layout block and verify the existing content remains.
3. Use Add page to create an independent content page. Reorder, duplicate and delete pages from the content menu.
4. Add audio/video blocks, choose course media or upload supported files, and edit transcript, trim, volume and loop. Verify the original asset is preserved. S3 configuration is required for real uploads.
5. Open Timeline & layers. Change page duration and each layer's start/end. Scrub and play to check appearance and audio/video synchronization. Confirm timing changes do not reorder the blocks. Hide, lock, reorder, duplicate and delete a layer, then reload after saving.
6. Preview the course. Mark a reading page complete. A required interaction must be fully explored and a quiz passed before its page can be marked complete. The content menu must show completed pages independently of current page position.
7. Reload preview in the same browser/account and verify completion is restored. Edit/save the page and verify the old revision's completion is invalidated. Another account must not inherit that preview progress.
8. Duplicate the course and verify block content, timeline and nested media are independently copied. Check a legacy canvas still uses its original editing controls.

## Fixed preview and draggable timeline checks

1. Select HD or Full HD in Preview frame. Verify the logical size remains 1280×720 or 1920×1080 as blocks are added, edited or hidden. Long content should scroll inside the frame. Saving/reloading should retain the selected resolution.
2. Open Timeline & layers and drag the horizontal divider. The timeline should gain/lose height and the fixed preview should refit without changing its aspect ratio. Arrow keys resize the focused divider; Home/End use its limits. Adding a block must retain the current panel height.
3. Drag a track's start/end handles. The saved interval must stay inside the page, handles must not cross, and locked layers must reject edits. Arrow keys adjust a focused handle by 0.1 seconds; Shift adjusts by 1 second. One pointer gesture should undo as one change.
4. Use Add audio track / Add video track. Upload or choose a course-owned file through the existing picker. Loaded metadata should show source duration and initialize clip length. Trim both edges and verify playback uses the source in/out points while retaining the original asset URL. Replacing a file must clear its old trim/duration metadata.
5. Use the Start field to delay a complete clip without cutting away its beginning. Drag an edge to trim source content. Verify undo/redo and reload preserve both schedule and source trims.

Automated coverage is in `tests/slide-timeline.test.ts`, `tests/slide-timeline-browser.test.tsx` and `tests/learning-page-ui.test.tsx`. The browser tests mount real client components and exercise mouse capture, resizing, fixed frames, source-bound trimming and keyboard controls. They do not use a live database or S3 account.

## Automated checks

### Immediate professional timeline upgrade — 2026-10-17

- Full suite: **704 passed, 27 database integration tests skipped** (84 files passed, one skipped).
- TypeScript, project lint and the Next.js production build passed. The existing block export build passed with its existing client-directive/sourcemap, dependency annotation and bundle-size warnings. `git diff --check` passed; the existing development-types change in `next-env.d.ts` was preserved.
- Coverage includes millisecond conversion/stability, duration-preserving clip moves, implicit-end clips, source trims, zoom-aware snapping, Alt bypass, locks, cancellation, a single completed-gesture commit/undo/redo, live canvas/inspector selection, preview mute/solo/gain, stored workspace preferences and a coordinated seek/end/loop clock.
- Chromium checks exercise whole-clip dragging at multiple zooms, ruler scrubbing, icon controls, zoom/fit, the existing trim handles and fixed-frame/divider behavior. The 100-track smoke check passes with vertical scrolling and no clip DOM mutations during playback. It does not measure decoding many large media assets simultaneously.
- Inspected screenshot: `test-results/professional-timeline.png`. The timeline defaults to a dark interface with an optional light palette. Zoom, snapping, palette, panel height and name-column width persist as browser preferences; source volume and authored slide content are unaffected by audio-monitor settings.
- Manual workflow: drag a clip body to move its complete range; drag either edge to trim; use the magnet or Alt to control snapping. Zoom with +/− or the slider, use Fit to restore the whole duration, and scrub the ruler. Speaker/headphone icons control preview mute/solo; the toolbar speaker and gain slider control the whole preview mix. Escape discards an active drag. Undo after release restores the entire gesture.
- Accepted scope and later phases: `docs/slide-timeline-plan.md`. Waveforms, split/group/ripple editing, keyframes, event tracks and slide HTML/SCORM export remain outside this immediate upgrade. Existing block export remains the regression boundary. No live database/S3 or LMS integration was exercised.

### Institutional Green master verification — 2026-10-17

- Full suite: **687 passed, 27 database integration tests skipped** (82 files passed, one skipped).
- TypeScript, project lint and Next.js production build passed.
- Existing block learner export build passed with its existing client-directive/sourcemap, dependency annotation and bundle-size warnings. Slide publishing remains disabled.
- New focused coverage: `slide-master.test.tsx`, `slide-master-ui.test.tsx`, `slide-master-browser.test.tsx`, plus master persistence and duplication cases in the existing service suites.
- Verified strict schema validation, actual Mongoose Course/Slide serialization without database access, sparse inheritance, reset, course-owned image checks, revisioned metadata saves, nested asset remapping, missing master-only media detection and numbering after reorder.
- Real Chromium checks exercise safe-area pointer conversion, fixed HD/Full HD dimensions, protected master decorations/tracks, persistent header/footer while scrubbing, preview/cancel/apply, and existing foreground interactions. Screenshots were inspected at `test-results/institutional-green-editor.png` and `test-results/institutional-green-canvas.png`.
- Conflicting bounds are blocked before applying a master and validated again on the server. Concurrent or stale conflicting drafts retain their overrides and render the course master as a fallback instead of crashing the canvas.
- No live MongoDB/S3 upload or LMS integration was exercised. Database integration skips do not count as database verification. No new environment variables or data migration are required; restart the development server to reload cached Mongoose Course/Slide schemas.

#### Teacher acceptance workflow

1. Open a slide course, choose **Theme → Institutional Green**, and close the gallery.
2. Open **Edit Slide Master**. Choose the institution logo through the existing course media picker; upload it there if needed. Set shared header/footer, background, content padding and numbering. Use Apply to **All inheriting slides**, then **Apply master**.
3. Edit each **Page title** (or **Slide name** on an older canvas/template). Header titles use that slide's title.
4. Use **Add object** for text, images, shapes, audio/video, buttons and interactions. For separate text/image placeholders, choose the prebuilt **Text + Image** layout. Move/resize/rotate and reorder foreground objects in their content safe area. Complex content scrolls inside its own fixed object box.
5. Use **Edit this slide’s master** for a sparse current-slide override. Test local undo/redo and Cancel; use **Reset to master** to clear master and number overrides. Older canvas/template slides retain their original content version.
6. Set a slide number override or hide it; otherwise numbers follow current course order and the shared start value. Move a slide up/down and verify its header/footer, learner preview and thumbnail.
7. Scrub the timeline and trim audio/video. The master remains visible throughout; original asset URLs and source trim metadata remain intact.
8. Wait for **All changes saved**, reload, and compare logo/footer, slide titles, object placement and trim settings. Reopen the existing Rise editor and preview/publish its normal block course as a deployment regression check.

Earlier canvas verification — 2026-10-17: full suite **666 passed, 27 database integration tests skipped**; project lint and production build passed. The build's TypeScript check passed. Real-client Chromium checks cover object move/resize/interaction, stable placement after hiding, pointer track trims, divider resizing, keyboard controls and HD/Full HD dimensions. Four content-composer/legacy-flow browser checks and the existing 38 template checks also passed. Screenshots were inspected. Browser teardown permits 30 seconds for resource contention; the initial build-concurrent run passed every assertion but hit the earlier 10-second browser cleanup timeout, and the complete rerun passed. Live S3 uploads and database/LMS integration were not exercised.

Run from the existing project root:

```sh
npm run typecheck
npm run lint
npm run build
npm run build:export
npm test
```

Focused slide verification:

```sh
npm test -- tests/learning-page.test.ts tests/learning-page-ui.test.tsx tests/learning-page-browser.test.tsx tests/slides-schema.test.ts tests/slide-templates.test.ts tests/slide-autosave.test.ts tests/slide-service.test.ts tests/slide-routes.test.ts tests/slide-template-editor.test.tsx tests/slide-player.test.tsx tests/slide-layout-browser.test.tsx tests/course-duplication.test.ts tests/course-author.test.ts
```

The browser layout suite uses Playwright Chromium. Install it once with `npx playwright install chromium` in environments without the project's browser dependencies. It checks all twelve templates at 1280, 768, and 390 pixels, verifies column reflow, long-text visibility, and touch target sizes, and writes desktop/mobile screenshots to `test-results/`. Generated browser reports are excluded from source linting. Database administration integration tests require a dedicated `RBAC_TEST_MONGODB_URI`; skipped integration tests are not database verification.

## Earlier template foundation verification — 2026-10-16

- `npm run typecheck`: passed.
- `npm run lint`: passed across the project.
- `npm run build`: passed with the final template/theme changes.
- `npm run build:export`: passed for the existing block learner runtime. Vite reports existing client-directive/sourcemap and bundle-size warnings; no slide publishing is implied.
- `npm test`: 580 passed, 27 database administration integration tests skipped; 71 test files passed and one integration file skipped.
- Chromium layout checks: all 38 passed. Desktop and mobile screenshots were inspected.
- `git diff --check`: passed. The pre-existing `next-env.d.ts` development-types change was preserved across builds.

The existing Continue-gate tests now wait for the progress effect's scheduled animation frame after React commits a click. This corrects their timing-sensitive assertions without changing block learner behavior.

## Earlier template authoring regression checks

1. Open an existing version 2 template page with course edit permission. Existing Responsive Courses should still open the block editor.
2. Click **Add block**, then **Prebuilt layout block**. Search/filter and choose **Text + Image**. The same page should retain its original layout as an editable block and append the selected layout block.
3. Click the heading directly and type. Edit the description in the Content panel. Wait for **All changes saved**, reload the page, and verify the authored content remains.
4. Click **Choose image**, upload/select an image through the existing course media library, and provide an image description. Verify that the editor and learner Preview show the same image and text. Valid S3 configuration from `.env.example` is required for uploads.
5. Open **Theme**, choose **Dark Presentation**, and adjust typography or spacing. All template slides should change together while text, media, and list items stay intact. Canvas slides retain their authored object styling.
6. In the Design panel, choose a layout variation and change spacing/image fit. Use **Reset design** and confirm that the content remains. Replace an image template with **Title + Description**, then return to an image template; the image should be restored from retained content.
7. Choose **Two-Column Content** or **Three-Column Cards**. Edit, add, reorder, and remove items. Switch between Desktop, Tablet, and Mobile preview. Mobile should stack cards/columns and remain readable without horizontal scrolling.
8. Toggle **Simple** and **Advanced** without changing content. Reopen an older canvas page and confirm its content and interactions remain available. Add, drag, resize, restyle, reorder, and hide legacy canvas objects; use the arrow keys to move a selected object.
9. Use **Undo slide edit** and **Redo slide edit**, including after an autosave. Reload to verify the final choice was saved. Slide list additions/deletions are separate server operations; content history does not recreate deleted slides.
10. Duplicate a slide and edit the copy. The original must remain unchanged. Duplicate the course from the dashboard and confirm its template slots, retained media, theme, and canvas navigation actions are copied independently.
11. Open the same slide in two tabs. Save an edit in the first, then edit the stale copy. The stale tab should show a conflict, keep its local content, and offer draft download/reload. It must never overwrite the newer server revision silently.
12. Use an assigned Viewer account to preview. It must not be able to edit slides or themes through either the UI or direct API requests. Repeat with an assigned Editor to verify the parent course owner scope is used correctly.
13. Preview a cover template and use its navigation button. Then preview an existing canvas slide with show/hide/state/feedback actions. Learner interactions should run without showing editing selection or panels.
14. Reopen an existing block course, edit content, preview, and export HTML/SCORM using the existing publishing controls. Those formats continue using the completed block runtime.
