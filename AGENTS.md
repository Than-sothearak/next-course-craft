# Project instructions

- Keep the product in one Next.js App Router project. Do not create a second app or export worker.
- Follow `docs/architecture.md` and the phase boundaries in `docs/roadmap.md`.
- Build application UI with the configured shadcn/ui source components in `components/ui`; extend those primitives instead of adding ad hoc design-system controls.
- Keep Standard and Presentation settings visually consistent. Reuse `components/ui/settings-section.tsx` for compact, icon-labeled collapsible sections and Show all/Hide all controls, and `components/ui/color-picker.tsx` for color inputs. Put secondary options in an Advanced settings section; preserve this shared pattern for future settings UI.
- Use the shared settings section's default bordered card style for Content settings and Block format popup groups, matching the Presentation inspector. Keep the borders subtle and use the shared spacing and corner radius consistently.
- Put popup Show all/Hide all actions in the top bar alongside its single title, outside the draggable handle. Do not repeat the popup settings title or bulk controls in the body.
- Use the shared color picker and text alignment control for theme settings. Keep course typography defaults optional, preserve authored inline formatting, and carry theme changes through authoring, preview and static learners.
- Use strict TypeScript, server-side ownership checks, Zod validation, and Mongoose models with timestamps/indexes.
- Keep the standalone learner export independent of Next.js server APIs; its build output must be static assets.
- Never commit credentials. Document required environment variables in `.env.example`.
- Add focused tests for new behavior and report checks accurately.
