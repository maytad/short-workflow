import { describe, expect, test } from "bun:test";
import {
  alignmentToWords,
  buildCaptionTimingDoc,
  validateAlignment,
  validateCaptionTimingDoc,
} from "./captionTiming";
import type { ElevenLabsAlignment } from "./elevenLabsTts";

const wellFormed: ElevenLabsAlignment = {
  characters: ["H", "i", " ", "y", "o", "u", "."],
  characterStartTimesSeconds: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
  characterEndTimesSeconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
};

describe("validateAlignment", () => {
  test("accepts well-formed alignment", () => {
    expect(validateAlignment(wellFormed)).toEqual({ ok: true });
  });

  test("rejects empty arrays", () => {
    const result = validateAlignment({
      characters: [],
      characterStartTimesSeconds: [],
      characterEndTimesSeconds: [],
    });
    expect(result.ok).toBe(false);
  });

  test("rejects length mismatch", () => {
    const result = validateAlignment({
      ...wellFormed,
      characterStartTimesSeconds: wellFormed.characterStartTimesSeconds.slice(0, -1),
    });
    expect(result.ok).toBe(false);
  });

  test("rejects NaN", () => {
    const result = validateAlignment({
      ...wellFormed,
      characterStartTimesSeconds: [Number.NaN, ...wellFormed.characterStartTimesSeconds.slice(1)],
    });
    expect(result.ok).toBe(false);
  });

  test("rejects -Infinity", () => {
    const result = validateAlignment({
      ...wellFormed,
      characterEndTimesSeconds: [
        Number.NEGATIVE_INFINITY,
        ...wellFormed.characterEndTimesSeconds.slice(1),
      ],
    });
    expect(result.ok).toBe(false);
  });

  test("rejects end <= start at any index", () => {
    const ends = [...wellFormed.characterEndTimesSeconds];
    ends[2] = wellFormed.characterStartTimesSeconds[2]; // equal -> reject
    const result = validateAlignment({ ...wellFormed, characterEndTimesSeconds: ends });
    expect(result.ok).toBe(false);
  });

  test("rejects negative first start", () => {
    const starts = [...wellFormed.characterStartTimesSeconds];
    starts[0] = -0.01;
    const result = validateAlignment({ ...wellFormed, characterStartTimesSeconds: starts });
    expect(result.ok).toBe(false);
  });
});

describe("alignmentToWords", () => {
  test("derives words by whitespace and attaches trailing punctuation", () => {
    const words = alignmentToWords(wellFormed);
    expect(words).toEqual([
      { text: "Hi", start: 0.0, end: 0.2 },
      { text: "you.", start: 0.3, end: 0.7 },
    ]);
  });

  test("handles leading whitespace", () => {
    const alignment: ElevenLabsAlignment = {
      characters: [" ", "h", "i"],
      characterStartTimesSeconds: [0.0, 0.05, 0.1],
      characterEndTimesSeconds: [0.05, 0.1, 0.2],
    };
    const words = alignmentToWords(alignment);
    expect(words).toEqual([{ text: "hi", start: 0.05, end: 0.2 }]);
  });

  test("handles trailing whitespace", () => {
    const alignment: ElevenLabsAlignment = {
      characters: ["a", " "],
      characterStartTimesSeconds: [0.0, 0.1],
      characterEndTimesSeconds: [0.1, 0.2],
    };
    const words = alignmentToWords(alignment);
    expect(words).toEqual([{ text: "a", start: 0.0, end: 0.1 }]);
  });
});

describe("buildCaptionTimingDoc", () => {
  test("builds doc from alignment with sourceAudioAssetId", () => {
    const doc = buildCaptionTimingDoc({
      alignment: wellFormed,
      sourceAudioAssetId: "audio-1",
    });
    expect(doc.version).toBe(1);
    expect(doc.sourceAudioAssetId).toBe("audio-1");
    expect(doc.narration).toBe("Hi you.");
    expect(doc.audioDurationSeconds).toBeCloseTo(0.7, 6);
    expect(doc.words.length).toBe(2);
  });
});

describe("validateCaptionTimingDoc", () => {
  test("accepts well-formed doc", () => {
    const doc = buildCaptionTimingDoc({
      alignment: wellFormed,
      sourceAudioAssetId: "audio-1",
    });
    expect(validateCaptionTimingDoc(doc, { sceneDurationSeconds: 5 })).toEqual({ ok: true });
  });

  test("does NOT mask audio overflow as caption issue", () => {
    // Even if audioDurationSeconds exceeds scene, the caption-shape validator must still pass.
    // The audio overflow gate lives upstream in the handler, not here.
    const doc = buildCaptionTimingDoc({
      alignment: wellFormed,
      sourceAudioAssetId: "audio-1",
    });
    const result = validateCaptionTimingDoc(doc, { sceneDurationSeconds: 0.1 });
    expect(result.ok).toBe(true);
  });

  test("rejects non-monotonic words", () => {
    const doc = buildCaptionTimingDoc({
      alignment: wellFormed,
      sourceAudioAssetId: "audio-1",
    });
    // Force overlap > 0.05s
    doc.words[1].start = doc.words[0].end - 0.5;
    doc.words[1].end = doc.words[1].start + 0.1;
    const result = validateCaptionTimingDoc(doc, { sceneDurationSeconds: 5 });
    expect(result.ok).toBe(false);
  });
});
