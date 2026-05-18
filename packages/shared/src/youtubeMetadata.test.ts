import { describe, expect, test } from "bun:test";

import { formatYoutubeDescriptionWithHashtags, youtubeTagKeywords } from "./youtubeMetadata";

describe("youtube metadata formatting", () => {
  test("appends visible hashtags to the YouTube description", () => {
    expect(
      formatYoutubeDescriptionWithHashtags({
        description: "A compact explanation of the mechanism.",
        hashtags: ["#TinyMechanisms", "Engineering", "#Shorts"],
      }),
    ).toBe("A compact explanation of the mechanism.\n\n#TinyMechanisms #Engineering #Shorts");
  });

  test("builds tag keywords without hash prefixes", () => {
    expect(youtubeTagKeywords(["#TinyMechanisms", " Engineering ", ""])).toEqual([
      "TinyMechanisms",
      "Engineering",
    ]);
  });

  test("uses the hashtag line directly when the description is empty", () => {
    expect(
      formatYoutubeDescriptionWithHashtags({
        description: " ",
        hashtags: ["#Shorts"],
      }),
    ).toBe("#Shorts");
  });
});
