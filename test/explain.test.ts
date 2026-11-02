import { expect, test } from 'vitest';
import type { FuseReport } from 'typeshade/runtime';
import { explain } from '../src/explain.ts';

// `explain` over reports of the shape a WebGPU plan gives (compiler surface §71): a group of one
// call, a fused group with the `why` of its standing apart, and the GPU time where it was measured.

const webgpu = (gpu: boolean): FuseReport => ({
  tier: 'webgpu',
  dispatches: 2,
  submissions: 1,
  groups: [
    { calls: ['synth'], fused: false, workgroupShapes: [[64, 1, 1]], ...(gpu ? { gpuTime: 210_000 } : {}) },
    {
      calls: ['mixdown', 'drive', 'gain', 'peak'],
      fused: true,
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

test('explain on WebGL2 counts draws and claims no tier the report does not give', () => {
  const webgl2: FuseReport = {
    tier: 'webgl2',
    dispatches: 3,
    submissions: 0,
    groups: [
      { calls: ['synth'], fused: false },
      { calls: ['mixdown'], fused: false, why: 'WebGL2 runs the calls apart' },
    ],
  };
  expect(explain([webgl2])).toBe(
    [
      '1 block on WebGL2, each block one fuse plan',
      'the last block: 3 draws, 0 submissions',
      '  1. synth: on WebGL2 or the CPU tier',
      '  2. mixdown: on WebGL2 or the CPU tier',
      '     WebGL2 runs the calls apart',
      'all blocks: 3 draws, 0 submissions',
    ].join('\n'),
  );
});

test('explain of no report says what to do', () => {
  expect(explain([])).toBe('Nothing has run yet: render a plan, then explain its reports.');
});
