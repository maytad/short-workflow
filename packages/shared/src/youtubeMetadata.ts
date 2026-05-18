export type YoutubeDescriptionInput = {
  description: string;
  hashtags: readonly string[];
};

export function youtubeTagKeywords(hashtags: readonly string[]) {
  return hashtags
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter((tag) => tag.length > 0);
}

export function youtubeHashtagLine(hashtags: readonly string[]) {
  return youtubeTagKeywords(hashtags)
    .map((tag) => `#${tag}`)
    .join(" ");
}

export function formatYoutubeDescriptionWithHashtags(input: YoutubeDescriptionInput) {
  const description = input.description.trim();
  const hashtagLine = youtubeHashtagLine(input.hashtags);

  if (!description) {
    return hashtagLine;
  }

  return hashtagLine ? `${description}\n\n${hashtagLine}` : description;
}
