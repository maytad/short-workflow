import { expect, test } from "bun:test";

import {
  buildYoutubeDiagnosisInputHash,
  parseYoutubeDiagnosisOutput,
  youtubeDiagnosisResponseSchema,
} from "./youtubeDiagnosis";

const validDiagnosis = {
  summaryTh: "ยอดดูตกจากช่วงเปิดคลิปที่ยังไม่ชัดพอ",
  likelyCauseTh: "ฮุกช่วงแรกยังไม่สื่อความขัดแย้งหรือผลลัพธ์ที่คนดูจะได้",
  priority: "high" as const,
  nextActionsTh: ["ปรับ 2 วินาทีแรกให้เปิดด้วยผลลัพธ์ที่ชัดเจน"],
  suggestedTitleEn: ["Why This Tiny Gear Fails Under Pressure"],
  suggestedHookEn: ["This gear looks harmless until it takes one wrong load."],
  suggestedVisualPromptEn: ["Macro shot of a tiny brass gear under a visible stress load"],
  metadataNotesEn: ["Keep the title specific to the failure mechanism."],
};

test("buildYoutubeDiagnosisInputHash is stable for equivalent objects with different key order", () => {
  const left = {
    video: {
      id: "abc123",
      title: "Tiny gear failure",
      metrics: {
        views: 1200,
        retention: [1, 0.8, 0.42],
      },
    },
    channel: "Tiny Mechanisms",
  };
  const right = {
    channel: "Tiny Mechanisms",
    video: {
      metrics: {
        retention: [1, 0.8, 0.42],
        views: 1200,
      },
      title: "Tiny gear failure",
      id: "abc123",
    },
  };

  const leftHash = buildYoutubeDiagnosisInputHash(left);
  const rightHash = buildYoutubeDiagnosisInputHash(right);

  expect(leftHash).toBe(rightHash);
  expect(leftHash).toMatch(/^sha256:[a-f0-9]{64}$/);
});

test("parseYoutubeDiagnosisOutput parses valid structured JSON", () => {
  const parsed = parseYoutubeDiagnosisOutput(JSON.stringify(validDiagnosis));

  expect(parsed).toEqual(validDiagnosis);
});

test("youtubeDiagnosisResponseSchema rejects empty summaryTh", () => {
  const result = youtubeDiagnosisResponseSchema.safeParse({
    ...validDiagnosis,
    summaryTh: "",
  });

  expect(result.success).toBe(false);
});
