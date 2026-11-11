// The parts of a mix (`src/study/build.ts`, `src/study/part-keys.ts`): the keys follow the code a
// part reaches and nothing else, a part that reads the code around it is refused, and a mix built
// from its parts, on workers or from the cache, has the layers and the samples of the plain code.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { build, renderMaster } from '../src/study/build.ts';
import type { Mix } from '../src/study/mix.ts';
import { sceneKeys } from '../src/study/part-keys.ts';

const STUDY = resolve(__dirname, '../src/study');
const dir = mkdtempSync(join(tmpdir(), 'study-build-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let serial = 0;
/** Writes a scene module and returns its path. `body` is the code of `scene()` after the mix. */
function sceneFile(top: string, body: string): string {
  const path = join(dir, `scene${serial++}.ts`);
  writeFileSync(
    path,
    `import { Mix } from '${STUDY}/mix.ts';
import { white, lp, nsamp } from '${STUDY}/dsp.ts';
${top}
export function scene(): Mix {
  const m = new Mix('t', 0.0, 0.6, 0.3);
${body}
  return m;
}
`,
  );
  return path;
}

const TOP = `
const A = 0.5;
const B = [0.1, 0.2];
function tone(seed: number): Float64Array { return lp(white(nsamp(0.2), seed), 900).map((v) => v * A); }
function carve(m: Mix, name: string, l: import('${STUDY}/mix.ts').Layer): void {
  if (name.startsWith('b')) for (const ch of l.dry) for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * 0.5;
}
function level(m: Mix): void {
  const l = m.layers.get('a0')!;
  for (const ch of l.wet) for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * 0.9;
}`;
const BODY = `
  m.part('a', () => {
    m.add('a0', tone(1), 0.0, [1.0, 1.6, -3.0], { target: -20, sendDb: -6 });
    m.add('a1', tone(2), 0.1, [-1.0, 1.6, -3.0], { target: -22 });
  });
  m.add('loose', white(nsamp(0.1), 9).map((v) => v * 0.01), 0.2, [0.0, 1.6, -2.0], { sendDb: null });
  m.part('b', () => {
    m.add('b0', tone(3).map((v) => v * B[0]!), 0.3, [0.0, 2.0, -5.0], { target: -24, sendDb: -3 });
  });
  m.finish(level);
  m.part('c', () => {
    m.addWide('c0', [tone(4), tone(5)], 0.05, { target: -26 });
  });
  m.eachLayer('carve', carve);`;

const layersOf = (m: Mix) =>
  m.order.map((n) => {
    const l = m.layers.get(n)!;
    return [n, l.start, l.gainDb, [...l.dry[0]], [...l.dry[1]], [...l.wet[0]], [...l.wet[1]]];
  });

describe('part keys', () => {
  it('change with the code a part reaches, and only with it', () => {
    const k0 = sceneKeys(sceneFile(TOP, BODY)).parts;
    const k1 = sceneKeys(sceneFile(TOP.replace('const B = [0.1, 0.2]', 'const B = [0.1, 0.3]'), BODY)).parts;
    const k2 = sceneKeys(sceneFile(TOP, BODY.replace('target: -26', 'target: -27'))).parts;
    const k3 = sceneKeys(sceneFile(TOP.replace('v * A', 'v * A * 1.0'), BODY)).parts;
    expect([...k0.keys()]).toEqual(['a', 'b', 'c']);
    // B is read by part b only
    expect([k1.get('a'), k1.get('b') !== k0.get('b'), k1.get('c')]).toEqual([k0.get('a'), true, k0.get('c')]);
    // a change inside part c
    expect([k2.get('a'), k2.get('b'), k2.get('c') !== k0.get('c')]).toEqual([k0.get('a'), k0.get('b'), true]);
    // tone() is reached by every part, through A as well
    for (const p of ['a', 'b', 'c']) expect(k3.get(p)).not.toBe(k0.get(p));
  });

  it('refuse a part that reads the code around it, changes the module or reads the layers', () => {
    const local = sceneFile(TOP, `  const g = 2;\n  m.part('a', () => m.add('a0', tone(1).map((v) => v * g), 0, [0, 1, -2]));`);
    expect(() => sceneKeys(local)).toThrow(/part 'a' reads 'g' from the code around it/);
    const mutate = sceneFile(TOP, `  m.part('a', () => { B.push(1); m.add('a0', tone(1), 0, [0, 1, -2]); });`);
    expect(() => sceneKeys(mutate)).toThrow(/part 'a' changes the module's 'B'/);
    const layers = sceneFile(TOP, `  m.part('a', () => { m.layers.get('x'); });`);
    expect(() => sceneKeys(layers)).toThrow(/part 'a' uses m.layers/);
    const dynamic = sceneFile(TOP, `  const n = 'a';\n  m.part(n, () => {});`);
    expect(() => sceneKeys(dynamic)).toThrow(/must be a string literal/);
  });
});

describe('a mix built from its parts', () => {
  it('has the layers and the samples of the plain code, on workers and from the cache', async () => {
    const path = sceneFile(TOP, BODY);
    const plain = ((await import(path)) as { scene: () => Mix }).scene();
    const yPlain = plain.render();
    const cache = join(dir, 'cache');
    const here = await build(path, { workers: 0, cacheDir: null });
    const onWorkers = await build(path, { workers: 2, cacheDir: cache });
    const fromCache = await build(path, { workers: 2, cacheDir: cache });
    expect(onWorkers.report.made).toBe(3);
    expect(fromCache.report.loaded).toBe(3);
    for (const b of [here, onWorkers, fromCache]) {
      expect(b.mix.order).toEqual(['a0', 'a1', 'loose', 'b0', 'c0']);
      expect(layersOf(b.mix)).toEqual(layersOf(plain));
    }
    const { y } = await renderMaster(fromCache.mix);
    expect([...y[0]]).toEqual([...yPlain[0]]);
    expect([...y[1]]).toEqual([...yPlain[1]]);
  }, 60_000);
});
