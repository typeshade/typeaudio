import type { PlanLayer } from './types.ts';

export interface MacroDefinition {
  min: 0;
  max: 1;
  /** The value of a macro the plan leaves out. */
  default: number;
}

export interface KindDefinition {
  /** How the vocabulary makes the kind. */
  sort: 'procedural' | 'grain' | 'stem';
  /** The one layer the kind belongs to. The validator refuses an event of the kind on another layer. */
  layer: PlanLayer;
  macros: Record<string, MacroDefinition>;
}

const macros = (...names: string[]): Record<string, MacroDefinition> =>
  Object.fromEntries(names.map((n) => [n, { min: 0, max: 1, default: 0.5 } as MacroDefinition]));

/** The starting vocabulary of docs/sound-design-loop.md, "The kinds". Each macro runs from 0 to 1. */
export const KINDS: Record<string, KindDefinition> = {
  whoosh: { sort: 'procedural', layer: 'effects', macros: macros('speed', 'brightness') },
  impact: { sort: 'procedural', layer: 'effects', macros: macros('weight', 'decay', 'crack') },
  shimmer: { sort: 'procedural', layer: 'effects', macros: macros('density', 'height') },
  riser: { sort: 'procedural', layer: 'effects', macros: macros('length', 'pitch') },
  wind: { sort: 'procedural', layer: 'ambience', macros: macros('gust', 'howl') },
  drone: { sort: 'procedural', layer: 'music', macros: macros('pitch', 'darkness') },
  footstep: { sort: 'grain', layer: 'foley', macros: macros('surface', 'weight', 'pace') },
  cloth: { sort: 'grain', layer: 'foley', macros: macros('fabric', 'speed') },
  voice: { sort: 'stem', layer: 'dialogue', macros: {} },
  crack: { sort: 'procedural', layer: 'effects', macros: macros('size', 'brightness', 'crumble') },
  boom: { sort: 'procedural', layer: 'effects', macros: macros('size', 'decay', 'tone') },
  rubble: {
    sort: 'procedural',
    layer: 'effects',
    macros: macros('size', 'density', 'brightness', 'swell'),
  },
  roar: { sort: 'procedural', layer: 'effects', macros: macros('brightness', 'motion', 'swell') },
};
