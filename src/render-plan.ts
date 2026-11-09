// The layered render of a sound plan (docs/sound-design-loop.md; docs/experiments.md, section 8).
// The plan is validated, its events sorted; every event becomes a lane of the bank of its kind, placed
// by the spatial chain into its layer, and each block of 1,024 frames is one `dev.fuse` scope of
// the kernels of `src/kinds/lanes.shade.ts`, `src/spatial/spatial.shade.ts` and `src/spatial/reverb.ts`.
// The master (`src/master.ts`) then measures the mix, scales it to the plan's loudness target and
// limits its true peak. The render is deterministic: the same plan gives the same bits on a tier.

import type { Device, FuseReport, Resident } from 'typeshade/runtime';
import { bank } from './bank.ts';
import {
  LAYERS,
  validatePlan,
  type PlanEvent,
  type PlanLayer,
  type SoundPlan,
} from './plan/index.ts';
import {
  cloths,
  drones,
  footsteps,
  gather,
  impacts,
  risers,
  shimmers,
  voices,
  whooshes,
  winds,
  type ClothLane,
  type DroneLane,
  type FootstepLane,
  type ImpactLane,
  type RiserLane,
  type ShimmerLane,
  type VoiceLane,
  type WhooshLane,
  type WindLane,
} from './kinds/lanes.shade.ts';
import { KIND_INDEX, eventKey, makeLane, type Made } from './kinds/make.ts';
import { Spatial, history, layers, pack, place, sendSum, strips } from './spatial/spatial.shade.ts';
import { BLOCK, WIDTH, impulseResponse, spatialOf, stripOf } from './spatial/room.ts';
import { Reverb } from './spatial/reverb.ts';
import { duckActive, duckGains, duckSources } from './spatial/duck.ts';
import { limiterGain, normalizationGain } from './master.ts';

/** The sample rate of a render: a renderer fact, not a plan field. */
export const SAMPLE_RATE = 48000;
/** How far an onset may move to meet a cut or a peak of motion, in seconds (one frame at 24 fps). */
export const SNAP_WINDOW = 0.04;
/** The time a block must take to keep up, in milliseconds. */
export const BLOCK_BUDGET_MS = (BLOCK / SAMPLE_RATE) * 1000;

export interface RenderPlanOptions {
  /** The spatial chain: distance, air, pan, early reflections and the reverb send. Default true. */
  spatial?: boolean;
  /** The guards: ducking, the layers' slots, the snap, the loudness target and the limiter. Default true. */
  guards?: boolean;
  /** The reverb send's convolution. Default: the same as `spatial`. Off, the wet return is silent. */
  reverb?: boolean;
  /** The binaural stage for headphones: an interaural delay and a head shadow on the far ear. Default false. */
  binaural?: boolean;
  /** The input stems of `voice` events by event id, mono at `SAMPLE_RATE`. A `voice` with none is silent. */
  stems?: Record<string, Float32Array>;
  /** Stop after this many blocks, for timing. The output holds those blocks only. */
  blocks?: number;
}

export type Stereo = [Float32Array, Float32Array];

export interface Rendered {
  sampleRate: number;
  frames: number;
  /** Each layer's stem: its events through the spatial chain and the layer's guards, before the reverb. */
  stems: Record<PlanLayer, Stereo>;
  /** The reverb's return, left and right. */
  wet: Stereo;
  /** The stems summed: the mix without the reverb. */
  dry: Stereo;
  /** The mix: `dry` plus `wet`. */
  mix: Stereo;
  /** The master: the gain that set the loudness, in dB, and the deepest gain of the limiter, in dB. */
  master: { lufsBefore: number; normalizeDb: number; limiterMinDb: number };
  /** The host time of each block, in milliseconds: its `fuse` scope and its read. */
  blockMs: number[];
  /** The fuse report of each block. */
  reports: FuseReport[];
  /** The host time of the partitions' transform before the first block, in milliseconds; 0 with no reverb. */
  reverbPrepareMs: number;
  /** The tier the first report names. */
  tier: string;
  /** Where each event was placed, in frames: id, start and end. */
  placed: { id: string; start: number; end: number }[];
}

/** The events of a moment run together when each starts within this many seconds of the one before. */
export const MOMENT_GAP = 0.1;

/**
 * The one-layer version of a plan (docs/experiments.md, section 8, method step 2): the same moments,
 * one sound at each. Events that start within `MOMENT_GAP` of the one before are one moment. The
 * moment keeps its loudest event's time, intensity and position, and its sound is one `impact` on
 * `effects`.
 */
