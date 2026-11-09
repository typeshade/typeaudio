"use typeshade";

// Experiment 3's two probes (docs/experiments.md, section 3). Each isolates one thing the FFT
// shows, on every tier, with inputs the host chooses.

/** The factor of `scaleProbe`, from the host, so that no compiler or driver can fold it. */
interface Probe {
  factor: f32;
}

declare const probe: uniform<Probe>;
declare const xs: storage<array<f32>>;
declare const ys: storage<array<f32>, "read_write">;

/**
 * Subnormals (docs/compiler-asks.md, E): `ys[i] = xs[i] * factor`. A subnormal input of 2^-146 or
 * more times 2^20 is a normal result, which is 0 only where the tier flushes a subnormal it reads;
 * a normal input below 2^-106 times 2^-20 is a subnormal result, which is 0 only where the tier
 * flushes a subnormal it writes.
 */
export const scaleProbe = compute([64], function scaleProbe(
  gid: builtin<"global_invocation_id", vec3u>,
) {
  if (gid.x < ys.length) {
    ys[gid.x] = xs[gid.x] * probe.factor;
  }
});

/**
 * A length read inside an index (docs/compiler-asks.md, J): `ys[i] = xs[i % xs.length]`. This is the
 * plain form, with no length parameter. The WebGL2 pass program left it undeclared before the pin
 * `87af4eb0` (compiler issue #900), and at the pin `415b276a` it runs on all three tiers. The FFT
 * entries read no length; this probe keeps the form, to measure it.
 */
export const wrapProbe = compute([64], function wrapProbe(
  gid: builtin<"global_invocation_id", vec3u>,
) {
  if (gid.x < ys.length) {
    ys[gid.x] = xs[gid.x % xs.length];
  }
});
