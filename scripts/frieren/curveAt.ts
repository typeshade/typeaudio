import type { Curve } from './types.ts';

/** Linear automation. Knots use seconds relative to a layer's source start. */
export function curveAt(points: Curve, time: number): number {
  if (time <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [end, right] = points[i], [start, left] = points[i - 1];
    if (time <= end) return left + (right - left) * (time - start) / (end - start);
  }
  return points[points.length - 1][1];
}
