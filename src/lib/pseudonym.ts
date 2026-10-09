import { randomInt } from "node:crypto";

// Pseudonym = Adjective + Animal/Nature word + 2 digits, e.g. "QuietFalcon82".
// Words are neutral on purpose: nothing rude, nothing that hints at a person.

export const ADJECTIVES = [
  "Amber", "Ancient", "Bold", "Brave", "Bright", "Brisk", "Calm", "Clever", "Cool", "Crisp",
  "Daring", "Deep", "Eager", "Early", "Fair", "Fast", "Gentle", "Glad", "Golden", "Grand",
  "Green", "Happy", "Hidden", "Honest", "Humble", "Keen", "Kind", "Lively", "Lucky", "Mellow",
  "Merry", "Misty", "Noble", "Patient", "Polite", "Proud", "Quick", "Quiet", "Rapid", "Ready",
  "Silent", "Silver", "Sharp", "Shy", "Smart", "Smooth", "Steady", "Still", "Sunny", "Swift",
  "Tall", "Tidy", "True", "Warm", "Wise", "Witty", "Young", "Zesty",
] as const;

export const NOUNS = [
  "Antelope", "Baobab", "Breeze", "Buffalo", "Canary", "Cedar", "Cheetah", "Cloud", "Comet",
  "Crane", "Delta", "Dolphin", "Dove", "Eagle", "Egret", "Falcon", "Fern", "Finch", "Gazelle",
  "Giraffe", "Harbour", "Hawk", "Heron", "Hill", "Hippo", "Ibis", "Iroko", "Kestrel", "Kite",
  "Lagoon", "Leopard", "Lily", "Lion", "Lotus", "Mahogany", "Meadow", "Moon", "Oasis", "Okapi",
  "Owl", "Palm", "Panther", "Parrot", "Pelican", "Pebble", "Plateau", "Rain", "River", "Robin",
  "Savanna", "Sparrow", "Star", "Stone", "Stork", "Sunbird", "Tiger", "Valley", "Weaver",
  "Willow", "Zebra",
] as const;

export const PSEUDONYM_PATTERN = /^[A-Z][A-Za-z]{2,23}[0-9]{2}$/;

// Maximum regenerations a user gets during onboarding.
export const MAX_PSEUDONYM_REGENERATIONS = 3;

/** Returns an integer in [0, max). Injectable so tests can be deterministic. */
export type RandomInt = (max: number) => number;

const secureRandomInt: RandomInt = (max) => randomInt(max);

export function generatePseudonym(rand: RandomInt = secureRandomInt): string {
  const adjective = ADJECTIVES[rand(ADJECTIVES.length)];
  const noun = NOUNS[rand(NOUNS.length)];
  const digits = 10 + rand(90); // 10–99: always exactly two digits
  return `${adjective}${noun}${digits}`;
}

/**
 * Generates a pseudonym that `isTaken` says is free. The database's unique
 * index is the final word (callers must still handle a unique violation if a
 * race happens); this just avoids obvious collisions up front.
 */
export async function generateUniquePseudonym(
  isTaken: (candidate: string) => Promise<boolean>,
  { rand = secureRandomInt, attempts = 10, exclude = [] as string[] } = {},
): Promise<string> {
  const excluded = new Set(exclude.map((e) => e.toLowerCase()));
  for (let i = 0; i < attempts; i++) {
    const candidate = generatePseudonym(rand);
    if (excluded.has(candidate.toLowerCase())) continue;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Could not find a free pseudonym");
}
