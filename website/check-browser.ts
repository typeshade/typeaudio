import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { SOFTWARE_GPU_FLAGS } from '../scripts/browser.ts';
import { mkdir } from 'node:fs/promises';
const server = await preview({ configFile: 'website/vite.config.ts', preview: { host: '127.0.0.1', port: 4178, strictPort: true } });
const browser = await chromium.launch({ executablePath: process.env['TYPESHADE_CHROMIUM'] || '/usr/bin/chromium', args: [...SOFTWARE_GPU_FLAGS, '--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4178/');
  await page.locator('#render').click();
  await page.waitForFunction(() => document.querySelector('#status')!.textContent!.includes('Render complete'), undefined, { timeout: 90000 });
  assert.equal(await page.locator('#metric-backend').textContent(), 'CPU');
  assert.ok(Number(await page.locator('#metric-peak').textContent()) > 0.01);
  assert.match(await page.locator('#report').textContent() ?? '', /CPU tier/);
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#status')!.textContent!.includes('Playback finished'));
  const downloading = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloading;
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(path!);
  assert.equal(bytes.toString('ascii',0,4), 'RIFF');
  assert.equal(bytes.length, 44 + 48000 * 2);
  console.log('PASS CPU synthesis, playback lifecycle, waveform state, and WAV download');
  await page.selectOption('#backend', 'webgpu');
  await page.selectOption('#duration', '0.5');
  await page.locator('#render').click();
  await page.waitForFunction(() => document.querySelector('#status')!.textContent!.includes('Render complete') || document.querySelector('#status')!.classList.contains('error'), undefined, { timeout: 90000 });
  assert.equal(await page.locator('#metric-backend').textContent(), 'WebGPU', await page.locator('#status').textContent() ?? '');
  assert.match(await page.locator('#report').textContent() ?? '', /WebGPU/);
  console.log('PASS actual WebGPU synthesis on Chromium SwiftShader');
  await page.locator('#render').click();
  await page.locator('#stop').click();
  assert.match(await page.locator('#status').textContent() ?? '', /cancelled/);
  assert.equal(await page.locator('#play').isDisabled(), true);
  console.log('PASS render cancellation');
  await page.selectOption('#backend', 'cpu');
  await page.selectOption('#preset', 'bass');
  await page.locator('#render').click();
  await page.waitForFunction(() => document.querySelector('#status')!.textContent!.includes('Render complete'), undefined, { timeout: 90000 });
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/website-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'artifacts/website-mobile.png', fullPage: true });
  for (const name of ['vision','architecture','experiments','compiler-asks']) {
    const response = await page.goto(`http://127.0.0.1:4178/docs/${name}/`);
    assert.equal(response?.status(), 200); assert.equal(await page.locator('h1').count(), 1);
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS responsive layout, presets, documentation routes, and no browser exceptions');
  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await unsupported.goto('http://127.0.0.1:4178/');
  await unsupported.selectOption('#backend','webgpu');
  await unsupported.locator('#render').click();
  assert.match(await unsupported.locator('#status').textContent() ?? '', /unavailable/);
  assert.equal(await unsupported.locator('#play').isDisabled(), true);
  console.log('PASS unsupported WebGPU error, without silent fallback');
  // A distinct entry URL must not create a second runtime through a chunk's back-import.
  const versioned = await browser.newPage();
  await versioned.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        const entry = new URL(String(url), location.href);
        entry.searchParams.set('entry', 'regression');
        super(entry, options);
      }
    };
  });
  await versioned.goto('http://127.0.0.1:4178/');
  await versioned.selectOption('#duration', '0.5');
  for (const backend of ['cpu', 'webgpu']) {
    await versioned.selectOption('#backend', backend);
    await versioned.locator('#render').click();
    await versioned.waitForFunction(() => {
      const status = document.querySelector('#status')!;
      return status.textContent!.includes('Render complete') || status.classList.contains('error');
    });
    assert.equal(await versioned.locator('#metric-backend').textContent(), backend === 'cpu' ? 'CPU' : 'WebGPU',
      await versioned.locator('#status').textContent() ?? '');
    assert.ok(Number(await versioned.locator('#metric-peak').textContent()) > 0.01);
  }
  console.log('PASS CPU and WebGPU with a query-bearing worker entry URL');

} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
