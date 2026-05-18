import type { CaptionTimingDoc, CaptionWord } from "@short-workflow/shared";

import type { ElevenLabsAlignment } from "./elevenLabsTts";

type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateAlignment(alignment: ElevenLabsAlignment): ValidationResult {
  const { characters, characterStartTimesSeconds, characterEndTimesSeconds } = alignment;

  if (characters.length === 0) {
    return { ok: false, reason: "empty_characters" };
  }
  if (
    characterStartTimesSeconds.length !== characters.length ||
    characterEndTimesSeconds.length !== characters.length
  ) {
    return { ok: false, reason: "length_mismatch" };
  }
  if (characterStartTimesSeconds[0] < 0) {
    return { ok: false, reason: "negative_first_start" };
  }
  for (let i = 0; i < characters.length; i += 1) {
    const s = characterStartTimesSeconds[i];
    const e = characterEndTimesSeconds[i];
    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      return { ok: false, reason: `non_finite_at_${i}` };
    }
    if (e <= s) {
      return { ok: false, reason: `end_le_start_at_${i}` };
    }
  }
  return { ok: true };
}

export function alignmentToWords(alignment: ElevenLabsAlignment): CaptionWord[] {
  const { characters, characterStartTimesSeconds, characterEndTimesSeconds } = alignment;
  const words: CaptionWord[] = [];
  let chunk: number[] = [];

  const flush = () => {
    if (chunk.length === 0) return;
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    words.push({
      text: chunk.map((i) => characters[i]).join(""),
      start: characterStartTimesSeconds[first],
      end: characterEndTimesSeconds[last],
    });
    chunk = [];
  };

  for (let i = 0; i < characters.length; i += 1) {
    const c = characters[i];
    if (/\s/.test(c)) {
      flush();
    } else {
      chunk.push(i);
    }
  }
  flush();

  return words;
}

export function buildCaptionTimingDoc(input: {
  alignment: ElevenLabsAlignment;
  sourceAudioAssetId: string;
}): CaptionTimingDoc {
  const { alignment, sourceAudioAssetId } = input;
  const words = alignmentToWords(alignment);
  const narration = alignment.characters.join("");
  const audioDurationSeconds = Math.max(...alignment.characterEndTimesSeconds);

  return {
    version: 1,
    sourceAudioAssetId,
    narration,
    audioDurationSeconds,
    words,
  };
}

export function validateCaptionTimingDoc(
  doc: CaptionTimingDoc,
  _options: { sceneDurationSeconds: number },
): ValidationResult {
  if (doc.words.length === 0) {
    return { ok: false, reason: "empty_words" };
  }
  if (doc.audioDurationSeconds <= 0) {
    return { ok: false, reason: "non_positive_audio_duration" };
  }
  for (let i = 0; i < doc.words.length; i += 1) {
    const w = doc.words[i];
    if (w.start < 0) return { ok: false, reason: `word_${i}_negative_start` };
    if (w.end <= w.start) return { ok: false, reason: `word_${i}_end_le_start` };
    if (i > 0) {
      const prev = doc.words[i - 1];
      if (w.start + 0.05 < prev.end) {
        return { ok: false, reason: `word_${i}_not_monotonic` };
      }
    }
  }
  return { ok: true };
}
