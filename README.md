# Short Workflow

Single-user, local-running workflow for creating English 9:16 short-form videos with AI assistance.

## Requirements

- Bun 1.2.0
- Node.js for Remotion rendering commands
- Hosted Supabase Postgres project

## Setup

```bash
bun install
cp .env.example .env
```

Fill in the Supabase and provider values in `.env`. Generated assets should live under `LOCAL_ASSET_ROOT`, outside committed source files.

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
