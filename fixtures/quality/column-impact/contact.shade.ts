"use typeshade";

export class ContactState {
  seed: u32 = 2026;
  low: f32 = 0;
}
export function createContact(): ContactState {
  return new ContactState();
}

export function contact(
  state: inout<ContactState>,
  hardness: f32,
  level: f32,
  time: f32,
): f32 {
  const age: f32 = time - 0.05;
  if (age < 0) return 0;
  let r: u32 = state.seed;
  r = r ^ (r << 13);
  r = r ^ (r >> 17);
  r = r ^ (r << 5);
  state.seed = r;
  const white: f32 = f32(r) / 2147483648 - 1;
  state.low += (0.035 + hardness * 0.2) * (white - state.low);
  const edge: f32 = white - state.low;
  const envelope: f32 =
    min(1, age * 3000) * exp(-age / (0.003 + (1 - hardness) * 0.012));
  return (
    (edge * hardness + state.low * (1.2 - hardness)) * envelope * level * 0.48
  );
}
