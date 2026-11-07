import { describe, expect, it } from "vitest";
import raw from "../../fixtures/quality/column-impact/brief.json";
import {
  validateBrief,
  validateComparison,
  chooseCandidate,
  proposeRevision,
  parseComparison,
} from "../../src/quality/index.ts";
import type { AudioComparison } from "../../src/quality/types.ts";

const brief = validateBrief(raw);
function comparison(preference: "A" | "B" = "B"): AudioComparison {
  return {
    preference,
    confidence: "high",
    criteria: brief.criteria.map((c) => ({
      id: c.id,
      A: "partial",
      B: "partial",
      reason: "Test evidence.",
    })),
    observations: [],
    revisions: [],
  };
}

describe("audio quality evidence boundaries", () => {
  it("accepts a single JSON fence and rejects prose or a second object", () => {
    const json = JSON.stringify(comparison());
    expect(
      parseComparison("```json\n" + json + "\n```", brief).preference,
    ).toBe("B");
    expect(() => parseComparison("My opinion: " + json, brief)).toThrow();
    expect(() => parseComparison(json + json, brief)).toThrow();
  });
  it("rejects unknown controls, invalid timecodes and duplicate criteria", () => {
    const c = comparison();
    c.revisions = [
      { side: "B", control: "execute", value: 1, reason: "Invalid proposal." },
    ];
    expect(() => validateComparison(c, brief)).toThrow(/bounded controls/);
    c.revisions = [];
    c.observations = [
      { side: "A", start: 0, end: 4, layer: "body", issue: "Outside audio." },
    ];
    expect(() => validateComparison(c, brief)).toThrow(/valid times/);
    c.observations = [];
    c.criteria[1] = { ...c.criteria[0]! };
    expect(() => validateComparison(c, brief)).toThrow(/exactly one/);
  });
  it("rejects NaN, out-of-range revisions and oversized briefs", () => {
    for (const value of [NaN, Infinity, 900]) {
      const c = comparison();
      c.revisions = [{ side: "B", control: "mass", value, reason: "Test." }];
      expect(() => validateComparison(c, brief)).toThrow();
    }
    expect(() => validateBrief({ ...brief, duration: 100 })).toThrow();
  });
  it("does not promote order bias, uncertainty, ties, or low confidence", () => {
    expect(chooseCandidate(brief, comparison(), comparison()).advance).toBe(
      false,
    );
    const reverse = comparison("A");
    for (const confidence of ["low"] as const) {
      expect(
        chooseCandidate(brief, { ...comparison(), confidence }, reverse)
          .advance,
      ).toBe(false);
    }
    const c = comparison();
    c.criteria[0]!.B = "uncertain";
    expect(chooseCandidate(brief, c, reverse).advance).toBe(false);
    expect(
      chooseCandidate(brief, { ...comparison(), preference: "tie" }, reverse)
        .advance,
    ).toBe(false);
  });
  it("rejects a partial-to-fail required regression despite a favorable preference", () => {
    const c = comparison();
    c.criteria[0]!.B = "fails";
    expect(chooseCandidate(brief, c, comparison("A")).reason).toContain(
      "regressed",
    );
  });
  it("distinguishes a model preference, satisfied criteria and human acceptance", () => {
    const x = comparison(),
      y = comparison("A");
    expect(chooseCandidate(brief, x, y)).toMatchObject({
      advance: true,
      modelCriteriaMet: false,
      humanAccepted: false,
    });
    x.criteria.forEach((c) => (c.B = "meets"));
    y.criteria.forEach((c) => (c.A = "meets"));
    expect(chooseCandidate(brief, x, y)).toMatchObject({
      advance: true,
      modelCriteriaMet: true,
      humanAccepted: false,
    });
  });
  it("only revises the intended side when both orders corroborate a bounded edit", () => {
    const x = comparison(),
      y = comparison("A");
    x.revisions = [
      { side: "B", control: "mass", value: 1.2, reason: "More body." },
    ];
    y.revisions = [
      { side: "A", control: "mass", value: 1.22, reason: "More body." },
    ];
    expect(
      proposeRevision(brief, { mass: 1 }, x, y, "B").controls.mass,
    ).toBeCloseTo(1.21);
    expect(proposeRevision(brief, { mass: 1 }, x, y, "A").changes).toHaveLength(
      0,
    );
    y.revisions[0]!.value = 1.8;
    expect(proposeRevision(brief, { mass: 1 }, x, y, "B").changes).toHaveLength(
      0,
    );
  });
});
