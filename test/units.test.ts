import { describe, expect, test } from 'vitest';
import { OnePole } from '../src/units/one-pole.shade.ts';
import { Biquad, Lowpass } from '../src/units/biquad.shade.ts';
import { Oscillator, Saw, Sine } from '../src/units/oscillator.shade.ts';
import { Envelope } from '../src/units/envelope.shade.ts';
import { Voice } from '../src/kernels/synth.shade.ts';
import { RefEnvelope, RefLowpass, RefOnePole, RefVoice, refSaw, refSine } from './reference.ts';

// Each unit is built with `new` on the host and ticked synchronously on the CPU tier (compiler
// change 0109), and held to the plain-JavaScript reference bit for bit: both round every
// operation to an f32, and `Math.sin`, `Math.cos` and `Math.tanh` are the same functions on both.

const SR = 48000;

/** `n` results of `tick`, in order. */
const run = (n: number, tick: (i: number) => number): number[] => Array.from({ length: n }, (_, i) => tick(i));

/** A test signal: a step, then two detuned sines. */
const signal = (i: number): number =>
  i < 64 ? 1 : 0.5 * Math.sin(i * 0.013) + 0.25 * Math.sin(i * 0.31);

describe('a unit built with new ticks on the CPU tier as the reference does', () => {
  test('Sine', () => {
    const osc = new Sine().hz(440, SR);
    const ref = refSine().hz(440, SR);
    expect(run(2000, () => osc.tick())).toEqual(run(2000, () => ref.tick()));
    expect([osc.phase, osc.inc]).toEqual([ref.phase, ref.inc]);
  });

  test('Saw, built by its static builder', () => {
    const osc = Saw.at(110, SR);
    const ref = refSaw().hz(110, SR);
    expect(osc).toBeInstanceOf(Saw);
    expect(run(2000, () => osc.tick())).toEqual(run(2000, () => ref.tick()));
    expect([osc.phase, osc.inc]).toEqual([ref.phase, ref.inc]);
  });

  test('OnePole', () => {
    const lp = new OnePole(0.05);
    const ref = new RefOnePole(0.05);
    expect(run(2000, (i) => lp.tick(signal(i)))).toEqual(run(2000, (i) => ref.tick(signal(i))));
    expect(lp.z).toBe(ref.z);
  });

  test('Lowpass, designed by set(), which returns the filter', () => {
    const lp = new Lowpass().set(1200, 0.707, SR);
    const ref = new RefLowpass().set(1200, 0.707, SR);
    expect(lp).toBeInstanceOf(Lowpass);
    expect(run(2000, (i) => lp.tick(signal(i)))).toEqual(run(2000, (i) => ref.tick(signal(i))));
  });

  test('Envelope, set by times(), which returns the envelope', () => {
    const env = new Envelope().times(0.002, 0.05, 0.25, SR);
    const ref = new RefEnvelope().times(0.002, 0.05, 0.25, SR);
    expect(env).toBeInstanceOf(Envelope);
    expect([env.attack, env.decay, env.sustain]).toEqual([ref.attack, ref.decay, ref.sustain]);
    const levels = run(20000, () => env.tick());
    expect(levels).toEqual(run(20000, () => ref.tick()));
    // It rises from 0 and settles at the sustain level, with no subnormal on the way.
    expect(levels[0]).toBe(0);
    expect(Math.max(...levels)).toBeLessThanOrEqual(1);
    expect(Math.abs(levels[levels.length - 1]! - 0.25)).toBeLessThan(1e-3);
    expect(levels.every((x) => x === 0 || Math.abs(x) >= 2 ** -126)).toBe(true);
  });

  test('Voice, a Saw and a Lowpass composed as its fields', () => {
    const voice = new Voice(220, 1500, 0.9, SR);
    const ref = new RefVoice(220, 1500, 0.9, SR);
    expect(run(4000, () => voice.tick())).toEqual(run(4000, () => ref.tick()));
    expect(voice.osc).toEqual({ phase: ref.osc.phase, inc: ref.osc.inc });
    expect(voice.filter).toEqual({ ...ref.filter });
  });
});

describe('the classes on the host', () => {
  test('a class that extends is an instance of its base, as in TypeScript', () => {
    expect(new Sine()).toBeInstanceOf(Oscillator);
    expect(new Lowpass()).toBeInstanceOf(Biquad);
  });

  test('a this-returning method returns the instance it was called on', () => {
    const osc = new Sine();
    expect(osc.hz(1000, SR)).toBe(osc);
    const lp = new Lowpass();
    expect(lp.set(1000, 0.7, SR)).toBe(lp);
  });

  test('an abstract class has no instance to build', () => {
    // The view declares it abstract, so `tsc` refuses `new Oscillator()` at the host's line; a
    // caller tsc did not read is refused at run time.
    const Abstract = Oscillator as unknown as new () => Oscillator;
    expect(() => new Abstract()).toThrow(/abstract/);
  });

  test('a unit field of a voice is a plain object of its fields on the host', () => {
    // The view writes a field whose class another file declares as an object of its fields
    // (compiler surface §64), so the host gets the state and not the class: no `tick()` there.
    const voice = new Voice(220, 1500, 0.9, SR);
    expect(voice.osc).not.toBeInstanceOf(Saw);
    expect(Object.getPrototypeOf(voice.osc)).toBe(Object.prototype);
  });
});
