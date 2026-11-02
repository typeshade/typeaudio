"use typeshade";

// Shape F (docs/architecture.md, section 2): one frame of a bus, read and written at the loop's
// counter, so a chain of these calls can run as one dispatch (surface §71, facts F1 to F5). Each
// writes a new array: a chain never processes in place (fact F4).

/** Scales a bus by the linear gain `g`: `out[i] = x[i] * g`. */
export function gain(out: array<f32>, x: array<f32>, g: f32) {
  for (let i: u32 = 0; i < out.length; i++) {
    out[i] = x[i] * g;
  }
}

/** Soft-clips a bus: `out[i] = tanh(x[i] * amount)`. */
export function drive(out: array<f32>, x: array<f32>, amount: f32) {
  for (let i: u32 = 0; i < out.length; i++) {
    out[i] = tanh(x[i] * amount);
  }
}
