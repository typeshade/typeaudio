// The CPU time of the threads of this process and of the processes it started (a browser), read
// from Linux's `/proc`: the time each thread spent on a CPU, the first field of
// `/proc/<pid>/task/<tid>/schedstat`, in nanoseconds. On a shared machine the wall time of a piece
// of work holds the time its thread waited for a CPU, and the thread's own CPU time does not.
// Experiment 2 reads it while an offline render is suspended. Elsewhere than on Linux a snapshot is
// empty.

import { readdirSync, readFileSync } from 'node:fs';

/** The CPU time of each thread, by `<pid>/<tid>`, with the thread's name. */
export type Snapshot = Map<string, { readonly name: string; readonly ns: number }>;

const read = (path: string): string | undefined => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

/** The processes descended from `root`, `root` included. */
function descendants(root: number): number[] {
  const parent = new Map<number, number>();
  for (const entry of safeList('/proc')) {
    const pid = Number(entry);
    if (!Number.isInteger(pid)) continue;
    const stat = read(`/proc/${pid}/stat`);
    // The fields after the name, which is in parentheses and may hold spaces.
    const rest = stat?.slice(stat.lastIndexOf(')') + 2).split(' ');
    if (rest !== undefined) parent.set(pid, Number(rest[1]));
  }
  const out = [root];
  for (let i = 0; i < out.length; i++) {
    for (const [pid, ppid] of parent) if (ppid === out[i]) out.push(pid);
  }
  return out;
}

function safeList(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** Every thread of the processes descended from `root` (this process by default). */
export function snapshot(root = process.pid): Snapshot {
  const out: Snapshot = new Map();
  for (const pid of descendants(root)) {
    for (const tid of safeList(`/proc/${pid}/task`)) {
      const ns = Number(read(`/proc/${pid}/task/${tid}/schedstat`)?.split(' ')[0]);
      if (!Number.isFinite(ns)) continue;
      out.set(`${pid}/${tid}`, { name: read(`/proc/${pid}/task/${tid}/comm`)?.trim() ?? '?', ns });
    }
  }
  return out;
}

/**
 * The thread that spent the most CPU time between `a` and `b`, among those whose name matches
 * `prefer` where one does, and the sum over every thread. A thread that began between the two
 * counts all of its time.
 */
export function busiest(
  a: Snapshot,
  b: Snapshot,
  prefer?: RegExp,
): { name: string; ms: number; allMs: number } | undefined {
  let best: { name: string; ms: number } | undefined;
  let bestPreferred: { name: string; ms: number } | undefined;
  let all = 0;
  for (const [key, after] of b) {
    const ms = (after.ns - (a.get(key)?.ns ?? 0)) / 1e6;
    all += ms;
    if (best === undefined || ms > best.ms) best = { name: after.name, ms };
    const preferred = prefer?.test(after.name) === true;
    if (preferred && (bestPreferred === undefined || ms > bestPreferred.ms)) {
      bestPreferred = { name: after.name, ms };
    }
  }
  const chosen = bestPreferred ?? best;
  return chosen === undefined ? undefined : { ...chosen, allMs: all };
}
