# Standalone player and future SCORM specification

The player is a static browser application with a versioned JSON course input. It must use relative asset paths and a progress adapter interface. Local browser storage supports standalone HTML5; a future adapter will implement the SCORM 1.2 LMS API.

The future SCORM 1.2 package uses one SCO, a root `imsmanifest.xml`, and static player assets. The adapter must initialize and terminate safely, handle API errors, commit changes, report completion and raw score, and persist lesson location and suspend data. Suspend data must remain within the SCORM 1.2 4,096-character limit. Export validation and LMS compatibility claims require actual package and LMS tests.

Phase 1 creates only the architectural boundary and build entry point. Runtime tracking, manifest generation, ZIP export, and LMS integration are out of scope until the SCORM phase.
