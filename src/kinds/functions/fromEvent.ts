// A planned event as typed function nodes. `makeLane` (src/kinds/make.ts) turns an event's macros,
// intensity and key into a kind with its shape set; this reads that shape back into the inputs of
// the kind's function definitions, so the take is computed in one place and the function sounds as
// the lane does. The site's editor shows these values as each node's inputs.

import type {
  FunctionDefinition,
  FunctionInstance,
  InputBinding,
} from '../../function-graph/types.ts';
import type { Made } from '../make.ts';
import { BOOM_DEFINITION, BOOM_MODULE, BOOM_SOURCE } from './boom.ts';
import {
  IMPACT_DEFINITION,
  IMPACT_MODULE,
  IMPACT_SOURCE,
  NOISE_MODULE,
  NOISE_SOURCE,
} from './impact.ts';
import { ROAR_BAND_DEFINITION, ROAR_MIX_DEFINITION, ROAR_MODULE, ROAR_SOURCE } from './roar.ts';
import {
  STONE_BAND_DEFINITION,
  STONE_CLOCK_DEFINITION,
  STONE_MIX_DEFINITION,
  STONES_MODULE,
  STONES_SOURCE,
} from './stones.ts';

/** The nodes of one event, the definitions and modules they use, and the node that sounds. */
export interface KindNodes {
  readonly modules: Record<string, string>;
  readonly definitions: FunctionDefinition[];
  readonly nodes: FunctionInstance[];
  readonly output: { readonly node: string; readonly port: string };
}

/** The kinds that have function definitions. */
export const FUNCTION_KINDS = ['impact', 'boom', 'roar', 'crack', 'rubble'] as const;

const c = (value: number): InputBinding => ({ kind: 'constant', value });
const k = (value: number): InputBinding => ({ kind: 'constant', value: value >>> 0 });
const wire = (node: string): InputBinding => ({ kind: 'connection', node, port: 'out' });

interface Shaped {
  [field: string]: unknown;
}
const num = (o: Shaped, field: string): number => {
  const v = o[field];
  if (typeof v !== 'number') throw new Error(`fromEvent: the shape has no number "${field}".`);
  return v;
};
const damp = (o: Shaped, svf: string): number => num(o[svf] as Shaped, 'damp');

