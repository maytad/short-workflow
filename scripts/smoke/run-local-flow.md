# Local Smoke Flow

- Run `bun run db:check`.
- Run `bun run db:migrate:up`.
- Run `bun run dev:api`.
- Run `curl http://127.0.0.1:3001/health` and confirm `{"ok":true,"service":"short-workflow-api"}`.
- Run `scripts/smoke/create-project.sh`.
- Run `bun run dev:worker`.
- In the web app, create or open the project.
- Generate script.
- Generate scene images.
- Generate scene audio.
- Render MP4.
- Confirm output MP4 exists under `{LOCAL_ASSET_ROOT}/projects/{projectId}/renders/{renderId}.mp4`.
