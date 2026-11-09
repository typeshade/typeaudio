// The guard that ducks the other layers before a hero impact (docs/sound-design-loop.md, "The
// guards"). The renderer knows every event before the first block, so the gain of each layer is
// known on the host: `duckGains` writes it as one block of `5 * BLOCK` linear gains, and the
// `strips` kernel multiplies each layer's frames by its row (`src/spatial/spatial.shade.ts`).

import { LAYERS, type PlanEvent, type PlanLayer } from '../plan/index.ts';
import { DEFAULT_RULES } from '../analyze/checklist.ts';
import { BLOCK } from './room.ts';

/** The attenuation at full depth, in dB. */
export const DUCK_DB = 6;
/** The fall, in seconds, from no attenuation to `DUCK_DB`. */
export const DUCK_FALL = 0.4;
/** The fall ends this many seconds before the onset. The attenuation then holds through the onset. */
export const DUCK_LEAD = 0.05;
/** The fall is an exponential approach in dB: it takes this many time constants to run its course. */
export const DUCK_FALL_TAUS = 5;
/** The recovery, in seconds, from `DUCK_DB` to no attenuation, from the onset on. */
export const DUCK_RECOVER = 0.3;

/** One hero impact: its onset in frames and the index of its layer. */
export interface DuckSource {
  start: number;
  layer: number;
}

/**
 * The hero impacts of a plan, by the rule `checklist` uses: an `impact` whose `intensity` is at or
 * above `R.heroIntensity`, capped at the highest `intensity` of the plan. `starts[i]` is the onset
 * of `events[i]` in frames.
 */
export function duckSources(events: readonly PlanEvent[], starts: readonly number[]): DuckSource[] {
  if (events.length === 0) return [];
  const top = Math.max(...events.map((e) => e.intensity));
  const hero = Math.min(DEFAULT_RULES.heroIntensity, top);
  const out: DuckSource[] = [];
  events.forEach((e, i) => {
    if (e.kind === 'impact' && e.intensity >= hero)
      out.push({ start: starts[i]!, layer: LAYERS.indexOf(e.layer as PlanLayer) });
  });
  return out;
}

/**
 * The attenuation, in dB, `dt` seconds from an onset: 0 before the fall; an exponential approach to
 * `DUCK_DB` over `DUCK_FALL`, scaled to end exactly on it (it falls fast first, as a hand on a
 * fader does, with a time constant of `DUCK_FALL / DUCK_FALL_TAUS`); `DUCK_DB` until the onset;
 * then a raised cosine to 0 over `DUCK_RECOVER`.
 */
export function attenuationDb(dt: number): number {
  const fallStart = -(DUCK_LEAD + DUCK_FALL);
  if (dt <= fallStart) return 0;
  if (dt < -DUCK_LEAD) {
    const x = (dt - fallStart) / DUCK_FALL;
    return (DUCK_DB * (1 - Math.exp(-DUCK_FALL_TAUS * x))) / (1 - Math.exp(-DUCK_FALL_TAUS));
  }
  if (dt <= 0) return DUCK_DB;
  if (dt < DUCK_RECOVER) return DUCK_DB * 0.5 * (1 + Math.cos((Math.PI * dt) / DUCK_RECOVER));
  return 0;
}

/**
 * Whether `sources` change any gain in the block that starts at frame `at`: the first frame of the
 * fall is before the end of the block, and the last frame of the recovery is after its start.
 */
export function duckActive(sources: readonly DuckSource[], at: number, sr: number): boolean {
  const before = Math.ceil((DUCK_LEAD + DUCK_FALL) * sr);
  const after = Math.ceil(DUCK_RECOVER * sr);
  return sources.some((s) => s.start - before < at + BLOCK && s.start + after > at);
}

/**
 * Fills `out` (`LAYERS.length * BLOCK` values) with the linear gain of each layer for the block that
 * starts at frame `at`. A source does not duck its own layer, and `dialogue` is never ducked. Where
 * sources overlap, the deeper attenuation holds.
 */
export function duckGains(
  out: Float32Array,
  sources: readonly DuckSource[],
  at: number,
  sr: number,
): void {
  out.fill(1);
  for (let l = 1; l < LAYERS.length; l++) {
    for (let n = 0; n < BLOCK; n++) {
      let db = 0;
      for (const s of sources) {
        if (s.layer === l) continue;
        db = Math.max(db, attenuationDb((at + n - s.start) / sr));
      }
      if (db > 0) out[l * BLOCK + n] = 10 ** (-db / 20);
    }
  }
}