/** The nodes of a made lane, their ids prefixed by `id` and a hyphen (an id is a letter or `_`, then letters, digits, `_` and `-`). Throws for a kind with no definitions. */
export function kindNodes(made: Made, id: string): KindNodes {
  const noise = { [NOISE_MODULE]: NOISE_SOURCE };
  switch (made.kind) {
    case 'impact': {
      const u = made.lane.impact as unknown as Shaped;
      return {
        modules: { ...noise, [IMPACT_MODULE]: IMPACT_SOURCE },
        definitions: [IMPACT_DEFINITION],
        nodes: [
          {
            id,
            definition: 'impact',
            inputs: {
              key: k(num(u, 'key')),
              base: c(num(u, 'base')),
              drop: c(num(u, 'drop')),
              dropRate: c(num(u, 'dropRate')),
              subDecay: c(num(u, 'subDecay')),
              noiseDecay: c(num(u, 'noiseDecay')),
              noiseK: c(num(u.lp as Shaped, 'k')),
              clickLen: c(num(u, 'clickLen')),
              aSub: c(num(u, 'aSub')),
              aNoise: c(num(u, 'aNoise')),
              aClick: c(num(u, 'aClick')),
            },
          },
        ],
        output: { node: id, port: 'out' },
      };
    }
    case 'boom': {
      const u = made.lane.boom as unknown as Shaped;
      return {
        modules: { ...noise, [BOOM_MODULE]: BOOM_SOURCE },
        definitions: [BOOM_DEFINITION],
        nodes: [
          {
            id,
            definition: 'boom',
            inputs: {
              key: k(num(u, 'key')),
              coef: c(num(u, 'coef')),
              damp: c(damp(u, 'svf')),
              base: c(num(u, 'base')),
              glide: c(num(u, 'glide')),
              glideRate: c(num(u, 'glideRate')),
              decay: c(num(u, 'decay')),
              rise: c(num(u, 'rise')),
              aNoise: c(num(u, 'aNoise')),
              aTone: c(num(u, 'aTone')),
            },
          },
        ],
        output: { node: id, port: 'out' },
      };
    }
    case 'roar': {
      const u = made.lane.roar as unknown as Shaped;
      const key = num(u, 'key');
      const bands = ['b0', 'b1', 'b2', 'b3'].map((b, i) => {
        const band = u[b] as Shaped;
        return {
          id: `${id}-band${i}`,
          definition: 'roarBand',
          inputs: {
            key: k(key ^ (201 + i)),
            coef: c(num(band, 'coef')),
            damp: c(damp(band, 'svf')),
            gain: c(num(band, 'gain')),
            depth: c(num(band, 'depth')),
            rate: c(num(band, 'rate')),
          },
        };
      });
      return {
        modules: { ...noise, [ROAR_MODULE]: ROAR_SOURCE },
        definitions: [ROAR_BAND_DEFINITION, ROAR_MIX_DEFINITION],
        nodes: [
          ...bands,
          {
            id,
            definition: 'roarMix',
            inputs: {
              b0: wire(bands[0]!.id),
              b1: wire(bands[1]!.id),
              b2: wire(bands[2]!.id),
              b3: wire(bands[3]!.id),
              len: c(num(u, 'len')),
              att: c(num(u, 'att')),
              low: c(num(u, 'low')),
              hold: c(num(u, 'hold')),
              gain: c(num(u, 'gain')),
            },
          },
        ],
        output: { node: id, port: 'out' },
      };
    }
    case 'crack':
    case 'rubble': {
      const u = made.lane.stones as unknown as Shaped;
      const key = num(u, 'key');
      const clock = (part: number) => ({
        part: c(part),
        key: k(key),
        len: c(num(u, 'len')),
        rateA: c(num(u, 'rateA')),
        rateB: c(num(u, 'rateB')),
        rateC: c(num(u, 'rateC')),
        sizeLo: c(num(u, 'sizeLo')),
        sizeLog: c(num(u, 'sizeLog')),
        grow0: c(num(u, 'grow0')),
        grow1: c(num(u, 'grow1')),
        first: c(num(u, 'first')),
        firstSize: c(num(u, 'firstSize')),
      });
      const level = `${id}-level`;
      const size = `${id}-size`;
      const bands = ['b0', 'b1', 'b2', 'b3', 'b4'].map((b, i) => {
        const band = u[b] as Shaped;
        return {
          id: `${id}-band${i}`,
          definition: 'stoneBand',
          inputs: {
            amp: wire(level),
            size: wire(size),
            key: k(key ^ (101 + i)),
            coef: c(num(band, 'coef')),
            damp: c(damp(band, 'svf')),
            keep: c(num(band, 'keep')),
            ratio: c(num(band, 'ratio')),
            edge: c(num(band, 'edge')),
            gain: c(num(band, 'gain')),
            bright: c(num(u, 'bright')),
          },
        };
      });
      return {
        modules: { ...noise, [STONES_MODULE]: STONES_SOURCE },
        definitions: [STONE_CLOCK_DEFINITION, STONE_BAND_DEFINITION, STONE_MIX_DEFINITION],
        nodes: [
          { id: level, definition: 'stoneClock', inputs: clock(0) },
          { id: size, definition: 'stoneClock', inputs: clock(1) },
          ...bands,
          {
            id,
            definition: 'stoneMix',
            inputs: Object.fromEntries(bands.map((b, i) => [`b${i}`, wire(b.id)])),
          },
        ],
        output: { node: id, port: 'out' },
      };
    }
    default:
      throw new Error(`fromEvent: the kind "${made.kind}" has no function definitions yet.`);
  }
}
