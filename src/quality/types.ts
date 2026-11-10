export interface QualityControl {
  id: string;
  name: string;
  min: number;
  max: number;
}

export interface AudioQualityBrief {
  schema: "typeaudio.quality-brief";
  version: 1;
  id: string;
  description: string;
  duration: number;
  layers: string[];
  criteria: { id: string; description: string; required: boolean }[];
  controls: QualityControl[];
}

export type AudioSide = "A" | "B";
export type CriterionResult = "meets" | "partial" | "fails" | "uncertain";

export interface AudioComparison {
  preference: AudioSide | "tie" | "inconclusive";
  confidence: "low" | "medium" | "high";
  criteria: {
    id: string;
    A: CriterionResult;
    B: CriterionResult;
    reason: string;
  }[];
  observations: {
    side: AudioSide;
    start: number;
    end: number;
    layer: string;
    issue: string;
  }[];
  revisions: {
    side: AudioSide;
    control: string;
    value: number;
    reason: string;
  }[];
}

export interface PairDecision {
  advance: boolean;
  reason: string;
  modelCriteriaMet: boolean;
  humanAccepted: false;
}