export function onePlan(plan: SoundPlan): SoundPlan {
  const moments: PlanEvent[][] = [];
  for (const e of plan.events) {
    const last = moments[moments.length - 1];
    if (last !== undefined && e.t - last[last.length - 1]!.t < MOMENT_GAP) last.push(e);
    else moments.push([e]);
  }
  return {
    ...plan,
    events: moments.map((m): PlanEvent => {
      const e = m.reduce((a, b) => (b.intensity > a.intensity ? b : a));
      return {
        id: e.id,
        t: e.t,
        kind: 'impact',
        layer: 'effects',
        intensity: e.intensity,
        position: e.position,
        macros: { weight: 0.5, decay: 0.5, crack: 0.5 },
        sync: 'onset',
      };
    }),
  };
}

/** The picture time nearest to `t` within `SNAP_WINDOW`, or `t`. */
function snapped(plan: SoundPlan, t: number): number {
  let best = t;
  let gap = SNAP_WINDOW;
  for (const p of [...plan.picture.cuts, ...plan.picture.motion]) {
    if (Math.abs(p - t) < gap) {
      gap = Math.abs(p - t);
      best = p;
    }
  }
  return best;
}

type Floats = Resident<Float32Array>;

/**
 * Renders `raw` (validated first) on `dev` and resolves to the stems, the reverb's return and the
 * mix. Each block is one `fuse` scope; its output is one read.
 *
 * @throws `Error` from `validatePlan` for a plan it refuses.
 */
