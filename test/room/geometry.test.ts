import { describe, expect, it } from 'vitest';
import { prepareRoom, prepareRoomSource, roomWalls, RoomMixer } from '../../src/spatial/room/index.ts';
import { definition, listener, room, source, target } from './helpers.ts';

describe('room control preparation', () => {
  it('prepares six mirror paths with travel time and arrival direction in metres', () => {
    expect(target.reflections.map(path => path.distance)).toEqual([4, 4, 6, 6, 8, 8]);
    expect(target.reflections.map(path => path.delayFrames)).toEqual([400, 400, 600, 600, 800, 800]);
    expect(target.reflections.map(path => path.pan)).toEqual([-1, 1, 0, 0, 0, 0]);
    expect(target.reflections[0].left).toBe(0.5);
    expect(target.reflections[1].right).toBe(0.5);
    expect(target.reflections.every(path => path.pole === 0)).toBe(true);
    expect(target.late.delayFrames).toBe(600);
    expect(target.late.gain).toBeCloseTo(0.5);
  });
  it('subtracts direct travel time and rotates the reflection with the listener', () => {
    const moved = { ...source, position: { x: 1, y: 0, z: 0 }, rolloff: 1 };
    const a = prepareRoomSource(room, listener, moved);
    const b = prepareRoomSource(room, { ...listener, forward: { x: 0, y: 0, z: 1 } }, moved);
    expect(a.direct.distance).toBe(1);
    expect(a.reflections[0].delayFrames).toBe(400);
    expect(a.reflections[1].delayFrames).toBe(200);
    expect(a.reflections[1].right).toBeCloseTo(0.5 / 3);
    expect(b.reflections[0].pan).toBe(1);
    expect(b.reflections[1].pan).toBe(-1);
  });
  it('estimates a longer decay for a larger or more reflective room', () => {
    const large = prepareRoom({ ...definition, max: { x: 6, y: 9, z: 12 } });
    const hard = prepareRoom({ ...definition, walls: Object.fromEntries(roomWalls.map(wall => [wall, { reflection: 0.9 }])) });
    expect(large.decaySeconds).toBeGreaterThan(room.decaySeconds);
    expect(hard.decaySeconds).toBeGreaterThan(room.decaySeconds);
    expect(prepareRoom({ ...definition, decaySeconds: 2 }).decaySeconds).toBe(2);
  });
  it('snapshots definitions and survives serialization without depending on object identity', () => {
    const input = structuredClone(definition), snapshot = prepareRoom(input);
    (input.min as { x: number }).x = -20;
    expect(snapshot.min.x).toBe(-2);
    const clone = structuredClone(snapshot);
    const mixer = new RoomMixer(clone, { capacity: 1 });
    expect(() => mixer.setSource(0, prepareRoomSource(snapshot, listener, source))).not.toThrow();
    expect(() => new RoomMixer({ ...clone, lateGain: 0.9 })).toThrow(/key/);
    expect(() => prepareRoomSource({ ...clone, earlyGain: 0.3 }, listener, source)).toThrow(/key/);
  });
  it('rejects invalid geometry, materials, decay, rates and exterior poses', () => {
    expect(() => prepareRoom({ ...definition, max: definition.min })).toThrow();
    expect(() => prepareRoom({ ...definition, max: { x: 300, y: 3, z: 4 } })).toThrow();
    expect(() => prepareRoom({ ...definition, walls: { xMin: { reflection: 1 } } })).toThrow();
    expect(() => prepareRoom({ ...definition, walls: { xMin: { damping: NaN } } })).toThrow();
    expect(() => prepareRoom({ ...definition, decaySeconds: Infinity })).toThrow();
    expect(() => prepareRoom(definition, 100)).toThrow();
    expect(() => prepareRoomSource(room, listener, { position: room.min })).toThrow(/inside/);
    expect(() => prepareRoomSource(room, { position: room.max }, source)).toThrow(/inside/);
    expect(() => new RoomMixer(room, { capacity: 65 })).toThrow();
    expect(() => new RoomMixer(room, { capacity: 1.5 })).toThrow();
    expect(() => new RoomMixer(room, { transitionSeconds: 0 })).toThrow();
  });
});
