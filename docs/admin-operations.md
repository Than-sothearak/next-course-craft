# Administration deployment and operations

## Database requirements

Use an authenticated MongoDB replica set (including a single-node development replica set) or a sharded MongoDB deployment. Administration, course deletion/restoration, role policies, assignments and ownership transfers require transactions. Unsupported deployments return a service-unavailable error rather than applying unaudited or partially authorized changes. The maintenance scripts also verify that the MongoDB connection is authenticated.

Back up the database before rollout. Configure `MONGODB_URI`, `AUTH_SECRET`, and the enabled OAuth providers using `.env.example`. The app and maintenance scripts must point to the same database. Configure the canonical public `AUTH_URL` behind a reverse proxy, use HTTPS in production, and ensure the proxy overwrites forwarded host/protocol headers.

The runtime database identity needs access to the application's collections and indexes. Restrict the database network and credentials to trusted application/maintenance hosts. No OAuth email address, environment email allowlist, or application startup path grants an administrative role.

## Migration and first Super Admin

1. Register the intended operator through Google or GitHub. The account is pending and can access `/account-status` and sign out.
2. Retrieve that existing user's ObjectId using an authenticated database administration session. Confirm the person's identity out of band. Set the protected `ADMIN_MAINTENANCE_ACTOR_ID` and `BOOTSTRAP_SUPER_ADMIN_USER_ID` values to the chosen account ID in the maintenance environment. These are account IDs, not email addresses. Keep the environment file private.
3. Inspect the migration without writing:

   ```sh
   npm run migrate:user-approval
   ```

4. Deliberately apply the migration:

   ```sh
   npm run migrate:user-approval -- --apply --confirm=MIGRATE_USERS
   ```

5. Bootstrap exactly the protected account, substituting its actual 24-character ObjectId:

   ```sh
   npm run bootstrap:super-admin -- --confirm-user-id=YOUR_EXISTING_ACCOUNT_OBJECT_ID
   ```

6. Restart/redeploy the updated application so cached Mongoose models load the new schemas. Sign in through the account's original provider and open `/admin`. Approve the remaining known accounts individually and choose their roles. Remove the maintenance ID values from the normal runtime environment after setup.

The npm commands load `.env.local` using Node's environment-file support. If credentials are already supplied by a protected maintenance shell or deployment secret store, invoke `node scripts/migrate-user-approval.mjs` or `node scripts/bootstrap-super-admin.mjs` with the same confirmation flags instead. Node 20.6+ is required for the npm environment-file commands.

The migration is resumable and idempotent. It normalizes email casing, rejects duplicate normalized emails before writing, maps legacy `author` roles to `editor`, and assigns **pending** to records with a missing/invalid status. Other valid roles and statuses remain intact. It initializes required indexes and logs changed accounts. It never changes user IDs, OAuth accounts, sessions, courses, lessons, media, or ownership. Do not resolve duplicate accounts by deleting users that own content; reconcile identity deliberately first.

Bootstrap verifies an existing account, requires an explicit matching confirmation, and atomically records its single chosen ID. Repeating it for that same active Super Admin is safe. A different bootstrap ID or any pre-existing Super Admin causes refusal. It does not recover a subsequently removed/demoted/suspended bootstrap account; additional administrators and recovery must be managed through an already active Super Admin or a separately reviewed maintenance process.

## Authorization and administration

- New OAuth users are `viewer` + `pending`. No role grants access unless the current database status is `active`. OAuth updates cannot modify role, status, approval metadata or custom permissions.
- `/admin`, `/admin/users`, and `/admin/approvals` manage registrations and users. Admin only sees/manages non-administrative accounts and can assign Editor or Viewer. Super Admin can assign any role. Administrative account changes cannot target the acting account itself.
- `/admin/roles` changes non-system role policies within immutable ceilings. Viewer cannot gain write/export/user-management permissions; Editor cannot gain platform administration; Admin cannot gain Super Admin-only settings, role-policy management or ownership transfer. An optional user-level `permissions` allowlist further narrows a role; it cannot add privileges. Super Admin's role privileges are immutable.
- `/admin/courses` provides all-course administration to permitted administrators. `/courses/[courseId]/access` manages explicit editor/viewer assignments for a course owner or authorized manager. Workspace membership still grants its existing shared access, subject to global platform permissions. Removing an explicit assignment does not remove workspace membership.
- All publishing routes require **both** `courses.publish` and `courses.export`, plus course scope. New AI work requires `ai.generate`, `courses.edit`, course scope, and the global AI setting. Approved course editors can still inspect/cancel existing jobs when AI is disabled, so cleanup and ownership transfer remain possible. Viewer can preview only.
- `/admin/settings` controls global AI availability. `/admin/audit-logs` filters recorded authentication and administration activity by actor, action and UTC date range.
- Status and permissions are read from MongoDB on protected requests. Existing session claims never grant authority. Account changes, assignments, role policies, settings, deletion/restoration and transfers are serialized and commit their audit records in the same transaction. Failed audit writes abort these changes.

## Provider linking

Google must report a verified email. Automatic email-based Google linking remains available for ordinary accounts and never resets approval or permissions. Adding Google to an **Admin or Super Admin** account requires an already authenticated session for that same active account. Privileged users first sign in with their original provider, open `/account-status`, and use **Connect Google** or **Connect GitHub**. An already linked Google identity can sign in normally. GitHub keeps Auth.js's default protection against automatic email-based linking.

## Ownership transfers and revocation

Super Admin can transfer a course to an approved author by confirmed title and account email. The server resolves the target's database ID and permissions. The course moves to the new owner's personal root; creator attribution, lessons, content identifiers, media URLs, private S3 keys, and explicit assignments are preserved. Asset/export/generation ownership is updated atomically. Original workspace membership stops granting access. Active saves, generation requests/source jobs, and unexpired upload policies block transfer. Abandoned generation leases expire after six minutes; upload policies last five minutes, with a ten-minute transfer safety window.

User removal is a tombstone that revokes access and preserves identity/content relationships. The system never removes, demotes, suspends or deletes the last active Super Admin. Two simultaneous administrator changes cannot bypass this invariant.

Media is streamed through the authenticated application route, including video ranges, so the browser receives no reusable private S3 download URL. Each new protected request checks current approval and permissions. Previously downloaded files and standalone learner exports cannot be revoked; an already authorized in-flight response/provider request can finish. A presigned upload issued earlier can upload bytes until its short policy expires, but its completion API still requires current authorization before those bytes become usable course media. Plan hosting bandwidth/runtime limits for streamed media and configure storage lifecycle cleanup for abandoned uploads.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build:export
npm run build
```

The integration suite is opt-in and uses a newly generated `coursecraft_rbac_test_*` database, which it drops at completion. Supply **an explicitly selected test MongoDB server**, never production credentials:

```sh
RBAC_TEST_MONGODB_URI='mongodb://TEST_SERVER/?replicaSet=TEST_REPLICA' npx vitest run tests/admin-integration.test.ts
```

It exercises native OAuth adapter defaults, approval, current-session revocation, role ceilings, direct API denial, course assignments, all publishing authorization guards, ownership/content preservation, audit rollback, bootstrap idempotence, legacy migration, media range revocation, and competing Super Admin changes against real transactions. The standard test command reports this suite as skipped when its dedicated test URI is absent. No real Google/GitHub/S3/OpenAI calls are made by these tests.
