import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { validateBrief, parseComparison } from "../../../src/quality/index.ts";
import { decodeWav } from "../audio/wav.ts";
import { sha256, writeReceipt } from "../receipts.ts";
import { comparisonPrompt, PROMPT_VERSION } from "./prompt.ts";
import type { AudioJudge, JudgeInput } from "./types.ts";

/** A resident local multimodal LLM receives the actual WAVs; its text remains untrusted data. */
export class LocalOmni implements AudioJudge {
  readonly identity = {
    provider: "local-qwen-omni",
    model: "Qwen/Qwen2.5-Omni-3B@f75b40e3da2003cdd6e1829b1f420ca70797c34e",
    endpoint: "local:python",
    promptVersion: PROMPT_VERSION,
  };
  private readonly child;
  private pending:
    | { resolve: (value: any) => void; reject: (error: Error) => void }
    | undefined;
  private readonly ready: Promise<any>;
  private sequence = 0;
  private runtime: unknown;
  private constructor(
    python: string,
    private directory: string,
  ) {
    this.ready = new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
    });
    this.child = spawn(
      python,
      [
        fileURLToPath(new URL("../local/omni.py", import.meta.url)),
        "--trace-dir",
        directory,
      ],
      { stdio: ["pipe", "pipe", "inherit"] },
    );
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      const pending = this.pending;
      this.pending = undefined;
      try {
        if (line.length > 200_000)
          throw new Error("Oversized local LLM output.");
        const data = JSON.parse(line);
        if (data.error) throw new Error("Local audio inference failed.");
        pending?.resolve(data);
      } catch {
        pending?.reject(new Error("Invalid local LLM output."));
      }
    });
    this.child.on("error", () =>
      this.pending?.reject(
        new Error("Cannot start the local Python environment."),
      ),
    );
    this.child.on("exit", () =>
      this.pending?.reject(
        new Error("Local audio LLM exited before completing its request."),
      ),
    );
  }
  static async start(python: string, directory: string) {
    await mkdir(directory);
    const judge = new LocalOmni(python, directory);
    try {
      const data = await judge.withTimeout(judge.ready, 180_000);
      if (
        !data.ready ||
        data.identity?.model !== "Qwen/Qwen2.5-Omni-3B" ||
        data.identity?.revision !== "f75b40e3da2003cdd6e1829b1f420ca70797c34e"
      )
        throw new Error("The local audio LLM does not match its pin.");
      judge.runtime = data.identity;
      await writeReceipt(join(directory, "runtime.json"), data.identity);
      return judge;
    } catch (error) {
      judge.close();
      throw error;
    }
  }
  async compare(input: JudgeInput) {
    const brief = validateBrief(input.brief);
    for (const wav of [input.a, input.b]) {
      const pcm = decodeWav(wav);
      if (
        Math.abs(pcm.channels[0]!.length / pcm.sampleRate - brief.duration) >
        1 / pcm.sampleRate
      )
        throw new Error("Audio duration does not match the brief.");
    }
    if (this.pending) throw new Error("Send one audio comparison at a time.");
    const id = ++this.sequence,
      hashes = { A: sha256(input.a), B: sha256(input.b) };
    const prompt = comparisonPrompt(
      brief,
      (input.instruction ?? "") +
        " This local model receives mono audio. Do not claim stereo placement or immersive spatial quality. Return uncertain for spatial criteria. Keep reasons concise.",
    );
    const promise = new Promise<any>((resolve, reject) => {
      this.pending = { resolve, reject };
    });
    this.child.stdin.write(
      JSON.stringify({
        id,
        prompt,
        a: input.a.toString("base64"),
        b: input.b.toString("base64"),
      }) + "\n",
    );
    const result = await this.withTimeout(promise, 600_000);
    await writeReceipt(
      join(this.directory, `${String(id).padStart(2, "0")}.json`),
      { prompt, ...result },
    );
    if (
      result.id !== id ||
      !result.finished ||
      typeof result.text !== "string" ||
      result.text.length > 30_000 ||
      JSON.stringify(result.identity) !== JSON.stringify(this.runtime) ||
      result.inputSha256?.A !== hashes.A ||
      result.inputSha256?.B !== hashes.B
    )
      throw new Error("Incomplete or mismatched local audio evidence.");
    const comparison = parseComparison(result.text, brief);
    return {
      identity: this.identity,
      resolvedModel: this.identity.model,
      requestId: `local-${id}`,
      inputSha256: hashes,
      comparison,
      usage: result.usage,
    };
  }
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.close();
            reject(new Error("Local audio inference timed out."));
          }, ms);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  close() {
    this.child.stdin.end();
    this.child.kill();
  }
}
