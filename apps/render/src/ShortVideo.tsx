import { Audio, Img, Sequence, staticFile, useVideoConfig } from "remotion";

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

export const getSceneDurationFrames = (
  scene: SceneDuration,
  fps: number,
) => Math.round(scene.durationSeconds * fps);

export const getTotalDurationFrames = (
  scenes: readonly SceneDuration[],
  fps: number,
) =>
  scenes.reduce(
    (total, scene) => total + getSceneDurationFrames(scene, fps),
    0,
  );

export const ShortVideo = (props: RenderInput) => {
  const { width, height } = useVideoConfig();
  let from = 0;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#050505",
        overflow: "hidden",
      }}
    >
      {props.scenes.map((scene) => {
        const durationInFrames = getSceneDurationFrames(
          scene,
          props.format.fps,
        );
        const sequenceFrom = from;
        from += durationInFrames;

        return (
          <Sequence
            durationInFrames={durationInFrames}
            from={sequenceFrom}
            key={scene.id}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                backgroundColor: "#050505",
              }}
            >
              <Img
                src={resolveMediaSrc(scene.imagePath)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              <Audio src={resolveMediaSrc(scene.audioPath)} />
              <div
                style={{
                  position: "absolute",
                  left: 72,
                  right: 72,
                  bottom: 150,
                  color: "#ffffff",
                  fontFamily:
                    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                  fontSize: 62,
                  fontWeight: 800,
                  lineHeight: 1.12,
                  textAlign: "center",
                  textShadow:
                    "0 3px 8px rgba(0,0,0,0.9), 0 0 28px rgba(0,0,0,0.85)",
                }}
              >
                {scene.caption}
              </div>
            </div>
          </Sequence>
        );
      })}
    </div>
  );
};
