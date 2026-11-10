import { validateNumber } from '../validateNumber.ts';
import { validateVector } from '../validateVector.ts';
import { roomWalls } from './roomWalls.ts';
import type { PreparedRoom, RoomDefinition, RoomWall, WallMaterial } from './types.ts';

/** Validate and snapshot room geometry on the control thread. */
export function prepareRoom(definition: RoomDefinition, sampleRate = 48000): PreparedRoom {
  validateNumber(sampleRate, 8000, 192000, 'sampleRate');
  if (!definition) throw new TypeError('Room definition is required.');
  validateVector(definition.min, 'room.min');
  validateVector(definition.max, 'room.max');
  const min = Object.freeze({ ...definition.min }), max = Object.freeze({ ...definition.max });
  for (const axis of ['x', 'y', 'z'] as const) {
    validateNumber(min[axis], -100000, 100000, 'room.min.' + axis);
    validateNumber(max[axis], -100000, 100000, 'room.max.' + axis);
    validateNumber(max[axis] - min[axis], 0.1, 200, 'room dimension ' + axis);
  }
  const walls = {} as Record<RoomWall, Readonly<Required<WallMaterial>>>;
  const areas = [(max.y - min.y) * (max.z - min.z), (max.x - min.x) * (max.z - min.z), (max.x - min.x) * (max.y - min.y)];
  let absorption = 0;
  for (let i = 0; i < roomWalls.length; i++) {
    const name = roomWalls[i], material = definition.walls?.[name];
    const reflection = validateNumber(material?.reflection ?? 0.6, 0, 0.98, name + '.reflection');
    const damping = validateNumber(material?.damping ?? 0.35, 0, 1, name + '.damping');
    walls[name] = Object.freeze({ reflection, damping });
    absorption += areas[Math.floor(i / 2)] * (1 - reflection * reflection);
  }
  const volume = (max.x - min.x) * (max.y - min.y) * (max.z - min.z);
  const decaySeconds = validateNumber(definition.decaySeconds ?? Math.max(0.05, Math.min(8, 0.161 * volume / absorption)), 0.05, 8, 'decaySeconds');
  const earlyGain = validateNumber(definition.earlyGain ?? 0.7, 0, 1, 'earlyGain');
  const lateGain = validateNumber(definition.lateGain ?? 0.2, 0, 1, 'lateGain');
  const key = JSON.stringify(['typeaudio-room-v1', sampleRate, min.x, min.y, min.z, max.x, max.y, max.z,
    ...roomWalls.flatMap(wall => [walls[wall].reflection, walls[wall].damping]), earlyGain, lateGain, decaySeconds]);
  return Object.freeze({ min, max, walls: Object.freeze(walls), earlyGain, lateGain, decaySeconds, sampleRate, key });
}
