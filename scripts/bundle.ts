// Builds a host entry with Vite and the compiler's plugin, as an application builds it (compiler
// surface §64): for Node (`target: 'node'`, every package bundled in, so Node runs it with no
// TypeScript to load), for a page (`target: 'web'`, an ES module beside an `index.html`) or for an
// AudioWorklet (`target: 'worklet'`, one ES module with every dynamic `import()` inlined, which
// `audioWorklet.addModule` loads: the scope refuses `import()`).

import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { typeshade } from 'typeshade/vite';

/** The repository root. */
export const ROOT = resolve(import.meta.dirname, '..');

export interface Bundle {
  /** The entry, relative to the repository root. */
  readonly entry: string;
  /** The output directory, relative to the repository root. It is emptied first. */
  readonly outDir: string;
  readonly target: 'node' | 'web' | 'worklet';
  /**
   * `worklet`: leave each dynamic `import()` as a chunk of its own, as a page's build does,
   * instead of inlining it into the module. Experiment 2 loads both builds.
   */
  readonly split?: boolean;
}

/** Builds `bundle` and resolves to the absolute path of the module to run or to load. */
export async function bundle({ entry, outDir, target, split = false }: Bundle): Promise<string> {
  const out = join(ROOT, outDir);
  if (target === 'worklet') {
    await build({
      configFile: false,
      root: ROOT,
      logLevel: 'warn',
      plugins: [typeshade()],
      build: {
        outDir: out,
        emptyOutDir: true,
        lib: { entry, formats: ['es'], fileName: 'processor' },
        rollupOptions: { output: { inlineDynamicImports: !split } },
      },
    });
    return join(out, 'processor.js');
  }
  if (target === 'node') {
    await build({
      configFile: false,
      root: ROOT,
      logLevel: 'warn',
      plugins: [typeshade()],
      ssr: { noExternal: true },
      build: {
        ssr: entry,
        outDir: out,
        emptyOutDir: true,
        target: 'node22',
        rollupOptions: { output: { entryFileNames: 'main.mjs' } },
      },
    });
    return join(out, 'main.mjs');
  }
  await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    plugins: [typeshade()],
    build: {
      outDir: out,
      emptyOutDir: true,
      lib: { entry, formats: ['es'], fileName: 'main' },
    },
  });
  await writeFile(
    join(out, 'index.html'),
    '<!doctype html>\n<meta charset="utf-8">\n<title>typeaudio</title>\n<script type="module" src="./main.js"></script>\n',
  );
  return join(out, 'index.html');
}
