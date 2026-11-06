import type { SpatialMixerOptions, SpatialTarget, Vector3 } from '../types.ts';

export type RoomWall = 'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax';
export interface WallMaterial {
  /** Pressure reflection coefficient, 0–0.98. Default 0.6. */
  readonly reflection?: number;
  /** Additional high-frequency damping, 0–1. Default 0.35. */
  readonly damping?: number;
}
export interface RoomDefinition {
  /** Axis-aligned bounds in metres. Each dimension must be 0.1–200 metres. */
  readonly min: Vector3;
  readonly max: Vector3;
  readonly walls?: Partial<Record<RoomWall, WallMaterial>>;
  /** Reflection level, 0–1. Default 0.7. */
  readonly earlyGain?: number;
  /** Diffuse tail level, 0–1. Default 0.2. */
  readonly lateGain?: number;
  /** Artistic decay override, 0.05–8 seconds. Otherwise estimated from absorption. */
  readonly decaySeconds?: number;
}
/** Immutable, serializable control data. No audio buffers or browser objects. */
export interface PreparedRoom extends RoomDefinition {
  readonly sampleRate: number;
  readonly key: string;
  readonly walls: Readonly<Record<RoomWall, Readonly<Required<WallMaterial>>>>;
  readonly earlyGain: number;
  readonly lateGain: number;
  readonly decaySeconds: number;
}
export interface ReflectionTarget extends SpatialTarget {
  readonly wall: RoomWall;
  /** Fractional delay relative to the immediate direct path. */
  readonly delayFrames: number;
}
export interface RoomSourceTarget {
  readonly roomKey: string;
  readonly direct: SpatialTarget;
  readonly reflections: readonly ReflectionTarget[];
  readonly late: { readonly delayFrames: number; readonly gain: number };
}
export interface RoomMixerOptions extends Omit<SpatialMixerOptions, 'sampleRate'> {
  /** Fixed source slots, 1–64. Default 8. Memory grows with room size and capacity. */
  readonly capacity?: number;
  /** Delay-tap crossfade duration, 0.001–0.1 seconds. Default 0.01. */
  readonly transitionSeconds?: number;
}
