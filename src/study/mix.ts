// The mix of the perceptual study (`docs/studies/frieren-perceptual/scripts/mix.py` at commit
// `07670c9`), ported line by line: every layer is placed in the hall, sent to the shared late field,
// and set by a loudness target; the master raises the sum by a drive into a look-ahead limiter and a
// soft clip. A layer is kept as the study keeps it, in 32-bit floats, but only over the samples it
// covers.

import {
  SR,
  Room,
  convolve,
  envPoints,
  fade,
  iir,
  interp,
  kWeight,
  lin,
  loudnessBlocks,
  nsamp,
  place,
  rbj,
  reverbIr,
  smooth,
  stereo,
  truePeakDb,
  type Path,
  type Stereo,
  type Vec3,
} from './dsp.ts';

export type Meter = 'm' | 'i' | 's' | 'a' | 'r';

/**
 * The loudness of a stereo layer: 'm' the highest momentary (0.4 s), 'i' the highest over 0.1 s,
 * 's' the highest short-term (3 s), 'a' the average over the active part, 'r' unweighted RMS in dBFS.
 */
export function meter(st: Stereo, kind: Meter): number {
  if (kind === 'r' || kind === 'a') {
    const [l, r] = kind === 'a' ? [kWeight(st[0]), kWeight(st[1])] : st;
    const n = l.length;
    const p = new Float64Array(n);
    let pmax = 0;
    for (let i = 0; i < n; i++) pmax = Math.max(pmax, (p[i] = l[i]! * l[i]! + r[i]! * r[i]!));
    let s = 0;
    let c = 0;
    for (let i = 0; i < n; i++)
      if (p[i]! > pmax * 1e-6) {
        s += p[i]!;
        c++;
      }
    const mean = s / c;
    return kind === 'r'
      ? 10 * Math.log10(Math.max(mean / 2, 1e-12))
      : -0.691 + 10 * Math.log10(Math.max(mean, 1e-12));
  }
  const w = { m: 0.4, i: 0.1, s: 3.0 }[kind];
  let x = st;
  if (st[0].length < nsamp(w) + 2) {
    x = stereo(nsamp(w) + 2);
    x[0].set(st[0]);
    x[1].set(st[1]);
  }
  const { l } = loudnessBlocks(x, w, w / 8);
  let m = -Infinity;
  for (const v of l) m = Math.max(m, v);
  return m;
}

/** The minimum of x[i : i + w] for every i, ones beyond the end. */
function minForward(x: Float64Array, w: number): Float64Array {
  const n = x.length;
  const y = new Float64Array(n);
  // A monotone deque over the window.
  const q = new Int32Array(n + w);
  let head = 0;
  let tail = 0;
  const at = (j: number) => (j < n ? x[j]! : 1);
  for (let j = 0; j < Math.min(w - 1, n + w); j++) {
    while (tail > head && at(q[tail - 1]!) >= at(j)) tail--;
    q[tail++] = j;
  }
  for (let i = 0; i < n; i++) {
    const j = i + w - 1;
    while (tail > head && at(q[tail - 1]!) >= at(j)) tail--;
    q[tail++] = j;
    while (q[head]! < i) head++;
    y[i] = at(q[head]!);
  }
  return y;
}

/** A look-ahead peak limiter for a stereo signal, one gain for both channels. Returns the gain. */
export function limiter(
  x: Stereo,
  ceiling: number,
  lookahead = 0.004,
  release = 0.12,
): Float64Array {
  const n = x[0].length;
  const a = Math.exp(-1.0 / (release * SR));
  const env = new Float64Array(n);
  let g = 1.0;
  for (let i = 0; i < n; i++) {
    const pk = Math.max(Math.abs(x[0][i]!), Math.abs(x[1][i]!));
    const t = Math.min(1.0, ceiling / Math.max(pk, 1e-12));
    g = 1.0 - (1.0 - g) * a;
    if (t < g) g = t;
    env[i] = g;
  }
  const k = Math.max(2, nsamp(lookahead));
  const lo = minForward(env, k);
  const gain = new Float64Array(n);
  let s = lo[0]! * k;
  // gain[i] = mean(lo[i-k+1 .. i]) with lo[0] before the start
  const pad = (j: number) => (j < 0 ? lo[0]! : lo[j]!);
  for (let i = 0; i < n; i++) {
    s += lo[i]! - pad(i - k);
    gain[i] = s / k;
  }
  return gain;
}

