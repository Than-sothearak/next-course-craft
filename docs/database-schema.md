# Database schema (foundation)

All collections use Mongoose timestamps and ObjectId references. Ownership must be checked in server services; references alone do not grant access.

| Model | Core fields | Indexes / notes |
|---|---|---|
| User | Auth.js adapter identity and account data | Auth adapter models registered by `@auth/mongodb-adapter` |
| Folder | `name`, `normalizedName`, `ownerId`, `parentId` | Unique owner/parent/normalized-name index; service prevents circular ancestry |
| Course | `ownerId`, `folderId`, title, description, language, theme, ordered sections, status, revision, `deletedAt` | Owner/folder and updatedAt indexes; revision supports optimistic concurrency; dashboard delete is a title-confirmed soft delete |
| Lesson | `courseId`, `editorId`, `sectionId`, title, order, versioned blocks, revision, settings | Course/section/order lookup and unique course/editor ID; separate collection prevents oversized course documents |
| Asset | owner/course IDs, storage key, MIME type, byte size, checksum, metadata | Owner/course indexes; private storage keys never exposed as credentials |
| Quiz | course/lesson IDs, versioned questions, passing score, attempt settings | Course/lesson indexes |
| ExportJob | course/owner IDs, snapshot revision, format, status, result key, error details | Status/createdAt and owner/createdAt; durable states allow a future worker |

## Phase 1 model scope

The initial implementation registers User, Folder, Course, Lesson, Asset, Quiz, and ExportJob schemas. Fields are deliberately foundational; later phases add domain-specific validation and service operations alongside their tests. Never store all lessons and block payloads in a Course document. Phase 3 editor saves use MongoDB transactions where available. On standalone MongoDB, they use an atomic course revision lock and restore the previous course and lesson snapshot if a write fails. The lock expires after five minutes to recover from a process crash.
