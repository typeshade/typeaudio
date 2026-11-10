// Experiment 10, the first module: the definitions a sound is made from, on the CPU.
//
// A material answers a force. A body is a material with a size. A gesture is the shape of a force
// in time. A contact joins two bodies and one gesture. An effect is a node after a sound. A style
// is the ratio between what physics computes and what the drawing asks for.
//
// This file is a prototype in plain TypeScript. It is not the engine: no kind of `src/kinds/` uses
// it. Its physics is a first form, and each simplification is named where it is made. The writer
// cannot hear, so nothing here was checked by ear.

export const SAMPLE_RATE = 48000;

/** A material in physical units: stone is stone in any work. */
export interface Material {
  readonly name: string;
  /** kg/m³. */
  readonly density: number;
  /** Young's modulus, Pa. */
  readonly modulus: number;
  /** The loss factor: the share of the energy of a mode that is lost in one radian. */
  readonly loss: number;
  /** The pressure at which the material is crushed, Pa. It is torn apart at a tenth of it. */
  readonly strength: number;
  /** The size of the smallest piece it breaks into, metres. */
  readonly grain: number;
}

export const MATERIALS: Readonly<Record<string, Material>> = {
  stone: {
    name: 'stone',
    density: 2600,
    modulus: 50e9,
    loss: 0.03,
    strength: 100e6,
    grain: 0.02,
  },
  flesh: {
    name: 'flesh',
    density: 1050,
    modulus: 1e6,
    loss: 0.5,
    strength: 1e6,
    grain: 1,
  },
};

/** The speed of a wave along the material, m/s. */
export const waveSpeed = (m: Material): number => Math.sqrt(m.modulus / m.density);

/** A material with a size. A block is free; a slab is a wall or a floor, held at its edges. */
export interface Body {
  readonly material: Material;
  readonly form: 'block' | 'slab';
  /** Metres on three axes. The smallest axis of a slab is its thickness. */
  readonly size: readonly [number, number, number];
}

export const volume = (b: Body): number => b.size[0] * b.size[1] * b.size[2];
export const mass = (b: Body): number => volume(b) * b.material.density;
export const surface = (b: Body): number => {
  const [x, y, z] = b.size;
  if (b.form === 'slab') return (x * y * z) / Math.min(x, y, z);
  return 2 * (x * y + y * z + z * x);
};

/** The body at another size: every axis by one ratio. */
export const scaled = (b: Body, ratio: number): Body => ({
  ...b,
  size: [b.size[0] * ratio, b.size[1] * ratio, b.size[2] * ratio],
});

/** One partial of a body: where it lies, how fast it dies, how loud it answers a force. */
export interface Mode {
  readonly f: number;
  readonly tau: number;
  readonly gain: number;
}

/** A generator of numbers in [0, 1) from a seed (mulberry32). */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ModeOptions {
  readonly fmin?: number;
  readonly fmax?: number;
  /** The most modes a body keeps. More are thinned at random, and the rest carry their power. */
  readonly max?: number;
}

/**
 * The modes of a body.
 *
 * A slab bends as a thin plate held at its edges: f = (π/2)·K·((m/a)² + (n/b)²), K = 0.303·h·c.
 * A block is taken as a box of standing waves of two speeds, c and 0.6·c. Both are textbook first
 * forms, not a solution of the body. Stone is not even, so each mode moves by up to 6 %.
 * A mode dies in tau = 1 / (π·f·η), and the loss η grows with the frequency.
 */
