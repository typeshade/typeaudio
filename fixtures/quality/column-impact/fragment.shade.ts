"use typeshade";

export class FragmentState {
  seed: u32 = 2026;
  low: f32 = 0;
  previous: f32 = 0;
  older: f32 = 0;
}
export function createFragment(): FragmentState {
  return new FragmentState();
}

export function fragment(
  state: inout<FragmentState>,
  onset: f32,
  spacing: f32,
  frequency: f32,
  size: f32,
  level: f32,
  time: f32,
  sampleRate: f32,
): f32 {
  const age: f32 = time - 0.05 - onset * spacing;
  if (age < 0) return 0;
  let r: u32 = state.seed;
  r = r ^ (r << 13);
  r = r ^ (r >> 17);
  r = r ^ (r << 5);
  state.seed = r;
  const white: f32 = f32(r) / 2147483648 - 1;
  state.low += 0.13 * (white - state.low);
  const excitation: f32 =
    (white - state.low) * exp(-age / (0.0015 + size * 0.004));
  const angle: f32 = (6.28318530718 * frequency) / sampleRate;
  const radius: f32 = exp(-1 / ((0.012 + size * 0.045) * sampleRate));
  const body: f32 =
    excitation * sin(angle) * 0.3 +
    2 * radius * cos(angle) * state.previous -
    radius * radius * state.older;
  state.older = state.previous;
  state.previous = body;
  return (excitation * 0.18 + body) * level * min(1, age * 5000);
}
