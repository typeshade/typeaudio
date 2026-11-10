import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepare } from "../../scripts/quality/prepare.ts";
import { runLoop } from "../../scripts/quality/runLoop.ts";
import { loadPrepared } from "../../scripts/quality/loadPrepared.ts";
import { budgetJudge } from "../../scripts/quality/judge/budget.ts";
import { sha256 } from "../../scripts/quality/receipts.ts";
import type {
  AudioJudge,
  JudgeInput,
} from "../../scripts/quality/judge/types.ts";
import { encodeWav } from "../../scripts/quality/audio/wav.ts";
import { validateBrief } from "../../src/quality/index.ts";
import raw from "../../fixtures/quality/column-impact/brief.json";

const identity = {
  provider: "test-fixture",
  model: "mock",
  endpoint: "none",
  promptVersion: "test",
};
function mockJudge(failAt = Infinity): AudioJudge {
  let calls = 0;
  return {
    identity,
    async compare(input: JudgeInput) {
      const n = ++calls;
      if (n === failAt) throw new Error("Injected failure.");
      const preference =
        n <= 5 ? ["A", "B", "tie", "A", "B"][n - 1] : n % 2 ? "A" : "B";
      const side = preference === "B" ? ("B" as const) : ("A" as const);
      return {
        identity,
        resolvedModel: "mock",
        requestId: `fixture-${n}`,
        inputSha256: { A: sha256(input.a), B: sha256(input.b) },
        usage: null,
        comparison: {
          preference: preference as "A" | "B" | "tie",
          confidence: "high",
          criteria: input.brief.criteria.map((c) => ({
            id: c.id,
            A: "partial",
            B: "partial",
            reason: "Mock fixture, not listening evidence.",
          })),
          observations: [],
          revisions:
            n <= 5
              ? []
              : [
                  {
                    side,
                    control: "mass",
                    value: 1.2,
                    reason: "Test the bounded edit path.",
                  },
                ],
        },
      };
    },
  };
}

describe("source render and bounded workflow (mocked evaluator)", () => {
  it("renders editable candidates, applies an evidenced revision, and preserves the best after a later failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "typeaudio-quality-"));
    try {
      const dir = join(root, "run");
      const prepared = await prepare(dir);
      expect(new Set(prepared.candidates.map((c) => c.audioSha256)).size).toBe(
        3,
      );
      expect(
        prepared.candidates.every(
          (c) => c.signal.passed && c.stems.length === 3,
        ),
      ).toBe(true);
      const loaded = await loadPrepared(dir);
      expect(loaded.candidates[0]!.sourceSha256).toBe(
        prepared.candidates[0]!.sourceSha256,
      );
      // Call 10 fails while judging a revision after two successful candidate comparisons.
      const result = await runLoop(dir, mockJudge(10), {
        maxCalls: 13,
        maxRevisions: 2,
      });
      expect(result).toMatchObject({
        status: "interrupted",
        bestCandidate: "resonant",
        calls: 10,
        humanAccepted: false,
        modelCriteriaMet: false,
      });
      const edit = JSON.parse(
        await readFile(join(dir, "revision-1/candidate.json"), "utf8"),
      );
      expect(edit.controls.mass).toBeCloseTo(1.2);
      expect(edit.sourceSha256).not.toBe(prepared.candidates[2]!.sourceSha256);
      expect(
        JSON.parse(
          await readFile(
            join(dir, "evaluation/requests/10.failure.json"),
            "utf8",
          ),
        ).status,
      ).toBe("failed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
  it("counts failed attempts and blocks model identity drift", async () => {
    const root = await mkdtemp(join(tmpdir(), "typeaudio-budget-"));
    try {
      await mkdir(join(root, "requests"));
      const brief = validateBrief(raw),
        wav = encodeWav({
          sampleRate: 48000,
          channels: [new Float32Array(144000)],
        });
      const base = mockJudge();
      let n = 0;
      const judge = budgetJudge(
        {
          identity,
          async compare(input) {
            const evidence = await base.compare(input);
            return {
              ...evidence,
              resolvedModel: ++n === 1 ? "first" : "changed",
            };
          },
        },
        join(root, "requests"),
        5,
      );
      await judge.compare({ brief, a: wav, b: wav });
      await expect(judge.compare({ brief, a: wav, b: wav })).rejects.toThrow(
        /identity/,
      );
      expect(judge.attempts).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