export function modesOf(body: Body, seed: number, options: ModeOptions = {}): Mode[] {
  const fmin = options.fmin ?? 25;
  const fmax = options.fmax ?? 9000;
  const max = options.max ?? 400;
  const rnd = random(seed);
  const c = waveSpeed(body.material);
  const found: number[] = [];
  if (body.form === 'slab') {
    const sorted = [...body.size].sort((p, q) => p - q);
    const h = sorted[0]!;
    const a = sorted[2]!;
    const b = sorted[1]!;
    const k = (Math.PI / 2) * 0.303 * h * c;
    for (let m = 1; k * (m / a) ** 2 < fmax; m++)
      for (let n = 1; ; n++) {
        const f = k * ((m / a) ** 2 + (n / b) ** 2);
        if (f > fmax) break;
        if (f >= fmin) found.push(f);
      }
  } else {
    const [x, y, z] = body.size;
    for (const speed of [c, 0.6 * c]) {
      const top = (axis: number): number => Math.ceil((2 * axis * fmax) / speed);
      for (let i = 0; i <= top(x); i++)
        for (let j = 0; j <= top(y); j++)
          for (let l = 0; l <= top(z); l++) {
            if (i + j + l === 0) continue;
            const f = (speed / 2) * Math.hypot(i / x, j / y, l / z);
            if (f >= fmin && f <= fmax) found.push(f);
          }
    }
  }
  const keep = Math.min(1, max / Math.max(1, found.length));
  const power = Math.sqrt(1 / keep);
  // A small body moves little air at a low frequency: (k·a)², to 1.
  const radius = Math.cbrt(volume(body)) / 2;
  const area = surface(body);
  const moved = mass(body) / 4;
  const modes: Mode[] = [];
  for (const f0 of found) {
    const jitter = 1 + 0.12 * (rnd() - 0.5);
    const shape = 2 * rnd() - 1;
    if (rnd() >= keep) continue;
    const f = f0 * jitter;
    const eta = body.material.loss * (1 + f / 3000);
    const ka = (2 * Math.PI * f * radius) / 343;
    const air = body.form === 'slab' ? 1 : Math.min(1, ka * ka);
    modes.push({ f, tau: 1 / (Math.PI * f * eta), gain: (power * shape * air * area) / moved });
  }
  return modes.sort((p, q) => p.f - q.f);
}

/** What the drawing shows of a contact. A plan reads the force backwards from it. */
export type Result = 'mark' | 'crack' | 'break';

/** A later failure of the struck body, as the drawing times it. */
export interface Failure {
  /** Seconds after the contact. */
  readonly at: number;
  /** The share of the pieces that come off here, 0 to 1. */
  readonly share: number;
  /** How long the pieces keep coming, seconds. */
  readonly spread: number;
  /**
   * The force that this failure frees, over the force of the contact, 0 to 1. A body that is
   * cracked already tears at less than its strength.
   */
  readonly force: number;
}

export interface Contact {
  readonly striker: Body;
  readonly struck: Body;
  /** m/s, as the drawing shows it. */
  readonly speed: number;
  readonly result: Result;
  /**
   * The volume that the drawing shows as broken, m³. Physics crushes energy / strength, which is
   * litres where a drawing shows a wall that falls. The larger of the two breaks.
   */
  readonly broken?: number;
  readonly failures?: readonly Failure[];
}

/** What a contact computes before any sound: the numbers a report shows. */
export interface ContactNumbers {
  /** The momentum that changes hands, N·s. */
  readonly impulse: number;
  /** The energy of the striker, J. */
  readonly energy: number;
  /** The length of the contact that physics gives, seconds. */
  readonly physicalTime: number;
  /** The length of the contact that the result in the drawing asks for, seconds. */
  readonly time: number;
  /** The top of the force, N. */
  readonly force: number;
  /** The force the drawing asks for, over the force physics gives. 1 when they agree. */
  readonly exaggeration: number;
  /** The volume that the energy can crush, m³. */
  readonly crushed: number;
  /** The volume that breaks: the larger of `crushed` and what the drawing shows, m³. */
  readonly broken: number;
  /** The count of the pieces that break off. */
  readonly pieces: number;
  /** The share of the force that each body carries as a ring, 0 to 1. */
  readonly rings: readonly [striker: number, struck: number];
}

const POISSON = 0.25;
/** The mean of the cube of a piece's width over the smallest width, for the power law below. */
const MEAN_VOLUME = 19;
/** A piece is from 1 to 16 of the smallest width, and small pieces are many. */
const pieceWidth = (u: number): number => Math.min(16, (1 - u) ** -0.4);

