# YouTube Shorts Views Recovery Design

## Summary

The current problem is YouTube Shorts performance, not app UI. Recent exports show that
Shorts feed is already the dominant traffic source, but viewers do not choose to keep watching
often enough. The next iteration should focus on improving the first 1-3 seconds, visual hook
clarity, and engaged-view quality before optimizing SEO, descriptions, or interface polish.

## Evidence

- YouTube Studio traffic source screenshot shows Shorts feed at 96.8% of views in the last
  28 days. The videos are being distributed through Shorts feed.
- The exported CSV includes `Stayed to watch (%)`, which is the practical export label for
  viewed-vs-swiped-away behavior.
- The export total shows `Stayed to watch (%)` at 45.74%, meaning roughly 54.26% of viewers
  swipe away.
- The export total shows `Average percentage viewed (%)` at 50.16%, so mid-video retention is
  also weak for short-form content.
- `Shown in feed` is not present in the provided export. Because Shorts feed traffic is already
  high, this field is useful later but is not the immediate blocker.

## Problem Statement

The channel is receiving Shorts feed traffic, but the opening seconds are not strong enough to
convert enough feed exposures into engaged viewers. Raw views around 800-1,500 should be treated
as baseline, not success. The current pipeline needs to optimize for viewer choice and retention
before expecting distribution to scale.

## Success Metrics

Use these gates for the next experiment batch:

- `Stayed to watch (%) < 45%`: fail; rewrite the first frame and first line.
- `45-55%`: weak; hook is not reliable enough to scale.
- `55-60%`: usable; inspect average percentage viewed before continuing.
- `60%+` with `Average percentage viewed (%) > 60%`: candidate for topic/style reuse.

Raw views remain a scale metric only. They should not be used alone to decide whether a topic or
prompt format is good.

## Content Strategy

Prioritize videos where the first frame shows a clear moving or tension state:

- latch, ratchet, zipper, nail clipper, tape measure lock, stapler, door closer, camera aperture,
  cam follower, spring release, pawl lock

Avoid or pause topics that have weak viewer-choice signals:

- perception, biology, voice, onions, abstract physics gimmicks, and repeated cabinet/push-latch
  variants until a new hook format proves stronger

## Prompt Direction

The generation prompts should favor:

- first image shows action, tension, snap, lock, release, or visible contradiction
- no clean product shot as the opening image
- no diagram or cutaway as the opening image
- first narration sentence describes what the viewer sees, not an abstract concept
- hook caption uses five words or fewer
- hook subtitle avoids semicolons, unusual punctuation, and sentence fragments that read awkwardly
- payoff appears early enough that viewers understand the promise before swiping

## Experiment Batch

Create a 12-video batch with three controlled variants:

1. Four videos open with a visually strange action in the first frame.
2. Four videos open with a short contradiction caption.
3. Four videos reveal the hidden mechanism within the first two seconds.

All variants should use familiar objects with visible mechanical behavior. The goal is not to
maximize topic diversity in the batch; the goal is to isolate which opening format improves
`Stayed to watch (%)`.

## Analysis Flow

Evaluate each video after 24 and 48 hours:

- If `Stayed to watch (%)` is low, treat the first frame, first caption, and first narration line
  as the failure point.
- If `Stayed to watch (%)` is good but `Average percentage viewed (%)` is low, treat pacing and
  reveal timing as the failure point.
- If both are good but views remain low, treat the topic appeal or audience fit as the likely
  constraint.

## Out Of Scope

- UI redesign
- YouTube SEO overhaul
- hashtag strategy beyond keeping Shorts discoverability intact
- YouTube Studio scraping
- broad analytics dashboard redesign

## Open Implementation Notes

- Exact `Shown in feed` is not available in the current CSV export and is not required for the
  next experiment gate.
- `Stayed to watch (%)` should be treated as the current manual-import metric for
  viewed-vs-swiped-away.
- Future implementation can add CSV/manual import for this metric, but the first decision can be
  made from Studio exports and manual review.