export async function renderPlan(
  dev: Device,
  raw: unknown,
  options: RenderPlanOptions = {},
): Promise<Rendered> {
  const plan = validatePlan(raw);
  const sr = SAMPLE_RATE;
  const spatial = options.spatial ?? true;
  const guards = options.guards ?? true;
  const frames = Math.ceil(plan.clip.duration * sr);
  const allBlocks = Math.ceil(frames / BLOCK);
  const blocks = Math.min(allBlocks, options.blocks ?? allBlocks);
  const total = blocks * BLOCK;
  const events = plan.events;
  const lanes = events.length;

  // One lane of its kind's bank and one lane of the chain for each event. `kinds` and `slots` say,
  // for event `i`, which bank holds its lane and at which place; `gather` reads them.
  const byKind: Made['lane'][][] = Object.keys(KIND_INDEX).map(() => []);
  const kinds = new Uint32Array(lanes);
  const slots = new Uint32Array(lanes);
  const places: Spatial[] = [];
  const placed: Rendered['placed'] = [];
  const stems: { slot: number; start: number; data: Float32Array }[] = [];
  events.forEach((e, i) => {
    const stem = options.stems?.[e.id];
    const made = makeLane(e, {
      sr,
      key: eventKey(plan.seed, e.id),
      ...(stem === undefined ? {} : { stem }),
    });
    const t = guards ? snapped(plan, e.t) : e.t;
    const anchor = Math.round(t * sr);
    const start = Math.max(0, e.sync === 'arrive' ? anchor - made.length : anchor);
    made.lane.start = start;
    made.lane.end = start + made.length;
    const k = KIND_INDEX[made.kind];
    kinds[i] = k;
    slots[i] = byKind[k]!.length;
    byKind[k]!.push(made.lane);
    places.push(spatialOf(e, plan.scene, { spatial, sr }));
    placed.push({ id: e.id, start, end: start + made.length });
    if (e.kind === 'voice' && stem !== undefined)
      stems.push({ slot: slots[i]!, start, data: stem });
  });

  // A bank for each kind that has an event: `bank()` refuses an empty array, and a kind with no
  // event has no call.
  const present = (k: number): boolean => byKind[k]!.length > 0;
  const bankOf = <T extends Made['lane']>(k: number) =>
    present(k) ? bank(dev, byKind[k] as T[]) : undefined;
  const whooshBank = bankOf<WhooshLane>(KIND_INDEX.whoosh);
  const impactBank = bankOf<ImpactLane>(KIND_INDEX.impact);
  const shimmerBank = bankOf<ShimmerLane>(KIND_INDEX.shimmer);
  const riserBank = bankOf<RiserLane>(KIND_INDEX.riser);
  const windBank = bankOf<WindLane>(KIND_INDEX.wind);
  const droneBank = bankOf<DroneLane>(KIND_INDEX.drone);
  const footstepBank = bankOf<FootstepLane>(KIND_INDEX.footstep);
  const clothBank = bankOf<ClothLane>(KIND_INDEX.cloth);
  const voiceBank = bankOf<VoiceLane>(KIND_INDEX.voice);
  const laneBank = bank(dev, places);
  const stripBank = bank(
    dev,
    LAYERS.map((_, i) => stripOf(i, sr, guards)),
  );
  const zeros = (n: number): Floats => dev.array(n, 'f32');
  const arrays: Floats[] = [];
  const make = (n: number): Floats => {
    const a = zeros(n);
    arrays.push(a);
    return a;
  };
  // The stems of the voice lanes, a row for each lane of the voice bank; the output of each kind's
  // kernel, a row for each lane of its bank (a kind with no event gets one frame, which `gather`
  // does not read); and `raws`, a row for each event.
  const rows = (k: number): number => Math.max(1, byKind[k]!.length) * BLOCK;
  const inputs = make(rows(KIND_INDEX.voice));
  const raws = make(lanes * BLOCK);
  const outs = Object.values(KIND_INDEX).map((k) => make(rows(k))) as [
    Floats,
    Floats,
    Floats,
    Floats,
    Floats,
    Floats,
    Floats,
    Floats,
    Floats,
  ];
  const kindIdx = dev.array(kinds);
  const slotIdx = dev.array(slots);
  let hist = make(lanes * WIDTH);
  let prev = make(lanes * WIDTH);
  const laneL = make(lanes * BLOCK);
  const laneR = make(lanes * BLOCK);
  const laneS = make(lanes * BLOCK);
  const layL = make(5 * BLOCK);
  const layR = make(5 * BLOCK);
  const layS = make(5 * BLOCK);
  const stripL = make(5 * BLOCK);
  const stripR = make(5 * BLOCK);
  const stripS = make(5 * BLOCK);
  // The gain of each layer for the block: the pre-impact ducking (`src/spatial/duck.ts`). All ones
  // until a block needs more; the guards off, always all ones.
  const duckGain = make(5 * BLOCK);
  const ones = new Float32Array(5 * BLOCK).fill(1);
  duckGain.write(ones);
  const duck = guards
    ? duckSources(
        events,
        placed.map((p) => p.start),
      )
    : [];
  const gainBlock = new Float32Array(5 * BLOCK);
  let ducked = false;
  const send = make(BLOCK);
  const out = make(12 * BLOCK);
  const none = make(2 * BLOCK);

  const prepareStart = performance.now();
  const reverb =
    (options.reverb ?? spatial)
      ? await (async () => {
          const ir = impulseResponse(plan.scene.room.material, sr, plan.seed);
          return Reverb.create(dev, ir.left, ir.right);
        })()
      : undefined;
  const reverbPrepareMs = reverb === undefined ? 0 : performance.now() - prepareStart;
  const wet = reverb?.wet ?? none;
  const binaural = options.binaural ? 1 : 0;

  const channel = (): Float32Array => new Float32Array(total);
  const stemOut = Object.fromEntries(
    LAYERS.map((l) => [l, [channel(), channel()] as Stereo]),
  ) as Record<PlanLayer, Stereo>;
  const wetOut: Stereo = [channel(), channel()];
  const blockMs: number[] = [];
  const reports: FuseReport[] = [];
  let fed = false;

  try {
    for (let b = 0; b < blocks; b++) {
      const t0 = performance.now();
      const at = b * BLOCK;
      // The stems of the voice events that sound in this block.
      const live = stems.filter((s) => s.start < at + BLOCK && s.start + s.data.length > at);
      if (live.length > 0 || fed) {
        const fill = new Float32Array(rows(KIND_INDEX.voice));
        for (const s of live) {
          const from = Math.max(at - s.start, 0);
          const to = Math.min(at + BLOCK - s.start, s.data.length);
          fill.set(s.data.subarray(from, to), s.slot * BLOCK + (s.start + from - at));
        }
        inputs.write(fill);
        fed = live.length > 0;
      }
      // The gain of the layers for this block, written only while a duck is in or near the block.
      const active = duckActive(duck, at, sr);
      if (active || ducked) {
        if (active) duckGains(gainBlock, duck, at, sr);
        duckGain.write(active ? gainBlock : ones);
        ducked = active;
      }
      [hist, prev] = [prev, hist];
      const report = await dev.fuse(() => {
        // One call for each kind that has an event, each over its own bank; then `gather` puts each
        // event's block in its row of `raws`.
        if (whooshBank) whooshes(outs[KIND_INDEX.whoosh]!, whooshBank.instances, BLOCK);
        if (impactBank) impacts(outs[KIND_INDEX.impact]!, impactBank.instances, BLOCK);
        if (shimmerBank) shimmers(outs[KIND_INDEX.shimmer]!, shimmerBank.instances, BLOCK);
        if (riserBank) risers(outs[KIND_INDEX.riser]!, riserBank.instances, BLOCK);
        if (windBank) winds(outs[KIND_INDEX.wind]!, windBank.instances, BLOCK);
        if (droneBank) drones(outs[KIND_INDEX.drone]!, droneBank.instances, BLOCK);
        if (footstepBank) footsteps(outs[KIND_INDEX.footstep]!, footstepBank.instances, BLOCK);
        if (clothBank) cloths(outs[KIND_INDEX.cloth]!, clothBank.instances, BLOCK);
        if (voiceBank) voices(outs[KIND_INDEX.voice]!, voiceBank.instances, inputs, BLOCK);
        gather(
          raws,
          kindIdx,
          slotIdx,
          outs[0],
          outs[1],
          outs[2],
          outs[3],
          outs[4],
          outs[5],
          outs[6],
          outs[7],
          outs[8],
          BLOCK,
        );
        history(hist, prev, raws);
        place(laneL, laneR, laneS, hist, laneBank.instances, binaural);
        layers(layL, layR, layS, laneL, laneR, laneS, laneBank.instances);
        strips(stripL, stripR, stripS, layL, layR, layS, duckGain, stripBank.instances);
        sendSum(send, stripS);
        reverb?.block(send);
        pack(out, stripL, stripR, wet);
      });
      const block = await out.read();
      LAYERS.forEach((l, i) => {
        stemOut[l][0].set(block.subarray(i * BLOCK, (i + 1) * BLOCK), at);
        stemOut[l][1].set(block.subarray((5 + i) * BLOCK, (6 + i) * BLOCK), at);
      });
      wetOut[0].set(block.subarray(10 * BLOCK, 11 * BLOCK), at);
      wetOut[1].set(block.subarray(11 * BLOCK, 12 * BLOCK), at);
      blockMs.push(performance.now() - t0);
      reports.push(report);
    }
  } finally {
    for (const a of arrays) dev.release(a);
    dev.release(kindIdx);
    dev.release(slotIdx);
    reverb?.release();
  }

  // Trim to the clip, sum, and run the master.
  const length = Math.min(total, frames);
  const trim = (x: Float32Array): Float32Array => x.slice(0, length);
  const trimmed = Object.fromEntries(
    LAYERS.map((l) => [l, [trim(stemOut[l][0]), trim(stemOut[l][1])] as Stereo]),
  ) as Record<PlanLayer, Stereo>;
  const wetT: Stereo = [trim(wetOut[0]), trim(wetOut[1])];
  const dry: Stereo = [new Float32Array(length), new Float32Array(length)];
  for (const l of LAYERS)
    for (let c = 0; c < 2; c++) for (let i = 0; i < length; i++) dry[c]![i]! += trimmed[l][c]![i]!;
  const mix: Stereo = [new Float32Array(length), new Float32Array(length)];
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < length; i++) mix[c]![i] = dry[c]![i]! + wetT[c]![i]!;

  let lufsBefore = NaN;
  let normalizeDb = 0;
  let limiterMinDb = 0;
  if (guards) {
    const gain = normalizationGain(mix, sr, plan.master.lufs);
    normalizeDb = 20 * Math.log10(gain);
    lufsBefore = plan.master.lufs - normalizeDb;
    const all: Float32Array[] = [...mix, ...dry, ...wetT, ...LAYERS.flatMap((l) => trimmed[l])];
    for (const x of all) for (let i = 0; i < x.length; i++) x[i]! *= gain;
    const limit = limiterGain(mix, sr, plan.master.truePeak);
    let min = 1;
    for (let i = 0; i < length; i++) min = Math.min(min, limit[i]!);
    limiterMinDb = 20 * Math.log10(min);
    for (const x of all) for (let i = 0; i < length; i++) x[i]! *= limit[i]!;
  }
  return {
    sampleRate: sr,
    frames: length,
    stems: trimmed,
    wet: wetT,
    dry,
    mix,
    master: { lufsBefore, normalizeDb, limiterMinDb },
    blockMs,
    reports,
    reverbPrepareMs,
    tier: reports[0]?.tier ?? 'none',
    placed,
  };
}