/**
 * The numbers of a contact.
 *
 * The softer body sets the front: the time of a Hertz contact, 2.87·(m² / (R·E*²·v))^(1/5).
 * A pressure above the strength of the weaker body crushes it: the force stops at strength times
 * the face that touches, and the contact is longer. A result of `crack` or `break` that this
 * force cannot make is the drawing's word against physics. The drawing wins: the force is raised
 * to what breaks the struck body, the contact is shorter, and the ratio is reported.
 */
export function contactNumbers(contact: Contact): ContactNumbers {
  const { striker, struck, speed } = contact;
  const m = mass(striker);
  const radius = Math.cbrt(volume(striker)) / 2;
  const stiff = (b: Body): number => b.material.modulus / (1 - POISSON * POISSON);
  const estar = 1 / (1 / stiff(striker) + 1 / stiff(struck));
  const impulse = m * speed * 1.2;
  const energy = 0.5 * m * speed * speed;
  const hertz = 2.87 * ((m * m) / (radius * estar * estar * speed)) ** 0.2;
  const face = 0.5 * Math.PI * radius * radius;
  const weak = Math.min(striker.material.strength, struck.material.strength);
  const hertzForce = (Math.PI * impulse) / (2 * hertz);
  // The face that touches: a Hertz circle of radius² = R·depth, to half of the striker's face.
  const hertzArea = Math.min(face, Math.PI * radius * ((speed * hertz) / 2));
  // Crushing: a pressure above the strength of the weaker body crushes it. The energy crushes a
  // volume of energy / strength, and the face that carries the force is as wide as that volume.
  const crushArea = Math.min(face, 2 * (energy / weak) ** (2 / 3));
  const crushes = hertzForce / hertzArea > weak;
  const area = crushes ? crushArea : hertzArea;
  const physical = crushes ? weak * crushArea : hertzForce;
  const physicalTime = (Math.PI * impulse) / (2 * physical);
  let force = physical;
  if (contact.result !== 'mark') force = Math.max(force, struck.material.strength * area);
  const time = (Math.PI * impulse) / (2 * force);
  const pressure = force / area;
  // A body carries as a ring only the stress that it can bear, and a body that loses a fifth of
  // the energy of a mode in a radian has no ring.
  const carries = (b: Body): number =>
    b.material.loss >= 0.2 ? 0 : Math.min(1, b.material.strength / pressure);
  // The energy crushes a volume of energy / strength. The pieces follow a power law from a few
  // grains wide to sixteen times that, and their mean volume is about 19 of the smallest.
  // A body with no ring is not crushed into pieces: it gives way.
  const soft = Math.max(striker.material.loss, struck.material.loss) >= 0.2;
  const crushed = soft ? 0 : energy / weak;
  const broken = contact.result === 'mark' ? 0 : Math.max(crushed, contact.broken ?? 0);
  const pieces = Math.round(broken / (MEAN_VOLUME * (2 * struck.material.grain) ** 3));
  return {
    impulse,
    energy,
    physicalTime,
    time,
    force,
    exaggeration: force / physical,
    crushed,
    broken,
    pieces,
    rings: [carries(striker), carries(struck)],
  };
}

/** Adds the answer of a set of modes to a force into `out`. */
export function ring(force: Float32Array, modes: readonly Mode[], out: Float64Array): void {
  const n = force.length;
  let last = n - 1;
  while (last > 0 && force[last] === 0) last--;
  for (const mode of modes) {
    const end = Math.min(n, last + 1 + Math.ceil(10 * mode.tau * SAMPLE_RATE));
    const w = (2 * Math.PI * mode.f) / SAMPLE_RATE;
    const r = Math.exp(-1 / (mode.tau * SAMPLE_RATE));
    const a1 = 2 * r * Math.cos(w);
    const a2 = -r * r;
    let y1 = 0;
    let y2 = 0;
    let x1 = 0;
    for (let i = 0; i < end; i++) {
      const x = force[i]!;
      const y = a1 * y1 + a2 * y2 + (x - x1);
      out[i]! += mode.gain * y;
      y2 = y1;
      y1 = y;
      x1 = x;
    }
  }
}

