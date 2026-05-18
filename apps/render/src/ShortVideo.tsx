import { useEffect, useRef, useState } from "react";
import {
  Audio,
  Easing,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { CaptionTimingDoc, CaptionWord } from "@short-workflow/shared";
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
 * Returns the index of the active word at time t. A word is active from its
 * own start until the next word starts (or until its end if it is the last
 * word). This intentionally extends through inter-word silences — without it,
 * the highlight flickers off-on across the small gaps that ElevenLabs leaves
 * between words.
 *
 * Returns -1 only for pre-roll (before any word has started) and post-roll
 * (after the last word's end has passed).
 */
export function pickActiveIndex(words: readonly CaptionWord[], t: number): number {
  if (words.length === 0) return -1;
  if (t < words[0]!.start) return -1;
  for (let i = 0; i < words.length; i += 1) {
    const next = words[i + 1];
    const upper = next ? next.start : words[i]!.end;
    if (t >= words[i]!.start && t < upper) return i;
  }
  return -1;
}

type ChunkedWord = { word: CaptionWord; index: number };
type Chunk = ChunkedWord[];

const PUNCT_SENTENCE = new Set([".", "?", "!"]);

export function chunkWords(
  words: readonly CaptionWord[],
  opts: { target: number; min: number; max: number },
): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk = [];

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current);
      current = [];
    }
  };

  for (let i = 0; i < words.length; i += 1) {
    current.push({ word: words[i]!, index: i });
    const text = words[i]!.text;
    const lastChar = text.slice(-1);

    if (current.length >= opts.max) {
      flush();
      continue;
    }
    if (PUNCT_SENTENCE.has(lastChar)) {
      flush();
      continue;
    }
    if (lastChar === "," && current.length >= opts.min) {
      flush();
    }
  }
  flush();
  return chunks;
}

/**
 * Selects the chunk to display. Uses a sticky "progress index" — the latest
 * word whose start has already passed — so the chunk does not flicker back to
 * chunks[0] during inter-word silences (mid-stream activeIndex === -1) or
 * after the last word ends (post-roll). Pre-roll still shows chunks[0].
 */
function pickChunk(
  chunks: readonly Chunk[],
  words: readonly CaptionWord[],
  t: number,
): Chunk {
  if (chunks.length === 0) return [];
  if (words.length === 0) return chunks[0] ?? [];
  if (t < words[0]!.start) return chunks[0] ?? [];

  let progressIndex = 0;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i]!.start <= t) progressIndex = i;
    else break;
  }

  for (const chunk of chunks) {
    if (chunk.some((entry) => entry.index === progressIndex)) return chunk;
  }
  return chunks[chunks.length - 1] ?? [];
}

const CAPTION_BOX_STYLE: React.CSSProperties = {
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

function StaticCaption({ text }: { text: string }) {
  return <div style={CAPTION_BOX_STYLE}>{text}</div>;
}

function KaraokeCaption({
  timingSrc,
  staticFallback,
}: {
  timingSrc: string;
  staticFallback: string;
}) {
  // All hooks declared up front, never inside a conditional.
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [handle] = useState(() => delayRender("caption_timing_load"));
  const [doc, setDoc] = useState<CaptionTimingDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const continuedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const releaseHandle = () => {
      if (continuedRef.current) return;
      continuedRef.current = true;
      continueRender(handle);
    };

    fetch(timingSrc)
      .then((r) => {
        if (!r.ok) throw new Error(`fetch_status_${r.status}`);
        return r.json();
      })
      .then((json) => captionTimingDocSchema.parse(json))
      .then((parsed) => {
        if (!cancelled) setDoc(parsed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        releaseHandle();
      });

    return () => {
      cancelled = true;
      releaseHandle();
    };
  }, [timingSrc, handle]);

  if (failed || !doc) {
    return <StaticCaption text={staticFallback} />;
  }

  const t = localFrame / fps;
  const activeIndex = pickActiveIndex(doc.words, t);
  const chunks = chunkWords(doc.words, { target: 5, min: 4, max: 6 });
  const selected = pickChunk(chunks, doc.words, t);

  return (
    <div style={CAPTION_BOX_STYLE}>
      {selected.map((entry) => {
        const { word, index } = entry;
        const isActive = index === activeIndex;
        const wordStartFrame = Math.round(word.start * fps);
        const wordEndFrame = Math.round(word.end * fps);
        const desiredEase = Math.round(0.08 * fps);
        const minSpan = 2;
        const effectiveEnd = Math.max(wordStartFrame + minSpan, wordEndFrame);
        const easeFrames = Math.max(
          1,
          Math.min(desiredEase, Math.floor((effectiveEnd - wordStartFrame) / 2)),
        );
        const easeIn = wordStartFrame + easeFrames;
        const easeOut = effectiveEnd + easeFrames;
        const scaleProgress = interpolate(
          localFrame,
          [wordStartFrame, easeIn, effectiveEnd, easeOut],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          },
        );
        const scale = 1 + 0.08 * scaleProgress;
        const color = isActive ? "#FFD400" : "#FFFFFF";

        return (
          <span
            key={index}
            style={{
              display: "inline-block",
              color,
              transform: `scale(${scale})`,
              transformOrigin: "center",
              marginRight: "0.25em",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}

function SceneCaption({
  scene,
}: {
  scene: RenderInput["scenes"][number];
}) {
  if (scene.captionTimingPath) {
    return (
      <KaraokeCaption
        timingSrc={resolveMediaSrc(scene.captionTimingPath)}
        staticFallback={scene.caption}
      />
    );
  }
  return <StaticCaption text={scene.caption} />;
}

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
              <SceneCaption scene={scene} />
            </div>
          </Sequence>
        );
      })}
    </div>
  );
};
