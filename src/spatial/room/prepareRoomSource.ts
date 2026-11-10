import { prepareSpatialSource } from '../prepareSpatialSource.ts';
import { validateVector } from '../validateVector.ts';
import type { ListenerPose, SpatialSource, Vector3 } from '../types.ts';
import { prepareRoom } from './prepareRoom.ts';
import { roomWalls } from './roomWalls.ts';
import type { PreparedRoom, RoomSourceTarget } from './types.ts';

function requireInterior(position: Vector3, room: PreparedRoom, name: string): void {
  validateVector(position, name);
  for (const axis of ['x', 'y', 'z'] as const)
    if (position[axis] <= room.min[axis] || position[axis] >= room.max[axis])
      throw new RangeError(name + ' must be strictly inside the room.');
}

/** Six image sources. Delay measures excess travel at 343 m/s; direct onset stays immediate. */
export function prepareRoomSource(room: PreparedRoom, listener: ListenerPose, source: SpatialSource): RoomSourceTarget {
  const plan = prepareRoom(room, room.sampleRate);
  if (room.key !== plan.key) throw new RangeError('Room control data does not match its key.');
  requireInterior(listener?.position, plan, 'listener.position');
  requireInterior(source?.position, plan, 'source.position');
  const direct = prepareSpatialSource(listener, source, plan.sampleRate);
  let delaySum = 0, reflectionSum = 0;
  const reflections = roomWalls.map((wall, i) => {
    const axis = (['x', 'y', 'z'] as const)[Math.floor(i / 2)];
    const boundary = i % 2 === 0 ? plan.min[axis] : plan.max[axis];
    const position = { ...source.position, [axis]: 2 * boundary - source.position[axis] };
    const image = prepareSpatialSource(listener, { ...source, position }, plan.sampleRate);
    const material = plan.walls[wall];
    const cutoff = Math.min(20000, plan.sampleRate * 0.45) * Math.pow(0.025, material.damping);
    const materialPole = material.damping === 0 ? 0 : Math.exp(-2 * Math.PI * cutoff / plan.sampleRate);
    const delayFrames = Math.max(0, (image.distance - direct.distance) * plan.sampleRate / 343);
    delaySum += delayFrames; reflectionSum += material.reflection;
    return Object.freeze({ ...image, wall, delayFrames, left: image.left * material.reflection * plan.earlyGain,
      right: image.right * material.reflection * plan.earlyGain, pole: Math.max(image.pole, materialPole) });
  });
  return Object.freeze({ roomKey: plan.key, direct: Object.freeze(direct), reflections: Object.freeze(reflections),
    late: Object.freeze({ delayFrames: delaySum / 6, gain: Math.hypot(direct.left, direct.right) * reflectionSum / 6 }) });
}
