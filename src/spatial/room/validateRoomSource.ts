import { validateNumber } from '../validateNumber.ts';
import { roomWalls } from './roomWalls.ts';
import type { PreparedRoom, RoomSourceTarget } from './types.ts';

/** Validate the complete message before the mixer changes any target or DSP history. */
export function validateRoomSource(target: RoomSourceTarget, room: PreparedRoom, maxDelay: number): void {
  if (!target || target.roomKey !== room.key || !target.direct || !target.late || target.reflections?.length !== 6)
    throw new RangeError('Room source must contain a matching room key, direct path, six reflections and late send.');
  const paths = target.reflections;
  for (let i = -1; i < 6; i++) {
    const path = i < 0 ? target.direct : paths[i];
    if (!path || path.sampleRate !== room.sampleRate) throw new RangeError('Room source sample rate must match the mixer.');
    validateNumber(path.left, 0, 16, 'path.left');
    validateNumber(path.right, 0, 16, 'path.right');
    validateNumber(path.pole, 0, 0.9999999, 'path.pole');
    if (i >= 0) {
      if (paths[i].wall !== roomWalls[i]) throw new RangeError('Room reflection wall order must match roomWalls.');
      validateNumber(paths[i].delayFrames, 0, maxDelay, 'reflection.delayFrames');
    }
  }
  validateNumber(target.late.delayFrames, 0, maxDelay, 'late.delayFrames');
  validateNumber(target.late.gain, 0, 16, 'late.gain');
}
