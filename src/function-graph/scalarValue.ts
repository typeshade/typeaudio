import type { ScalarType, ScalarValue } from "./types.ts";

export function scalarValue(
  value: unknown,
  type: ScalarType,
  label: string,
): ScalarValue {
  const valid =
    type === "bool"
      ? typeof value === "boolean"
      : typeof value === "number" &&
        Number.isFinite(value) &&
        (type === "f32"
          ? Number.isFinite(Math.fround(value))
          : Number.isInteger(value) &&
            value >= (type === "u32" ? 0 : -2147483648) &&
            value <= (type === "u32" ? 4294967295 : 2147483647));
  if (!valid) throw new Error(`${label}: expected a finite ${type} value.`);
  return type === "f32" ? Math.fround(value as number) : (value as ScalarValue);
}
