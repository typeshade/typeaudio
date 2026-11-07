import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';

/** Check delivery decoding and seeking. This does not constitute listening or physical-phone testing. */
const root = resolve(process.argv[2]);
const links = JSON.parse(await readFile(join(root, 'temporary-listening-links.json'), 'utf8')) as Record<string, string>;
const browser = await chromium.launch({ executablePath: process.env.TYPESHADE_CHROMIUM ?? '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const results = [];
try {
  for (const [name, url] of Object.entries(links).filter(([name]) => name.endsWith('.m4a'))) {
    const page = await browser.newPage();
    const result = await page.evaluate(async (url) => {
      const audio = new Audio();
      const waitFor = (event: string) => new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for ' + event)), 15000);
        audio.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
        audio.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Media error ' + audio.error?.code)); }, { once: true });
      });
      const loaded = waitFor('loadeddata');
      audio.preload = 'auto'; audio.src = url;
      await loaded;
      const duration = audio.duration;
      const sought = waitFor('seeked');
      audio.currentTime = duration * .55;
      await sought;
      await audio.play();
      const start = audio.currentTime;
      await new Promise(resolve => setTimeout(resolve, 350));
      const advanced = audio.currentTime - start;
      const error = audio.error?.code ?? null;
      audio.pause(); audio.removeAttribute('src'); audio.load();
      if (!Number.isFinite(duration) || duration < 10 || advanced < .1 || error) throw new Error('Playback failed');
      return { durationSeconds: duration, seekPositionSeconds: start, advancedSeconds: advanced, error };
    }, url);
    results.push({ name, ...result });
    await page.close();
    console.log('Playback and seek passed:', name);
  }
  await writeFile(join(root, 'browser-playback-check.json'), JSON.stringify({
    date: new Date().toISOString(), browser: browser.version(), results, passed: results.length === 6,
    listeningReviewed: false, physicalMobileDeviceTested: false, youtubeSyncTested: false,
  }, null, 2) + '\n');
} finally {
  await browser.close();
}
