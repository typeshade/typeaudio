import { describe, expect, it } from "vitest";
import raw from "../../fixtures/quality/column-impact/brief.json";
import { validateBrief } from "../../src/quality/index.ts";
import { openaiAudio } from "../../scripts/quality/judge/openaiAudio.ts";
import { encodeWav } from "../../scripts/quality/audio/wav.ts";
import { sha256 } from "../../scripts/quality/receipts.ts";

const brief = validateBrief(raw);
const a = encodeWav({
  sampleRate: 48000,
  channels: [new Float32Array(144000).fill(0.1)],
});
const b = encodeWav({
  sampleRate: 48000,
  channels: [new Float32Array(144000).fill(-0.1)],
});
const comparison = {
  preference: "inconclusive",
  confidence: "low",
  criteria: brief.criteria.map((c) => ({
    id: c.id,
    A: "uncertain",
    B: "uncertain",
    reason: "Transport fixture only.",
  })),
  observations: [],
  revisions: [],
};

describe("actual audio transport (mocked network, not a listening test)", () => {
  it("sends both complete WAVs in input_audio, preserves their order and hashes", async () => {
    let calls = 0;
    const fetchImpl = (async (_url, init) => {
      const body = JSON.parse(String(init?.body)),
        parts = body.messages[0].content;
      expect(body.modalities).toEqual(["text"]);
      expect(Buffer.from(parts[2].input_audio.data, "base64")).toEqual(
        calls ? b : a,
      );
      expect(Buffer.from(parts[4].input_audio.data, "base64")).toEqual(
        calls ? a : b,
      );
      calls++;
      return new Response(
        JSON.stringify({
          model: "test-audio-snapshot",
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(comparison) },
            },
          ],
        }),
        { headers: { "x-request-id": "test-only" } },
      );
    }) as typeof fetch;
    const judge = openaiAudio({
      apiKey: "test-key",
      model: "test-audio",
      fetchImpl,
    });
    const first = await judge.compare({ brief, a, b });
    const second = await judge.compare({ brief, a: b, b: a });
    expect(first.inputSha256).toEqual({ A: sha256(a), B: sha256(b) });
    expect(second.inputSha256).toEqual({ A: sha256(b), B: sha256(a) });
    expect(JSON.stringify(first)).not.toContain("test-key");
  });
  it("rejects provider failures and truncated JSON instead of inferring a winner", async () => {
    const judge = openaiAudio({
      apiKey: "test-key",
      model: "test-audio",
      fetchImpl: (async () =>
        new Response("private provider details", {
          status: 401,
        })) as typeof fetch,
    });
    await expect(judge.compare({ brief, a, b })).rejects.toThrow("HTTP 401");
    const truncated = openaiAudio({
      apiKey: "test-key",
      model: "test-audio",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            model: "test",
            choices: [{ finish_reason: "length", message: { content: "{}" } }],
          }),
        )) as typeof fetch,
    });
    await expect(truncated.compare({ brief, a, b })).rejects.toThrow(
      "incomplete",
    );
  });
});
