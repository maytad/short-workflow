# YouTube Subscribe Lower Third Design

Date: 2026-05-19
Author: short-workflow MVP
Status: Draft, awaiting user review

## Summary

Add a hardcoded YouTube subscribe lower-third animation to the final Remotion render. The overlay appears only during the `cta` scene at the end of the video and uses the local channel branding for Tiny Mechanisms.

This is a render-only visual enhancement for the MVP. It does not add database fields, API routes, frontend settings, migrations, worker job types, or new dependencies.

## Research Notes

- The referenced HyperFrames block is an animated YouTube subscribe lower third with avatar and channel info. Its documented duration is 4.5 seconds and its source dimensions are 1920x1080, so the project should recreate the behavior natively for the existing 1080x1920 Remotion pipeline instead of importing the horizontal HTML block directly.
- YouTube Shorts guidance says on-screen text can be used for calls to action and that text should be timed on the video timeline. This supports a short timed overlay instead of a persistent subscribe prompt.
- YouTube changed Shorts view counting on 2025-03-31, while keeping Engaged views for comparing how many viewers continued watching. This makes the hook and early value delivery more important than early subscribe exposure.
- YouTube Analytics includes audience retention reports for understanding which moments hold or lose viewer attention. The subscribe overlay should therefore be isolated and easy to tune later.
- The real YouTube subscribe action exists in the YouTube UI, not as a clickable button inside the rendered MP4. The overlay should read as a visual reminder, not as a deceptive interactive control.

References:

- https://hyperframes.heygen.com/catalog/blocks/yt-lower-third
- https://support.google.com/youtube/answer/13380879
- https://support.google.com/youtube/answer/10059070
- https://support.google.com/youtube/answer/9313698
- https://support.google.com/youtube/answer/4489286
- https://support.google.com/youtube/answer/13748639

## Goals

- Show a polished YouTube subscribe lower-third during the final `cta` scene.
- Keep the overlay short, deterministic, and non-disruptive to the main video content.
- Use hardcoded Tiny Mechanisms branding for the MVP.
- Avoid scope expansion into project settings, YouTube channel API reads, or per-project customization.
- Keep the implementation inside `apps/render` unless an existing asset convention requires a small static asset placement change.

## Non-Goals

- No HyperFrames package installation.
- No new npm/Bun dependencies.
- No database migration.
- No API route.
- No frontend control for enabling, disabling, or customizing the overlay.
- No YouTube channel API lookup.
- No generated avatar or image generation step.
- No interactive/clickable subscribe behavior inside the video.
- No changes to caption timing, TTS, scene generation, image generation, YouTube upload, or job lifecycle behavior.

## Product Behavior

The overlay appears only in scenes where `scene.role === "cta"`.

Default timing:

- Target duration: 4.5 seconds.
- If the `cta` scene is shorter than 4.5 seconds, use the available scene duration.
- If the `cta` scene is extremely short, keep the overlay readable by compressing the entrance and exit timing instead of dropping the component.

Hardcoded branding:

- Logo path: `logo/logo.png`
- Channel name: `Tiny Mechanisms`
- Initial button label: `Subscribe`
- Completed button label: `Subscribed`
- Avatar fallback: `TM`

The overlay should not appear in `hook`, `context`, `point`, or `payoff` scenes.

## Architecture

Implement the overlay as a native Remotion React component in `apps/render`.

Expected component boundary:

```text
apps/render/src/ShortVideo.tsx
  ShortVideo
    SceneVisual
    Audio
    SceneCaption
    SubscribeLowerThird
```

`ShortVideo` remains responsible for composing scene sequences. `SubscribeLowerThird` owns only the overlay layout and frame-derived animation state.

The component should be rendered from inside each scene sequence only when:

```ts
scene.role === "cta"
```

It should receive enough local render context to calculate deterministic animation:

```ts
type SubscribeLowerThirdProps = {
  durationInFrames: number;
  fps: number;
};
```

The component should use Remotion frame APIs already present in `ShortVideo.tsx`; it should not use runtime timers, random values, or browser-only layout measurement. The only allowed component state is image-load fallback state for switching from `logo/logo.png` to the `TM` avatar if the logo cannot be displayed.

## Asset Handling

The logo should be treated as a static render asset and referenced with:

```ts
resolveMediaSrc("logo/logo.png")
```

Expected file location:

```text
apps/render/public/logo/logo.png
```