/** A layer as the study keeps it: 32-bit floats, here from `start` over the samples it covers. */
export interface Layer {
  readonly start: number;
  readonly dry: [Float32Array, Float32Array];
  readonly wet: [Float32Array, Float32Array];
  readonly gainDb: number;
  readonly target: number | null;
  readonly meter: Meter;
  readonly t: number;
}

/** Positions: one, one for each sample, or (picture seconds, position) keys smoothed over 0.12 s. */
export type Where = Path | readonly (readonly [number, Vec3])[];

export interface AddOptions {
  target?: number | null;
  kind?: Meter;
  gainDb?: number;
  focusDb?: number;
  erDb?: number | null;
  sendDb?: number | null;
  doppler?: boolean;
}

export class Mix {
  readonly n: number;
  readonly room: Room;
  readonly ir: Stereo;
  readonly layers = new Map<string, Layer>();
  readonly order: string[] = [];
  driveDb = 0;
  /** A layer that starts at or after this picture second is left out (the end of a scene). */
  until = Infinity;
  afterDb: readonly (readonly [number, number])[] | undefined;
  /**
   * A level set on the sum before the master: (picture seconds, dB) points, never above 0 dB. Not
   * the study's: experiment 12 uses it to keep the soft clip from trimming the whole mix.
   */
  beforeDb: readonly (readonly [number, number])[] | undefined;
  masterGainDb = 0;
  limitDb = 0;
  limitedShare = 0;

  constructor(
    readonly name: string,
    readonly t0: number,
    readonly t1: number,
    readonly tail = 2.5,
    room?: Room,
    readonly revDb = -5.0,
  ) {
    this.n = nsamp(t1 - t0 + tail);
    this.room = room ?? new Room();
    const ir = reverbIr(this.room);
    const g = lin(revDb);
    this.ir = [ir[0].map((v) => v * g), ir[1].map((v) => v * g)];
  }

  positions(pos: Where, t: number, n: number): Path {
    if (!Array.isArray(pos) || typeof pos[0] === 'number') return pos as Path;
    const keys = pos as readonly (readonly [number, Vec3])[];
    const ts = keys.map((k) => k[0]);
    const axes = [0, 1, 2].map((c) => {
      const ps = keys.map((k) => k[1][c]!);
      const v = new Float64Array(n);
      for (let i = 0; i < n; i++) v[i] = interp(t + i / SR, ts, ps);
      return smooth(v, 0.12);
    });
    return { x: axes[0]!, y: axes[1]!, z: axes[2]! };
  }

  private fit(x: Float64Array, s: number): { start: number; data: Float32Array } {
    const a = Math.max(s, 0);
    const b = Math.min(this.n, s + x.length);
    const data = new Float32Array(Math.max(0, b - a));
    for (let i = a; i < b; i++) data[i - a] = x[i - s]!;
    return { start: a, data };
  }

  private store(
    name: string,
    dry: Stereo,
    send: Float64Array | null,
    t: number,
    opts: AddOptions,
  ): void {
    const wet: Stereo = send !== null ? convolve(send, this.ir) : stereo(dry[0].length);
    const m = Math.max(dry[0].length, wet[0].length);
    const full = stereo(m);
    const d = stereo(m);
    for (let c = 0; c < 2; c++) {
      full[c].set(dry[c]);
      d[c].set(dry[c]);
      for (let i = 0; i < wet[c].length; i++) full[c][i] = full[c][i]! + wet[c][i]!;
    }
    let g = lin(opts.gainDb ?? 0);
    const target = opts.target ?? null;
    const kind = opts.kind ?? 'm';
    if (target !== null) g *= lin(target - meter(full, kind));
    const s = nsamp(t - this.t0);
    const dl = this.fit(
      d[0].map((v) => v * g),
      s,
    );
    const dr = this.fit(
      d[1].map((v) => v * g),
      s,
    );
    const wl = this.fit(
      full[0].map((v, i) => (v - d[0][i]!) * g),
      s,
    );
    const wr = this.fit(
      full[1].map((v, i) => (v - d[1][i]!) * g),
      s,
    );
    this.layers.set(name, {
      start: dl.start,
      dry: [dl.data, dr.data],
      wet: [wl.data, wr.data],
      gainDb: 20 * Math.log10(g),
      target,
      meter: kind,
      t,
    });
    this.order.push(name);
  }

