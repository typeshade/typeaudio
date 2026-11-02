import type { Device, Resident } from 'typeshade/runtime';

/**
 * The state of an instance: its fields, without its methods. A unit field whose class another
 * file declares is already an object of its fields in the host view (compiler surface §64).
 */
export type State<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K];
};

/**
 * A bank: the instances of one unit class on a device, one lane each, as a kernel's `array<T>`
 * takes them. A kernel that calls a method on an element writes that element (compiler Rule 8.29),
 * so each instance's state stays on the device from block to block, and the host reads it only
 * when it asks, with `await bank.instances.read()`.
 */
export interface Bank<T extends object> {
  /** The device that holds the bank. */
  readonly device: Device;
  /** The instances on the device: the `Resident` a kernel takes for its `array<T>` parameter. */
  readonly instances: Resident<T[]>;
  /** How many lanes the bank holds. */
  readonly size: number;
  /**
   * Reads the state of every lane back from the device, in lane order: the fields of each
   * instance, as plain objects. A read of the `Resident` returns the fields and not instances of
   * the class (workaround of `docs/compiler-asks.md`, N), so the type says so.
   */
  read(): Promise<State<T>[]>;
}

/**
 * Puts a copy of `instances` on `dev` as a bank, one lane each. Build each instance with `new`
 * (`new Voice(220, 1200, 0.7, 48000)`): its constructor runs on the CPU tier, field initializers
 * included. The bank holds a copy, so a later change to `instances` does not reach it.
 *
 * @throws `RangeError` for an empty array: a kernel's loop over the bank would run no iteration.
 */
export function bank<T extends object>(dev: Device, instances: readonly T[]): Bank<T> {
  if (instances.length === 0) {
    throw new RangeError('bank(): takes at least one instance; got an empty array.');
  }
  const resident = dev.array([...instances]);
  return {
    device: dev,
    instances: resident,
    size: instances.length,
    read: () => resident.read(),
  };
}
