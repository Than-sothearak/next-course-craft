# Delivery roadmap

Work one phase at a time; stop after the requested phase.

1. **Foundation:** Next.js, TypeScript, MongoDB/Mongoose, Auth.js, shared schemas, UI/tooling, tests, and static export build boundary.
2. **Dashboard and folders:** folder tree, course CRUD, search, breadcrumbs, and organization.
3. **Lesson editor:** sections, lessons, block editing, ordering, autosave, and persistence.
4. **Core blocks and media:** content rendering, media library, validation, and storage.
5. **HTML export:** standalone learner experience, navigation, progress, preview, and HTML5 publishing.
6. **SCORM 1.2:** validated snapshot, manifest and schema files, shared static export runtime, LMS runtime, resume/completion tracking, media packaging, and focused tests.
7. **Interactive blocks:** learner-answerable knowledge checks, author-configurable answer feedback, rating surveys, shared preview/export rendering, and focused tests.
8. **Quizzes and assessments:** author-set passing scores, graded attempts and retry, persisted assessment results, course navigation gating, SCORM score reporting, and focused tests.
9. **Themes and branding:** saved course palettes, custom brand and accent colors, typography options, themed course and lesson previews, and export parity.
10. Templates.
11. **Advanced navigation:** searchable and collapsible learner course outline, per-section completion summaries, and course-level free, sequential, or restricted lesson progression across preview and standalone export.
12. **Additional publishing formats:** downloadable PDF course handout with owner-scoped images and learner-safe quiz prompts.
13. **Team collaboration:** shared workspaces, owner/admin/editor/viewer roles, email-bound copyable invitations, and workspace-scoped courses and folders.
14. **AI generation:** prompt and document ingestion, structured course drafts using existing blocks, optional generated images, and author review/apply.
15. Production hardening.

Current status: Phases 1 through 9, 11, 12, and 13 are complete. Phase 14 AI generation remains in progress by request; Phase 10 is unstarted.

Requested Phase 15 administration scope is implemented: account approval, immutable Super Admin bootstrap, constrained platform RBAC, administration dashboards, explicit course assignments, ownership transfer, current database authorization, transactional audit logs, and focused security/regression verification. Deployment requires the explicit migration and bootstrap steps in `docs/admin-operations.md`. Other production hardening remains outside this administration scope.

## Interactive editor initiative — content blocks and timeline layers

These phase numbers follow the revised slide-editor request and are separate from the platform phases above. See `docs/slide-editor-plan.md` for source-level boundaries and `docs/slide-editor-testing.md` for verification and manual checks.

1. **Foundation — complete:** separate editor mode, legacy-safe canvas schema, ownership-scoped CRUD, navigation, revisioned autosave, local conflict preservation, and content undo/redo.
2. **Template-first authoring — complete for core content:** twelve built-in content templates, visual searchable gallery, structured editable slots, safe design replacement/reset, six course themes, per-slide design controls, Simple/Advanced mode, and responsive desktop/tablet/mobile previews using shared presentation components.
3. **Multimedia — core blocks implemented:** reusable S3 picker supports audio alongside images/video. Audio/video blocks have transcripts, trim metadata, volume/loop and timeline playback. Captions, fades, waveforms and richer multimedia presets remain pending.
4. **Interactivity — core blocks implemented:** composable accordion, tabs, flashcards and graded quiz blocks, shared quiz grading, feedback/retry, learner content menu, ordinary reading completion and required activity completion. Preview completion is browser-local and actor/course scoped. Hotspots, additional assessments, detailed attempt/resume records, server reporting and branching remain pending.
5. **Timeline and layers — core implementation complete:** version 3 pages combine editable blocks as layers, with validated timing, duration, play/pause/scrub, media synchronization, rename/reorder/hide/lock/duplicate/delete. The editor has fixed HD/Full HD preview frames, a draggable timeline divider, whole-clip movement, pointer/keyboard trim handles, adaptive ruler zoom/fit, snapping, icon transport, preview audio mute/solo/gain and direct audio/video track insertion. Gesture previews commit once through existing history/autosave; browser workspace preferences stay outside the course document. Media trims preserve source files and respect loaded source duration. Animations, cues, waveform previews and advanced overlay stacking remain pending.
6. **Publishing — pending:** existing block HTML/SCORM exports continue using their existing strategy. Slide HTML/SCORM publishing and LMS validation are not implemented.
7. **Advanced tools — pending:** personal/shared user templates, branching scenarios, advanced timing/positioning, and slide-oriented AI generation.

The latest clarification defines **fixed canvas → freely positioned prebuilt interactive objects → independent timeline layers**. Add page creates a blank canvas; Add object opens the object library. Prebuilt layouts insert independently editable objects. Older structured content remains editable and retains its authored slots. Populated legacy canvases keep their original editor. Platform Phase 10's user/platform template management remains unstarted; the registry contains built-in definitions only.

## Slide Master initiative — current attachment

See `docs/slide-master-plan.md` for the source-level plan. The free object canvas correction is implemented first: fixed design size, move/resize/rotate, object styling, overlap/stacking, prebuilt interactive objects and independent timeline integration.

1. **Master architecture — complete:** validated course-owned master, sparse per-slide inheritance/overrides/reset, protected safe area and shared editor/learner/thumbnail renderer.
2. **Institutional Green — complete:** angled/straight header, owned institution logo, geometric background, configurable footer and automatic/manual/hidden slide numbering.
3. **Theme management — core complete:** preset preview, live master editor, apply/cancel/reset/history and current/all-slide scope. Reusable private/shared master library and additional master presets remain pending.
4. **Content editing expansion — safe areas complete:** foreground objects map into master content bounds without rewriting source geometry/timing. Rich text, crops, tables/icons, multiselect and grouping remain pending.
5. **Timeline expansion — immediate professional upgrade complete:** protected master track, whole-clip move/trim, icon playback, ruler zoom/fit, snapping and preview audio monitoring. Header/footer remain visible throughout playback. Animations/events, waveforms, split/group/ripple editing and cue synchronization remain pending.
6. **Publishing — planned:** shared master/object static HTML/SCORM runtime, packaged media and LMS regression checks.