export interface Rendered {
  /** The sound of the contact, mono, in units that hold between contacts. */
  readonly samples: Float32Array;
  readonly numbers: ContactNumbers;
}

/** The most pieces that are made one by one. More are made as fewer and louder. */
const PIECES = 6000;

/**
 * The sound of a contact: `seconds` long, with the contact at `lead` seconds.
 *
 * The force is one pulse of the length of the contact, and a click for each piece that breaks
 * off. Both bodies get the same force and answer with their own modes. A break is a pair of forces
 * inside a body, a few grains apart, and not a push from outside: it moves a mode only as far as
 * the pair is wide against the wave, 2π·s·f / c, so a break is weak at the bottom. A wall, a floor and a
 * block of metres are wide against the wave in air, so the air hears the speed of their surfaces.
 */
export function renderContact(
  contact: Contact,
  seconds: number,
  seed: number,
  lead = 0.01,
  parts: 'all' | 'pulse' | 'breaks' = 'all',
): Rendered {
  const numbers = contactNumbers(contact);
  const n = Math.round(seconds * SAMPLE_RATE);
  const force = new Float32Array(n);
  const breaks = new Float32Array(n);
  const rnd = random(seed);
  const at = Math.round(lead * SAMPLE_RATE);
  const pulse = (start: number, length: number, top: number): void => {
    const len = Math.max(2, Math.round(length * SAMPLE_RATE));
    // A pulse shorter than two samples keeps its momentum.
    const scale = Math.max(1, 2 / SAMPLE_RATE / length);
    for (let i = 0; i < len && start + i < n; i++)
      force[start + i]! += top * scale * Math.sin((Math.PI * (i + 0.5)) / len) ** 2;
  };
  pulse(at, numbers.time, numbers.force);
  const grain = contact.struck.material.grain;
  const strength = contact.struck.material.strength;
  // A force that crushes is not smooth. The face holds the force piece by piece: when a piece
  // fails, the force falls by what that piece held, and it comes back as the next piece takes the
  // load, in the time the striker needs to cross the piece.
  const span = Math.round(numbers.time * SAMPLE_RATE);
  const fails = Math.min(2000, Math.round(numbers.crushed / (2 * grain) ** 3));
  for (let k = 0; k < fails && span > 4; k++) {
    const start = at + Math.floor(rnd() * span);
    const size = Math.min(4, pieceWidth(rnd())) * 2 * grain;
    const held = Math.min(force[start]!, strength * size * size);
    const back = Math.max(2, (size / contact.speed) * SAMPLE_RATE);
    for (let i = 0; i < 6 * back && start + i < at + span; i++)
      force[start + i] = Math.max(0, force[start + i]! - held * Math.exp(-i / back));
  }

  const failures = contact.failures ?? [];
  const later = failures.reduce((sum, f) => sum + f.share, 0);
  const first: Failure = { at: 0, share: Math.max(0, 1 - later), spread: 0.06, force: 1 };
  const made = Math.min(PIECES, numbers.pieces);
  const louder = Math.sqrt(numbers.pieces / Math.max(1, made));
  // One piece is torn off: it frees a tenth of the strength over its own face, in the time a
  // crack needs to cross it. A crack runs at about 800 m/s. So a large piece is loud, long and low.
  const click = (strength / 10) * louder;
  for (const failure of [first, ...failures]) {
    if (failure.at > 0)
      pulse(at + Math.round(failure.at * SAMPLE_RATE), numbers.time, numbers.force * failure.force);
    const count = Math.round(made * failure.share);
    for (let k = 0; k < count; k++) {
      const t = lead + failure.at - failure.spread * Math.log(1 - rnd());
      const i = Math.round(t * SAMPLE_RATE);
      // Small pieces are many: the size of a piece follows a power law.
      const size = pieceWidth(rnd()) * 2 * grain;
      const len = Math.max(2, Math.round((size / 800) * SAMPLE_RATE));
      const top = (rnd() < 0.5 ? -1 : 1) * click * failure.force * size * size;
      for (let j = 0; j < len && i + j < n; j++)
        breaks[i + j]! += top * Math.sin((Math.PI * (j + 0.5)) / len) ** 2;
    }
  }

  const sum = new Float64Array(n);
  const [strikerShare, struckShare] = numbers.rings;
  const part = (body: Body, share: number, salt: number): void => {
    if (share <= 0) return;
    const modes = modesOf(body, seed + salt).map((mode) => ({ ...mode, gain: mode.gain * share }));
    if (parts !== 'breaks') ring(force, modes, sum);
    if (parts === 'pulse') return;
    const shear = 0.6 * waveSpeed(body.material);
    const wide = (f: number): number => Math.min(1, (2 * Math.PI * 4 * grain * f) / shear);
    ring(
      breaks,
      modes.map((mode) => ({ ...mode, gain: mode.gain * wide(mode.f) })),
      sum,
    );
  };
  part(contact.striker, strikerShare, 1);
  part(contact.struck, struckShare, 2);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = sum[i]!;
  return { samples, numbers };
}

