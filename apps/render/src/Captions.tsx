import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Easing,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { CaptionTimingDoc, CaptionWord } from "@short-workflow/shared";
import { captionTimingDocSchema } from "@short-workflow/shared";

import type { RenderInput } from "./schema";

type CaptionRole = RenderInput["scenes"][number]["role"];

export type ChunkedWord = { word: CaptionWord; index: number };
export type Chunk = ChunkedWord[];

const PUNCT_SENTENCE = new Set([".", "?", "!"]);
const PUNCH_CAPTION_SECONDS = 1.15;
const KEYWORD_ACCENT = "#6EE7FF";
const ACTIVE_ACCENT = "#FFD400";

const MECHANISM_KEYWORDS = new Set([
  "bend",
  "bends",
  "block",
  "blocks",
  "body",
  "cam",
  "catch",
  "catches",
  "clutch",
  "closer",
  "clipper",
  "clippers",
  "escapement",
  "freewheel",
  "gear",
  "gears",
  "grab",
  "grabs",
  "grip",
  "grips",
  "hook",
  "jaw",
  "jaws",
  "latch",
  "lock",
  "locks",
  "mass",
  "pawl",
  "pendulum",
  "pin",
  "pins",
  "pivot",
  "pull",
  "pulls",
  "push",
  "pushes",
  "ratchet",
  "release",
  "releases",
  "slide",
  "slides",
  "sliding",
  "snap",
  "snaps",
  "spring",
  "springs",
  "staple",
  "stapler",
  "strap",
  "squeeze",
  "squeezes",
  "tape",
  "teeth",
  "tick",
  "ticks",
  "tooth",
  "valve",
  "valves",
  "weight",
  "wedge",
  "zipper",
]);

const CAPTION_BOX_BASE_STYLE: CSSProperties = {
  position: "absolute",
  left: 84,
  right: 176,
  bottom: 292,
  color: "#ffffff",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontSize: 58,
  fontWeight: 820,
  lineHeight: 1.1,
  maxHeight: 190,
  overflow: "hidden",
  textAlign: "center",
  textShadow: "0 3px 8px rgba(0,0,0,0.9), 0 0 28px rgba(0,0,0,0.85)",
};

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

export function chunkWords(
  words: readonly CaptionWord[],
  opts: { target: number; min: number; max: number; maxDurationSeconds?: number },
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
    const nextWord = words[i]!;
    const firstWord = current[0]?.word;
    if (
      opts.maxDurationSeconds !== undefined &&
      firstWord &&
      current.length >= opts.min &&
      nextWord.end - firstWord.start > opts.maxDurationSeconds
    ) {
      flush();
    }

    current.push({ word: words[i]!, index: i });
    const text = words[i]!.text;
    const lastChar = text.slice(-1);
    const first = current[0]?.word;
    const currentDuration = first ? words[i]!.end - first.start : 0;

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
      continue;
    }
    if (
      opts.maxDurationSeconds !== undefined &&
      current.length >= opts.min &&
      currentDuration >= opts.maxDurationSeconds
    ) {
      flush();
    }
  }
  flush();
  return chunks;
}

export function shouldShowPunchCaption(role: CaptionRole, t: number) {
  return role === "hook" && t >= 0 && t < PUNCH_CAPTION_SECONDS;
}

export function captionBoxStyleForRole(role: CaptionRole): CSSProperties {
  return {
    ...CAPTION_BOX_BASE_STYLE,
    bottom: role === "cta" ? 410 : CAPTION_BOX_BASE_STYLE.bottom,
  };
}

export function isMechanismKeyword(text: string) {
  const normalized = text.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

  return MECHANISM_KEYWORDS.has(normalized);
}

function pickChunk(chunks: readonly Chunk[], words: readonly CaptionWord[], t: number): Chunk {
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

function StaticCaption({ role, text }: { role: CaptionRole; text: string }) {
  return <div style={captionBoxStyleForRole(role)}>{text}</div>;
}

function PunchCaption({ frame, fps, text }: { frame: number; fps: number; text: string }) {
  const opacity = interpolate(
    frame,
    [0, Math.round(0.18 * fps), Math.round(0.95 * fps), Math.round(1.15 * fps)],
    [0, 1, 1, 0],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <div
      style={{
        color: ACTIVE_ACCENT,
        fontSize: 50,
        fontWeight: 900,
        lineHeight: 1,
        marginBottom: 18,
        opacity,
        textShadow: "0 4px 12px rgba(0,0,0,0.92), 0 0 24px rgba(0,0,0,0.86)",
        transform: `translate3d(0, ${8 * (1 - opacity)}px, 0)`,
        willChange: "opacity, transform",
      }}
    >
      {text}
    </div>
  );
}

function KaraokeCaption({
  role,
  staticFallback,
  timingSrc,
}: {
  role: CaptionRole;
  staticFallback: string;
  timingSrc: string;
}) {
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
    return <StaticCaption role={role} text={staticFallback} />;
  }

  const t = localFrame / fps;
  const activeIndex = pickActiveIndex(doc.words, t);
  const chunks = chunkWords(doc.words, {
    target: 4,
    min: 2,
    max: 5,
    maxDurationSeconds: 1.45,
  });
  const selected = pickChunk(chunks, doc.words, t);

  return (
    <div style={captionBoxStyleForRole(role)}>
      {shouldShowPunchCaption(role, t) ? (
        <PunchCaption fps={fps} frame={localFrame} text={staticFallback} />
      ) : null}
      <div>
        {selected.map((entry) => {
          const { word, index } = entry;
          const isActive = index === activeIndex;
          const isKeyword = isMechanismKeyword(word.text);
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
          const scale = 1 + (isKeyword ? 0.1 : 0.07) * scaleProgress;
          const color = isActive ? ACTIVE_ACCENT : isKeyword ? KEYWORD_ACCENT : "#FFFFFF";

          return (
            <span
              key={index}
              style={{
                color,
                display: "inline-block",
                fontWeight: isKeyword ? 900 : 820,
                marginRight: "0.25em",
                transform: `scale(${scale})`,
                transformOrigin: "center",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function SceneCaption({
  resolveSrc,
  scene,
}: {
  resolveSrc: (src: string) => string;
  scene: RenderInput["scenes"][number];
}) {
  if (scene.captionTimingPath) {
    return (
      <KaraokeCaption
        role={scene.role}
        staticFallback={scene.caption}
        timingSrc={resolveSrc(scene.captionTimingPath)}
      />
    );
  }
  return <StaticCaption role={scene.role} text={scene.caption} />;
}
