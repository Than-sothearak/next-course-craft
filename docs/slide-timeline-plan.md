# Professional timeline — immediate upgrade

## Accepted scope

The 2026-10-17 Premiere-inspired brief describes a larger seven-phase initiative. The author selected the immediate upgrade: drag/trim, icon playback, zoom, snapping and audio monitoring. This extends the existing slide editor and its revisioned saves. Animation/keyframes, event tracks, waveform analysis, non-destructive split and slide HTML/SCORM publishing remain later work.

## Implemented architecture

- The existing `page-timeline.tsx` entry delegates to `timeline-panel.tsx`; `timeline-track.tsx` renders memoized clip rows with stable object IDs and selection shared with the canvas/inspector.
- `lib/slides/timeline.ts` centralizes millisecond arithmetic, time/pixel conversion, formatting, adaptive tick intervals and screen-space snapping. Stored seconds remain compatible with the current composition schema; edits are quantized to milliseconds without a migration.
- Dragging a clip body moves the complete time range while preserving its duration, source URL, source in/out, geometry and visual order. An open-ended clip acquires an explicit end when moved. The numeric Start field can delay an open-ended reveal without cutting source content.
- Dragging edges changes the visible range or media source in/out. Bounds, locks and loaded source duration still apply. Snapping targets the playhead, other clip edges and slide boundaries; Alt bypasses it.
- Pointer movement updates a transient preview layer shared with the canvas/inspector. Pointer release commits one existing draft-store operation. Escape, pointer cancellation, lost capture, or undo during an active gesture discard the preview. Playback and pointer frames never generate revisioned saves.
- Playback uses one `requestAnimationFrame` clock derived from elapsed browser time. Seek resets the clock anchor; stop/end and optional loop are coordinated with the existing media renderer. Ruler scrubbing and keyboard controls update the same playhead.
- Icon controls provide play/pause, stop, beginning/end, step, loop, zoom, fit, snapping, audio/video insertion, light/dark appearance and timeline maximize/restore. Buttons retain accessible names and tooltips. Native inputs, clip handles and buttons keep their keyboard behavior; panel shortcuts avoid editable controls.
- Horizontal/vertical scrolling keeps track names, ruler and numeric fields available. The track-name column and panel height are resizable. Browser preferences for zoom, snapping, palette, column width and panel height are validated separately from authoring documents and survive panel reopen/slide switching/reload when local storage is available.
- Global monitor gain/mute and per-track mute/solo affect actual audio/video elements in editor preview. Authored media volume and source metadata remain unchanged; monitor state does not enter learner progress or MongoDB. Deleting a soloed track reconciles its preview monitor state. Hidden/unmounted playing media is paused.
- Master background/header/logo/footer/number remain a protected, persistent track. No shared master data is duplicated into content layers. Existing Rise rendering/publishing and ownership-scoped S3 flows remain in place.

## Verification

Focused tests cover time conversion, millisecond stability, clip movement, source trims, snapping, locks, long-gesture commit/undo/redo, cancellation, live inspector updates, browser preferences, actual media mute/solo/gain, playback seek/end/loop and master regression.

Chromium tests cover dragging at multiple zoom levels, ruler scrubbing, icon controls, fit, original audio/video trim handles, viewport resizing, and 100 visible track records. The 100-track smoke benchmark permits two seconds to populate the timeline on the test machine; a mutation observer confirms that clip DOM remains unchanged while the CSS playhead advances. This is not a benchmark for decoding 100 simultaneous large media files. No waveform or video-thumbnail extraction is claimed.

Screenshots: `test-results/professional-timeline.png` and `test-results/institutional-green-editor.png`. Final full-project check results are recorded in `docs/slide-editor-testing.md`.
