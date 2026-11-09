// Headless Chromium with WebGPU on SwiftShader, as the compiler's gates launch it
// (`scripts/gate-browser.ts` there): the same flags, and `TYPESHADE_CHROMIUM` to name the binary.
// `TYPESHADE_GPU=device` opens a visible window on the machine's own GPU instead, with Chrome's
// default flags (the device mode of `docs/device-runs.md`); it needs a display.
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

/**
 * The options of `chromium.launch` for a mode. `TYPESHADE_GPU` unset or `swiftshader`: headless,
 * on SwiftShader. `TYPESHADE_GPU=device`: a window on the machine's own GPU, with no flag of the
 * software path. `TYPESHADE_CHROMIUM` names the binary in both modes.
 */
export function launchOptions(
  env: Record<string, string | undefined>,
  args: readonly string[],
): { executablePath: string | undefined; headless: boolean; args: string[] } {
  const mode = env['TYPESHADE_GPU'];
  const executablePath = env['TYPESHADE_CHROMIUM'] || undefined;
  if (mode === undefined || mode === 'swiftshader') {
    return { executablePath, headless: true, args: [...SOFTWARE_GPU_FLAGS, ...args] };
  }
  if (mode === 'device') {
    return { executablePath, headless: false, args: [...args] };
  }
  throw new Error(`TYPESHADE_GPU must be "swiftshader" (the default) or "device", not "${mode}".`);
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
};

/**
 * Serves `dir` on 127.0.0.1, opens its `index.html` in headless Chromium and resolves to what
 * `run` resolves to. The page's console lines go to `log`. `args` adds flags to the browser's
 * own. The browser and the server are closed on every path out, a failure included.
 */
export async function inPage<T>(
  dir: string,
  run: (page: Page) => Promise<T>,
  log: (line: string) => void = (line) => console.error(line),
  args: readonly string[] = [],
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
  const browser = await chromium.launch(launchOptions(process.env, args));
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
