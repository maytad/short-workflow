import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      generatedRouteTree: "./src/routeTree.gen.ts",
      routesDirectory: "./src/routes",
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
