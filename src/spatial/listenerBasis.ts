import type { ListenerPose } from './types.ts';
import { validateVector } from './validateVector.ts';
const FORWARD = { x: 0, y: 0, z: -1 };
const UP = { x: 0, y: 1, z: 0 };
/** Build the listener's right axis. Tilted up is valid; parallel axes are not. */
export function listenerBasis(listener: ListenerPose) {
  if (!listener) throw new TypeError('Listener pose is required.');
  validateVector(listener.position, 'listener.position');
  const forward = listener.forward ?? FORWARD, up = listener.up ?? UP;
  validateVector(forward, 'listener.forward');
  validateVector(up, 'listener.up');
  const fl = Math.hypot(forward.x, forward.y, forward.z);
  const ul = Math.hypot(up.x, up.y, up.z);
  if (fl < 1e-9 || ul < 1e-9) throw new RangeError('Listener axes must have nonzero length.');
  const fx = forward.x / fl, fy = forward.y / fl, fz = forward.z / fl;
  const ux = up.x / ul, uy = up.y / ul, uz = up.z / ul;
  const rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;
  const length = Math.hypot(rx, ry, rz);
  if (length < 1e-6) throw new RangeError('Listener forward and up must not be parallel.');
  return { x: rx / length, y: ry / length, z: rz / length };
}