  /** A mono source at a place in the hall. */
  add(name: string, sig: Float64Array, t: number, pos: Where, opts: AddOptions = {}): void {
    if (t >= this.until) return;
    const P = this.positions(pos, t, sig.length);
    const [d, er] = place(
      sig,
      P,
      this.room,
      opts.focusDb ?? 0,
      opts.erDb === undefined ? 0 : opts.erDb,
      opts.doppler ?? true,
    );
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < d[c].length; i++) d[c][i] = d[c][i]! + er[c][i]!;
    const sendDb = opts.sendDb === undefined ? 0 : opts.sendDb;
    const send = sendDb !== null ? sig.map((v) => v * lin(sendDb)) : null;
    this.store(name, d as Stereo, send, t, opts);
  }

  /** A stereo source with no place, as wide as it was made. */
  addWide(name: string, sig: Stereo, t: number, opts: AddOptions = {}): void {
    if (t >= this.until) return;
    const sendDb = opts.sendDb ?? null;
    const send =
      sendDb !== null ? sig[0].map((v, i) => ((v + sig[1][i]!) / 2) * lin(sendDb)) : null;
    this.store(name, [Float64Array.from(sig[0]), Float64Array.from(sig[1])], send, t, opts);
  }

  /** A layer over the whole mix, its room included. */
  layer(name: string): Stereo {
    const out = stereo(this.n);
    this.addLayer(out, this.layers.get(name)!);
    return out;
  }

  private addLayer(out: Stereo, l: Layer): void {
    for (let c = 0; c < 2; c++) {
      const dry = l.dry[c]!;
      const wet = l.wet[c]!;
      const o = out[c]!;
      for (let i = 0; i < dry.length; i++) o[l.start + i] = o[l.start + i]! + (dry[i]! + wet[i]!);
    }
  }

  /**
   * The sum of the layers. The highest true peak goes to `peakDbtp`. With `driveDb` set, the sum is
   * raised by that much, and a look-ahead limiter and a soft clip hold the peaks at the same ceiling.
   */
  render(peakDbtp = -2.0): Stereo {
    let mix = stereo(this.n);
    for (const name of this.order) this.addLayer(mix, this.layers.get(name)!);
    if (this.beforeDb && this.beforeDb.length > 0) {
      const ts = this.beforeDb.map((p) => p[0] - this.t0);
      const vs = this.beforeDb.map((p) => Math.min(p[1], 0));
      for (let i = 0; i < this.n; i++) {
        const g = lin(interp(i / SR, ts, vs));
        mix[0][i] = mix[0][i]! * g;
        mix[1][i] = mix[1][i]! * g;
      }
    }
    mix = [
      iir(mix[0], [rbj('hp', 27.0, 0.7071)], 0.5),
      iir(mix[1], [rbj('hp', 27.0, 0.7071)], 0.5),
    ];
    const tp = truePeakDb(mix);
    this.masterGainDb = peakDbtp - tp;
    const drive = this.driveDb;
    this.limitDb = 0;
    this.limitedShare = 0;
    const mg = lin(this.masterGainDb);
    let y: Stereo = [mix[0].map((v) => v * mg), mix[1].map((v) => v * mg)];
    if (drive > 0) {
      const c = lin(peakDbtp - 0.3);
      const dg = lin(drive);
      const driven: Stereo = [y[0].map((v) => v * dg), y[1].map((v) => v * dg)];
      const gain = limiter(driven, c * lin(4.0), 0.004, 0.06);
      y = driven.map((ch) => ch.map((v, i) => c * Math.tanh((v * gain[i]!) / c))) as Stereo;
      const g2 = lin(peakDbtp - truePeakDb(y));
      y = [y[0].map((v) => v * g2), y[1].map((v) => v * g2)];
      let gmin = Infinity;
      let below = 0;
      for (const v of gain) {
        gmin = Math.min(gmin, v);
        if (v < 0.99) below++;
      }
      this.limitDb = -20 * Math.log10(gmin);
      this.limitedShare = below / gain.length;
    }
    if (this.afterDb && this.afterDb.length > 0) {
      const ts = this.afterDb.map((p) => p[0] - this.t0);
      const vs = this.afterDb.map((p) => Math.min(p[1], 0));
      for (let i = 0; i < this.n; i++) {
        const g = lin(interp(i / SR, ts, vs));
        y[0][i] = y[0][i]! * g;
        y[1][i] = y[1][i]! * g;
      }
    }
    return [fade(y[0], 0.02, 0.3), fade(y[1], 0.02, 0.3)];
  }
}

export { envPoints };
