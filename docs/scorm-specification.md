# Standalone export and SCORM behavior

The export is a static browser application with a versioned JSON course input. It uses relative asset paths and a progress adapter interface. Local browser storage supports standalone HTML5; the SCORM adapters implement the SCORM 1.2 and SCORM 2004 LMS APIs.

Each SCORM package uses one SCO, a root `imsmanifest.xml`, and static export assets. The adapters initialize and terminate safely, handle API errors, commit changes, report completion and assessment scores, and persist lesson location and suspend data. SCORM 1.2 suspend data remains within its 4,096-character limit. Quiz scores are averaged across scored quizzes; the LMS receives score fields when a score is available and receives passed/completed status when the learner completes the course. Validate packages in the target LMS before relying on LMS-specific reporting behavior.

The browser export runtime remains independent of Next.js server APIs, MongoDB, Auth.js, and private storage credentials. SCORM-specific packaging and runtime code belongs in `lib/scorm/`, `lib/scorm12/`, and `export/src/scorm-runtime.ts`.
