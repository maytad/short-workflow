export function formatMetric(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }

  return Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }

  return `${Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusLabel(value: "linked" | "unlinked") {
  return value === "linked" ? "Linked" : "Unlinked";
}
