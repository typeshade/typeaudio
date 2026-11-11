// The owner's rule (2026-11-11): a sound earns its place, above all in animation; small stones that
// roll, trickle or scatter are cut. This audit reads the scenes' sources (experiments 12 and on)
// and fails when a model that makes small stones comes back:
//
// - `slabFall` without `scatter` 0 (its scatter is a tumble of 5 to 15 cm pieces);
// - `rockFall` (pieces of 0.8 to 3 cm after the impact);
// - `tumble` or `rubble` with pieces under 0.3 m (or with the default sizes);
// - a `stoneCrack` of a written size under 0.2 m (a chip that flies off);
// - `cloth` (its flutter is a run of clicks) or reversed grains (`.reverse()`): heard as pebbles
//   on 2026-11-11 (scene 1 at 7.2 s, scene 2 at 43.6 s).
//
// The study's red passage (`red.ts`) stays the study's; the layers of it that carry small stones
// must be left out by the scenes (`tail.ts`, and scene 2's `tidy` where it exists).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', 'experiments');
const scenes = readdirSync(root)
  .filter((d) => /^1[2-9]-/.test(d))
  .flatMap((d) =>
    readdirSync(join(root, d))
      .filter((f) => f.endsWith('.ts') && f !== 'red.ts')
      .map((f) => join(root, d, f)),
  );

/** The argument text of each call of `name(` in `src`, with the line of the call. */
function calls(src: string, name: string): { line: number; args: string }[] {
  const out: { line: number; args: string }[] = [];
  const re = new RegExp(`\\b${name}\\(`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (/function\s+$/.test(src.slice(Math.max(0, m.index - 10), m.index))) continue;
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      if ('([{'.includes(src[i]!)) depth++;
      else if (')]}'.includes(src[i]!)) depth--;
    }
    out.push({ line: src.slice(0, m.index).split('\n').length, args: src.slice(start, i - 1) });
  }
  return out;
}

/** The top-level arguments of an argument text. */
function split(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of args) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The smallest size of a `[a, b]` written in `text`, or undefined. */
function smallest(text: string | undefined): number | undefined {
  const m = text?.match(/\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/);
  return m ? Number(m[1]) : undefined;
}

describe('the owner rule on small stones', () => {
  it('finds the scenes', () => expect(scenes.length).toBeGreaterThan(2));

  const problems: string[] = [];
  for (const file of scenes) {
    const src = readFileSync(file, 'utf8');
    const at = (line: number) => `${file.slice(root.length + 1)}:${line}`;
    for (const c of calls(src, 'slabFall')) {
      const a = split(c.args);
      if (a.length < 4 || a[3] !== '0') problems.push(`${at(c.line)}: slabFall with its scatter`);
    }
    for (const c of calls(src, 'rockFall')) problems.push(`${at(c.line)}: rockFall`);
    for (const c of calls(src, 'tumble')) {
      const s = smallest(split(c.args)[3]);
      if (s === undefined || s < 0.3) problems.push(`${at(c.line)}: tumble of pieces under 0.3 m`);
    }
    for (const c of calls(src, 'rubble')) {
      const s = smallest(c.args.match(/sizes:\s*(\[[^\]]*\])/)?.[1]);
      if (s === undefined || s < 0.3) problems.push(`${at(c.line)}: rubble of pieces under 0.3 m`);
    }
    for (const c of calls(src, 'cloth'))
      problems.push(`${at(c.line)}: cloth (a flutter of clicks)`);
    for (const c of calls(src, 'reverse'))
      problems.push(`${at(c.line)}: reversed grains (clicks that crowd)`);
    for (const c of calls(src, 'stoneCrack')) {
      const size = Number(split(c.args)[1]);
      if (!Number.isNaN(size) && size < 0.2) problems.push(`${at(c.line)}: a chip (stoneCrack)`);
    }
  }

  it('no scene model makes small stones', () => expect(problems).toEqual([]));

  it("the scenes leave out the red passage's small stones", () => {
    const tail = readFileSync(join(root, '12-scene1-red-seal', 'tail.ts'), 'utf8');
    for (const name of [
      'rock-burst',
      'wall-debris0',
      'wall-debris1',
      'debris-rain0',
      'debris-rain1',
    ])
      expect(tail).toContain(`'${name}'`);
    expect(tail).toContain('`ray-debris${i}`');
    const scene2 = join(root, '13-scene2-stone-giant', 'scene2.ts');
    if (existsSync(scene2))
      expect(readFileSync(scene2, 'utf8')).toMatch(/drop\(m, \['settle0', 'settle1'/);
  });
});
