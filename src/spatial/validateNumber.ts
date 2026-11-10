/** Control-path validation. Successful calls do not allocate. */
export function validateNumber(value: number, low: number, high: number, name: string): number {
  if (!Number.isFinite(value) || value < low || value > high)
    throw new RangeError(name + ' must be finite and between ' + low + ' and ' + high + '.');
  return value;
}
