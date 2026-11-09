// The plan: the cue sheet a model writes for a picture and the engine renders (docs/experiments.md,
// section 8). It is JSON. Only a plan that `validatePlan` returned reaches a renderer, the way only
// validated graph source reaches the compiler (docs/feedback-loop.md).

/** The five layers of a sound design, in the order a mix reads them. */
export const LAYERS = ['dialogue', 'foley', 'effects', 'ambience', 'music'] as const;
export type PlanLayer = (typeof LAYERS)[number];

/** The surface material of the room. */
export const MATERIALS = ['stone', 'wood', 'plaster', 'glass', 'cloth', 'grass'] as const;
export type PlanMaterial = (typeof MATERIALS)[number];

/** The room model: the box in metres and what its walls are made of. */
export interface PlanRoom {
  size: { width: number; depth: number; height: number };
  material: PlanMaterial;
}

/** The listener is the camera: its height in metres and its horizontal field of view in degrees. */
export interface PlanListener {
  height: number;
  fov: number;
}

export interface PlanScene {
  /** Seconds. */
  duration: number;
  /** Hertz. */
  sampleRate: number;
  room: PlanRoom;
  listener: PlanListener;
}

/** Where an event sounds: the picture's screen coordinates (0 left or top, 1 right or bottom) and metres. */
export interface PlanPosition {
  x: number;
  y: number;
  distance: number;
}

export interface PlanEvent {
  /** The name of the event in every message, 1 to 64 letters, digits, `_` and `-`. */
  id: string;
  /** Start, in seconds from the start of the scene. */
  time: number;
  /** Length, in seconds. The event ends inside the scene. */
  duration: number;
  /** A key of `KINDS` (`src/plan/kinds.ts`). */
  kind: string;
  layer: PlanLayer;
  /** 0 to 1. */
  intensity: number;
  position: PlanPosition;
  /** The macro values the kind defines. A macro left out takes the kind's default. */
  macros: Record<string, number>;
}

/** The times of the picture, in seconds: the cuts and the peaks of motion. */
export interface PlanPicture {
  cuts: number[];
  motion: number[];
}

export interface SoundPlan {
  version: 1;
  description?: string;
  scene: PlanScene;
  picture: PlanPicture;
  events: PlanEvent[];
}
