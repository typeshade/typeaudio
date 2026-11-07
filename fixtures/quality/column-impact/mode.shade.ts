"use typeshade";

export class ModeState {
  previous: f32 = 0;
  older: f32 = 0;
}
export function createMode(): ModeState {
  return new ModeState();
}

export function mode(
  state: inout<ModeState>,
  input: f32,
  frequency: f32,
  mass: f32,
  decay: f32,
  weight: f32,
  sampleRate: f32,
): f32 {
  const hz: f32 = frequency / sqrt(mass);
  const angle: f32 = (6.28318530718 * hz) / sampleRate;
  const lifetime: f32 = decay / (1 + frequency * 0.0017);
  const radius: f32 = exp(-1 / (max(0.008, lifetime) * sampleRate));
  const next: f32 =
    input * sin(angle) * weight +
    2 * radius * cos(angle) * state.previous -
    radius * radius * state.older;
  state.older = state.previous;
  state.previous = next;
  return next;
}
