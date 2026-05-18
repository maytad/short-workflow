import type { GenerateScriptInput, ScriptScene } from "../../types";

export const TINY_MECHANISMS_PRESET_ID = "tiny_mechanisms" as const;
export const TINY_MECHANISMS_CHANNEL_NAME = "Tiny Mechanisms";
export const TINY_MECHANISMS_TOPIC_PREFIX = "tiny_mechanisms:";
export const TINY_MECHANISMS_PENDING_TOPIC = `${TINY_MECHANISMS_TOPIC_PREFIX}pending`;

export type TinyMechanismsSeed = {
  seedId: string;
  centralQuestion: string;
  everydayObjectOrPhenomenon: string;
  mechanismHint: string;
  visualMetaphor: string;
  riskLevel: "low";
};

export const TINY_MECHANISMS_SCENE_ROLES_BY_DURATION = {
  30: ["hook", "context", "point", "payoff", "cta"],
  45: ["hook", "context", "point", "point", "payoff", "cta"],
  60: ["hook", "context", "point", "point", "point", "payoff", "cta"],
} as const satisfies Record<
  GenerateScriptInput["targetDurationSeconds"],
  readonly ScriptScene["role"][]
>;

export const TINY_MECHANISMS_CHANNEL_BIBLE = [
  "Channel: Tiny Mechanisms.",
  "Promise: one everyday mystery explained in under 45 seconds.",
  "Audience: English-speaking curious general audience at middle-school knowledge level.",
  "Tone: clear, curious, precise, lightly dramatic, and never generic.",
  "Format: faceless 9:16 micro-documentary with generated images, narration, captions, and a loopable ending.",
  "Allowed topics: everyday object design, human perception, everyday physics, materials and chemistry, and small systems.",
  "Disallowed topics: medical advice, finance, legal advice, politics, war, crime, breaking news, public figures, dangerous instructions, children's characters, conspiracy framing, and unsupported claims.",
  "Captions: short mobile-readable beat summaries, not full narration paragraphs.",
  "Image direction: social-native vertical science frames with one dominant object, action already in progress, real-world hands or macro details, clear mechanism reveals, no embedded text, no logos, no UI, no public figures.",
  "Retention: first sentence must be understandable without context, payoff must answer the hook, final line must connect back to the opening idea.",
].join("\n");

