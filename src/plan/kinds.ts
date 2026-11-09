import type { PlanLayer } from './types.ts';

export interface MacroDefinition {
  min: number;
  max: number;
  /** The value of a macro the plan leaves out. */
  default: number;
  unit: string;
}

export interface KindDefinition {
  /** The layer the kind belongs to by default. A plan may place an event on another layer. */
  layer: PlanLayer;
  summary: string;
  macros: Record<string, MacroDefinition>;
}

/**
 * The vocabulary of the plan. It starts small, and each entry grows with the units that render it.
 * A kind names its layer, its macros and their ranges.
 */
export const KINDS: Record<string, KindDefinition> = {
  impact: {
    layer: 'effects',
    summary: 'A hit with a body, a click and a tail.',
    macros: {
      weight: { min: 0, max: 1, default: 0.5, unit: '1' },
      brightness: { min: 0, max: 1, default: 0.5, unit: '1' },
      decay: { min: 0.1, max: 6, default: 1.2, unit: 's' },
    },
  },
  whoosh: {
    layer: 'effects',
    summary: 'A filtered noise sweep that leads into an impact.',
    macros: {
      speed: { min: 0.1, max: 1, default: 0.5, unit: '1' },
      brightness: { min: 0, max: 1, default: 0.5, unit: '1' },
      lead: { min: 0, max: 1, default: 0.25, unit: 's' },
    },
  },
  shimmer: {
    layer: 'effects',
    summary: 'A cloud of high partials that rises and fades.',
    macros: {
      pitch: { min: 200, max: 4000, default: 1200, unit: 'Hz' },
      spread: { min: 0, max: 1, default: 0.4, unit: '1' },
      decay: { min: 0.5, max: 8, default: 3, unit: 's' },
    },
  },
  footstep: {
    layer: 'foley',
    summary: 'One step on a surface, from a grain.',
    macros: {
      surface: { min: 0, max: 1, default: 0.3, unit: '1' },
      weight: { min: 0, max: 1, default: 0.5, unit: '1' },
    },
  },
  wind: {
    layer: 'ambience',
    summary: 'A bed of filtered noise with slow gusts.',
    macros: {
      gust: { min: 0, max: 1, default: 0.3, unit: '1' },
      pitch: { min: 100, max: 1500, default: 400, unit: 'Hz' },
    },
  },
  tone: {
    layer: 'music',
    summary: 'A sustained pitch with an attack and a release.',
    macros: {
      frequency: { min: 40, max: 4000, default: 220, unit: 'Hz' },
      detune: { min: 0, max: 50, default: 8, unit: 'cent' },
      attack: { min: 0.001, max: 2, default: 0.2, unit: 's' },
    },
  },
};
