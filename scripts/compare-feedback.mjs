import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function compareFeedback(baseline, candidate) {
  const cases = (report) => {
    assert.equal(report.format, "typeaudio.feedback-report");
    assert.equal(report.version, 1);
    assert(
      Array.isArray(report.results) && report.results.length > 0,
      "An empty corpus cannot pass",
    );
    for (const row of report.results)
      assert.notEqual(row.status, "failed", "A failed case cannot pass");
    const rows = new Map(report.results.map((r) => [r.fixture, r.warm]));
    assert.equal(
      rows.size,
      report.results.length,
      "Duplicate fixture identities",
    );
    return rows;
  };
  const a = cases(baseline),
    b = cases(candidate);
  assert.deepEqual(
    [...a.keys()].sort(),
    [...b.keys()].sort(),
    "Candidate corpus differs",
  );
  for (const [name, expected] of a) {
    const actual = b.get(name);
    for (const field of [
      "frames",
      "pcmHash",
      "peak",
      "rms",
      "invalidSamples",
      "updates",
    ]) {
      assert.notEqual(
        expected?.[field],
        undefined,
        `${name}: missing ${field}`,
      );
      assert.deepEqual(
        actual?.[field],
        expected[field],
        `${name}: changed ${field}`,
      );
    }
    assert.equal(actual.invalidSamples, 0, `${name}: non-finite samples`);
  }
  return a.size;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [baseline, candidate] = process.argv.slice(2);
  if (!baseline || !candidate)
    throw new Error("Pass baseline and candidate report paths.");
  const count = compareFeedback(
    JSON.parse(readFileSync(baseline, "utf8")),
    JSON.parse(readFileSync(candidate, "utf8")),
  );
  console.log(
    `${count} graph fixtures match the pinned compiler. Timings remain diagnostic; they are not a hardware performance gate.`,
  );
}
