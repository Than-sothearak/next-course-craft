# Administration verification — 2026-10-16

## Delivered

Approval is independent of OAuth authentication. New users are pending; protected requests resolve current account status and constrained role permissions from MongoDB. The administration UI includes overview metrics, paginated user search/filtering and details, an approval queue, a permission matrix, course administration and assignments, ownership transfer, protected AI settings, and filterable audit logs.

Authoring APIs retain their existing editor/export services and ownership scopes, with centralized platform checks added above personal, workspace and course assignment access. Media downloads now stream through an authenticated route. A shared transaction control protects administrative decisions and commits sensitive changes with audit events, including protection against concurrent removal of the last active Super Admin. Runtime authentication explicitly waits for a live request to support Cache Components and partial prefetching safely.

## Checks

| Check | Result |
| --- | --- |
| Full Vitest suite with dedicated test MongoDB URI, `--maxWorkers=2` | **507 tests passed in 62 files**, including all 27 database integration tests; no skipped tests in this verification run |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build:export` | Passed; static assets emitted. Existing Rollup directive/source-map and large-chunk warnings remain |
| Next.js production build with `--webpack` | Passed with Cache Components and Partial Prefetching enabled |
| Default Turbopack build | Environment blocked compiler child-process socket binding (`EPERM`), including elevated execution; webpack was used for production verification |
| `git diff --check` | Passed |
| Standalone JavaScript scan for MongoDB/auth configuration identifiers | No matches |
| Maintenance CLI against isolated authenticated MongoDB | Dry run, deliberate apply, bootstrap, repeated bootstrap passed; existing course ownership preserved |
| Chrome against the production server with real Auth.js database sessions | Passed desktop and mobile flows below; no uncaught browser page errors |

The database suite used an authenticated local replica set and generated/dropped random `coursecraft_rbac_test_*` databases. The production browser server used a separate temporary database with synthetic identities and generated session tokens. Test services and temporary credentials were removed after verification. The project's existing MongoDB data and provider credentials were not used for these operations.

## Security cases exercised

- Native Google/GitHub adapter registrations become pending and cannot create courses.
- Admin approval explicitly assigns Editor and permits course creation with the correct owner/creator.
- Assigned editors can edit only accessible courses; viewers cannot write, generate, upload, publish, or export.
- Current account suspension and role-policy changes revoke existing sessions on their next protected request; forged session role claims do not authorize.
- Direct admin API calls reject unauthenticated/non-administrative users. Admin cannot assign Super Admin or manage administrative targets/settings/policies.
- All four publishing formats enforce current approval, course scope, publish permission and export permission; assigned Editor SCORM builds receive the real owner scope.
- Competing Super Admin suspensions leave one active Super Admin and one committed audit event. Self-removal is denied.
- Mandatory audit-write failure rolls back the account decision; invalid destructive confirmations leave content and logs unchanged.
- Ownership transfer preserves creator, lessons, assets/private keys and identifiers, changes owner scopes atomically, and blocks while a generation lease is active.
- Bootstrap is idempotent for its chosen existing account and refuses a different account. Legacy migration preserves OAuth accounts, ownership and existing valid statuses without implicit approval.
- Authenticated media ranges expose no reusable storage redirect and are denied after suspension.
- Existing generation jobs can be cancelled with AI disabled, allowing safe cleanup and transfer.
- Missing/invalid database authorization fields fail closed.
- Unverified Google profiles are denied. New Google linking to a privileged account requires an existing authenticated session for that same active account.

## Production browser flows

Chrome verified anonymous login redirects and API 401 responses; pending approval screens and API denial; Viewer preview-only navigation; approval dialogs activating the same existing session; Admin promotion/settings restrictions; suspension using an existing cookie; immutable permission controls and live policy changes; protected settings dialogs; ownership transfer; owner-controlled assignment revocation; audit filtering; and a 390px mobile layout without document overflow.

## Required rollout and limits

Follow [administration operations](admin-operations.md). An authenticated transactional MongoDB deployment, a deliberate legacy migration, and bootstrap of an existing account ID are required. Existing accounts with missing status remain pending until reviewed; no existing account is implicitly approved and no course ownership is silently changed.

Live Google/GitHub OAuth handshakes, private S3 transfers, and OpenAI calls were not exercised. Native Auth.js database sessions and server authorization were exercised with test identities; packaging behavior retains the existing format tests. Already delivered/downloaded content and standalone exports cannot be revoked, and an already authorized in-flight response/provider request can finish. Presigned uploads expire shortly and completion requires current authorization. See the operations document for hosting/storage cleanup considerations.

## Changed files

The manifest below covers authentication and administration work in this session. Pre-existing unrelated README and invitation-client edits are excluded.

- `.env.example`
- `app/access-denied/page.tsx`
- `app/account-status/page.tsx`
- `app/admin/approvals/page.tsx`
- `app/admin/audit-logs/page.tsx`
- `app/admin/courses/page.tsx`
- `app/admin/layout.tsx`
- `app/admin/loading.tsx`
- `app/admin/page.tsx`
- `app/admin/roles/page.tsx`
- `app/admin/settings/page.tsx`
- `app/admin/users/[userId]/page.tsx`
- `app/admin/users/page.tsx`
- `app/api/admin/audit-logs/route.ts`
- `app/api/admin/courses/[courseId]/route.ts`
- `app/api/admin/courses/route.ts`
- `app/api/admin/roles/route.ts`
- `app/api/admin/route.ts`
- `app/api/admin/settings/route.ts`
- `app/api/admin/users/[userId]/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/assets/[assetId]/file/route.ts`
- `app/api/courses/[courseId]/assignments/route.ts`
- `app/api/courses/[courseId]/generate/route.ts`
- `app/api/courses/[courseId]/publish/pdf/route.ts`
- `app/api/courses/[courseId]/publish/route.ts`
- `app/api/courses/[courseId]/publish/scorm12/route.ts`
- `app/api/courses/[courseId]/publish/scorm2004/route.ts`
- `app/api/courses/[courseId]/restore/route.ts`
- `app/api/courses/[courseId]/route.ts`
- `app/api/workspace-invitations/[token]/route.ts`
- `app/courses/[courseId]/access/page.tsx`
- `app/courses/[courseId]/edit/_components/editor-client.tsx`
- `app/courses/[courseId]/edit/lessons/[lessonId]/page.tsx`
- `app/courses/[courseId]/edit/page.tsx`
- `app/courses/[courseId]/preview/course-preview-route.tsx`
- `app/courses/[courseId]/preview/page.tsx`
- `app/dashboard/_components/(dashboard_client_components)/course-card.tsx`
- `app/dashboard/_components/(dashboard_client_components)/dashboard-sidebar.tsx`
- `app/dashboard/_components/(dashboard_client_components)/empty-state.tsx`
- `app/dashboard/_components/(dashboard_client_components)/folder-card.tsx`
- `app/dashboard/_components/dashboard-data.ts`
- `app/dashboard/_components/dashboard-navbar.tsx`
- `app/dashboard/dashboard-client.tsx`
- `app/dashboard/page.tsx`
- `app/login/page.tsx`
- `components/admin/admin-common.tsx`
- `components/admin/admin-loading.tsx`
- `components/admin/admin-navigation.tsx`
- `components/admin/admin-overview.tsx`
- `components/admin/admin-section.tsx`
- `components/admin/audit-management.tsx`
- `components/admin/course-access-manager.tsx`
- `components/admin/course-management.tsx`
- `components/admin/role-management.tsx`
- `components/admin/settings-management.tsx`
- `components/admin/use-admin-resource.ts`
- `components/admin/user-management.tsx`
- `components/ui/checkbox.tsx`
- `components/ui/dialog.tsx`
- `components/ui/table.tsx`
- `docs/admin-implementation.md`
- `docs/admin-operations.md`
- `docs/admin-verification.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `lib/admin/courses.ts`
- `lib/admin/http.ts`
- `lib/admin/queries.ts`
- `lib/admin/roles.ts`
- `lib/admin/schemas.ts`
- `lib/admin/transactions.ts`
- `lib/admin/types.ts`
- `lib/admin/user-policy.ts`
- `lib/admin/users.ts`
- `lib/ai/generation-lease.ts`
- `lib/auth/adapter.ts`
- `lib/auth/authorization.ts`
- `lib/auth/google-linking.ts`
- `lib/auth/http-security.ts`
- `lib/auth/index.ts`
- `lib/auth/pages.ts`
- `lib/auth/policy.ts`
- `lib/dashboard/http.ts`
- `lib/dashboard/services/courses.ts`
- `lib/dashboard/services/list.ts`
- `lib/dashboard/types.ts`
- `lib/media/services/assets.ts`
- `lib/workspaces/access.ts`
- `lib/workspaces/services.ts`
- `models/AuditLog.ts`
- `models/Course.ts`
- `models/CourseAssignment.ts`
- `models/PlatformSettings.ts`
- `models/RolePermission.ts`
- `models/SecurityControl.ts`
- `models/User.ts`
- `models/index.ts`
- `package.json`
- `proxy.ts`
- `scripts/admin-maintenance.mjs`
- `scripts/bootstrap-super-admin.d.mts`
- `scripts/bootstrap-super-admin.mjs`
- `scripts/migrate-user-approval.d.mts`
- `scripts/migrate-user-approval.mjs`
- `tests/admin-integration.test.ts`
- `tests/admin-policy.test.ts`
- `tests/approval-adapter.test.ts`
- `tests/auth-account-linking.test.ts`
- `tests/course-card.test.ts`
- `tests/course-generation-route.test.ts`
- `tests/course-preview-suspense.test.tsx`
- `tests/dashboard-data.test.ts`
- `tests/dashboard-loading.test.tsx`
- `tests/google-linking.test.ts`
- `tests/http-security.test.ts`
- `tests/lesson-editor-location.test.tsx`
- `tests/login-suspense.test.tsx`
- `tests/preview-edit-navigation.test.tsx`
- `tests/user-migration.test.ts`
- `tests/workspace-access.test.ts`
