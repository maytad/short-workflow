import type { CaptionTimingDoc, CaptionWord } from "@short-workflow/shared";
import { captionTimingDocSchema } from "@short-workflow/shared";

import type { ElevenLabsAlignment } from "./elevenLabsTts";

/**
 * Validates that an ElevenLabsAlignment is non-empty and all three arrays
 * have the same length. Throws on any violation.
 */
export function validateAlignment(alignment: ElevenLabsAlignment): void {
  const len = alignment.characters.length;
  if (len === 0) {
    throw new Error("elevenlabs_alignment_empty");
  }
  if (
    alignment.characterStartTimesSeconds.length !== len ||
    alignment.characterEndTimesSeconds.length !== len
  ) {
    throw new Error("elevenlabs_alignment_length_mismatch");
  }
}

/**
 * Converts a character-level ElevenLabs alignment into an array of
 * CaptionWord objects by grouping consecutive non-whitespace characters.
 * Each word's start/end times come from the first/last character in the group.
 */
export function alignmentToWords(alignment: ElevenLabsAlignment): CaptionWord[] {
  validateAlignment(alignment);

  const words: CaptionWord[] = [];
  let wordChars = "";
  let wordStart = 0;
  let wordEnd = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const start = alignment.characterStartTimesSeconds[i];
    const end = alignment.characterEndTimesSeconds[i];

    if (char === undefined || start === undefined || end === undefined) {
      continue;
    }

    if (char === " " || char === "\n" || char === "\t") {
      if (wordChars.length > 0) {
        words.push({ text: wordChars, start: wordStart, end: wordEnd });
        wordChars = "";
      }
    } else {
      if (wordChars.length === 0) {
        wordStart = start;
      }
      wordChars += char;
      wordEnd = end;
    }
  }

  if (wordChars.length > 0) {
    words.push({ text: wordChars, start: wordStart, end: wordEnd });
  }

  return words;
}

export type BuildCaptionTimingDocInput = {
  alignment: ElevenLabsAlignment;
  narration: string;
  sourceAudioAssetId: string;
  audioDurationSeconds: number;
};

/**
 * Builds and validates a CaptionTimingDoc from an ElevenLabs alignment and
 * audio metadata. Throws if the alignment produces no words or if the
 * resulting document fails schema validation.
 */
export function buildCaptionTimingDoc(input: BuildCaptionTimingDocInput): CaptionTimingDoc {
  const words = alignmentToWords(input.alignment);
  if (words.length === 0) {
    throw new Error("caption_timing_no_words");
  }

  return validateCaptionTimingDoc({
    version: 1,
    sourceAudioAssetId: input.sourceAudioAssetId,
    narration: input.narration,
    audioDurationSeconds: input.audioDurationSeconds,
    words,
  });
}

/**
 * Parses and validates an unknown value as a CaptionTimingDoc using the
 * shared Zod schema. Throws a ZodError on invalid input.
 */
export function validateCaptionTimingDoc(value: unknown): CaptionTimingDoc {
  return captionTimingDocSchema.parse(value);
}
