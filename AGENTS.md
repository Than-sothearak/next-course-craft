# Project instructions

- Keep the product in one Next.js App Router project. Do not create a second app or export worker.
- Follow `docs/architecture.md` and the phase boundaries in `docs/roadmap.md`.
- Build application UI with the configured shadcn/ui source components in `components/ui`; extend those primitives instead of adding ad hoc design-system controls.
- Use strict TypeScript, server-side ownership checks, Zod validation, and Mongoose models with timestamps/indexes.
- Keep the standalone learner export independent of Next.js server APIs; its build output must be static assets.
- Never commit credentials. Document required environment variables in `.env.example`.
- Add focused tests for new behavior and report checks accurately.
