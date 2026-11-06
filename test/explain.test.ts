import { expect, test } from 'vitest';
import type { FuseReport } from 'typeshade/runtime';
import { explain } from '../src/explain.ts';

// `explain` over reports of the shape a plan gives (compiler surface §71): a group of one call, a
// fused group with the `why` of its standing apart, the GPU time where it was measured, and on
// WebGL2 the `tier` and the `why` of a group that fell to the CPU tier (compiler change 0118).

// New compiler candidates report dispatches per group; retain those facts while
// checking the fixture against both the pinned and candidate public report type.
type ReportFixture = Omit<FuseReport, 'groups'> & {
  groups: readonly (FuseReport['groups'][number] & { dispatches: number })[];
};
const webgpu = (gpu: boolean): ReportFixture => ({
  tier: 'webgpu',
  dispatches: 2,
  submissions: 1,
  groups: [
    {
      calls: ['synth'],
      fused: false,
      tier: 'webgpu',
      dispatches: 1,
      workgroupShapes: [[64, 1, 1]],
      ...(gpu ? { gpuTime: 210_000 } : {}),
    },
    {
      calls: ['mixdown', 'drive', 'gain', 'peak'],
      fused: true,
      tier: 'webgpu',
      dispatches: 1,
      why: 'synth and mixdown run as two dispatches because the trip counts differ (5 and 512)',
      workgroupShapes: [[256, 1, 1]],
      ...(gpu ? { gpuTime: 120_400 } : {}),
    },
  ],
});

test('explain names each group, whether it fused, its why and its GPU time', () => {
  expect(explain([webgpu(true), webgpu(true)])).toBe(
    [
      '2 blocks on WebGPU, each block one fuse plan',
      'the last block: 2 dispatches, 1 submission',
      '  1. synth: 1 dispatch, 0.210 ms GPU',
      '  2. mixdown + drive + gain + peak: fused into one dispatch, 0.120 ms GPU',
      '     synth and mixdown run as two dispatches because the trip counts differ (5 and 512)',
      'all blocks: 4 dispatches, 2 submissions, 0.661 ms GPU',
    ].join('\n'),
  );
});

test('explain leaves the GPU time out where the device measured none', () => {
  expect(explain([webgpu(false)]).split('\n')[2]).toBe('  1. synth: 1 dispatch');
});

test('explain on WebGL2 counts draws and names the tier of each group', () => {
  // The plan of the engine on WebGL2 with the CPU tier after it, as the report of the compiler at
  // the pin `87af4eb0` gave it in headless Chromium on SwiftShader: `synth` and `peak` have no WebGL2
  // program, so they ran on the CPU tier and their `why` says so. The plan's `tier` stays the best
  // tier of its groups.
  const webgl2: ReportFixture = {
    tier: 'webgl2',
    dispatches: 3,
    submissions: 0,
    groups: [
      {
        calls: ['synth'],
        fused: false,
        tier: 'cpu',
        dispatches: 0,
        why: 'synth runs on the CPU, it runs on the CPU, loop 1 writes more than one array, and WebGL2 draws one',
      },
      { calls: ['mixdown'], fused: false, tier: 'webgl2', dispatches: 1, why: 'WebGL2 runs the calls apart' },
      { calls: ['drive'], fused: false, tier: 'webgl2', dispatches: 1, why: 'WebGL2 runs the calls apart' },
      { calls: ['gain'], fused: false, tier: 'webgl2', dispatches: 1, why: 'WebGL2 runs the calls apart' },
      {
        calls: ['peak'],
        fused: false,
        tier: 'cpu',
        dispatches: 0,
        why: 'peak runs on the CPU, it runs on the CPU, loop 1 reduces, which WebGL2 has no workgroup memory for',
      },
    ],
  };
  expect(explain([webgl2])).toBe(
    [
      '1 block on WebGL2, each block one fuse plan',
      'the last block: 3 draws, 0 submissions',
      '  1. synth: on the CPU tier',
      '     synth runs on the CPU, it runs on the CPU, loop 1 writes more than one array, and WebGL2 draws one',
      '  2. mixdown: on WebGL2',
      '     WebGL2 runs the calls apart',
      '  3. drive: on WebGL2',
      '     WebGL2 runs the calls apart',
      '  4. gain: on WebGL2',
      '     WebGL2 runs the calls apart',
      '  5. peak: on the CPU tier',
      '     peak runs on the CPU, it runs on the CPU, loop 1 reduces, which WebGL2 has no workgroup memory for',
      'all blocks: 3 draws, 0 submissions',
    ].join('\n'),
  );
});

test('explain of no report says what to do', () => {
  expect(explain([])).toBe('Nothing has run yet: render a plan, then explain its reports.');
});
