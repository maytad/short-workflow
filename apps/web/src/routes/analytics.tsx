import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsDashboard } from "../features/analytics/AnalyticsDashboard";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsDashboard,
});
