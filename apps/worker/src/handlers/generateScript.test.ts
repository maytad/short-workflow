import { describe, expect, test } from "bun:test";

import { buildRecentLocalTopicLines } from "./generateScript";

describe("generate script topic context", () => {
  test("builds recent Tiny Mechanisms topic lines without the current project", () => {
    const rows = [
      {
        id: "current",
        title: "Current Pending Project",
        topic: "tiny_mechanisms:pending",
        createdAt: new Date("2026-05-25T10:20:00.000Z"),
      },
      {
        id: "zipper-2",
        title: "Your Zipper Tab Is Secretly a Lock",
        topic: "tiny_mechanisms:ai:locking-zipper-slider-pull-tab",
        createdAt: new Date("2026-05-25T10:19:00.000Z"),
      },
      {
        id: "non-tiny",
        title: "Other Project",
        topic: "other:project",
        createdAt: new Date("2026-05-25T10:18:00.000Z"),
      },
      {
        id: "stapler",
        title: "The Tiny Grooves That Bend Every Staple",
        topic: "tiny_mechanisms:ai:stapler-anvil-grooves",
        createdAt: new Date("2026-05-25T10:17:00.000Z"),
      },
    ];

    expect(buildRecentLocalTopicLines(rows, "current", 12)).toEqual([
      "Your Zipper Tab Is Secretly a Lock - tiny_mechanisms:ai:locking-zipper-slider-pull-tab",
      "The Tiny Grooves That Bend Every Staple - tiny_mechanisms:ai:stapler-anvil-grooves",
    ]);
  });

  test("limits recent topic context", () => {
    const rows = Array.from({ length: 14 }, (_, index) => ({
      id: `project-${index}`,
      title: `Project ${index}`,
      topic: `tiny_mechanisms:ai:topic-${index}`,
      createdAt: new Date(`2026-05-25T10:${String(index).padStart(2, "0")}:00.000Z`),
    }));

    expect(buildRecentLocalTopicLines(rows, "missing", 12)).toHaveLength(12);
  });
});
