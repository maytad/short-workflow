import { useState } from "react";
import {
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { SceneCaption } from "./Captions";
import type { RenderInput } from "./schema";

type SceneDuration = Pick<RenderInput["scenes"][number], "durationSeconds">;

const isAbsoluteOrUrl = (src: string) =>
  src.startsWith("file://") ||
  src.startsWith("/") ||
  /^[a-zA-Z]:[\\/]/.test(src) ||
  /^https?:\/\//.test(src);

const absolutePathToFileUrl = (src: string) => {
  if (src.startsWith("file://") || /^https?:\/\//.test(src)) {
    return src;
  }

  if (/^[a-zA-Z]:[\\/]/.test(src)) {
    return `file:///${src.replaceAll("\\", "/")}`;
  }

  return `file://${src}`;
};

export const resolveMediaSrc = (src: string) =>
  isAbsoluteOrUrl(src) ? absolutePathToFileUrl(src) : staticFile(src);

export const getSceneDurationFrames = (scene: SceneDuration, fps: number) =>
  Math.round(scene.durationSeconds * fps);

export const getTotalDurationFrames = (scenes: readonly SceneDuration[], fps: number) =>
  scenes.reduce((total, scene) => total + getSceneDurationFrames(scene, fps), 0);

export function getSceneVisualTransitionFrames(input: {
  fps: number;
  nextDurationInFrames: number;
  previousDurationInFrames: number;
}) {
  const targetFrames = Math.max(1, Math.round(0.3 * input.fps));
  const previousDuration = Math.max(0, Math.round(input.previousDurationInFrames));
  const nextDuration = Math.max(0, Math.round(input.nextDurationInFrames));
  const maxBySceneDuration = Math.floor(Math.min(previousDuration, nextDuration) / 3);

  return Math.max(0, Math.min(targetFrames, maxBySceneDuration));
}

export function getSceneVisualOpacity(input: { frame: number; transitionInFrames: number }) {
  const transitionInFrames = Math.max(0, Math.round(input.transitionInFrames));

  if (transitionInFrames === 0) {
    return 1;
  }

  return interpolate(input.frame, [0, transitionInFrames], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

type SceneMotionRole = RenderInput["scenes"][number]["role"];

export type SceneMotionProfile = {
  baseScaleStart: number;
  baseScaleEnd: number;
  panX: number;
  panY: number;
  beatEveryFrames: number;
  beatOffsetFrames: number;
  pulseFrames: number;
  overlayMaxOpacity: number;
  captionScrimOpacity: number;
};

export type SceneMotionStyle = {
  scale: number;
  translateX: number;
  translateY: number;
  overlayOpacity: number;
  captionScrimOpacity: number;
};

export type SceneMotionStyleInput = {
  durationInFrames: number;
  fps: number;
  frame: number;
  position: number;
  role: SceneMotionRole;
};

const deterministicDirection = (position: number) => (position % 2 === 0 ? -1 : 1);

const smoothPulseProgress = (beatPosition: number, pulseFrames: number) => {
  const pulseDuration = Math.max(2, pulseFrames);
  if (beatPosition < 0 || beatPosition > pulseDuration) {
    return 0;
  }

  return interpolate(beatPosition, [0, pulseDuration / 2, pulseDuration], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
};

export function sceneMotionProfile(
  role: SceneMotionRole,
  position: number,
  fps: number,
): SceneMotionProfile {
  const direction = deterministicDirection(position);
  const twoSeconds = Math.max(1, Math.round(2 * fps));
  const threeSeconds = Math.max(1, Math.round(3 * fps));
  const fourSeconds = Math.max(1, Math.round(4 * fps));

  switch (role) {
    case "hook":
      return {
        baseScaleStart: 1.07,
        baseScaleEnd: 1.105,
        panX: 34 * direction,
        panY: -20,
        beatEveryFrames: twoSeconds,
        beatOffsetFrames: Math.round(0.25 * fps),
        pulseFrames: Math.round(0.55 * fps),
        overlayMaxOpacity: 0.18,
        captionScrimOpacity: 0.32,
      };
    case "context":
      return {
        baseScaleStart: 1.05,
        baseScaleEnd: 1.075,
        panX: 24 * direction,
        panY: 10,
        beatEveryFrames: fourSeconds,
        beatOffsetFrames: Math.round(0.75 * fps),
        pulseFrames: Math.round(0.45 * fps),
        overlayMaxOpacity: 0.1,
        captionScrimOpacity: 0.28,
      };
    case "point":
      return {
        baseScaleStart: 1.06,
        baseScaleEnd: 1.12,
        panX: 28 * direction,
        panY: -14,
        beatEveryFrames: threeSeconds,
        beatOffsetFrames: Math.round(0.45 * fps),
        pulseFrames: Math.round(0.55 * fps),
        overlayMaxOpacity: 0.22,
        captionScrimOpacity: 0.34,
      };
    case "payoff":
      return {
        baseScaleStart: 1.055,
        baseScaleEnd: 1.09,
        panX: 26 * direction,
        panY: -8,
        beatEveryFrames: threeSeconds,
        beatOffsetFrames: Math.round(0.65 * fps),
        pulseFrames: Math.round(0.5 * fps),
        overlayMaxOpacity: 0.14,
        captionScrimOpacity: 0.32,
      };
    case "cta":
      return {
        baseScaleStart: 1.05,
        baseScaleEnd: 1.085,
        panX: -22 * direction,
        panY: 12,
        beatEveryFrames: threeSeconds,
        beatOffsetFrames: Math.round(0.35 * fps),
        pulseFrames: Math.round(0.45 * fps),
        overlayMaxOpacity: 0.12,
        captionScrimOpacity: 0.32,
      };
  }
}

export function getSceneMotionStyle(input: SceneMotionStyleInput): SceneMotionStyle {
  const duration = Math.max(1, input.durationInFrames);
  const frame = Math.min(Math.max(0, input.frame), duration - 1);
  const profile = sceneMotionProfile(input.role, input.position, input.fps);
  const progress = duration <= 1 ? 1 : frame / (duration - 1);

  const baseScale = interpolate(progress, [0, 1], [profile.baseScaleStart, profile.baseScaleEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const rawBeatFrame = frame - profile.beatOffsetFrames;
  const beatFrame = Math.max(0, rawBeatFrame);
  const beatPosition =
    profile.beatEveryFrames > 0 ? beatFrame % profile.beatEveryFrames : beatFrame;
  const pulseProgress =
    rawBeatFrame >= 0 ? smoothPulseProgress(beatPosition, profile.pulseFrames) : 0;

  const scale = baseScale;

  const overlayOpacity = Math.min(
    profile.overlayMaxOpacity,
    profile.overlayMaxOpacity * (1 - progress) + profile.overlayMaxOpacity * 0.35 * pulseProgress,
  );

  return {
    scale,
    translateX: interpolate(progress, [0, 1], [-profile.panX, profile.panX], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }),
    translateY: interpolate(progress, [0, 1], [-profile.panY, profile.panY], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }),
    overlayOpacity,
    captionScrimOpacity: profile.captionScrimOpacity,
  };
}

export const SUBSCRIBE_LOWER_THIRD = {
  channelName: "Tiny Mechanisms",
  durationSeconds: 4.5,
  logoPath: "logo/logo.png",
} as const;

export type SubscribeLowerThirdWindow = {
  durationInFrames: number;
  endFrame: number;
  startFrame: number;
};

export type SubscribeLowerThirdState = {
  buttonScale: number;
  localFrame: number;
  opacity: number;
  scale: number;
  subscribed: boolean;
  translateY: number;
  visible: boolean;
};

const hiddenSubscribeLowerThirdState: SubscribeLowerThirdState = {
  buttonScale: 1,
  localFrame: -1,
  opacity: 0,
  scale: 0.96,
  subscribed: false,
  translateY: 24,
  visible: false,
};

export function shouldShowSubscribeLowerThird(role: SceneMotionRole) {
  return role === "cta";
}

export function getSubscribeLowerThirdWindow(input: {
  fps: number;
  sceneDurationInFrames: number;
}): SubscribeLowerThirdWindow {
  const sceneDurationInFrames = Math.max(0, Math.round(input.sceneDurationInFrames));

  if (sceneDurationInFrames === 0) {
    return {
      durationInFrames: 0,
      endFrame: 0,
      startFrame: 0,
    };
  }

  const targetDurationInFrames = Math.max(
    1,
    Math.round(SUBSCRIBE_LOWER_THIRD.durationSeconds * input.fps),
  );
  const durationInFrames = Math.min(sceneDurationInFrames, targetDurationInFrames);
  const startFrame = Math.max(0, sceneDurationInFrames - durationInFrames);

  return {
    durationInFrames,
    endFrame: startFrame + durationInFrames,
    startFrame,
  };
}

export function getSubscribeLowerThirdState(input: {
  fps: number;
  frame: number;
  sceneDurationInFrames: number;
}): SubscribeLowerThirdState {
  const window = getSubscribeLowerThirdWindow({
    fps: input.fps,
    sceneDurationInFrames: input.sceneDurationInFrames,
  });

  if (
    window.durationInFrames === 0 ||
    input.frame < window.startFrame ||
    input.frame >= window.endFrame
  ) {
    return hiddenSubscribeLowerThirdState;
  }

  const localFrame = input.frame - window.startFrame;
  const entranceFrames = Math.max(
    1,
    Math.min(Math.round(0.4 * input.fps), Math.floor(window.durationInFrames / 3)),
  );
  const exitFrames = Math.max(
    1,
    Math.min(Math.round(0.36 * input.fps), Math.floor(window.durationInFrames / 3)),
  );
  const pressFrames = Math.max(
    1,
    Math.min(Math.round(0.24 * input.fps), Math.floor(window.durationInFrames / 4)),
  );
  const pressStartFrame = Math.min(
    Math.round(1.65 * input.fps),
    Math.max(0, window.durationInFrames - exitFrames - pressFrames - 1),
  );

  const entranceProgress = interpolate(localFrame, [0, entranceFrames], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitStartFrame = Math.max(0, window.durationInFrames - exitFrames);
  const exitProgress = interpolate(
    localFrame,
    [exitStartFrame, Math.max(exitStartFrame + 1, window.durationInFrames - 1)],
    [1, 0],
    {
      easing: Easing.in(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const pressProgress =
    localFrame >= pressStartFrame && localFrame <= pressStartFrame + pressFrames
      ? interpolate(
          localFrame,
          [pressStartFrame, pressStartFrame + pressFrames / 2, pressStartFrame + pressFrames],
          [0, 1, 0],
          {
            easing: Easing.out(Easing.cubic),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )
      : 0;

  return {
    buttonScale: 1 - 0.08 * pressProgress,
    localFrame,
    opacity: Math.min(entranceProgress, exitProgress),
    scale: 0.96 + 0.04 * entranceProgress,
    subscribed: localFrame >= pressStartFrame + pressFrames,
    translateY: 28 * (1 - entranceProgress) + 20 * (1 - exitProgress),
    visible: true,
  };
}

function SubscribeAvatar() {
  const [logoFailed, setLogoFailed] = useState(false);
  const avatarStyle: React.CSSProperties = {
    alignItems: "center",
    background: "linear-gradient(135deg, #151515, #2a2a2a)",
    border: "3px solid rgba(255,255,255,0.92)",
    borderRadius: "50%",
    boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
    color: "#ffffff",
    display: "flex",
    flex: "0 0 auto",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    fontSize: 24,
    fontWeight: 900,
    height: 68,
    justifyContent: "center",
    lineHeight: 1,
    overflow: "hidden",
    width: 68,
  };

  if (logoFailed) {
    return <div style={avatarStyle}>TM</div>;
  }

  return (
    <div style={avatarStyle}>
      <Img
        onError={() => setLogoFailed(true)}
        src={resolveMediaSrc(SUBSCRIBE_LOWER_THIRD.logoPath)}
        style={{
          height: "100%",
          objectFit: "cover",
          width: "100%",
        }}
      />
    </div>
  );
}

function SubscribeCheckMark() {
  return (
    <svg
      aria-hidden="true"
      height="26"
      viewBox="0 0 28 28"
      width="26"
      style={{
        display: "block",
        flex: "0 0 auto",
      }}
    >
      <circle cx="14" cy="14" fill="#ffffff" r="13" />
      <path
        d="M8.1 14.4 12 18.2 20.2 9.8"
        fill="none"
        stroke="#1f2937"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function SubscribeLowerThird({ durationInFrames }: { durationInFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = getSubscribeLowerThirdState({
    fps,
    frame,
    sceneDurationInFrames: durationInFrames,
  });

  if (!state.visible) {
    return null;
  }

  const buttonBackground = state.subscribed ? "#f4f4f5" : "#ff0033";
  const buttonColor = state.subscribed ? "#27272a" : "#ffffff";

  return (
    <div
      style={{
        alignItems: "center",
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(255,255,255,0.72)",
        borderRadius: 22,
        bottom: 34,
        boxShadow: "0 18px 48px rgba(0,0,0,0.3)",
        display: "flex",
        gap: 18,
        height: 88,
        left: 64,
        opacity: state.opacity,
        padding: "12px 16px",
        position: "absolute",
        transform: `translate3d(0, ${state.translateY}px, 0) scale(${state.scale})`,
        transformOrigin: "left bottom",
        width: 560,
        willChange: "opacity, transform",
      }}
    >
      <SubscribeAvatar />
      <div
        style={{
          display: "flex",
          flex: "1 1 auto",
          flexDirection: "column",
          gap: 7,
          minWidth: 0,
        }}
      >
        <div
          style={{
            color: "#111111",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 27,
            fontWeight: 850,
            letterSpacing: 0,
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {SUBSCRIBE_LOWER_THIRD.channelName}
        </div>
        <div
          style={{
            color: "#666666",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 17,
            fontWeight: 650,
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          YouTube
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          background: buttonBackground,
          borderRadius: 999,
          boxShadow: state.subscribed
            ? "inset 0 0 0 1px rgba(24,24,27,0.08)"
            : "0 14px 32px rgba(255,0,51,0.32)",
          color: buttonColor,
          display: "flex",
          flex: "0 0 auto",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          fontSize: 20,
          fontWeight: 850,
          gap: state.subscribed ? 8 : 0,
          height: 48,
          justifyContent: "center",
          letterSpacing: 0,
          lineHeight: 1,
          minWidth: state.subscribed ? 146 : 132,
          padding: "0 18px",
          transform: `scale(${state.buttonScale})`,
          transformOrigin: "center",
          willChange: "transform",
        }}
      >
        {state.subscribed ? <SubscribeCheckMark /> : null}
        {state.subscribed ? "Subscribed" : "Subscribe"}
      </div>
    </div>
  );
}

function SceneVisual({
  durationInFrames,
  frameOverride,
  scene,
}: {
  durationInFrames: number;
  frameOverride?: number;
  scene: RenderInput["scenes"][number];
}) {
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = frameOverride ?? currentFrame;
  const motion = getSceneMotionStyle({
    durationInFrames,
    fps,
    frame,
    position: scene.position,
    role: scene.role,
  });

  return (
    <>
      <Img
        src={resolveMediaSrc(scene.imagePath)}
        style={{
          height: "100%",
          objectFit: "cover",
          transform: `translate3d(${motion.translateX}px, ${motion.translateY}px, 0) scale(${motion.scale})`,
          transformOrigin: "center",
          willChange: "transform",
          width: "100%",
        }}
      />
      <div
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.16), rgba(0,0,0,0) 36%), linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.18))",
          inset: 0,
          opacity: motion.overlayOpacity,
          pointerEvents: "none",
          position: "absolute",
        }}
      />
      <div
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.66) 100%)",
          bottom: 0,
          height: 520,
          left: 0,
          opacity: motion.captionScrimOpacity,
          pointerEvents: "none",
          position: "absolute",
          right: 0,
        }}
      />
    </>
  );
}

type SceneTiming = {
  durationInFrames: number;
  scene: RenderInput["scenes"][number];
  sequenceFrom: number;
};

function SceneVisualTrack({
  sceneTimings,
  transitionInFramesByScene,
}: {
  sceneTimings: readonly SceneTiming[];
  transitionInFramesByScene: readonly number[];
}) {
  const absoluteFrame = useCurrentFrame();

  return (
    <div
      style={{
        backgroundColor: "#050505",
        inset: 0,
        position: "absolute",
      }}
    >
      {sceneTimings.map((timing, index) => {
        const requestedTransitionFrames = transitionInFramesByScene[index] ?? 0;
        const visualStartFrame = Math.max(0, timing.sequenceFrom - requestedTransitionFrames);
        const transitionInFrames = timing.sequenceFrom - visualStartFrame;
        const visualEndFrame = timing.sequenceFrom + timing.durationInFrames;

        if (absoluteFrame < visualStartFrame || absoluteFrame >= visualEndFrame) {
          return null;
        }

        const localFrame = Math.max(0, absoluteFrame - timing.sequenceFrom);
        const opacity = getSceneVisualOpacity({
          frame: absoluteFrame - visualStartFrame,
          transitionInFrames,
        });

        return (
          <div
            key={`${timing.scene.id}-visual`}
            style={{
              inset: 0,
              opacity,
              position: "absolute",
            }}
          >
            <SceneVisual
              durationInFrames={timing.durationInFrames}
              frameOverride={localFrame}
              scene={timing.scene}
            />
          </div>
        );
      })}
    </div>
  );
}

export const ShortVideo = (props: RenderInput) => {
  const { width, height } = useVideoConfig();
  let from = 0;
  const sceneTimings = props.scenes.map((scene) => {
    const durationInFrames = getSceneDurationFrames(scene, props.format.fps);
    const sequenceFrom = from;
    from += durationInFrames;

    return {
      durationInFrames,
      scene,
      sequenceFrom,
    };
  });
  const transitionInFramesByScene = sceneTimings.map((timing, index) => {
    const previousTiming = sceneTimings[index - 1];

    if (!previousTiming) {
      return 0;
    }

    return getSceneVisualTransitionFrames({
      fps: props.format.fps,
      nextDurationInFrames: timing.durationInFrames,
      previousDurationInFrames: previousTiming.durationInFrames,
    });
  });

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#050505",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <SceneVisualTrack
        sceneTimings={sceneTimings}
        transitionInFramesByScene={transitionInFramesByScene}
      />
      {sceneTimings.map((timing) => (
        <Sequence
          durationInFrames={timing.durationInFrames}
          from={timing.sequenceFrom}
          key={`${timing.scene.id}-audio-caption`}
        >
          <Audio src={resolveMediaSrc(timing.scene.audioPath)} />
          {shouldShowSubscribeLowerThird(timing.scene.role) ? (
            <SubscribeLowerThird durationInFrames={timing.durationInFrames} />
          ) : null}
          <SceneCaption resolveSrc={resolveMediaSrc} scene={timing.scene} />
        </Sequence>
      ))}
    </div>
  );
};
