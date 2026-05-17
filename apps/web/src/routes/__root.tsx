import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { AppShell } from "../components/layout/AppShell";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootRoute,
});

function RootRoute() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
