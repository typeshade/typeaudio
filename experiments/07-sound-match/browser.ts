// Experiment 7 on WebGPU or WebGL2, in a page: `run.ts` bundles this file, writes the packed program
// of each parameter count beside it (`program.ts`), opens it in headless Chromium and calls
// `runMatch` with the tier. The page loads each program with `typeshade/runtime` alone.

import { createRuntime, resident, type Pack } from 'typeshade/runtime';
import { Adam, timedAsync, type Repeats, type Timing } from './match.ts';
import { ENTRY, FORWARD_LANES, FRAMES, startOf, truthOf } from './patch.ts';

export interface PageOptions {
  readonly tier: 'webgpu' | 'webgl2';
  readonly counts: readonly number[];
  readonly repeats: Repeats;
  /** How long one call may take, in milliseconds, before the tier's remaining calls are not run. */
  readonly timeoutMs: number;
  /** The target of each count: `logPower` of the known answer on the oracle, 16 numbers. */
  readonly targets: Readonly<Record<string, readonly number[]>>;
  /** The steps of the descent of 3 parameters on the tier, with forward mode's gradient; 0 for none. */
  readonly iterations: number;
}

/** What one parameter count gave on the tier. */
export interface PageCount {
  readonly count: number;
  /** The render by one invocation, `render` as the CPU arms call it. */
  readonly render?: Timing;
  /** The render by one invocation for each frame (`framesEntry`). */
  readonly frames?: Timing;
  readonly loss?: Timing;
  readonly forward?: Timing;
  readonly reverse?: Timing;
  /** The outputs at the known answer (the frames of both renders) and at the start (the loss and both gradients). */
  readonly renderOutput?: number[];
  readonly framesOutput?: number[];
  readonly lossAtStart?: number;
  readonly forwardGradient?: number[];
  readonly reverseGradient?: number[];
  /** Milliseconds to make each pipeline, by entry, in the order they are made. */
  readonly pipelineMs?: Readonly<Record<string, number>>;
  /**
   * Milliseconds of each entry's first call, untimed in its measure. WebGL2 builds an entry's pass
   * program at its first dispatch, so there the build is in this time.
   */
  readonly firstCallMs?: Readonly<Record<string, number>>;
  /** The descent of 3 parameters on the tier: the loss before each step and after the last, and the parameters it ends at. */
  readonly descent?: { readonly losses: number[]; readonly final: number[] };
  readonly refused?: string;
  readonly unfinished?: string;
}

export interface PageResult {
  readonly tier: string;
  readonly renderer?: string;
  readonly userAgent: string;
  readonly counts: PageCount[];
}

class Timeout extends Error {}

