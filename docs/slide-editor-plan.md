# Template-first slide editor delivery plan

The latest attachment supersedes this plan's earlier vertical-block interpretation: prebuilt interactions are freely positioned objects on a fixed canvas. See `docs/slide-master-plan.md` for the current source-level plan, implemented canvas correction, and upcoming master phases.

## Clarified product model — content blocks and timeline layers

The user's clarification supersedes the whole-slide interpretation of templates. The author creates content pages, adds prebuilt content/interactive blocks to each page, and edits every block as an individual timeline layer. Reading content, Rise-style interactive text, quizzes, audio and video belong in the same composer. The learner content menu tracks reading pages as well as activities. Existing Rise authoring remains a separate working mode.

The current implementation adds version 3 compositions while preserving version 1 canvas and version 2 template documents. It includes editable reading text, accordion, tabs, flashcards, graded single/multiple answer quizzes, images, audio/video blocks, editable layout blocks, browser preview completion, and basic timed playback/layer controls. S3 upload, owner checks, revisioned autosave, theme, and duplication are reused. Layout blocks remain structured content rather than flattened pictures.

The additional preview/timeline request adds fixed HD/Full HD authoring frames, a draggable timeline divider, pointer/keyboard edge trimming, source-duration-aware audio/video trims, and direct media-track insertion. Preview content scrolls inside the fixed frame. Panel sizing is client state; page resolution and clip timing/trim metadata use the existing revisioned save contract.

Remaining work retains the existing phase boundaries: advanced multimedia/captions/waveforms (Phase 3), additional activities/assessment and server/LMS progress (Phase 4 and publishing), animations/advanced stacking (Phase 5), and static HTML/SCORM packaging (Phase 6). These are not represented as completed controls.

This plan follows the revised slide-editor request. Its phase numbers are specific to the slide editor; the existing platform roadmap remains intact.

## Source inspection and reuse

- `models/Course.ts`, `models/Slide.ts`, `lib/slides/schema.ts`, and `lib/slides/service.ts` already provide editor selection, separate versioned slides, ownership checks, CRUD, and slide revisions. Extend these rather than introducing another content store.
- `app/courses/[courseId]/slides/edit/slide-editor-client.tsx` is currently a manual canvas with explicit saving. Replace its authoring shell with a default Simple mode, reusable panels, and a shared draft/autosave coordinator; retain canvas documents and advanced object editing.
- `app/courses/[courseId]/slides/preview/slide-player-client.tsx` is the existing slide learner wrapper. Share a browser-only presentation component with the editor, thumbnails, and gallery. Keep rendering independent of authoring selection.
- `app/api/courses/[courseId]/slides/**`, `lib/workspaces/access.ts`, and `lib/dashboard/http.ts` provide authenticated course permissions, validated request bodies, origin checks, and stable errors. Use the same pattern for slide themes and template creation.
- `app/courses/[courseId]/edit/_components/media-library-dialog.tsx`, `lib/media/services/**`, and `lib/media/storage.ts` provide the course-scoped media library and private S3 upload/read lifecycle. The clarified composer extends the same MIME contract/picker to audio rather than introducing a second upload service.
- `lib/media/asset-references.ts` already recursively collects and remaps nested media URLs. `lib/dashboard/services/course-duplication.ts` must preserve template content and slide themes when copying courses.
- `lib/editor/theme.ts` is the completed block-course theme contract. Add a separate slide theme contract on `Course` so responsive block themes retain their current behavior.
- Existing Rise block templates/renderers remain intact. Reuse browser-independent assessment logic and media services; the new block registry defines composable page layers rather than treating a template as an entire course page.
- `app/api/courses/[courseId]/publish/route.ts`, `lib/scorm/package.ts`, `export/src/main.ts`, and `export/src/scorm-runtime.ts` provide the existing block exporters, ZIP/manifests, and LMS runtime. Slide export remains a separate publishing phase. Shared slide presentation code must avoid Next.js APIs and database imports in preparation for that phase.
- Use the configured `components/ui` primitives for dialogs, buttons, fields, selection, and checkbox controls.

