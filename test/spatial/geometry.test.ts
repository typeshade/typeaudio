import { describe, expect, it } from 'vitest';
import { prepareSpatialSource } from '../../src/spatial/index.ts';
import type { ListenerPose } from '../../src/spatial/index.ts';
const listener: ListenerPose = { position: { x: 0, y: 0, z: 0 } };
const source = (x: number, y = 0, z = 0) => ({ position: { x, y, z }, airAbsorption: 0 });

describe('listener-relative geometry', () => {
  it('uses +X right, +Y up and forward -Z with constant stereo power', () => {
    const left = prepareSpatialSource(listener, source(-1));
    const right = prepareSpatialSource(listener, source(1));
    const front = prepareSpatialSource(listener, source(0, 0, -1));
    expect(left.left).toBeCloseTo(1, 12);
    expect(left.right).toBe(0);
    expect(right.left).toBeCloseTo(0, 12);
    expect(right.right).toBe(1);
    expect(front.left).toBeCloseTo(Math.SQRT1_2, 12);
    expect(front.right).toBeCloseTo(Math.SQRT1_2, 12);
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      const p = prepareSpatialSource(listener, source(Math.sin(angle), 0, -Math.cos(angle)));
      expect(p.left ** 2 + p.right ** 2).toBeCloseTo(1, 12);
    }
  });
  it('turns a world-right source into a front source when the listener turns right', () => {
    const pose = { ...listener, forward: { x: 2, y: 0, z: 0 }, up: { x: 0.3, y: 3, z: 0 } };
    const p = prepareSpatialSource(pose, source(1));
    expect(p.pan).toBe(0);
    expect(p.left).toBeCloseTo(p.right, 12);
    expect(prepareSpatialSource({ ...listener, forward: { x: 0, y: 0, z: 1 } }, source(1)).pan).toBe(-1);
  });
  it('is invariant to joint translation and never amplifies a coincident source', () => {
    const p = prepareSpatialSource(listener, source(1, 2, -3));
    const moved = prepareSpatialSource({ position: { x: 10, y: 20, z: 30 } }, source(11, 22, 27));
    expect(moved).toEqual(p);
    const centre = prepareSpatialSource(listener, source(0));
    expect(centre.pan).toBe(0);
    expect(centre.left ** 2 + centre.right ** 2).toBeCloseTo(1, 12);
  });
  it('halves amplitude at twice the reference distance and can disable rolloff', () => {
    const near = prepareSpatialSource(listener, source(0, 0, -1));
    const far = prepareSpatialSource(listener, source(0, 0, -2));
    expect(far.left / near.left).toBeCloseTo(0.5, 12);
    const flat = prepareSpatialSource(listener, { ...source(0, 0, -200), rolloff: 0 });
    expect(flat.left).toBe(near.left);
  });
  it('uses spread to centre the pan without changing total power', () => {
    const p = prepareSpatialSource(listener, { ...source(1), spread: 1 });
    expect(p.pan).toBe(0);
    expect(p.left ** 2 + p.right ** 2).toBeCloseTo(1, 12);
  });
  it('applies more lowpass damping with distance or authored occlusion', () => {
    const near = prepareSpatialSource(listener, { position: { x: 0, y: 0, z: -1 } });
    const far = prepareSpatialSource(listener, { position: { x: 0, y: 0, z: -80 } });
    const blocked = prepareSpatialSource(listener, { ...source(0, 0, -1), occlusion: 1 });
    expect(near.pole).toBe(0);
    expect(far.pole).toBeGreaterThan(0.4);
    expect(blocked.pole).toBeGreaterThan(far.pole);
    expect(blocked.left / near.left).toBeCloseTo(0.25, 12);
  });
  it('rejects invalid geometry, parallel axes and invalid source controls', () => {
    for (const pose of [
      { position: { x: NaN, y: 0, z: 0 } },
      { ...listener, forward: { x: 0, y: 0, z: 0 } },
      { ...listener, forward: { x: 0, y: 1, z: 0 } },
      { ...listener, up: { x: 0, y: 0, z: 1 } },
    ]) expect(() => prepareSpatialSource(pose, source(1))).toThrow();
    for (const fields of [{ gain: -1 }, { gain: Infinity }, { rolloff: -1 }, { spread: 2 }, { occlusion: -0.1 }, { referenceDistance: 0 }, { airAbsorption: NaN }])
      expect(() => prepareSpatialSource(listener, { ...source(1), ...fields })).toThrow();
    expect(() => prepareSpatialSource(listener, source(1), 0)).toThrow();
  });
});
