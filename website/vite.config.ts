import { defineConfig } from 'vite';
import { typeshade } from 'typeshade/vite';
export default defineConfig({
  root: 'website',
  plugins: [typeshade()],
  worker: { format: 'es', plugins: () => [typeshade()] },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
