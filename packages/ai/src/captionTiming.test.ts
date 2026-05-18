import { describe, expect, test } from "bun:test";

import {
  alignmentToWords,
  buildCaptionTimingDoc,
  validateAlignment,
  validateCaptionTimingDoc,
} from "./captionTiming";
import type { ElevenLabsAlignment } from "./elevenLabsTts";

const helloWorldAlignment: ElevenLabsAlignment = {
  characters: ["H", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"],
  characterStartTimesSeconds: [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
  characterEndTimesSeconds: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6],
};

describe("validateAlignment", () => {
  test("accepts a valid alignment", () => {
    expect(() => validateAlignment(helloWorldAlignment)).not.toThrow();
  });

  test("throws on empty alignment", () => {
    expect(() =>
      validateAlignment({ characters: [], characterStartTimesSeconds: [], characterEndTimesSeconds: [] }),
    ).toThrow("elevenlabs_alignment_empty");
  });

  test("throws when array lengths differ", () => {
    expect(() =>
      validateAlignment({
        characters: ["a", "b"],
        characterStartTimesSeconds: [0.0],
        characterEndTimesSeconds: [0.1, 0.2],
      }),
    ).toThrow("elevenlabs_alignment_length_mismatch");
  });
});

describe("alignmentToWords", () => {
  test("splits on spaces into words", () => {
    const words = alignmentToWords(helloWorldAlignment);
    expect(words).toHaveLength(2);
    expect(words[0]).toEqual({ text: "Hello", start: 0.0, end: 0.25 });
    expect(words[1]).toEqual({ text: "world", start: 0.3, end: 0.6 });
  });

  test("handles leading/trailing spaces", () => {
    const alignment: ElevenLabsAlignment = {
      characters: [" ", "h", "i", " "],
      characterStartTimesSeconds: [0.0, 0.1, 0.2, 0.3],
      characterEndTimesSeconds: [0.1, 0.2, 0.3, 0.4],
    };
    const words = alignmentToWords(alignment);
    expect(words).toHaveLength(1);
    expect(words[0]).toEqual({ text: "hi", start: 0.1, end: 0.3 });
  });

  test("handles multiple consecutive spaces", () => {
    const alignment: ElevenLabsAlignment = {
      characters: ["a", " ", " ", "b"],
      characterStartTimesSeconds: [0.0, 0.1, 0.2, 0.3],
      characterEndTimesSeconds: [0.1, 0.2, 0.3, 0.4],
    };
    const words = alignmentToWords(alignment);
    expect(words).toHaveLength(2);
    expect(words[0]?.text).toBe("a");
    expect(words[1]?.text).toBe("b");
  });

  test("handles newline as word separator", () => {
    const alignment: ElevenLabsAlignment = {
      characters: ["a", "\n", "b"],
      characterStartTimesSeconds: [0.0, 0.1, 0.2],
      characterEndTimesSeconds: [0.1, 0.2, 0.3],
    };
    const words = alignmentToWords(alignment);
    expect(words).toHaveLength(2);
  });

  test("throws on empty alignment", () => {
    expect(() =>
      alignmentToWords({ characters: [], characterStartTimesSeconds: [], characterEndTimesSeconds: [] }),
    ).toThrow("elevenlabs_alignment_empty");
  });
});

describe("buildCaptionTimingDoc", () => {
  test("builds a valid doc from alignment", () => {
    const doc = buildCaptionTimingDoc({
      alignment: helloWorldAlignment,
      narration: "Hello world",
      sourceAudioAssetId: "asset-123",
      audioDurationSeconds: 1.0,
    });
    expect(doc.version).toBe(1);
    expect(doc.words).toHaveLength(2);
    expect(doc.narration).toBe("Hello world");
    expect(doc.sourceAudioAssetId).toBe("asset-123");
    expect(doc.audioDurationSeconds).toBe(1.0);
  });

  test("throws when alignment produces no words (all spaces)", () => {
    const spacesOnly: ElevenLabsAlignment = {
      characters: [" ", " "],
      characterStartTimesSeconds: [0.0, 0.1],
      characterEndTimesSeconds: [0.1, 0.2],
    };
    expect(() =>
      buildCaptionTimingDoc({
        alignment: spacesOnly,
        narration: "Hello world",
        sourceAudioAssetId: "asset-123",
        audioDurationSeconds: 1.0,
      }),
    ).toThrow("caption_timing_no_words");
  });

  test("throws when audioDurationSeconds is 0", () => {
    expect(() =>
      buildCaptionTimingDoc({
        alignment: helloWorldAlignment,
        narration: "Hello world",
        sourceAudioAssetId: "asset-123",
        audioDurationSeconds: 0,
      }),
    ).toThrow();
  });

  test("throws when narration is empty", () => {
    expect(() =>
      buildCaptionTimingDoc({
        alignment: helloWorldAlignment,
        narration: "",
        sourceAudioAssetId: "asset-123",
        audioDurationSeconds: 1.0,
      }),
    ).toThrow();
  });
});

describe("validateCaptionTimingDoc", () => {
  test("accepts a well-formed doc", () => {
    expect(() =>
      validateCaptionTimingDoc({
        version: 1,
        sourceAudioAssetId: "asset-1",
        narration: "Hello world",
        audioDurationSeconds: 1.2,
        words: [
          { text: "Hello", start: 0, end: 0.5 },
          { text: "world", start: 0.5, end: 1.2 },
        ],
      }),
    ).not.toThrow();
  });

  test("rejects unknown keys", () => {
    expect(() =>
      validateCaptionTimingDoc({
        version: 1,
        sourceAudioAssetId: "asset-1",
        narration: "Hello",
        audioDurationSeconds: 1.0,
        words: [{ text: "Hello", start: 0, end: 1.0 }],
        extra: "bad",
      }),
    ).toThrow();
  });

  test("rejects version !== 1", () => {
    expect(() =>
      validateCaptionTimingDoc({
        version: 2,
        sourceAudioAssetId: "asset-1",
        narration: "Hello",
        audioDurationSeconds: 1.0,
        words: [{ text: "Hello", start: 0, end: 1.0 }],
      }),
    ).toThrow();
  });
});