If the implementation finds that `apps/render` already uses a different Remotion public/static asset convention, follow the existing convention and preserve the public path `logo/logo.png` from the component's point of view.

If the image fails to load or is not present, the render should still succeed by showing a circular fallback avatar with the letters `TM`.

This spec assumes the user-provided file exists or will be placed at the expected path before final manual visual verification.

## Layout

The overlay is designed for 1080x1920 vertical video.

Initial layout target:

- Position: lower part of the frame, below the karaoke/static caption region.
- Suggested placement: left aligned with `left: 64px`, `bottom: 70px` to `90px`.
- Suggested width: 560px to 640px.
- Height: compact enough to avoid fighting the existing caption area.
- Shape: a single rounded rectangle lower-third surface, not nested cards.
- Avatar: circular logo at the left.
- Text: channel name and optional small supporting label.
- Action: YouTube-red `Subscribe` pill on the right, transitioning to a neutral `Subscribed` state.

The current caption style uses a bottom placement around `150px`. If the first implementation overlaps captions, prefer lowering or compacting the subscribe overlay rather than moving captions.

## Motion

All motion must be deterministic from the local scene frame.

Motion sequence:

1. Entrance: slide up, fade in, and scale from about `0.96` to `1`.
2. Hold: show logo, channel name, and red `Subscribe` button.
3. Interaction beat: after roughly 1.5 to 2.0 seconds, apply a small press animation to the button.
4. State change: switch button copy to `Subscribed` and show a check or bell-style completion state.
5. Exit: fade and slide down during the last frames of the overlay window.

Suggested timings at 30fps:

- Entrance: 10 to 14 frames.
- Button press: 6 to 10 frames.
- Exit: 10 to 12 frames.
- Total target duration: 135 frames.

The implementation can tune exact numbers for readability, but it must keep the overlay short and avoid distracting from the `cta` narration.

## Data Flow

No render input schema change is required.

Current render flow:

```text
worker builds RenderInput
  -> apps/render stages media assets
  -> Remotion renders ShortVideo
  -> ShortVideo renders SubscribeLowerThird in cta scene
```

The lower-third uses render-local constants:

```ts
const SUBSCRIBE_LOWER_THIRD = {
  channelName: "Tiny Mechanisms",
  logoPath: "logo/logo.png",
  durationSeconds: 4.5,
};
```

If future customization is needed, use a separate follow-up spec to add a typed `branding` object to `RenderInput` or a shared local config boundary.

## Error Handling

- Missing logo: show `TM` avatar fallback and continue rendering.
- `cta` scene shorter than 4.5 seconds: clamp overlay duration to the scene duration.
- Non-CTA scene: render nothing.
- Caption timing load failure: unchanged existing behavior; fall back to static caption.
- Render media staging failure for scene images/audio: unchanged existing behavior.

The subscribe overlay should never be the reason a render fails unless the React component itself has a programming error.

## Testing And Verification

Follow the MVP validation rule: use the lightest relevant checks and do not add broad automated suites by default.

Focused automated checks should cover deterministic helper logic if helper functions are introduced:

- CTA-only visibility decision.
- Overlay duration clamping for scenes shorter than 4.5 seconds.
- Animation state at representative frames: hidden before/after, entering, subscribed state, exiting.

Manual verification should cover:

- A local Remotion render or preview using an existing fixture or project with a `cta` scene.
- Logo displays from `logo/logo.png` when present.
- Fallback avatar displays if the logo is absent or cannot be loaded.
- Overlay does not obscure karaoke/static captions.
- Overlay appears only during the final CTA scene.

Recommended command scope, depending on available scripts:

```bash
bun run --filter @short-workflow/render check
```

or the render package's narrow test/check command if one exists.

## Implementation Boundaries

Allowed changes:

- `apps/render/src/ShortVideo.tsx`
- focused render tests such as `apps/render/src/ShortVideo.test.ts`
- static logo placement under `apps/render/public/logo/logo.png` if the asset is present in the workspace and needs to be copied into the render public tree

Avoid changes to:

- `packages/shared/src/render.ts`
- `apps/worker/src/handlers/renderVideo.ts`
- `packages/db`
- `apps/api`
- `apps/web`
- YouTube upload/auth code

## Future Extensions

Possible follow-ups, explicitly out of scope for this MVP step:

- Project-level subscribe overlay toggle.
- Custom channel name, handle, and avatar per project.
- Automatic channel info from the connected YouTube account.
- Alternative overlay styles for TikTok or Instagram.
- A/B timing variants for retention testing.
