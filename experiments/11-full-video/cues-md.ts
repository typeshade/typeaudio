// Writes `cues.md`, the readable form of the cue sheet `cues.json`, and the list of what to hear first.
//
//   bun experiments/11-full-video/cues-md.ts [--check]
//
// `--check` fails when `cues.md` does not match `cues.json`.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSheet, type Sheet } from './draft.ts';
import { RECIPES } from './recipes.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

const time = (t: number): string => {
  const m = Math.floor(t / 60);
  const s = t - 60 * m;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

const cell = (s: string): string => s.replaceAll('|', '\\|');

export function cuesMarkdown(sheet: Sheet): string {
  const lines: string[] = [];
  const events = sheet.cues.filter((c) => !c.bed);
  const beds = sheet.cues.filter((c) => c.bed);
  const used = new Set(sheet.cues.map((c) => c.recipe ?? (c.store ? `store:${c.store.name}` : '')));
  lines.push('<!-- Generated from cues.json by cues-md.ts. Do not edit by hand. -->', '');
  lines.push('# Experiment 11: the cue sheet of the whole video', '');
  lines.push(sheet.note, '');
  lines.push(
    `The video lasts ${sheet.video.duration.toFixed(1)} s. It has ${sheet.scenes.length} scenes, ` +
      `${events.length} sound events and ${beds.length} ambience beds. The engine renders it in ` +
      `${sheet.segments.length} segments. The accepted force passage holds ${time(sheet.accepted.from)} ` +
      `to ${time(sheet.accepted.to)} (\`${sheet.accepted.module}\`, variant \`${sheet.accepted.variant}\`). ` +
      `After ${time(sheet.end)} the reference has no audio, and the draft is silent too.`,
    '',
  );
  lines.push('## The recipes', '');
  lines.push('| Recipe | What it makes |', '| --- | --- |');
  for (const [name, what] of Object.entries(RECIPES))
    if (used.has(name)) lines.push(`| \`${name}\` | ${what} |`);
  lines.push(
    '| `store:stone-landing` | the accepted stone landing of experiment 10, moved by a pitch node |',
    '| `store:break` | the accepted break of experiment 10 |',
    '',
  );
  lines.push('## What to hear first', '');
  lines.push(
    'One moment for each part of the video, the A cues where the draft carries the scene:',
    '',
  );
  for (const scene of sheet.scenes) {
    const first = events.find((c) => c.scene === scene.id && c.priority === 'A' && !c.accepted);
    if (first) lines.push(`- ${time(first.t)} (${scene.id}): ${first.what}`);
  }
  lines.push('');
  lines.push('## The scenes', '');
  for (const scene of sheet.scenes) {
    lines.push(`### ${scene.id}, ${time(scene.from)} to ${time(scene.to)}`, '');
    lines.push(`${scene.picture}. Space: ${scene.space}.`, '');
    if (scene.dialogue) lines.push(`- Dialogue (not designed): ${scene.dialogue}`);
    if (scene.music) lines.push(`- Music (not designed): ${scene.music}`);
    const own = sheet.cues.filter((c) => c.scene === scene.id);
    for (const bed of own.filter((c) => c.bed))
      lines.push(`- Ambience bed: ${bed.what} (\`${bed.recipe}\`, ${bed.level} dB)`);
    if (scene.dialogue || scene.music || own.some((c) => c.bed)) lines.push('');
    const cues = own.filter((c) => !c.bed);
    if (cues.length === 0) continue;
    lines.push(
      '| Time | Cue | What | Who | What is met | How | How much | Where | Why | Made by | dB | P |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const c of cues) {
      const by = c.accepted
        ? 'accepted passage'
        : c.store
          ? `store:${c.store.name}${c.store.pitch ? ` ×${c.store.pitch}` : ''}`
          : `\`${c.recipe}\``;
      const s = c.seven;
      lines.push(
        `| ${time(c.t)} | ${c.id} | ${cell(c.what)} | ${cell(s.who)} | ${cell(s.what)} | ${s.how} | ${s.howMuch} | ${s.where} | ${s.why} | ${by} | ${c.level} | ${c.priority} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

if (import.meta.main) {
  const text = cuesMarkdown(readSheet());
  const file = join(HERE, 'cues.md');
  if (process.argv.includes('--check')) {
    if (readFileSync(file, 'utf8') !== text) {
      console.error('cues.md does not match cues.json: run bun experiments/11-full-video/cues-md.ts');
      process.exit(1);
    }
  } else writeFileSync(file, text);
}
