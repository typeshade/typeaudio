// The engine's sources stand alone: no module of `src/` imports from `experiments/`, `test/` or
// `scripts/`. (Two compiler adapters read `node_modules/typeshade`, which the site links too; ask F.) The site in typeshade/web links only `src/` (through `sources/typeaudio`), and an
// import that leaves `src/` breaks its build (web pin run 42921558957, 2026-11-10).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.ts$/.test(name) && !name.endsWith('.typeshade.ts') ? [path] : [];
  });
}

describe('the engine boundary', () => {
  it('no module of src/ imports from experiments/, test/ or scripts/', () => {
    const leaving: string[] = [];
    for (const file of files(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/(?:import|export)[^'"]*from\s*['"](\.[^'"]+)['"]/g)) {
        const target = resolve(join(file, '..'), m[1]!);
        const outside = ['experiments', 'test', 'scripts'].map((d) => join(ROOT, d));
        if (outside.some((d) => target.startsWith(d)))
          leaving.push(`${relative(ROOT, file)} -> ${m[1]}`);
      }
    }
    expect(leaving).toEqual([]);
  });
});
