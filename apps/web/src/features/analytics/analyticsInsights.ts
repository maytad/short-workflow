import type { YoutubeAnalyticsVideoSummary } from "@short-workflow/shared";

const ACTION_LABELS = new Set([
  "weak_hold",
  "low_exposure_proxy",
  "strong_retention_low_distribution",
  "high_like_rate_low_scale",
]);

const WINNER_LABELS = new Set(["winner_candidate"]);

export type AnalyticsSignalTone = "attention" | "winner" | "new" | "neutral" | "private";

export type AnalyticsSignal = {
  description: string;
  label: string;
  tone: AnalyticsSignalTone;
};

export function isPublicVideo(video: YoutubeAnalyticsVideoSummary) {
  return video.link.privacyStatus === "public";
}

export function diagnosisLabels(video: YoutubeAnalyticsVideoSummary) {
  const labels = video.latestRuleDiagnosis?.suggestionsEn.labels;

  return Array.isArray(labels)
    ? labels.filter((label): label is string => typeof label === "string")
    : [];
}

export function isWinnerVideo(video: YoutubeAnalyticsVideoSummary) {
  return diagnosisLabels(video).some((label) => WINNER_LABELS.has(label));
}

export function needsAction(video: YoutubeAnalyticsVideoSummary) {
  if (!isPublicVideo(video)) {
    return false;
  }

  const labels = diagnosisLabels(video);

  return labels.some((label) => ACTION_LABELS.has(label));
}

export function isNewVideo(video: YoutubeAnalyticsVideoSummary) {
  if (!isPublicVideo(video)) {
    return false;
  }

  return diagnosisLabels(video).includes("too_new") || publishedAgeHours(video) < 24;
}

export function publishedAgeHours(video: YoutubeAnalyticsVideoSummary) {
  if (!video.link.publishedAt) {
    return Number.POSITIVE_INFINITY;
  }

  const publishedAt = new Date(video.link.publishedAt).getTime();

  if (Number.isNaN(publishedAt)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (Date.now() - publishedAt) / 3_600_000);
}

export function videoSignal(video: YoutubeAnalyticsVideoSummary): AnalyticsSignal {
  if (!isPublicVideo(video)) {
    return {
      description: "Excluded from public performance decisions.",
      label: video.link.privacyStatus ?? "Not public",
      tone: "private",
    };
  }

  const labels = diagnosisLabels(video);

  if (labels.includes("too_new")) {
    return {
      description: "Wait for more feed data before changing the creative.",
      label: "Too new",
      tone: "new",
    };
  }

  if (labels.includes("winner_candidate")) {
    return {
      description: "Use this as a pattern candidate for the next topic batch.",
      label: "Winner",
      tone: "winner",
    };
  }

  if (labels.includes("weak_hold")) {
    return {
      description: "Viewers are dropping before the mechanism payoff.",
      label: "Weak hold",
      tone: "attention",
    };
  }

  if (labels.includes("strong_retention_low_distribution")) {
    return {
      description: "The video holds viewers but probably did not get enough feed distribution.",
      label: "Low distribution",
      tone: "attention",
    };
  }

  if (labels.includes("high_like_rate_low_scale")) {
    return {
      description: "People who saw it liked it, but scale stayed low.",
      label: "Liked but small",
      tone: "attention",
    };
  }

  if (labels.includes("low_exposure_proxy")) {
    return {
      description: "Views or velocity are below the public baseline.",
      label: "Low exposure",
      tone: "attention",
    };
  }

  if (labels.includes("mid_video_drop_proxy")) {
    return {
      description: "No clear win signal yet. Improve hook clarity or pacing.",
      label: "Middle",
      tone: "neutral",
    };
  }

  return {
    description: "No rule signal is available yet.",
    label: "No signal",
    tone: "neutral",
  };
}

export function nextAction(video: YoutubeAnalyticsVideoSummary) {
  const signal = videoSignal(video);

  if (signal.tone === "winner") {
    return "Clone the topic structure, hook pattern, and first-frame visual tension into the next batch.";
  }

  if (signal.label === "Weak hold") {
    return "Rewrite the first 3 seconds around one visible contradiction, then shorten the explanation before the reveal.";
  }

  if (signal.label === "Low distribution") {
    return "Keep the mechanism, but retest the title and first image around a more familiar object action.";
  }

  if (signal.label === "Liked but small") {
    return "Turn the strongest visual moment into the first frame and make the title less technical.";
  }

  if (signal.tone === "new") {
    return "Wait until the video has enough feed exposure before changing the prompt strategy.";
  }

  if (signal.tone === "private") {
    return "Do not use this row for public performance decisions.";
  }

  return "Compare the hook caption, title, and first image against current winners before remaking it.";
}

export function stringArrayField(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
