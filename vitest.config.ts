import { defineConfig } from 'vitest/config';
import { typeshade } from 'typeshade/vite';

// The plugin compiles each `.shade.ts` a test imports into the module a host gets (compiler
// surface §64): the CPU tier of its functions and classes, its kernel functions, and the facts a
// `fuse` scope plans by. The tests run on the CPU tier, with no device.
export default defineConfig({
  plugins: [typeshade()],
  test: { include: ['test/**/*.test.ts', 'website/*.test.ts'] },
});
