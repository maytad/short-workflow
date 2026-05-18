import { z } from "zod";

export const captionWordSchema = z
  .object({
    text: z.string().min(1),
    start: z.number().nonnegative(),
    end: z.number().positive(),
  })
  .strict()
  .refine(({ start, end }) => end > start, {
    message: "caption_word_end_must_exceed_start",
    path: ["end"],
  });

export type CaptionWord = z.infer<typeof captionWordSchema>;

export const captionTimingDocSchema = z
  .object({
    version: z.literal(1),
    sourceAudioAssetId: z.string().min(1),
    narration: z.string().min(1),
    audioDurationSeconds: z.number().positive(),
    words: z.array(captionWordSchema).min(1),
  })
  .strict();

export type CaptionTimingDoc = z.infer<typeof captionTimingDocSchema>;
