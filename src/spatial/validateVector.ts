import type { Vector3 } from './types.ts';
import { validateNumber } from './validateNumber.ts';
export function validateVector(value: Vector3, name: string): void {
  if (!value || typeof value !== 'object') throw new TypeError(name + ' needs x, y and z.');
  validateNumber(value.x, -1e6, 1e6, name + '.x');
  validateNumber(value.y, -1e6, 1e6, name + '.y');
  validateNumber(value.z, -1e6, 1e6, name + '.z');
}
