import { prepareRoom, prepareRoomSource, roomWalls } from '../../src/spatial/room/index.ts';
import type { RoomDefinition, RoomSourceTarget } from '../../src/spatial/room/index.ts';

export const listener = { position: { x: 0, y: 0, z: 0 } };
export const source = { position: { x: 0, y: 0, z: 0 }, airAbsorption: 0, rolloff: 0 };
export const definition: RoomDefinition = {
  min: { x: -2, y: -3, z: -4 }, max: { x: 2, y: 3, z: 4 }, earlyGain: 1, lateGain: 0,
  walls: Object.fromEntries(roomWalls.map(wall => [wall, { reflection: 0.5, damping: 0 }])),
};
export const room = prepareRoom(definition, 34300);
export const target = prepareRoomSource(room, listener, source);
/** Isolate one early path for independently calculable impulse tests. */
export function isolated(delayFrames: number, pole = 0): RoomSourceTarget {
  return { ...target, direct: { ...target.direct, left: 0, right: 0 },
    reflections: target.reflections.map((path, i) => ({ ...path, delayFrames, pole, left: i === 0 ? 1 : 0, right: 0 })),
    late: { delayFrames: 0, gain: 0 } };
}
