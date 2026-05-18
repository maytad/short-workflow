import { useEffect, useState } from "react";
import {
  Audio,
  Img,
  Sequence,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { CaptionWord } from "@short-workflow/shared";
import { captionTimingDocSchema } from "@short-workflow/shared";

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

/**
 * Returns the word whose time window contains currentTimeSeconds, or null if
 * no word is active at that moment. Uses a linear scan — word arrays are small.
 */
export function findActiveWord(
  words: CaptionWord[],
  currentTimeSeconds: number,
): CaptionWord | null {
  for (const word of words) {
    if (currentTimeSeconds >= word.start && currentTimeSeconds < word.end) {
      return word;
    }
  }
  return null;
}

const captionContainerStyle: React.CSSProperties = {
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
  textShadow: "0 3px 8px rgba(0,0,0,0.9), 0 0 28px rgba(0,0,0,0.85)",
};

export const StaticCaption = ({ caption }: { caption: string }) => (
  <div style={captionContainerStyle}>{caption}</div>
);

export const KaraokeCaption = ({
  captionTimingPath,
  fps,
}: {
  captionTimingPath: string;
  fps: number;
}) => {
  const frame = useCurrentFrame();
  const [words, setWords] = useState<CaptionWord[] | null>(null);
  const [handle] = useState(() => delayRender("loading caption timing"));

  useEffect(() => {
    const url = resolveMediaSrc(captionTimingPath);
    fetch(url)
      .then((r) => r.json())
      .then((data: unknown) => {
        const doc = captionTimingDocSchema.parse(data);
        setWords(doc.words);
        continueRender(handle);
      })
      .catch(() => {
        continueRender(handle);
      });
  }, [captionTimingPath, handle]);

  if (!words) {
    return null;
  }

  const currentTimeSeconds = frame / fps;
  const activeWord = findActiveWord(words, currentTimeSeconds);

  return (
    <div style={captionContainerStyle}>
      {words.map((word, index) => (
        <span
          key={index}
          style={{
            color: word === activeWord ? "#FFD700" : "#ffffff",
          }}
        >
          {word.text}
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </div>
  );
};

export const SceneCaption = ({
  scene,
  fps,
}: {
  scene: Pick<RenderInput["scenes"][number], "caption" | "captionTimingPath">;
  fps: number;
}) => {
  if (scene.captionTimingPath) {
    return <KaraokeCaption captionTimingPath={scene.captionTimingPath} fps={fps} />;
  }
  return <StaticCaption caption={scene.caption} />;
};

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
        const durationInFrames = getSceneDurationFrames(scene, props.format.fps);
        const sequenceFrom = from;
        from += durationInFrames;

        return (
          <Sequence durationInFrames={durationInFrames} from={sequenceFrom} key={scene.id}>
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
              <SceneCaption scene={scene} fps={props.format.fps} />
            </div>
          </Sequence>
        );
      })}
    </div>
  );
};
