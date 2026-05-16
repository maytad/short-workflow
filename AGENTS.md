# AGENTS.md

## Project

Short Workflow is a single-user, local-first AI video workflow for creating English 9:16 short-form videos. The MVP is a step-by-step editor that turns a topic into script, scenes, generated images, generated voice, captions, a Remotion render input, and a local MP4.

Read the design spec before implementation work:

- `docs/superpowers/specs/2026-05-17-short-workflow-design.md`

## Current Stage

This project is design/spec-first. Do not scaffold, add dependencies, or implement application code before an approved implementation plan exists.

## Stack

- Package manager: Bun workspaces.
- Task orchestration: Turborepo.
- Frontend: React + Vite + TanStack Router + TanStack Query.
- API: ElysiaJS on Bun.
- Worker: Bun.
- Database: Supabase Postgres.
- Rendering: Remotion local. Node.js is allowed for Remotion Studio/rendering compatibility.
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
bun run render:project --project <projectId>
```

Never use `npm`, `yarn`, or `pnpm` unless the package-manager decision is explicitly changed.

## Boundaries

Always:

- Keep the MVP single-user and local-first.
- Keep the app UI and generated video content in English.
- Store asset paths in the database as portable relative paths.
- Keep Supabase service role keys and AI provider keys out of the frontend.
- Use `packages/shared` for shared schemas, enums, constants, and cross-app types.
- Use `packages/db` as the database boundary.
- Keep `apps/web` as an API consumer, not a direct database client.
- Keep generated image/audio/render files under `LOCAL_ASSET_ROOT`.

Never:

- Add Supabase Auth, RLS, Redis/BullMQ, cloud storage, YouTube upload automation, billing, public deployment, or cloud rendering in the MVP.
- Add background music to the first MVP.
- Let `apps/web` import `packages/db` directly.
- Store binary or base64 provider payloads in `prompt_versions`.
- Commit `.env` files, secrets, service role keys, generated videos, or large generated assets.
- Change the video output language away from English unless the user changes the product decision.

Ask first:

- Before adding new dependencies.
- Before changing the design spec.
- Before broad refactors.
- Before adding auth, queueing, cloud deployment, cloud storage, background music, subtitle export, or publishing automation.

## Project-Local Skills

Use relevant project-local skills when working in these areas:

- `turborepo` for monorepo structure, task pipelines, caching, and package boundaries.
- `elysiajs` for API routes, validation, plugins, and Bun backend patterns.
- `supabase-postgres-best-practices` for schema, query, migration, locking, and Postgres design.
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
- Database changes: verify migrations and core query functions.
- API changes: manually verify `GET /health`.
- Worker changes: manually verify one pending job can be claimed and completed.
- Remotion changes: run a tiny fixture render before wiring real AI outputs.

## Implementation Notes

- Job claiming must be atomic in the database. Prefer a `claim_next_job()` function using `FOR UPDATE SKIP LOCKED`.
- `renders` stores render attempt metadata only. Render input and MP4 file paths live in `assets`.
- Scene `caption` is on-screen text rendered by Remotion. Standalone `.srt` or `.vtt` subtitle export is out of scope for the MVP.
- Project deletion is destructive in the MVP and should attempt to remove `{LOCAL_ASSET_ROOT}/projects/{projectId}/`.
- Job progress uses polling in the MVP, not SSE or WebSockets.

## When Unsure

Read the design spec first. If the spec and code disagree, stop and ask before changing architecture.