## Phase 1 — Foundation completion

Preserve existing version 1 canvas slides and add a tested draft coordinator with debounced autosave, revision reconciliation, conflict preservation, undo/redo, and visible save states. UI selections, device previews, and editing mode remain client state.

## Phase 2 — Template-first authoring (current delivery)

1. Add `lib/slides/template-definitions.ts`, `template-schema.ts`, and `templates.ts`: a versioned registry, validated text/image/list/button slots, twelve core content templates, compatible-slot preservation, retained incompatible content, and design-only reset.
2. Extend `lib/slides/schema.ts`, `models/Slide.ts`, and `lib/slides/service.ts` with structured version 2 template data. Continue reading version 1 canvas documents. Validate template identities, versions, required slots, media URLs, and slot types server-side.
3. Add `lib/slides/themes.ts`, course slide-theme persistence, and a permission-checked `slides/theme` API with an independent revision. Provide six theme presets and safe typography, density, radius, card, and button controls. Apply themes without rewriting slide content.
4. Add shared browser-only slide surfaces under `components/slides`: structured responsive layouts, editable content selection, accurate thumbnails, and legacy canvas rendering. Stack columns on narrow viewports and keep buttons readable and touch-friendly.
5. Rebuild the slide editor shell with reusable components: visual searchable template gallery, template-aware Content/Design inspectors, Simple/Advanced mode, slide actions, viewport controls, themes, autosave, and error recovery. Add Slide opens the gallery. Template replacement and layout variation preserve compatible content; manually positioned slides receive a safe new-slide alternative.
6. Update the dedicated player to use the same surfaces and themes. Extend course/slide duplication to preserve all structured content independently and remap nested media.
7. Add focused tests for every template contract, content preservation, legacy parsing, autosave races/conflicts/history, server persistence and permissions, and the user-facing gallery/editing flow. Run TypeScript, lint, production build, and the relevant regression suites. Document actual results.

## Phase 3 — Multimedia (core blocks implemented; expansion pending)

Audio and video blocks, supported audio S3 uploads, transcripts, non-destructive trim, volume, loop and timeline synchronization are implemented. Captions, fades, waveform previews and richer combinations remain pending. Preserve original media and package references.

## Phase 4 — Interactivity (core blocks implemented; expansion pending)

Accordion, tabs, flashcards and quizzes with feedback/passing score/retry are implemented as editable page blocks. The learner menu supports ordinary reading completion and required activity completion, with actor/course-scoped browser preview storage. Keep existing declarative canvas actions. Hotspots, additional assessments, full attempt/resume storage, server learning records and branching remain pending.

## Phase 5 — Timeline and layers (basic playback implemented; expansion pending)

Validated block tracks, start/end fields, page duration, collapsed timeline UI, playback/scrubbing, rename/reorder/visibility/lock/duplicate/delete tools and media synchronization are implemented. HD/Full HD preview frames, draggable timeline sizing, pointer/keyboard trim handles and direct audio/video track insertion are implemented. Animation presets, advanced overlays, event cues and reduced-motion animation behavior remain pending.

## Phase 6 — Publishing (pending)

Bundle the shared slide renderer/runtime through the existing static export build boundary. Add HTML and SCORM strategies with owned local assets, quiz/completion reporting, resume, and LMS validation. Existing block exporters continue using their current strategy.

## Phase 7 — Advanced tools (pending)

Add private/shared user templates, authorized management, advanced positioning/timeline tools, branching scenarios, additional animations, and separately validated slide-oriented AI generation.

The clarified request expands the current delivery to the core block composer and its media, learner-menu and timing prerequisites across Phases 3–5. Later phase capabilities must not be represented by nonfunctional gallery templates or enabled publishing buttons.
