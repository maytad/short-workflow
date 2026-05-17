import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export type RouterContext = {
  queryClient: QueryClient;
};

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    context: {
      queryClient,
    },
    defaultPreload: "intent",
    routeTree,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
