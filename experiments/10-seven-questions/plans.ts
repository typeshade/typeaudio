// The plan of a store entry: shared by the store in Node (`store.ts`) and the page of the site.

import type { StoreEntry } from './store.ts';

/** The seconds and the lead of a group's render, as the store renders it. */
export const GROUP_SECONDS = 3;
export const GROUP_LEAD = 0.05;

/**
 * The plan that renders an entry. A whole plan is its own. A group takes the room and the master
 * of the passage (`passage-without-landings`), and starts at `lead` seconds.
 */
export function planOf(
  entry: StoreEntry,
  read: (name: string) => StoreEntry,
  seconds = GROUP_SECONDS,
  lead = GROUP_LEAD,
): unknown {
  if (entry.plan) return entry.plan;
  if (!entry.events) throw new Error(`the store entry "${entry.name}" has no events and no plan`);
  const passage = read('passage-without-landings').plan as Record<string, unknown>;
  return {
    ...passage,
    description: `The store entry "${entry.name}" alone.`,
    clip: { duration: seconds, fps: 23.976 },
    // The level of a group is set where it is used. A low target keeps the master's limiter out.
    master: { lufs: -40, truePeak: -1 },
    picture: { cuts: [], motion: [] },
    silences: [],
    events: entry.events.map((e) => ({ ...e, t: e.t + lead })),
  };
}
