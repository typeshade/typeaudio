// The recipes of experiment 11: a cue of the cue sheet as events of the engine's kinds.
//
// A recipe is a named sound definition with a few parameters (`size`, `brightness`, a length). It
// gives the events of one cue, in seconds from the start of the video. The kinds are those of
// `src/kinds/`; where a kind has a typed function (`src/kinds/functions/`: impact, boom, roar,
// crack, rubble), a recipe uses it first, so that a later scene can move onto function nodes.

/** One event of the engine, as a plan holds it, with its time in video seconds. */
export interface EngineEvent {
  readonly id: string;
  readonly t: number;
  readonly kind: string;
  readonly layer: string;
  readonly intensity: number;
  readonly position: { readonly x: number; readonly y: number; readonly distance: number };
  readonly macros: Readonly<Record<string, number>>;
  readonly duration?: number;
}

/** A cue of the cue sheet that the engine makes. */
export interface Cue {
  readonly id: string;
  readonly t: number;
  readonly recipe: string;
  /** The level in dB under the sound that leads the moment: 0 leads, -6 explains, -12 hints. */
  readonly level: number;
  /** 0 (small) to 1 (largest of its sort). */
  readonly size?: number;
  readonly brightness?: number;
  /** Seconds, for a recipe that lasts. */
  readonly duration?: number;
  /** Left (-1) to right (1). */
  readonly pan?: number;
  /** Bottom (-1) to top (1). */
  readonly height?: number;
  /** Metres from the camera. */
  readonly distance?: number;
  /** A count, for a recipe that scatters (debris, lightning). */
  readonly count?: number;
}

const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));

/** A small seeded generator (mulberry32), so a recipe that scatters gives the same events each time. */
export function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAYER: Record<string, string> = {
  whoosh: 'effects',
  impact: 'effects',
  shimmer: 'effects',
  riser: 'effects',
  wind: 'ambience',
  footstep: 'foley',
  cloth: 'foley',
  crack: 'effects',
  boom: 'effects',
  rubble: 'effects',
  roar: 'effects',
};