// Effects: nodes after a sound.

/** Every frequency and every length by one ratio: a ratio under 1 is lower and longer. */
export function pitched(samples: Float32Array, ratio: number): Float32Array {
  const n = Math.floor(samples.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const k = Math.floor(x);
    const a = samples[k] ?? 0;
    const b = samples[k + 1] ?? a;
    out[i] = a + (b - a) * (x - k);
  }
  return out;
}

/** A soft limit that adds partials and average level. `drive` 0 leaves the sound as it is. */
export function saturated(samples: Float32Array, drive: number): Float32Array {
  if (drive <= 0) return samples.slice();
  const out = new Float32Array(samples.length);
  const top = Math.tanh(drive);
  for (let i = 0; i < samples.length; i++) out[i] = Math.tanh(samples[i]! * drive) / top;
  return out;
}

export interface Room {
  /** Seconds for the low part of the room to fall by 60 dB. */
  readonly decay: number;
  /** How much darker the room gets in each pass, 0 to 1. */
  readonly damping: number;
  /** The level of the room under the direct sound, dB. */
  readonly level: number;
}

export const ROOMS: Readonly<Record<string, Room>> = {
  hall: { decay: 2.4, damping: 0.35, level: -12 },
};

const LINES = [1447, 1789, 2083, 2399, 2731, 3089, 3433, 3767];

/** The room: eight delay lines that feed one another. Returns the left and the right of the room. */
export function roomOf(samples: Float32Array, room: Room): [Float32Array, Float32Array] {
  const n = samples.length;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const lines = LINES.map((len) => new Float32Array(len));
  const at = LINES.map(() => 0);
  const low = LINES.map(() => 0);
  const gain = LINES.map((len) => 10 ** ((-3 * len) / (room.decay * SAMPLE_RATE)));
  const wet = 10 ** (room.level / 20) / 2;
  const taps = new Float64Array(8);
  for (let i = 0; i < n; i++) {
    let total = 0;
    for (let k = 0; k < 8; k++) {
      const v = lines[k]![at[k]!]!;
      low[k] = v + room.damping * (low[k]! - v);
      taps[k] = low[k]! * gain[k]!;
      total += taps[k]!;
    }
    const mixed = total / 4;
    for (let k = 0; k < 8; k++) {
      lines[k]![at[k]!] = samples[i]! + taps[k]! - mixed;
      at[k] = (at[k]! + 1) % LINES[k]!;
    }
    left[i] = wet * (taps[0]! + taps[2]! + taps[4]! + taps[6]!);
    right[i] = wet * (taps[1]! + taps[3]! + taps[5]! + taps[7]!);
  }
  return [left, right];
}
