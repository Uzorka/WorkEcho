import { describe, expect, it } from "vitest";
import {
  ADJECTIVES,
  NOUNS,
  PSEUDONYM_PATTERN,
  generatePseudonym,
  generateUniquePseudonym,
} from "@/lib/pseudonym";

// Deterministic "random" source: returns the queued values in order.
function queue(...values: number[]) {
  return (max: number) => {
    const v = values.shift();
    if (v === undefined || v >= max) throw new Error(`bad test value ${v} for max ${max}`);
    return v;
  };
}

describe("generatePseudonym", () => {
  it("is Adjective + Animal/Nature word + 2 digits", () => {
    const quiet = ADJECTIVES.indexOf("Quiet");
    const falcon = NOUNS.indexOf("Falcon");
    expect(generatePseudonym(queue(quiet, falcon, 72))).toBe("QuietFalcon82");
  });

  it("always uses exactly two digits (10–99)", () => {
    expect(generatePseudonym(queue(0, 0, 0))).toMatch(/[A-Za-z]10$/);
    expect(generatePseudonym(queue(0, 0, 89))).toMatch(/[A-Za-z]99$/);
  });

  it("produces names that match the database pattern, across many runs", () => {
    for (let i = 0; i < 2000; i++) {
      const name = generatePseudonym();
      expect(name).toMatch(PSEUDONYM_PATTERN);
      expect(name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
    }
  });

  it("has word lists with no duplicates and only letters", () => {
    for (const list of [ADJECTIVES, NOUNS]) {
      expect(new Set(list).size).toBe(list.length);
      for (const w of list) expect(w).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it("matches the pattern even with the longest words", () => {
    const longest = (l: readonly string[]) => l.reduce((a, b) => (b.length > a.length ? b : a));
    expect(`${longest(ADJECTIVES)}${longest(NOUNS)}99`).toMatch(PSEUDONYM_PATTERN);
  });

  it("has plenty of combinations", () => {
    expect(ADJECTIVES.length * NOUNS.length * 90).toBeGreaterThan(250_000);
  });

  it("varies between calls", () => {
    const names = new Set(Array.from({ length: 50 }, () => generatePseudonym()));
    expect(names.size).toBeGreaterThan(40);
  });
});

describe("generateUniquePseudonym", () => {
  it("skips names that are taken", async () => {
    const taken = new Set(["AmberAntelope10"]);
    const name = await generateUniquePseudonym(async (c) => taken.has(c), { rand: queue(0, 0, 0, 0, 0, 1) });
    expect(name).toBe("AmberAntelope11");
  });

  it("skips excluded names (e.g. the current one) case-insensitively", async () => {
    const name = await generateUniquePseudonym(async () => false, {
      rand: queue(0, 0, 0, 0, 0, 1),
      exclude: ["amberantelope10"],
    });
    expect(name).toBe("AmberAntelope11");
  });

  it("gives up after the attempt limit", async () => {
    await expect(generateUniquePseudonym(async () => true, { attempts: 3 })).rejects.toThrow();
  });
});