/** The events of one cue. `gain` is the cue's level as a linear factor on each event's intensity. */
export function eventsOf(cue: Cue): EngineEvent[] {
  const s = clamp(cue.size ?? 0.5);
  const b = clamp(cue.brightness ?? 0.5);
  const d = cue.duration ?? 1;
  const g = 10 ** (cue.level / 20);
  const pos = {
    x: clamp(cue.pan ?? 0, -1, 1),
    y: clamp(cue.height ?? 0, -1, 1),
    distance: cue.distance ?? 4,
  };
  const out: EngineEvent[] = [];
  let n = 0;
  const add = (
    kind: string,
    dt: number,
    intensity: number,
    macros: Record<string, number>,
    duration?: number,
    at: Partial<typeof pos> = {},
  ): void => {
    const e: EngineEvent = {
      id: `${cue.id}-${n++}`,
      t: Math.max(0, cue.t + dt),
      kind,
      layer: LAYER[kind]!,
      intensity: clamp(intensity * g),
      position: { ...pos, ...at },
      macros: Object.fromEntries(Object.entries(macros).map(([k, v]) => [k, clamp(v)])),
      ...(duration === undefined ? {} : { duration: Math.max(0.02, duration) }),
    };
    out.push(e);
  };
  const rnd = seeded(cue.id);
  const spread = (): number => clamp((pos.x ?? 0) + 0.6 * (rnd() * 2 - 1), -1, 1);

  switch (cue.recipe) {
    // Ambience beds.
    case 'hall-air':
      add('wind', 0, 0.1, { gust: 0.15, howl: 0 }, d, { distance: 6 });
      break;
    case 'wind':
      add('wind', 0, 0.22, { gust: 0.5 + 0.4 * b, howl: 0.25 * b }, d, { distance: 3 });
      break;
    case 'dust-bed':
      add('wind', 0, 0.12, { gust: 0.35, howl: 0 }, d, { distance: 5 });
      add('roar', 0, 0.12, { brightness: 0.1, motion: 0.2, swell: 0.6 }, d, { distance: 8 });
      break;
    case 'magic-air':
      add('wind', 0, 0.08, { gust: 0.2, howl: 0.1 }, d, { distance: 6 });
      add('shimmer', 0, 0.08, { density: 0.3, height: 0.3 + 0.4 * b }, d, { distance: 8 });
      break;

    // Stone.
    case 'stone-hit':
      add('impact', 0, 0.8, { weight: 0.5 + 0.5 * s, decay: 0.15 + 0.2 * s, crack: 0.7 });
      add('boom', 0, 0.9, { size: s, decay: 0.4 + 0.5 * s, tone: 0 });
      add('crack', 0, 0.6, { size: 0.3 + 0.6 * s, brightness: 0.4 + 0.5 * b, crumble: 0.2 }, 0.2);
      add('rubble', 0.03, 0.4, { size: 0.6 * s, density: 0.7, brightness: 0.4 + 0.4 * b, swell: 0 }, 0.4 + 0.8 * s);
      break;
    case 'rock-shatter':
      add('crack', 0, 0.7, { size: 0.2 + 0.5 * s, brightness: 0.7 + 0.3 * b, crumble: 0.6 }, 0.25);
      add('impact', 0, 0.4, { weight: 0.3 + 0.5 * s, decay: 0.15, crack: 0.9 });
      add('rubble', 0.02, 0.35, { size: 0.3 * s, density: 0.8, brightness: 0.7, swell: 0 }, 0.5);
      break;
    case 'debris': {
      // Pieces that fall over `duration`: a bed of rubble and `count` single cracks, large first.
      add('rubble', 0, 0.3, { size: 0.3 + 0.5 * s, density: 0.6, brightness: 0.4 + 0.4 * b, swell: 0.3 }, d);
      const count = cue.count ?? 4;
      for (let i = 0; i < count; i++) {
        const k = 1 - i / Math.max(1, count);
        const dt = d * (i / count) + 0.1 * d * rnd();
        add('crack', dt, 0.35 * (0.4 + 0.6 * k), { size: 0.15 + 0.6 * s * k, brightness: 0.5 + 0.3 * b, crumble: 0.5 }, 0.15, {
          x: spread(),
        });
      }
      break;
    }
    case 'rumble':
      add('boom', 0, 0.7, { size: 0.85 + 0.15 * s, decay: 0.9, tone: 0 }, undefined, { distance: 10 });
      add('roar', 0, 0.35, { brightness: 0.1, motion: 0.3, swell: 0.5 }, d, { distance: 10 });
      break;
    case 'dust':
      add('roar', 0, 0.4, { brightness: 0.2 + 0.3 * b, motion: 0.3, swell: 0.7 }, d);
      add('wind', 0.1, 0.18, { gust: 0.6, howl: 0 }, d);
      break;

    // Energy.
    case 'beam':
      add('boom', 0, 0.5, { size: 0.3 + 0.5 * s, decay: 0.5, tone: 0.3 });
      add('roar', 0, 0.6, { brightness: 0.4 + 0.5 * b, motion: 0.7, swell: 0.2 }, d);
      add('shimmer', 0, 0.25, { density: 0.6, height: 0.3 + 0.6 * b }, d);
      add('riser', 0, 0.12, { length: 0.2, pitch: 0.3 + 0.5 * b }, d);
      break;
    case 'blast':
      add('impact', 0, 0.8, { weight: 1, decay: 0.3, crack: 0.5 + 0.4 * b });
      add('boom', 0, 1, { size: 0.3 + 0.6 * s, decay: 0.6 + 0.3 * s, tone: 0.2 });
      add('roar', 0, 0.7, { brightness: 0.3 + 0.5 * b, motion: 0.6, swell: 0 }, 0.6 + 1.4 * s, { x: clamp(pos.x - 0.5, -1, 1) });
      add('roar', 0, 0.7, { brightness: 0.3 + 0.5 * b, motion: 0.6, swell: 0 }, 0.6 + 1.4 * s, { x: clamp(pos.x + 0.5, -1, 1) });
      break;
    case 'flash':
      add('boom', 0, 0.9, { size: 0.9, decay: 0.9, tone: 0 }, undefined, { distance: 6 });
      add('whoosh', -0.25, 0.4, { speed: 0.8, brightness: 0.4 + 0.5 * b }, 0.3);
      add('roar', 0, 0.5, { brightness: 0.5 + 0.4 * b, motion: 0.5, swell: 0.4 }, d);
      break;
    case 'zap':
      add('crack', 0, 0.6, { size: 0.08, brightness: 1, crumble: 0.9 }, 0.12);
      add('whoosh', 0, 0.35, { speed: 1, brightness: 0.9 }, 0.1);
      add('shimmer', 0, 0.2, { density: 0.9, height: 0.8 + 0.2 * b }, 0.35);
      break;
    case 'lightning': {
      // An arc that crawls for `duration`: a bright roar and `count` short cracks across it.
      add('roar', 0, 0.45, { brightness: 0.85, motion: 0.9, swell: 0.3 }, d);
      const count = cue.count ?? Math.max(3, Math.round(d * 4));
      for (let i = 0; i < count; i++)
        add('crack', d * rnd() * 0.95, 0.4 + 0.3 * rnd(), { size: 0.05 + 0.1 * rnd(), brightness: 1, crumble: 0.9 }, 0.1, {
          x: spread(),
        });
      break;
    }
    case 'charge':
      add('riser', 0, 0.3, { length: 0.9, pitch: 0.4 + 0.5 * b }, d);
      add('shimmer', 0, 0.2, { density: 0.5, height: 0.5 + 0.4 * b }, d);
      break;
    case 'shield':
      add('shimmer', 0, 0.25, { density: 0.4, height: 0.35 + 0.3 * b }, d);
      add('roar', 0, 0.15, { brightness: 0.3, motion: 0.2, swell: 0.4 }, d);
      break;
    case 'shield-hit':
      add('impact', 0, 0.55, { weight: 0.3 + 0.5 * s, decay: 0.35, crack: 0.3 });
      add('shimmer', 0, 0.3, { density: 0.8, height: 0.7 + 0.3 * b }, 0.4);
      add('crack', 0, 0.3, { size: 0.3 * s + 0.1, brightness: 0.6, crumble: 0.3 }, 0.12);
      break;
    case 'shatter':
      add('crack', 0, 0.7, { size: 0.12, brightness: 1, crumble: 1 }, 0.3);
      add('shimmer', 0, 0.45, { density: 1, height: 0.9 }, 0.5 + 0.8 * s);
      add('rubble', 0.02, 0.4, { size: 0, density: 1, brightness: 1, swell: 0 }, 0.4 + 0.8 * s);
      break;
    case 'sparkle':
      add('shimmer', 0, 0.25, { density: 0.3 + 0.6 * s, height: 0.6 + 0.4 * b }, d);
      break;

    // Movement and the body.
    case 'whoosh':
      add('whoosh', 0, 0.45, { speed: 0.3 + 0.7 * s, brightness: b }, d);
      break;
    case 'swish':
      add('whoosh', 0, 0.35, { speed: 1, brightness: 0.4 + 0.5 * b }, Math.min(d, 0.25));
      break;
    case 'float':
      add('whoosh', 0, 0.2, { speed: 0.1, brightness: 0.1 }, d);
      break;
    case 'cloth':
      add('cloth', 0, 0.4, { fabric: 0.5, speed: 0.3 + 0.6 * s }, d, { distance: cue.distance ?? 2 });
      break;
    case 'step':
      add('footstep', 0, 0.5, { surface: 0.25, weight: 0.3 + 0.6 * s, pace: 0.5 });
      break;
    case 'land':
      add('footstep', 0, 0.7, { surface: 0.25, weight: 0.8 + 0.2 * s, pace: 0.3 });
      add('cloth', 0, 0.3, { fabric: 0.5, speed: 0.7 }, 0.3, { distance: cue.distance ?? 2 });
      add('boom', 0, 0.25, { size: 0.1 + 0.3 * s, decay: 0.2, tone: 0.2 });
      break;
    default:
      throw new Error(`cue "${cue.id}": no recipe "${cue.recipe}"`);
  }
  return out;
}

