import { describe, expect, test } from "bun:test";
import { captionTimingDocSchema, captionWordSchema } from "./captionTiming";

describe("captionWordSchema", () => {
  test("accepts a well-formed word", () => {
    expect(() =>
      captionWordSchema.parse({ text: "hello", start: 0.1, end: 0.5 }),
    ).not.toThrow();
  });

  test("rejects empty text", () => {
    expect(() => captionWordSchema.parse({ text: "", start: 0, end: 0.1 })).toThrow();
  });

  test("rejects negative start", () => {
    expect(() => captionWordSchema.parse({ text: "x", start: -0.01, end: 0.1 })).toThrow();
  });

  test("rejects end <= start", () => {
    expect(() => captionWordSchema.parse({ text: "x", start: 0.5, end: 0.5 })).toThrow();
    expect(() => captionWordSchema.parse({ text: "x", start: 0.5, end: 0.4 })).toThrow();
  });
});

describe("captionTimingDocSchema", () => {
  const baseDoc = {
    version: 1,
    sourceAudioAssetId: "audio-asset-1",
    narration: "Hello world.",
    audioDurationSeconds: 1.2,
    words: [
      { text: "Hello", start: 0, end: 0.5 },
      { text: "world.", start: 0.5, end: 1.2 },
    ],
  };

  test("accepts a well-formed doc", () => {
    expect(() => captionTimingDocSchema.parse(baseDoc)).not.toThrow();
  });

  test("rejects version !== 1", () => {
    expect(() => captionTimingDocSchema.parse({ ...baseDoc, version: 2 })).toThrow();
  });

  test("rejects empty words array", () => {
    expect(() => captionTimingDocSchema.parse({ ...baseDoc, words: [] })).toThrow();
  });

  test("rejects audioDurationSeconds <= 0", () => {
    expect(() =>
      captionTimingDocSchema.parse({ ...baseDoc, audioDurationSeconds: 0 }),
    ).toThrow();
  });

  test("rejects missing sourceAudioAssetId", () => {
    const { sourceAudioAssetId: _omit, ...rest } = baseDoc;
    expect(() => captionTimingDocSchema.parse(rest)).toThrow();
  });

  test("rejects empty narration", () => {
    expect(() => captionTimingDocSchema.parse({ ...baseDoc, narration: "" })).toThrow();
  });

  test("rejects unknown keys (strict)", () => {
    expect(() =>
      captionTimingDocSchema.parse({ ...baseDoc, extra: 1 }),
    ).toThrow();
  });
});
