import { createApp } from "./app";
import { parseEnv } from "./env";

const env = parseEnv();
const app = createApp({ databaseUrl: env.DATABASE_URL });

app.listen({
  hostname: env.API_HOST,
  port: env.API_PORT,
});

console.log(`short-workflow-api listening on http://${env.API_HOST}:${env.API_PORT}`);

export type App = typeof app;
