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
  /** Milliseconds to make the five pipelines. */
  readonly pipelineMs?: number;
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

async function runCount(o: PageOptions, count: number): Promise<PageCount & { renderer?: string }> {
  const pack = (await (await fetch(`./program-${count}.json`)).json()) as Pack;
  const rt = await createRuntime({ prefer: [o.tier], programs: [pack] });
  try {
    if (rt.tier !== o.tier) return { count, refused: `the runtime made ${rt.tier}, not ${o.tier}` };
    const gl = rt.device as WebGL2RenderingContext;
    const info = (rt.device as { adapterInfo?: { description?: string; vendor?: string; architecture?: string } }).adapterInfo;
    const renderer =
      rt.tier === 'webgl2'
        ? String(gl.getParameter(gl.RENDERER))
        : [info?.vendor, info?.architecture, info?.description].filter((x) => x !== undefined && x !== '').join(', ') || 'WebGPU adapter';
    const program = rt.load(pack);
    let t = performance.now();
    const pipes = {
      render: await program.compute(ENTRY.render),
      frames: await program.compute(ENTRY.frames),
      loss: await program.compute(ENTRY.loss),
      forward: await program.compute(ENTRY.forward),
      reverse: await program.compute(ENTRY.reverse),
    };
    const pipelineMs = performance.now() - t;
    const target = Float32Array.from(o.targets[String(count)]!);
    const out = resident(new Float32Array(Math.max(FRAMES, count)));
    const reached = (entry: string): readonly string[] =>
      pack.entries.find((e) => e.name === entry)?.bindings?.map((b) => b.name) ?? [];
    const call = async (key: keyof typeof pipes, entry: string, theta: readonly number[], workgroups: number): Promise<Float32Array> => {
      const available: Record<string, unknown> = { theta: Float32Array.from(theta), target, out };
      const bindings: Record<string, unknown> = {};
      for (const name of reached(entry)) bindings[name] = available[name];
      const frame = rt.frame();
      frame.dispatch(pipes[key] as never, bindings as never, workgroups);
      await frame.submit();
      return (await out.read()) as Float32Array;
    };
    const truth = truthOf(count);
    const start = startOf(count);
    const lanes = Math.ceil(count / FORWARD_LANES);
    const result: { -readonly [K in keyof PageCount]?: PageCount[K] } = { count, pipelineMs };
    const limit = o.timeoutMs;
    result.renderOutput = [...(await within(call('render', ENTRY.render, truth, 1), limit, 'renderEntry'))].slice(0, FRAMES);
    result.render = await timedAsync(o.repeats, async () => {
      await within(call('render', ENTRY.render, truth, 1), limit, 'renderEntry');
    });
    const frameGroups = FRAMES / FORWARD_LANES;
    result.framesOutput = [...(await within(call('frames', ENTRY.frames, truth, frameGroups), limit, 'framesEntry'))].slice(0, FRAMES);
    result.frames = await timedAsync(o.repeats, async () => {
      await within(call('frames', ENTRY.frames, truth, frameGroups), limit, 'framesEntry');
    });
    result.lossAtStart = (await within(call('loss', ENTRY.loss, start, 1), limit, 'lossEntry'))[0]!;
    result.loss = await timedAsync(o.repeats, async () => {
      await within(call('loss', ENTRY.loss, start, 1), limit, 'lossEntry');
    });
    result.forwardGradient = [...(await within(call('forward', ENTRY.forward, start, lanes), limit, 'forwardStep'))].slice(0, count);
    {
      const params = [...start];
      const adam = new Adam(count);
      result.forward = await timedAsync(o.repeats, async () => {
        const g = await within(call('forward', ENTRY.forward, params, lanes), limit, 'forwardStep');
        adam.step(params, [...g.subarray(0, count)]);
      });
    }
    result.reverseGradient = [...(await within(call('reverse', ENTRY.reverse, start, 1), limit, 'reverseStep'))].slice(0, count);
    {
      const params = [...start];
      const adam = new Adam(count);
      result.reverse = await timedAsync(o.repeats, async () => {
        const g = await within(call('reverse', ENTRY.reverse, params, 1), limit, 'reverseStep');
        adam.step(params, [...g.subarray(0, count)]);
      });
    }
    if (count === 3 && o.iterations > 0) {
      const params = [...start];
      const adam = new Adam(count);
      const losses: number[] = [];
      for (let i = 0; i < o.iterations; i++) {
        losses.push((await within(call('loss', ENTRY.loss, params, 1), limit, 'lossEntry'))[0]!);
        const g = await within(call('forward', ENTRY.forward, params, lanes), limit, 'forwardStep');
        adam.step(params, [...g.subarray(0, count)]);
      }
      losses.push((await within(call('loss', ENTRY.loss, params, 1), limit, 'lossEntry'))[0]!);
      result.descent = { losses, final: params };
    }
    out.destroy();
    return { ...(result as PageCount), renderer };
  } finally {
    rt.destroy();
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
      const { renderer: _, ...rest } = r;
      counts.push(rest);
      console.log(`${o.tier} ${count}: done`);
    } catch (e) {
      if (e instanceof Timeout) {
        stuck = `${count} parameters: ${e.message}`;
        counts.push({ count, unfinished: e.message });
      } else counts.push({ count, refused: String(e) });
      console.log(`${o.tier} ${count}: ${String(e)}`);
    }
  }
  return { tier: o.tier, ...(renderer === undefined ? {} : { renderer }), userAgent: navigator.userAgent, counts };
};
