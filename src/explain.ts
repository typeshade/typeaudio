import { mergeReports, type FuseReport } from 'typeshade/runtime';

/** The words for a tier. */
const TIER = { webgpu: 'WebGPU', webgl2: 'WebGL2', cpu: 'the CPU tier' } as const;

/**
 * The fuse reports of a render, in words (docs/vision.md, section 2, moment 5). It says how the
 * last block ran, group by group: whether each group fused into one dispatch, why a group stood
 * apart from the one before it (the compiler's `why`, in the author's names), its dispatches and
 * the GPU time the device measured, where it measured one. Then it sums every block. Print it with
 * `console.log(explain(plan.reports))`.
 */
export function explain(reports: readonly FuseReport[]): string {
  const last = reports[reports.length - 1];
  if (last === undefined) return 'Nothing has run yet: render a plan, then explain its reports.';
  const all = mergeReports(reports);
  // On WebGL2 the report counts draws as its dispatches (compiler surface §71).
  const unit = all.tier === 'webgl2' ? 'draw' : 'dispatch';
  const lines = [
    `${count(reports.length, 'block')} on ${TIER[all.tier]}, each block one fuse plan`,
    `the last block: ${count(last.dispatches, unit)}, ${count(last.submissions, 'submission')}`,
  ];
  last.groups.forEach((group, i) => {
    const shapes = group.workgroupShapes;
    // A group that did not run on WebGPU has no workgroup shapes. The report does not say whether
    // it ran on WebGL2 or fell to the CPU tier, so the words do not either (docs/compiler-asks.md, P).
    const where =
      shapes !== undefined
        ? group.fused
          ? 'fused into one dispatch'
          : count(shapes.length, 'dispatch')
        : last.tier === 'cpu'
          ? 'on the CPU tier'
          : last.tier === 'webgl2'
            ? 'on WebGL2 or the CPU tier'
            : 'not on WebGPU: on WebGL2 or the CPU tier';
    const time = group.gpuTime === undefined ? '' : `, ${ms(group.gpuTime)} GPU`;
    lines.push(`  ${i + 1}. ${group.calls.join(' + ')}: ${where}${time}`);
    if (group.why !== undefined) lines.push(`     ${group.why}`);
  });
  const timed = all.groups.filter((g) => g.gpuTime !== undefined);
  const gpu = timed.length === 0 ? '' : `, ${ms(timed.reduce((s, g) => s + g.gpuTime!, 0))} GPU`;
  lines.push(
    `all blocks: ${count(all.dispatches, unit)}, ${count(all.submissions, 'submission')}${gpu}`,
  );
  if (all.tier === 'cpu') {
    lines.push(
      'The CPU tier runs the calls one after another and fuses none; it is the reference a fused group is held to.',
    );
  }
  return lines.join('\n');
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : noun.endsWith('h') ? 'es' : 's'}`;
}

function ms(nanoseconds: number): string {
  return `${(nanoseconds / 1e6).toFixed(3)} ms`;
}
