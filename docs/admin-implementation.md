# Administration implementation

This is the requested production administration work within roadmap Phase 15. It preserves the existing App Router, OAuth providers, workspace membership, editor services and static export boundary.

## Plan and boundaries

1. Inspect Auth.js, user/course persistence, workspace scope, authoring routes and dashboard. Existing OAuth users live in `users`; the MongoDB adapter bypasses Mongoose defaults. Legacy users may have `author` roles and no status.
2. Extend User and add role policies, course assignments, audit logs and a singleton security control. Provide deliberate migration and first-super-admin scripts. Never approve legacy accounts implicitly.
3. Resolve account status and effective permissions from MongoDB on every privileged request. Apply platform permissions before owner, workspace or course assignment access. Sessions carry identity, never authoritative authorization claims.
4. Add the administration overview, paginated user management, approval queue and account-status screens.
5. Add constrained role permission editing, course assignments, ownership transfer and platform AI settings.
6. Apply the same guards to authoring, media, generation, downloads and all publishing formats; adapt navigation to the effective permissions.
7. Audit sensitive mutations atomically and run authorization, route, migration and existing regression checks.

## Security decisions

- There are four platform roles. Pending is an account status. A missing/legacy status is pending at runtime until explicitly migrated and approved.
- Super Admin permissions are immutable. Other role policies and optional per-user allowlists can only reduce hardcoded role ceilings. Only Super Admin can edit role policies or protected settings.
- Admin cannot manage Admin/Super Admin accounts, assign those roles, or mutate their own account. Approval requires an explicitly chosen role.
- Course assignments supplement existing workspace membership. Global permission checks still apply to owners and workspace administrators. Assigned editors cannot manage ownership or collaborators.
- Administration mutations use MongoDB transactions and a shared security control document to serialize decisions, prevent concurrent removal of the last active Super Admin, and commit the audit event with the mutation. A replica set or sharded deployment is required; unsupported deployments fail closed.
- Ownership transfer moves a course into the new owner's personal root, updates asset/job ownership, increments its revision, and preserves lessons, content IDs and creator attribution. In-progress saves/generation block transfer.
- Audit metadata is constructed by server code from explicit safe fields, never OAuth tokens, session values or arbitrary request bodies.

Deployment and maintenance commands are documented in `docs/admin-operations.md`.

## Completion

All seven implementation steps are complete. `docs/admin-verification.md` records the changed files, full regression results, real MongoDB transaction tests, production browser checks, build results and rollout limits. Existing application data was not migrated or bootstrapped during implementation; verification used an isolated authenticated local replica set.
