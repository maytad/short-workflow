export const SHORTS_RECOVERY_EXAMPLE_OBJECTS = [
  "latch",
  "ratchet",
  "zipper",
  "nail clipper",
  "tape measure lock",
  "stapler",
  "door closer",
  "camera aperture",
  "cam follower",
  "spring release",
  "pawl lock",
] as const;

export const SHORTS_RECOVERY_PAUSED_TOPICS = [
  "perception",
  "biology",
  "voice",
  "onions",
  "abstract physics gimmicks",
  "repeated cabinet or push-latch variants",
] as const;

export const SHORTS_RECOVERY_METRIC_GATES = [
  "Stayed to watch under 45% means the first frame and first line failed.",
  "Stayed to watch from 45-55% is weak and should not be scaled.",
  "Stayed to watch from 55-60% is usable only if average percentage viewed also improves.",
  "Stayed to watch 60%+ with average percentage viewed above 60% is the candidate reuse gate.",
] as const;

export const SHORTS_RECOVERY_CHANNEL_BIBLE_LINES = [
  "Shorts recovery goal: increase Stayed to watch from about 45% toward 60%+ before optimizing for raw views.",
  "Distribution note: Shorts feed is already the dominant traffic source, so solve feed response before SEO or hashtag changes.",
  `Recovery example objects: ${SHORTS_RECOVERY_EXAMPLE_OBJECTS.join(", ")}. Use these as examples, not a ranked topic list.`,
  `Paused recovery topics: ${SHORTS_RECOVERY_PAUSED_TOPICS.join(", ")}.`,
  "Recovery gate: raw views are a scale signal only; viewer choice and engaged-view quality decide whether a format is reusable.",
] as const;

export const SHORTS_RECOVERY_RESEARCH_RULES = [
  "Use the recovery metric gate: optimize for Stayed to watch, engaged views, and average percentage viewed before raw views.",
  ...SHORTS_RECOVERY_METRIC_GATES,
  "The first frame must create a visible moving or tension state in the first 0.5 seconds.",
  `Use ${SHORTS_RECOVERY_EXAMPLE_OBJECTS.join(", ")} as examples of image-readable mechanics, not a ranked topic list; presentation quality beats object category.`,
  "Do not let the example list narrow topic selection; start from a fresh visible behavior before choosing the object.",
  `Pause perception, biology, voice, onions, abstract physics gimmicks, and repeated cabinet or push-latch variants unless the user explicitly asks for them.`,
  "Start from a familiar object under visible stress or change, not from a broad fact or clean explanatory category.",
  "Reject candidates whose opening would be a calm object portrait, clean diagram, product shot, or abstract explanation.",
] as const;

export const SHORTS_RECOVERY_JUDGE_RULES = [
  "Judge for the 24-48 hour feed test, not evergreen educational completeness.",
  ...SHORTS_RECOVERY_METRIC_GATES,
  "A reusable candidate should plausibly reach Stayed to watch 60%+ and average percentage viewed above 60%.",
  "Reward a first frame with a visible moving or tension state that makes the viewer ask why before narration matters.",
  "Penalize perception, biology, voice, onions, abstract physics gimmicks, calm product shots, clean diagrams, and repeated cabinet or push-latch variants.",
  "Do not reward a candidate merely because it uses a recovery example object; reward the opening presentation, visual proof, and loop payoff.",
  "Do not select a candidate just because the mechanism is familiar; select it because the opening behavior is visually undeniable.",
] as const;

export const SHORTS_RECOVERY_SCRIPT_RULES = [
  "Recovery target: improve Stayed to watch in the first 1-3 seconds before optimizing raw views.",
  ...SHORTS_RECOVERY_METRIC_GATES,
  "The first scene must open on visible action, tension, snap, lock, release, or contradiction already happening.",
  "The first caption must be no more than 4 words and must read like a feed hook, not a transcript line.",
  "Use no clean product shot as the hook image.",
  "Use no diagram or cutaway as the opening image unless the cutaway itself is the surprising visible action.",
  "Reveal the hidden mechanism within the first two seconds when possible, or show an unmistakable clue before the first scene ends.",
  "The first narration line must describe what the viewer sees, not define the mechanism.",
] as const;

export const SHORTS_RECOVERY_IMAGE_RULES = [
  "This is a first-frame feed test for Stayed to watch, not a pretty illustration.",
  "No clean product shot for hook scenes.",
  "No clean diagram or cutaway as the opening frame unless the cutaway is itself the visible surprise.",
  "Show action, tension, snap, lock, release, resistance, or failure already happening.",
  "The viewer should understand the object and curiosity gap without reading captions or hearing narration.",
] as const;
