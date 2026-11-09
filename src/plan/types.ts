// The plan: the cue sheet a model writes for a picture and the engine renders. The names follow
// docs/sound-design-loop.md (the plan, the layers, the kinds). Only a plan that `validatePlan`
// returned reaches a renderer, the way only validated graph source reaches the compiler
// (docs/feedback-loop.md). All times are seconds from the start of the clip.

/** The five layers of a sound design, in the order a mix reads them. */
export const LAYERS = ['dialogue', 'foley', 'effects', 'ambience', 'music'] as const;
export type PlanLayer = (typeof LAYERS)[number];

/** The material of the room's walls. */
export const MATERIALS = ['stone', 'wood', 'plaster', 'fabric', 'glass', 'open'] as const;
export type PlanMaterial = (typeof MATERIALS)[number];

export type Vec3 = [number, number, number];

export interface PlanClip {
  /** Seconds. */
  duration: number;
  fps: number;
}

export interface PlanScene {
  room: {
    /** Width, depth and height in metres. */
    size: Vec3;
    material: PlanMaterial;
  };
  /** The listener is the camera: its position in metres and its heading in degrees. */
  listener: { position: Vec3; yaw: number };
}

export interface PlanMaster {
  /** The integrated loudness target in LUFS. The default is -23. */
  lufs: number;
  /** The true-peak limit in dBTP. The default is -1. */
  truePeak: number;
}

/** Screen coordinates from -1 to 1 (left to right, bottom to top) and an estimated distance in metres. */
export interface PlanPosition {
  x: number;
  y: number;
  distance: number;
}

export type PlanSync = 'onset' | 'arrive';

export interface PlanEvent {
  /** The name of the event in every message, 1 to 64 letters, digits, `_` and `-`. Unique. */
  id: string;
  /** The anchor in seconds: the onset, or for `sync: 'arrive'` the end of the sound. */
  t: number;
  /** A key of `KINDS` (`src/plan/kinds.ts`). */
  kind: string;
  layer: PlanLayer;
  /** 0 to 1. */
  intensity: number;
  position: PlanPosition;
  /** The macro values the kind defines, each 0 to 1. A macro left out takes the kind's default. */
  macros: Record<string, number>;
  /** The length in seconds, for kinds that sustain. Absent: the event is a point. */
  duration?: number;
  /** `onset` (the default) or `arrive`. */
  sync: PlanSync;
}

/**
 * The times of the picture, in seconds: the cuts and the peaks of motion. The note does not name
 * this field yet; the fixture and the checklist need it (see the pull request's open items).
 */
export interface PlanPicture {
  cuts: number[];
  motion: number[];
}

export interface SoundPlan {
  version: 1;
  description?: string;
  clip: PlanClip;
  scene: PlanScene;
  master: PlanMaster;
  seed: number;
  picture: PlanPicture;
  events: PlanEvent[];
}

/** The seconds an event covers: it starts at `start` and sounds until `end`. */
export function eventSpan(e: PlanEvent): { start: number; end: number } {
  const d = e.duration ?? 0;
  return e.sync === 'arrive' ? { start: e.t - d, end: e.t } : { start: e.t, end: e.t + d };
}
