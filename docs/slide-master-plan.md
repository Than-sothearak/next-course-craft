# Slide Master and free object canvas plan

## Confirmed product model

In this editor, a prebuilt object is an independently positioned interactive component. It can be moved, resized, rotated, overlapped, styled, stacked, and timed on a fixed HD/Full HD canvas. Accordion, tabs, flashcards, quizzes, media, shapes, and buttons are objects. A content layout inserts a set of independent placeholder objects. The existing Rise editor continues to use its own responsive block model.

The supplied screenshot defines Institutional Green: a green angled header, white logo region, pale geometric triangles and a green footer with a numbered circle. The implemented preset uses editable React/CSS/SVG; it does not embed the screenshot.

## Canvas correction — implemented first

- `lib/slides/blocks.ts`: validated object placement and appearance, vector shapes/navigation buttons, explicit canvas/legacy-flow layout.
- `lib/slides/object-canvas.ts`: canonical 1280×720 design grid, bounded placement/resize, stable stacking independent of timeline timing, content-preserving normalization.
- `lib/slides/object-layouts.ts`: twelve content layouts create independent objects with validated initial bounds.
- `components/slides/object-canvas-surface.tsx`: fixed scene, absolute object positions, pointer/keyboard selection/move/resize, lock handling, per-object content bounds. Hiding one object never reflows another. Fully transparent objects do not intercept learner input.
- `components/slides/learning-page-surface.tsx`: shared functional interactive-object rendering. `fixed-stage-viewport.tsx` scales the composition to fit the workspace; Full HD scales the complete design rather than changing individual positions.
- `app/courses/[courseId]/slides/edit/_components/object-inspector.tsx`: independent object geometry, typography, colors, opacity, shapes and button content/actions.
- Existing `learning-page-editor.tsx`, `page-timeline.tsx`, `draft-store.ts`, `service.ts`, slide APIs and course duplication retain ownership, revision checks, history, media and trim metadata.
- `learning-course-player.tsx` and `slide-surface.tsx` use the same placement for learner preview and resolution-aware thumbnails. Explicit legacy flow documents remain readable; unpositioned canvas objects receive deterministic initial bounds and persist them when edited.

## Phase 1 — Master architecture (implemented)

1. Add `lib/slides/master-schema.ts` for a versioned master document: background, header, logo, content region/safe bounds, footer, numbering and typography. Use bounded geometry, safe media sources and declarative decorative shape definitions. Reject executable SVG/JavaScript and external object references.
2. Extend `lib/slides/themes.ts` and `models/Course.ts` with an optional course-owned master within `Course.slideTheme`, using the existing `slideThemeRevision` save boundary. A course keeps an independent master copy; no edits to one course may affect another.
3. Add strict per-slide master overrides in the composition schema. Merge overrides at rendering time, preserving inherited values for every unmodified field. Keep title/manual number overrides separate from common header/footer styles.
4. Extend `saveSlideCourseTheme` media validation in `lib/slides/service.ts` to require ready, course-owned image assets for logos/backgrounds. Course duplication must remap these nested references through the existing recursive media utilities.
5. Add browser-only `components/slides/master-surface.tsx`: background → protected header/footer → bounded object canvas. Map saved object bounds into the protected content safe region; inverse pointer conversion respects both axes. Object source geometry and timing are not rewritten when applying a master. Decorative elements must ignore pointer events; master controls are editable only in the master editor.

## Phase 2 — Institutional Green reference preset (implemented)

1. Add one master preset before expanding the gallery: green `#199B5B`, white title, angled CSS/SVG banner, replaceable logo placeholder, pale geometric triangles and a configurable green footer.
2. Use editable color, height, typography, padding, corner, logo-size/position and visibility settings. Do not flatten the theme into an image.
3. Derive numbering from current slide order plus the master start value. Support per-slide hide/manual numbering. Reordering must update thumbnails and learner presentation immediately without rewriting content objects.
4. Verify existing content, interactions and media timing survive master application and overrides.

## Phase 3 — Master editing and theme management (core editor implemented; library pending)

1. The theme gallery shows an actual master thumbnail; the master editor supports course/current-slide application. Existing palette records remain readable.
2. `_components/master-editor.tsx` provides local draft preview, explicit apply/cancel, reset and local undo/redo. Applied course changes use the existing revisioned theme draft store, with Undo theme / Redo theme in the toolbar. Per-slide changes use the slide draft store.
3. Reuse the S3 media picker for logo/background images. Add Academic Blue, Corporate Minimal, Modern Dark, Creative Gradient and Clean White after the first preset/inheritance checks pass.
4. Add an owner-scoped saved-master library with timestamps/indexes and permission-checked routes. Applying a library theme makes a course-owned copy. Shared/library updates cannot silently rewrite existing courses.

## Phase 4 — Content editing expansion

Extend the working object canvas with content safe areas, rich text, crops/posters, tables/icons, grouped layouts, multiselect, group/ungroup, context menus and alignment tools. Preserve stable object IDs, semantic interaction data and source media. Layer order controls visual stacking; timeline timing controls visibility independently.

## Phase 5 — Timeline and interaction expansion

The working media insertion, resizable panel, trim handles and playback engine now include a protected always-visible master track. The immediate professional upgrade adds whole-clip dragging, adaptive ruler/zoom, snapping, icon transport, preview audio monitoring and transient gesture commits; see `docs/slide-timeline-plan.md`. Animation/event markers and media completion cues remain pending. Master visibility/animation is changed only through supported master settings.

## Phase 6 — Publishing and regression verification

Extend the existing static export build and packaging services with the same master/object renderer and validated snapshot. Package owned logos, backgrounds, images, audio and video; reuse existing LMS completion/resume adapters. HTML/SCORM output must run without CourseCraft/MongoDB/server APIs. Verify numbering, media/interactions, previews, thumbnails, permissions and existing Rise publishing. Slide publishing stays disabled until this runtime/packaging phase is functional.

## Current boundary

Implemented: versioned course master in `Course.slideTheme`, independent theme revision checks, strict sparse slide overrides, reset to master, Institutional Green, shared editor/learner/thumbnail rendering, protected safe area, always-visible master track, local preview/apply/cancel/reset/history, automatic/manual/hidden numbering, owned image picker and server validation, and nested asset remapping on course duplication. The six existing palettes remain available.

Foreground boxes map from the existing 1280 by 720 object grid into the master safe area. Text and interactive contents reflow or scroll inside their mapped boxes; images/videos retain their media fit behavior. Disabling the master restores the full canvas without changing saved object bounds. Legacy template/canvas content is fitted inside the safe region without rewriting its content document; top-level master/numbering metadata provides their per-slide overrides and reset controls. Existing explicit flow pages use the fixed canvas when a master is enabled.

Pending: reusable private/shared master library, additional master presets, rich text/grouping/crops, advanced animations/cues, and static slide HTML/SCORM publishing. These are later phases and are outside the Institutional Green implementation.

Operational note: restart a running development server after changing the cached Mongoose Course/Slide schemas. Existing courses need no data migration; an absent master retains previous rendering.