export const TINY_MECHANISMS_SEEDS: TinyMechanismsSeed[] = [
  {
    seedId: "recorded_voice",
    centralQuestion: "Why your recorded voice sounds wrong",
    everydayObjectOrPhenomenon: "a recorded human voice",
    mechanismHint: "Bone conduction makes your own voice sound deeper to you than it sounds through air to everyone else.",
    visualMetaphor: "sound waves traveling through a translucent skull and through open air",
    riskLevel: "low",
  },
  {
    seedId: "round_airplane_windows",
    centralQuestion: "Why airplane windows are round",
    everydayObjectOrPhenomenon: "airplane windows",
    mechanismHint: "Rounded corners spread stress more evenly than sharp corners in a pressurized cabin.",
    visualMetaphor: "stress lines flowing smoothly around a round airplane window",
    riskLevel: "low",
  },
  {
    seedId: "onion_tears",
    centralQuestion: "Why onions make your eyes water",
    everydayObjectOrPhenomenon: "cut onions",
    mechanismHint: "Cut onion cells release compounds that react into an eye-irritating gas.",
    visualMetaphor: "microscopic onion cells releasing a faint vapor toward an eye silhouette",
    riskLevel: "low",
  },
  {
    seedId: "cold_batteries",
    centralQuestion: "Why batteries drain faster in the cold",
    everydayObjectOrPhenomenon: "batteries in cold weather",
    mechanismHint: "Cold slows the chemical reactions that move charge through the battery.",
    visualMetaphor: "a frosted battery cross-section with sluggish glowing particles",
    riskLevel: "low",
  },
  {
    seedId: "microwave_cold_spots",
    centralQuestion: "Why microwave ovens leave cold spots",
    everydayObjectOrPhenomenon: "microwave heating",
    mechanismHint: "Standing wave patterns create hot and cold zones unless food moves through them.",
    visualMetaphor: "invisible wave bands crossing a plate with alternating warm and cold patches",
    riskLevel: "low",
  },
  {
    seedId: "damaged_qr_codes",
    centralQuestion: "Why QR codes still work when scratched",
    everydayObjectOrPhenomenon: "damaged QR codes",
    mechanismHint: "QR codes include error correction so missing pieces can be reconstructed.",
    visualMetaphor: "a torn QR code still forming a readable square pattern",
    riskLevel: "low",
  },
  {
    seedId: "zipper_locking",
    centralQuestion: "Why zippers lock instead of sliding open",
    everydayObjectOrPhenomenon: "zippers",
    mechanismHint: "The slider forces interlocking teeth together at precise angles so tension holds them in place.",
    visualMetaphor: "macro zipper teeth interlocking like tiny hooks under the slider",
    riskLevel: "low",
  },
  {
    seedId: "soap_bubbles_round",
    centralQuestion: "Why soap bubbles are round",
    everydayObjectOrPhenomenon: "soap bubbles",
    mechanismHint: "Surface tension pulls the film into the smallest possible area for the trapped air.",
    visualMetaphor: "a soap film tightening into a sphere with rainbow highlights",
    riskLevel: "low",
  },
  {
    seedId: "mirror_flip",
    centralQuestion: "Why mirrors appear to flip left and right",
    everydayObjectOrPhenomenon: "mirrors",
    mechanismHint: "Mirrors reverse depth, not left and right; the apparent flip comes from how people imagine turning around.",
    visualMetaphor: "a person silhouette and reflected axes showing front-back reversal",
    riskLevel: "low",
  },
  {
    seedId: "noise_cancelling",
    centralQuestion: "Why noise-cancelling headphones work better on steady sounds",
    everydayObjectOrPhenomenon: "noise-cancelling headphones",
    mechanismHint: "Predictable low-frequency noise is easier to cancel with an opposite sound wave than sudden irregular noise.",
    visualMetaphor: "two opposite waveforms flattening into a quiet line around headphones",
    riskLevel: "low",
  },
  {
    seedId: "barcode_scanners",
    centralQuestion: "Why barcode scanners can read black and white stripes",
    everydayObjectOrPhenomenon: "barcodes",
    mechanismHint: "The scanner measures reflected light differences and decodes the stripe widths into numbers.",
    visualMetaphor: "a red scanning beam turning stripe widths into a digital number trail",
    riskLevel: "low",
  },
  {
    seedId: "credit_card_chips",
    centralQuestion: "Why credit card chips are safer than magnetic stripes",
    everydayObjectOrPhenomenon: "credit card chips",
    mechanismHint: "Chip cards can create transaction-specific data instead of exposing one reusable magnetic pattern.",
    visualMetaphor: "a card chip creating a one-time glowing key beside a faded magnetic stripe",
    riskLevel: "low",
  },
  {
    seedId: "autofocus_sharpness",
    centralQuestion: "Why autofocus can tell an image is sharp",
    everydayObjectOrPhenomenon: "camera autofocus",
    mechanismHint: "Autofocus looks for contrast and phase alignment to decide when edges are crisp.",
    visualMetaphor: "a camera sensor locking onto a crisp edge after a blurred edge",
    riskLevel: "low",
  },
  {
    seedId: "popcorn_pops",
    centralQuestion: "Why popcorn kernels pop",
    everydayObjectOrPhenomenon: "popcorn",
    mechanismHint: "Water inside the kernel turns to steam until pressure ruptures the shell and expands the starch.",
    visualMetaphor: "a popcorn kernel cross-section building steam pressure",
    riskLevel: "low",
  },
  {
    seedId: "ice_floats",
    centralQuestion: "Why ice floats instead of sinking",
    everydayObjectOrPhenomenon: "ice cubes",
    mechanismHint: "Water expands as it freezes into an open crystal structure, making ice less dense.",
    visualMetaphor: "open crystal lattice inside a floating ice cube",
    riskLevel: "low",
  },
  {
    seedId: "thermos_insulation",
    centralQuestion: "Why a thermos keeps drinks hot or cold",
    everydayObjectOrPhenomenon: "a thermos",
    mechanismHint: "A vacuum layer slows heat transfer by removing most conduction and convection paths.",
    visualMetaphor: "a thermos cross-section with heat arrows blocked by a vacuum gap",
    riskLevel: "low",
  },
  {
    seedId: "nonstick_pans",
    centralQuestion: "Why food slides off nonstick pans",
    everydayObjectOrPhenomenon: "nonstick pans",
    mechanismHint:
      "Low-surface-energy coatings make it harder for food molecules and oils to grip the pan surface.",
    visualMetaphor: "a fried egg gliding over a smooth microscopic surface like water on wax",
    riskLevel: "low",
  },
  {
    seedId: "stainless_steel_garlic_smell",
    centralQuestion: "Why stainless steel can reduce garlic smell",
    everydayObjectOrPhenomenon: "garlic smell on hands",
    mechanismHint:
      "Sulfur-containing odor compounds can bind to stainless steel surfaces instead of staying on skin.",
    visualMetaphor: "tiny sulfur particles leaving fingertips and attaching to a brushed steel surface",
    riskLevel: "low",
  },
  {
    seedId: "soda_fizz",
    centralQuestion: "Why soda fizzes when you open it",
    everydayObjectOrPhenomenon: "carbonated soda",
    mechanismHint:
      "Opening the bottle lowers pressure, so dissolved carbon dioxide escapes as bubbles.",
    visualMetaphor: "carbon dioxide bubbles rushing out of a dark soda like released springs",
    riskLevel: "low",
  },
  {
    seedId: "compass_north",
    centralQuestion: "Why a compass points north",
    everydayObjectOrPhenomenon: "a compass needle",
    mechanismHint:
      "A magnetized needle aligns with Earth's magnetic field, which roughly points toward magnetic north.",
    visualMetaphor: "a compass needle floating inside faint magnetic field lines around Earth",
    riskLevel: "low",
  },
  {
    seedId: "rubber_bands_snap_back",
    centralQuestion: "Why rubber bands snap back",
    everydayObjectOrPhenomenon: "rubber bands",
    mechanismHint:
      "Stretching lines up tangled polymer chains, and entropy pulls them back toward a more disordered shape.",
    visualMetaphor: "tangled elastic strands stretching straight, then curling back into loops",
    riskLevel: "low",
  },
  {
    seedId: "phone_screen_rotation",
    centralQuestion: "How your phone knows it turned sideways",
    everydayObjectOrPhenomenon: "phone screen rotation",
    mechanismHint:
      "Tiny motion sensors measure acceleration and gravity direction so software can infer orientation.",
    visualMetaphor: "a phone cross-section with a tiny mass shifting as gravity arrows rotate",
    riskLevel: "low",
  },
  {
    seedId: "escalator_steps_level",
    centralQuestion: "Why escalator steps stay level",
    everydayObjectOrPhenomenon: "escalator steps",
    mechanismHint:
      "Each step rides on tracks that control its angle while the chain moves it up or down.",
    visualMetaphor: "escalator steps following hidden rails that keep each tread flat",
    riskLevel: "low",
  },
  {
    seedId: "washing_machine_spin",
    centralQuestion: "Why a washing machine spin cycle dries clothes",
    everydayObjectOrPhenomenon: "washing machine spin cycle",
    mechanismHint:
      "Fast rotation forces water out through drum holes while fabric stays inside the spinning basket.",
    visualMetaphor: "water droplets flinging outward from clothes against a perforated metal drum",
    riskLevel: "low",
  },
  {
    seedId: "traffic_light_colors",
    centralQuestion: "Why traffic lights use red, yellow, and green",
    everydayObjectOrPhenomenon: "traffic light colors",
    mechanismHint:
      "The colors combine visibility, historical signaling conventions, and easy category separation.",
    visualMetaphor: "three colored signals cutting through mist at different attention levels",
    riskLevel: "low",
  },
  {
    seedId: "stop_sign_octagons",
    centralQuestion: "Why stop signs are octagons",
    everydayObjectOrPhenomenon: "stop signs",
    mechanismHint:
      "A unique shape lets drivers recognize the sign from the back, side, or in poor visibility.",
    visualMetaphor: "an octagon silhouette standing out among circles, triangles, and rectangles",
    riskLevel: "low",
  },
  {
    seedId: "pencils_write",
    centralQuestion: "Why pencils write on paper",
    everydayObjectOrPhenomenon: "pencils",
    mechanismHint:
      "Graphite layers slide off onto rough paper fibers, leaving a dark trail without melting or ink.",
    visualMetaphor: "thin graphite sheets peeling from a pencil tip onto paper fibers",
    riskLevel: "low",
  },
  {
    seedId: "sticky_notes_peel",
    centralQuestion: "Why sticky notes peel off cleanly",
    everydayObjectOrPhenomenon: "sticky notes",
    mechanismHint:
      "Low-tack adhesive makes many weak contact points, enough to hold paper but weak enough to release.",
    visualMetaphor: "tiny soft adhesive dots letting go from a desk surface one by one",
    riskLevel: "low",
  },
  {
    seedId: "hook_and_loop_fasteners",
    centralQuestion: "Why hook-and-loop fasteners stick and rip apart",
    everydayObjectOrPhenomenon: "hook-and-loop fasteners",
    mechanismHint:
      "Tiny hooks catch flexible loops across many contact points, then release when peeled at an angle.",
    visualMetaphor: "macro hooks grabbing fabric loops like a miniature forest canopy",
    riskLevel: "low",
  },
  {
    seedId: "ice_cubes_crack",
    centralQuestion: "Why ice cubes crack in warm drinks",
    everydayObjectOrPhenomenon: "ice cubes in drinks",
    mechanismHint:
      "The outside warms and expands faster than the cold center, creating stress that fractures the ice.",
    visualMetaphor: "crack lines racing through a clear ice cube as warm liquid surrounds it",
    riskLevel: "low",
  },
];

export function encodeTinyMechanismsTopic(seedId: string) {
  return `${TINY_MECHANISMS_TOPIC_PREFIX}${seedId}`;
}

export function parseTinyMechanismsSeedId(topic: string): string | null {
  if (!topic.startsWith(TINY_MECHANISMS_TOPIC_PREFIX)) {
    return null;
  }

  return topic.slice(TINY_MECHANISMS_TOPIC_PREFIX.length);
}

export function getTinyMechanismsSeed(seedId: string) {
  return TINY_MECHANISMS_SEEDS.find((seed) => seed.seedId === seedId) ?? null;
}

export function pickNextTinyMechanismsSeed(usedSeedIds: Iterable<string>) {
  const used = new Set(usedSeedIds);
  const seed = TINY_MECHANISMS_SEEDS.find((candidate) => !used.has(candidate.seedId));

  if (!seed) {
    throw new Error("tiny_mechanisms_seed_bank_exhausted");
  }

  return seed;
}

export function tinyMechanismsProjectTitle(seed: TinyMechanismsSeed) {
  return `Tiny Mechanisms: ${seed.centralQuestion}`;
}
