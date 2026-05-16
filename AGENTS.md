# AGENTS.md

## Project

Short Workflow is a single-user, local-running AI video workflow for creating English 9:16 short-form videos. The MVP is a step-by-step editor that turns a topic into script, scenes, generated images, generated voice, captions, a Remotion render input, and a local MP4.

Read the design spec before implementation work:

- `docs/superpowers/specs/2026-05-17-short-workflow-design.md`

## Current Stage

This project is design/spec-first. Do not scaffold, add dependencies, or implement application code before an approved implementation plan exists.

## Stack

- Package manager: Bun workspaces.
- Task orchestration: Turborepo.
- Frontend: React + Vite + TanStack Router + TanStack Query.
- Forms: react-hook-form + Zod resolver with schemas from `packages/shared`.
- Styling: Tailwind v4 + shadcn/ui primitives + lucide-react icons.
- API: ElysiaJS on Bun.
- Worker: Bun.
- Database: hosted Supabase Free Tier Postgres, accessed through Drizzle ORM in `packages/db`.
- Migrations: Drizzle Kit generation/checks plus a custom reversible migration runner.
- Rendering: Remotion local in `apps/render`. Use Node.js for Remotion Studio/rendering; the Bun worker triggers render through a Node.js subprocess.
- Storage: local filesystem for MVP assets, with portable relative paths stored in the database.

## Commands

Commands may not exist until scaffolded. Once implemented, prefer:

```bash
bun install
bun run dev
bun run dev:web
bun run dev:api
bun run dev:worker
bun run dev:render
bun run db:generate
bun run db:check
bun run db:migrate:up
bun run db:migrate:down -- --steps 1
bun run db:studio
bun run render:project --project <projectId>
```

Never use `npm`, `yarn`, or `pnpm` unless the package-manager decision is explicitly changed.

## Boundaries

Always:

- Keep the MVP single-user and local-running.
- Keep `apps/web` and `apps/api` bound to localhost for MVP development.
- Use hosted Supabase Postgres through `DATABASE_URL`; do not require a local Supabase CLI stack.
- Keep the app UI and generated video content in English.
- Store asset paths in the database as portable relative paths.
- Keep `DATABASE_URL`, Supabase service role keys, and AI provider keys out of the frontend.
- Use `packages/shared` for shared schemas, enums, constants, and cross-app types.
- Use `packages/db` as the Drizzle database boundary for schema, queries, clients, and migrations.
- Keep `apps/web` as an API consumer, not a direct database client.
- Keep generated image/audio/render files under `LOCAL_ASSET_ROOT`.
- Keep generated assets append-only; stale scene assets remain history and are ignored for new renders.

Never:

- Add Supabase Auth, RLS, Redis/BullMQ, cloud storage, YouTube upload automation, billing, public deployment, or cloud rendering in the MVP.
- Add background music to the first MVP.
- Let `apps/web` import `packages/db` directly.
- Let `apps/web` connect to Supabase directly.
- Use `drizzle-kit push` for normal schema changes.
- Treat `drizzle-kit up` as the application migration-up command; it is for Drizzle snapshot metadata upgrades.
- Store binary or base64 provider payloads in `prompt_versions`.
- Commit `.env` files, secrets, service role keys, generated videos, or large generated assets.
- Change the video output language away from English unless the user changes the product decision.

Ask first:

- Before adding dependencies not already listed in the approved design.
- Before changing the design spec.
- Before broad refactors.
- Before adding auth, queueing, cloud deployment, cloud storage, background music, subtitle export, or publishing automation.

## Project-Local Skills

Use relevant project-local skills when working in these areas:

- `turborepo` for monorepo structure, task pipelines, caching, and package boundaries.
- `elysiajs` for API routes, validation, plugins, and Bun backend patterns.
- `supabase-postgres-best-practices` for hosted Postgres behavior, locking, indexes, constraints, and query design.
- `tanstack-router-best-practices` for React routing, search params, and navigation.
- `remotion-best-practices` for video composition, render input design, and Remotion rendering.
- `vercel-react-best-practices` for React performance and data-flow patterns.
- `vercel-composition-patterns` for reusable React component architecture.
- `design-taste-frontend` for premium frontend UX, interaction states, visual hierarchy, and avoiding generic AI UI patterns.
- `web-design-guidelines` for UI review, accessibility, and interface polish.

Design/image skills such as `high-end-visual-design`, `imagegen-frontend-web`, `image-to-code`, `minimalist-ui`, and `industrial-brutalist-ui` are optional. Use them only when the task is specifically visual or design-heavy.

## Validation

The MVP does not require a full automated test suite before the first working local flow. Still run the lightest relevant verification for the area changed:

- Shared schemas: run a small schema check or unit test when created.
- Database changes: run `bun run db:check`, apply with `bun run db:migrate:up`, verify core query functions, and keep rollback covered with `down.sql`.
- API changes: manually verify `GET /health`.
- Worker changes: manually verify one pending job can be claimed and completed.
- Remotion changes: run a tiny fixture render before wiring real AI outputs.

## Implementation Notes

- Job claiming must be atomic in the database. Prefer a `claim_next_job()` function using `FOR UPDATE SKIP LOCKED`.
- Job auto-retry uses `next_retry_at` and capped exponential backoff. Set `finished_at` only for terminal states, and clear it when auto-retrying back to `pending`.
- `renders` stores render attempt metadata only. Render input and MP4 file paths live in `assets`.
- Render input generation is an internal worker sub-step of `render_video`, not a public API endpoint.
- Scene `caption` is on-screen text rendered by Remotion. Standalone `.srt` or `.vtt` subtitle export is out of scope for the MVP.
- Scene content freshness uses `content_updated_at`. Bump it only in application code when content fields actually change after normalization, not via a generic DB trigger.
- Current scene assets are `ready` assets where `asset.created_at >= scene.content_updated_at`; older ready assets are stale history.
- Project deletion is destructive in the MVP, but must return `409 Conflict` while the project has `pending` or `processing` jobs. If allowed, it should attempt to remove `{LOCAL_ASSET_ROOT}/projects/{projectId}/`.
- Job progress uses polling in the MVP, not SSE or WebSockets.

## Migration Rules

- Drizzle schema in `packages/db/src/schema.ts` is the table-definition source of truth.
- Migration folders live under `packages/db/migrations`.
- Each migration must include `migration.sql` and `down.sql`.
- `db:migrate:up` applies unapplied `migration.sql` files in lexical order and records them in `app_migrations`.
- `db:migrate:down -- --steps N` applies latest `down.sql` files in reverse order and removes their `app_migrations` records only after rollback succeeds.
- Missing `down.sql` should fail loudly. Intentionally irreversible migrations must include an explicit failing statement and a comment explaining why rollback is blocked.
- Migration scripts connect to hosted Supabase through `DATABASE_URL`; do not require `supabase start`.

## Frontend Rules

- Use TanStack Router file-based routes under `apps/web/src/routes`; do not manually edit `routeTree.gen.ts`.
- Route files should compose feature components; feature logic belongs under `apps/web/src/features/*`.
- Use TanStack Query for server state, polling, retries, and invalidation. Do not duplicate server data in local React state.
- Use react-hook-form with Zod schemas for editable forms.
- Treat shadcn/ui as customizable primitives in `apps/web/src/components/ui`, not finished screens.
- Use Tailwind theme tokens and restrained styling. Avoid generic AI gradients, glow effects, nested cards, and decorative blobs.

## When Unsure

Read the design spec first. If the spec and code disagree, stop and ask before changing architecture.