/** The recipes, with what each stands for: the cue sheet's legend. */
export const RECIPES: Readonly<Record<string, string>> = {
  'hall-air': 'bed: the air of the stone hall (wind, low gust)',
  wind: 'bed: moving air on the body and the hair (wind)',
  'dust-bed': 'bed: a hall full of settling dust (wind and a low roar)',
  'magic-air': 'bed: the air of a space lit by magic (wind and a faint shimmer)',
  'stone-hit': 'a stone body hits stone (impact, boom, crack, rubble)',
  'rock-shatter': 'a rock breaks under a force (crack, impact, rubble)',
  debris: 'pieces of stone fall, large first (rubble and cracks)',
  rumble: 'a structure answers from far (boom and a low roar)',
  dust: 'a cloud of dust billows (roar and wind)',
  beam: 'a beam of mana lasts (boom, roar, shimmer, riser)',
  blast: 'a magic blast (impact, boom, two roars)',
  flash: 'a graphic flash with low pressure under it (boom, whoosh, roar)',
  zap: 'one arc of lightning (crack, whoosh, shimmer)',
  lightning: 'arcs that crawl for a time (roar and cracks)',
  charge: 'mana gathers (riser and shimmer)',
  shield: 'a barrier of hexagons holds (shimmer and a low roar)',
  'shield-hit': 'a body hits the barrier (impact, shimmer, crack)',
  shatter: 'crystal breaks (crack, shimmer, rubble)',
  sparkle: 'particles of light (shimmer)',
  whoosh: 'a body passes fast through the air (whoosh)',
  swish: 'a staff or an arm swings (whoosh)',
  float: 'rocks drift past slowly (whoosh)',
  cloth: 'cloth and hair move (cloth)',
  step: 'a footstep on stone (footstep)',
  land: 'a body lands on stone (footstep, cloth, boom)',
};
