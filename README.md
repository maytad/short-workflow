# Short Workflow

Single-user, local-running workflow for creating English 9:16 short-form videos with AI assistance.

## Requirements

- Bun 1.2.0
- Node.js for Remotion rendering commands
- Hosted Supabase Postgres project

## Local MVP Setup

```bash
cp .env.example .env
```

Update `.env`:

1. Set `DATABASE_URL` to the Supabase pooled connection string.
2. Set `DATABASE_DIRECT_URL` to the Supabase direct connection string.
3. Set `LOCAL_ASSET_ROOT` to an absolute directory on this machine.
4. Set provider keys for OpenAI, Google image generation, and Google Text-to-Speech.
5. Optionally override `OPENAI_MODEL` and the web app's `VITE_API_BASE_URL`.

Then run:

```bash
bun install
bun run db:check
bun run db:migrate:up
bun run dev
```

Notes:

- Hosted Supabase Free Tier is the DB; no local Supabase CLI is required for MVP.
- `DATABASE_URL` is the runtime pooler URL; `DATABASE_DIRECT_URL` is the direct URL for migrations.
- Local assets are machine-local under `LOCAL_ASSET_ROOT`; the hosted DB stores relative paths only.
- Drizzle Studio edits the hosted DB live.
- Do not use `drizzle-kit push` for normal schema changes; use committed reversible migrations.

## Development

```bash
bun run dev
```

Run one app at a time when needed:

```bash
bun run dev:web
bun run dev:api
bun run dev:worker
bun run dev:render
```

## Verification

```bash
bun run typecheck
```

## First Smoke Flow

1. Start the API, web app, worker, and render dev commands.
2. Create a project from an English topic in the web app.
3. Generate and review the script and scenes.
4. Generate scene images and narration.
5. Render the local MP4 and inspect the output path.