/** `p`, or a rejection once `ms` milliseconds pass without it. */
function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, fail) => {
    timer = setTimeout(() => fail(new Timeout(`${what} did not return within ${String(ms / 1000)} s`)), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/** Runs one parameter count's measures on the tier, each with its own pipeline. */
async function runCount(o: PageOptions, count: number): Promise<PageCount & { renderer?: string; stuck?: string }> {
  const pack = (await (await fetch(`./program-${count}.json`)).json()) as Pack;
  const rt = await createRuntime({ prefer: [o.tier], programs: [pack] });
  const result: { -readonly [K in keyof PageCount]?: PageCount[K] } = { count };
  const failures: string[] = [];
  let stuck: string | undefined;
  try {
    if (rt.tier !== o.tier) return { count, refused: `the runtime made ${rt.tier}, not ${o.tier}` };
    const gl = rt.device as WebGL2RenderingContext;
    const info = (rt.device as { adapterInfo?: { description?: string; vendor?: string; architecture?: string } }).adapterInfo;
    const unmasked = (): string => {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext !== null ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    };
    const renderer =
      rt.tier === 'webgl2'
        ? unmasked()
        : [info?.vendor, info?.architecture, info?.description].filter((x) => x !== undefined && x !== '').join(', ') || 'WebGPU adapter';
    const program = rt.load(pack);
    const limit = o.timeoutMs;
    const pipelineMs: Record<string, number> = {};
    result.pipelineMs = pipelineMs;
    const firstCallMs: Record<string, number> = {};
    result.firstCallMs = firstCallMs;
    const target = Float32Array.from(o.targets[String(count)]!);
    const out = resident(new Float32Array(Math.max(FRAMES, count)));
    const reached = (entry: string): readonly string[] =>
      pack.entries.find((e) => e.name === entry)?.bindings?.map((b) => b.name) ?? [];
    type Pipe = Awaited<ReturnType<typeof program.compute>>;
    const pipes = new Map<string, Pipe>();
    const pipeline = async (entry: string): Promise<Pipe> => {
      const had = pipes.get(entry);
      if (had !== undefined) return had;
      const t = performance.now();
      const made = await within(program.compute(entry), limit, `the pipeline of ${entry}`);
      pipelineMs[entry] = performance.now() - t;
      console.log(`${o.tier} ${count}: the pipeline of ${entry} took ${pipelineMs[entry]!.toFixed(0)} ms`);
      pipes.set(entry, made);
      return made;
    };
    const call = async (entry: string, theta: readonly number[], workgroups: number): Promise<Float32Array> => {
      const pipe = await pipeline(entry);
      const first = !(entry in firstCallMs);
      const t = performance.now();
      const available: Record<string, unknown> = { theta: Float32Array.from(theta), target, out };
      const bindings: Record<string, unknown> = {};
      for (const name of reached(entry)) bindings[name] = available[name];
      const frame = rt.frame();
      frame.dispatch(pipe as never, bindings as never, workgroups);
      await within(frame.submit(), limit, entry);
      const read = (await within(out.read(), limit, `the read-back of ${entry}`)) as Float32Array;
      if (first) firstCallMs[entry] = performance.now() - t;
      return read;
    };
    /** Runs `measure`, and keeps what stopped it: a call that did not return stops the tier. */
    const step = async (what: string, measure: () => Promise<void>): Promise<void> => {
      if (stuck !== undefined) return;
      try {
        await measure();
      } catch (e) {
        if (e instanceof Timeout) stuck = `${count} parameters, ${what}: ${e.message}`;
        failures.push(`${what}: ${String(e)}`);
        console.log(`${o.tier} ${count} ${what}: ${String(e)}`);
      }
    };
    const truth = truthOf(count);
    const start = startOf(count);
    const lanes = Math.ceil(count / FORWARD_LANES);
    await step('render', async () => {
      result.renderOutput = [...(await call(ENTRY.render, truth, 1))].slice(0, FRAMES);
      result.render = await timedAsync(o.repeats, async () => {
        await call(ENTRY.render, truth, 1);
      });
    });
    await step('frames', async () => {
      const groups = FRAMES / FORWARD_LANES;
      result.framesOutput = [...(await call(ENTRY.frames, truth, groups))].slice(0, FRAMES);
      result.frames = await timedAsync(o.repeats, async () => {
        await call(ENTRY.frames, truth, groups);
      });
    });
    await step('loss', async () => {
      result.lossAtStart = (await call(ENTRY.loss, start, 1))[0]!;
      result.loss = await timedAsync(o.repeats, async () => {
        await call(ENTRY.loss, start, 1);
      });
    });
    await step('forward', async () => {
      result.forwardGradient = [...(await call(ENTRY.forward, start, lanes))].slice(0, count);
      const params = [...start];
      const adam = new Adam(count);
      result.forward = await timedAsync(o.repeats, async () => {
        const g = await call(ENTRY.forward, params, lanes);
        adam.step(params, [...g.subarray(0, count)]);
      });
    });
    await step('reverse', async () => {
      result.reverseGradient = [...(await call(ENTRY.reverse, start, 1))].slice(0, count);
      const params = [...start];
      const adam = new Adam(count);
      result.reverse = await timedAsync(o.repeats, async () => {
        const g = await call(ENTRY.reverse, params, 1);
        adam.step(params, [...g.subarray(0, count)]);
      });
    });
    if (count === 3 && o.iterations > 0) {
      await step('descent', async () => {
        const params = [...start];
        const adam = new Adam(count);
        const losses: number[] = [];
        for (let i = 0; i < o.iterations; i++) {
          losses.push((await call(ENTRY.loss, params, 1))[0]!);
          const g = await call(ENTRY.forward, params, lanes);
          adam.step(params, [...g.subarray(0, count)]);
        }
        losses.push((await call(ENTRY.loss, params, 1))[0]!);
        result.descent = { losses, final: params };
      });
    }
    if (stuck === undefined) out.destroy();
    if (failures.length > 0) result.refused = failures.join('; ');
    return { ...(result as PageCount), renderer, ...(stuck === undefined ? {} : { stuck, unfinished: stuck }) };
  } finally {
    // A call that did not return keeps the device busy; the runner closes the browser after the tier.
    if (stuck === undefined) rt.destroy();
  }
}

declare global {
  // eslint-disable-next-line no-var
  var runMatch: (options: PageOptions) => Promise<PageResult>;
}

globalThis.runMatch = async (o) => {
  const counts: PageCount[] = [];
  let renderer: string | undefined;
  let stuck: string | undefined;
  for (const count of o.counts) {
    if (stuck !== undefined) {
      counts.push({ count, unfinished: `not run: ${stuck}` });
      continue;
    }
    try {
      const r = await runCount(o, count);
      renderer ??= r.renderer;
      const { renderer: _, stuck: stopped, ...rest } = r;
      if (stopped !== undefined) stuck = stopped;
      counts.push(rest);
      console.log(`${o.tier} ${count}: done`);
    } catch (e) {
      counts.push({ count, refused: String(e) });
      console.log(`${o.tier} ${count}: ${String(e)}`);
    }
  }
  return { tier: o.tier, ...(renderer === undefined ? {} : { renderer }), userAgent: navigator.userAgent, counts };
};
