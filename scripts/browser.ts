// Headless Chromium with WebGPU on SwiftShader, as the compiler's gates launch it
// (`scripts/gate-browser.ts` there): the same flags, and `TYPESHADE_CHROMIUM` to name the binary.
// A page loads a directory served over http from 127.0.0.1, a secure context, which WebGPU needs.
// The page is cross-origin isolated (COOP and COEP), which gives `performance.now()` its fine
// resolution: Chromium coarsens it to 100 microseconds otherwise.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright-core';

/** The flags that give a headless Chromium WebGPU and WebGL2 on SwiftShader. */
export const SOFTWARE_GPU_FLAGS = [
  '--enable-unsafe-webgpu',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--use-vulkan=swiftshader',
  '--enable-features=Vulkan',
];

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
};

/**
 * Serves `dir` on 127.0.0.1, opens its `index.html` in headless Chromium and resolves to what
 * `run` resolves to. The page's console lines go to `log`. The browser and the server are closed
 * on every path out, a failure included.
 */
export async function inPage<T>(
  dir: string,
  run: (page: Page) => Promise<T>,
  log: (line: string) => void = (line) => console.error(line),
): Promise<T> {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent((request.url ?? '/').split('?')[0]!));
    const file = join(dir, path === '/' ? 'index.html' : path);
    if (!file.startsWith(dir)) {
      response.writeHead(403).end();
      return;
    }
    readFile(file).then(
      (body) => {
        response.writeHead(200, {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-embedder-policy': 'require-corp',
        });
        response.end(body);
      },
      () => response.writeHead(404).end(),
    );
  });
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const browser = await chromium.launch({
    executablePath: process.env['TYPESHADE_CHROMIUM'] || undefined,
    args: SOFTWARE_GPU_FLAGS,
  });
  try {
    const page = await browser.newPage();
    page.on('console', (message) => log(message.text()));
    page.on('pageerror', (error) => log(`page error: ${error.message}`));
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForFunction(() => document.readyState === 'complete');
    return await run(page);
  } finally {
    await browser.close();
    await new Promise<void>((closed) => server.close(() => closed()));
  }
}
