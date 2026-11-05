import { defineConfig } from 'vite';
import { typeshade } from 'typeshade/vite';
export default defineConfig({
  root: 'website',
  plugins: [typeshade()],
  // Keep the resident registry and fuse executor in one worker module. A split chunk
  // can import the entry again under a different URL, creating a second runtime.
  worker: {
    format: 'es',
    plugins: () => [typeshade()],
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
