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

The requested administration extension adds Super Admin workspace listings, details, name updates, and audited deletion of empty workspaces. Existing courses (including recently deleted courses) and folders block workspace deletion.

Requested Phase 15 Media Storage scope extends the existing administration and media systems with Super Admin provider switching, private persistent local storage, legacy S3 compatibility, and provider-independent HTML/SCORM/PDF publishing. No other unfinished phase is included.

Requested Phase 15 verification scope adds a reproducible full test baseline with transactional MongoDB, production browser smoke tests, CI checks, focused AI/editor module splits, and an isolated workload for 100 concurrent authors browsing and editing. Results and remaining performance limits are recorded in `docs/verification-baseline.md`. This scope does not complete all production hardening or the unfinished generation/template phases.

Requested Phase 10 slide template slice: course creation offers a Slide interactive presentation alongside the standard course. It reuses ordered lessons as slides and existing blocks, with a fitted 16:9 canvas, free object dragging and resizing, visible block content settings, a selectable layer list, master themes, a slide thumbnail rail, and dedicated presentation preview and static learner shell. Authors can insert an image cover as the first slide, edit its course title, subtitle, lesson label, image, and Start button, and retain existing slide content. The rest of Phase 10 remains unstarted.
