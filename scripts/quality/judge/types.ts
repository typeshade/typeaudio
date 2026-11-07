import type {
  AudioComparison,
  AudioQualityBrief,
} from "../../../src/quality/types.ts";

export interface JudgeIdentity {
  provider: string;
  model: string;
  endpoint: string;
  promptVersion: string;
}
export interface JudgeInput {
  brief: AudioQualityBrief;
  a: Buffer;
  b: Buffer;
  instruction?: string;
}
export interface JudgeEvidence {
  identity: JudgeIdentity;
  resolvedModel: string;
  requestId: string | null;
  inputSha256: { A: string; B: string };
  comparison: AudioComparison;
  usage: unknown;
}
export interface AudioJudge {
  identity: JudgeIdentity;
  compare(input: JudgeInput): Promise<JudgeEvidence>;
}
