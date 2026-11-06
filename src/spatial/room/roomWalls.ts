import type { RoomWall } from './types.ts';

/** Stable wire order for the six first-order image paths. */
export const roomWalls: readonly RoomWall[] = Object.freeze(['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax']);
