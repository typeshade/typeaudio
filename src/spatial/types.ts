/** World coordinates in metres. +X right, +Y up, default forward -Z. */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface ListenerPose {
  readonly position: Vector3;
  /** Normalized during preparation. Defaults to (0, 0, -1). */
  readonly forward?: Vector3;
  /** Orthogonalized against forward. Defaults to (0, 1, 0). */
  readonly up?: Vector3;
}
export interface SpatialSource {
  readonly position: Vector3;
  /** Linear gain, 0–16. Defaults to 1. */
  readonly gain?: number;
  /** Distance below which attenuation stops, in metres. Defaults to 1. */
  readonly referenceDistance?: number;
  /** Inverse-distance attenuation strength, 0–8. Defaults to 1. */
  readonly rolloff?: number;
  /** High-frequency damping per metre beyond referenceDistance, 0–1. Defaults to 0.035. */
  readonly airAbsorption?: number;
  /** Authored obstruction, 0 clear to 1 obstructed. Defaults to 0. */
  readonly occlusion?: number;
  /** 0 is a point source; 1 collapses directional pan to the stereo centre. */
  readonly spread?: number;
}
/** Prepared control data. Copy to the audio thread; do not recompute geometry per sample. */
export interface SpatialTarget {
  readonly sampleRate: number;
  readonly distance: number;
  readonly pan: number;
  readonly left: number;
  readonly right: number;
  /** Pole of a stable one-pole lowpass. Zero bypasses its damping. */
  readonly pole: number;
}
export interface SpatialMixerOptions {
  /** Fixed number of source slots, 1–256. Defaults to 32. */
  readonly capacity?: number;
  readonly sampleRate?: number;
  /** Maximum frames per process call, 1–4096. Defaults to 128. */
  readonly maxFrames?: number;
  /** One-pole control smoothing time constant, 0.001–1 seconds. Defaults to 0.01. */
  readonly smoothingSeconds?: number;
}
