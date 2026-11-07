import type { ListenerPose, SpatialSource, SpatialTarget } from './types.ts';
import { listenerBasis } from './listenerBasis.ts';
import { validateVector } from './validateVector.ts';
import { validateNumber } from './validateNumber.ts';
/** Prepare listener-relative stereo coefficients on the control thread. */
export function prepareSpatialSource(
  listener: ListenerPose,
  source: SpatialSource,
  sampleRate = 48000,
): SpatialTarget {
  validateNumber(sampleRate, 8000, 192000, 'sampleRate');
  const right = listenerBasis(listener);
  if (!source) throw new TypeError('Spatial source is required.');
  validateVector(source.position, 'source.position');
  const gain = validateNumber(source.gain ?? 1, 0, 16, 'gain');
  const reference = validateNumber(source.referenceDistance ?? 1, 0.01, 1000, 'referenceDistance');
  const rolloff = validateNumber(source.rolloff ?? 1, 0, 8, 'rolloff');
  const air = validateNumber(source.airAbsorption ?? 0.035, 0, 1, 'airAbsorption');
  const occlusion = validateNumber(source.occlusion ?? 0, 0, 1, 'occlusion');
  const spread = validateNumber(source.spread ?? 0, 0, 1, 'spread');
  const x = source.position.x - listener.position.x;
  const y = source.position.y - listener.position.y;
  const z = source.position.z - listener.position.z;
  const distance = Math.hypot(x, y, z);
  const pan = distance < 1e-9 ? 0 : Math.max(-1, Math.min(1, (x * right.x + y * right.y + z * right.z) / distance)) * (1 - spread);
  const excess = Math.max(0, distance - reference);
  const level = gain * reference / (reference + rolloff * excess) * (1 - 0.75 * occlusion);
  const angle = (pan + 1) * Math.PI / 4;
  const ceiling = Math.min(20000, sampleRate * 0.45);
  const cutoff = Math.max(20, ceiling / (1 + air * excess) * Math.pow(1000 / ceiling, occlusion));
  const pole = air * excess === 0 && occlusion === 0 ? 0 : Math.exp(-2 * Math.PI * cutoff / sampleRate);
  return { sampleRate, distance, pan, left: Math.cos(angle) * level, right: Math.sin(angle) * level, pole };
}
