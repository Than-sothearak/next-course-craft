# Architecture

Coursecraft is one Next.js App Router application. Server routes and server components handle authentication, persistence, authorization, and authoring APIs. Client components provide the interactive authoring experience.

## Boundaries

- `app/`: routes, layouts, and API handlers.
- `components/`: reusable authoring and learner UI.
- `lib/db/`: cached MongoDB connection and Mongoose model registration.
- `lib/auth/`: Auth.js configuration and server session helpers.
- `lib/schemas/`: versioned, runtime-validated content contracts shared by authoring, preview, and export.
- `lib/export/`: shared export runtime logic and learner progress interfaces.
- `lib/dashboard/`: validated folder/course operations, ownership-scoped queries, and dashboard request helpers.
- `lib/<domain>/services/`: server-side operations grouped by the dashboard, editor, and media page/API areas that use them.
- `export/`: standalone static export entry point and build configuration. It must not import Next.js server code, MongoDB, Auth.js, or private storage credentials.
- `models/`: Mongoose models; lessons and assets are independent documents rather than a giant course document.
- `tests/`: Vitest unit tests and Playwright end-to-end tests.

The standalone export runtime is bundled separately by Vite as a build tool inside this repository. Its build output consists only of static HTML, CSS, and JavaScript. The authenticated HTML publishing route embeds that bundle, the validated course snapshot, and owner-scoped course media in one downloadable HTML file. The SCORM 1.2 publishing route packages the same compiled export runtime with a validated snapshot, owner-scoped media, the root-level `imsmanifest.xml`, and the referenced schema files. SCORM 2004 uses the same runtime and packaged media with its own manifest and `API_1484_11` adapter. The browser-only export saves resume and completion state through either LMS API when available; without an LMS it falls back to browser storage.

The browser-only learner view lives in `app/courses/[courseId]/preview/course-preview.tsx` and is shared by the authenticated preview route and the standalone Vite entry point. App-only navigation and publishing actions are supplied by the preview route wrapper, so the static export does not depend on Next.js APIs. The SCORM adapter lives in `export/src/scorm-runtime.ts` and depends only on browser APIs and the shared learner progress contract. Quiz best scores and passed-quiz IDs are saved with resume state; the adapter reports raw scores as attempts are graded and reports assessment success with course completion. Both outputs use `app/globals.css` for matching layout, typography, and animations.

Course themes are validated in `lib/editor/theme.ts`, persisted in the course document, and included in the revision-checked editor snapshot. The course editor exposes palette presets, custom brand and accent colors, and local system font choices. The shared learner view maps these values to CSS custom properties, so the authenticated preview, HTML package, and both SCORM formats render the same branding without loading external fonts or assets.

## Persistence and security

MongoDB is accessed only from server-side code. Every data access path must scope reads and writes to the authenticated owner or workspace. Zod validates untrusted input before persistence. Mongoose schemas add database-level validation, indexes, and timestamps. Secrets stay in server environment variables.

The Phase 2 dashboard uses `/api/folders`, `/api/courses`, and `/api/dashboard`. Folder deletion is blocked while it contains courses or subfolders. Course deletion requires an exact title confirmation and marks the document as recently deleted, preserving its content references. The dashboard filters deleted documents from normal listings.

The Phase 3 course page is served at `/courses/[courseId]/edit`, with lessons edited individually at `/courses/[courseId]/edit/lessons/[lessonId]`. Adding a lesson uses `/api/courses/[courseId]/lessons`; editor saves persist through `/api/courses/[courseId]/editor`. It stores ordered section metadata on the course and stores lessons as separate documents with stable editor IDs. Autosaves validate the complete snapshot and check the course revision. Replica sets use a MongoDB transaction; standalone MongoDB uses an atomic course revision lock and restores the prior course and lesson snapshot if a write fails. A stale revision returns a conflict so the editor can preserve the author's local changes and ask them to reload.

Phase 4 media uploads use short-lived S3 presigned POST policies. The application stores the private object key and ownership metadata in `Asset`, and lesson blocks reference an authenticated `/api/assets/[assetId]/file` route rather than a bucket URL. Configure S3 bucket CORS to allow `POST`, `GET`, and `HEAD` from the development and production app origins; keep S3 Block Public Access enabled. The application IAM identity needs `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on the configured bucket prefix.

## Authentication

Auth.js v5 is configured with a MongoDB adapter and environment-based provider credentials. Provider setup is deployment-specific; no provider secrets are committed. Routes can use `auth()` and should enforce ownership independently of authentication.

## Runtime and deployment

Mongo-backed route handlers use the Node.js runtime. The export bundle is built with `npm run build:export` into `public/course-export`; this is static output that publishing routes package as HTML or SCORM. Export work belongs in isolated server-side service modules and must respect hosting request and memory limits.
