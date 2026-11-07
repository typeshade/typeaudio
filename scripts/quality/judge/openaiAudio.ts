import { createHash } from "node:crypto";
import { validateBrief, parseComparison } from "../../../src/quality/index.ts";
import { decodeWav } from "../audio/wav.ts";
import { comparisonPrompt, PROMPT_VERSION } from "./prompt.ts";
import type { AudioJudge, JudgeInput } from "./types.ts";

export interface OpenAIAudioOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

/** Actual PCM is sent through Chat Completions input_audio. No transcription fallback. */
export function openaiAudio(options: OpenAIAudioOptions): AudioJudge {
  if (!options.apiKey || !options.model || options.model.length > 128)
    throw new Error(
      "Configure OPENAI_API_KEY and TYPEAUDIO_AUDIO_MODEL for an audio-input model.",
    );
  const endpoint = "https://api.openai.com/v1/chat/completions";
  const identity = {
    provider: "openai-chat-audio",
    model: options.model,
    endpoint,
    promptVersion: PROMPT_VERSION,
  };
  return {
    identity,
    async compare(input: JudgeInput) {
      const brief = validateBrief(input.brief);
      for (const bytes of [input.a, input.b]) {
        const pcm = decodeWav(bytes);
        if (
          Math.abs(pcm.channels[0]!.length / pcm.sampleRate - brief.duration) >
          1 / pcm.sampleRate
        )
          throw new Error("Audio duration does not match the brief.");
      }
      const content = [
        { type: "text", text: comparisonPrompt(brief, input.instruction) },
        { type: "text", text: "Audio A follows." },
        {
          type: "input_audio",
          input_audio: { data: input.a.toString("base64"), format: "wav" },
        },
        { type: "text", text: "Audio B follows." },
        {
          type: "input_audio",
          input_audio: { data: input.b.toString("base64"), format: "wav" },
        },
      ];
      const response = await (options.fetchImpl ?? fetch)(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(45000),
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          modalities: ["text"],
          messages: [{ role: "user", content }],
          max_completion_tokens: 2400,
        }),
      });
      // Never log response bodies on authentication/provider failures or include the key in artifacts.
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(
          `Audio evaluator HTTP ${response.status}; no candidate was promoted.`,
        );
      }
      const raw = await response.text();
      if (raw.length > 100_000)
        throw new Error("Audio evaluator response exceeds its limit.");
      const data = JSON.parse(raw),
        choice = data.choices?.[0],
        text = choice?.message?.content;
      if (
        choice?.finish_reason !== "stop" ||
        typeof text !== "string" ||
        text.length > 30_000 ||
        typeof data.model !== "string"
      )
        throw new Error(
          "Audio evaluator returned incomplete or non-text output.",
        );
      const comparison = parseComparison(text, brief);
      return {
        identity,
        resolvedModel: data.model,
        requestId: response.headers.get("x-request-id"),
        inputSha256: {
          A: createHash("sha256").update(input.a).digest("hex"),
          B: createHash("sha256").update(input.b).digest("hex"),
        },
        comparison,
        usage: data.usage ?? null,
      };
    },
  };
}
