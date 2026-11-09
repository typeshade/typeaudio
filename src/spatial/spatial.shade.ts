'use typeshade';

// The spatial chain of one block (docs/sound-design-loop.md, "Spatial sound"), in the engine's loop
// shapes. Each event is a lane. `history` keeps the last 4,096 frames of every lane beside the
// block (shape F over a ping-pong pair), so that `place` reads the early reflections and the far
// ear as plain reads and writes only its own frames (shape V). `layers` sums the lanes of each
// layer (shape G), `strips` ducks and shelves each layer (shape V over the layers), and `sendSum`
// and `pack` close the block. The block is 1,024 frames, a module constant, so no loop reads a
// length it does not know (docs/compiler-asks.md, J).

/** The frames of a block. */
const BLOCK: u32 = 1024;
/** The frames of history kept before a block: 85 ms. `spatialOf` leaves out a reflection later than this. */
const HIST: u32 = 4096;
/** The frames one lane's history array holds: the history, then the block. */
const WIDTH: u32 = 5120;
/** The layers: dialogue, foley, effects, ambience, music. */
const LAYERS: u32 = 5;

/** One event's place in the scene: its gain, its filters, its pan, its taps and its layer. */
export class Spatial {
  /** The layer, 0 to 4. */
  layer: u32 = 0;
  /** The distance gain, linear: 1 at 2 m or less, then inverse distance. */
  g: f32 = 1;
  /** The air absorption: the fraction of its way the one-pole lowpass moves each frame. */
  kAir: f32 = 1;
  /** The air absorption's state. */
  zAir: f32 = 0;
  /** The equal-power pan gains of the left and right ears. */
  panL: f32 = 0.7071;
  panR: f32 = 0.7071;
  /** The reverb send's gain against the raw sound. */
  send: f32 = 0;
  /** The interaural delay of the far ear, in frames. */
  itd: u32 = 0;
  /** 1 when the left ear is the far one. */
  farLeft: u32 = 0;
  /** The head shadow: the far ear's one-pole lowpass, its coefficient and state. */
  kFar: f32 = 1;
  zFar: f32 = 0;
  /** The six early reflections: delay in frames and gain, linear. */
  d0: u32 = 1;
  r0: f32 = 0;
  d1: u32 = 1;
  r1: f32 = 0;
  d2: u32 = 1;
  r2: f32 = 0;
  d3: u32 = 1;
  r3: f32 = 0;
  d4: u32 = 1;
  r4: f32 = 0;
  d5: u32 = 1;
  r5: f32 = 0;

  /** The direct sound: the distance gain, then the air's one-pole lowpass. */
  direct(x: f32): f32 {
    this.zAir = this.zAir + this.kAir * (x * this.g - this.zAir);
    return this.zAir;
  }

  /** The far ear: the distance gain, then the head shadow's one-pole lowpass. */
  shadow(x: f32): f32 {
    this.zFar = this.zFar + this.kFar * (x * this.g - this.zFar);
    return this.zFar;
  }
}

/**
 * Moves every lane's history one block on: `next[v * 5120 + k]` is `prev[v * 5120 + k + 1,024]`
 * for the first 4,096 frames of a lane, and the lane's frame `k + 1,024 - 5,120` of `fresh` (the
 * block `cues` wrote, `v * 1,024 + n`) for the last 1,024. Call it with the pair swapped each block.
 */
export function history(next: array<f32>, prev: array<f32>, fresh: array<f32>) {
  for (let i: u32 = 0; i < next.length; i++) {
    const v = i / WIDTH;
    const k = i % WIDTH;
    if (k < HIST) {
      next[i] = prev[v * WIDTH + k + BLOCK];
    } else {
      next[i] = fresh[v * BLOCK + k - HIST];
    }
  }
}

/**
 * The chain for every lane, frame by frame: the distance gain and the air's lowpass; the pan, equal
 * power; with `binaural` 1, the far ear delayed by `itd` frames through the head shadow; six early
 * reflections read from the history, alternating between the two ears; and the reverb send, the raw
 * sound times `send`. Lane `v` writes `outL`, `outR` and `send` at `v * 1,024 + n`.
 */
export function place(
  outL: array<f32>,
  outR: array<f32>,
  send: array<f32>,
  hist: array<f32>,
  lanes: array<Spatial>,
  binaural: u32,
) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    const base = v * WIDTH + HIST;
    for (let n: u32 = 0; n < BLOCK; n++) {
      const x = hist[base + n];
      const near = lanes[v].direct(x);
      let l = near * lanes[v].panL;
      let r = near * lanes[v].panR;
      if (binaural == 1) {
        const far = lanes[v].shadow(hist[base + n - lanes[v].itd]);
        if (lanes[v].farLeft == 1) {
          l = far * lanes[v].panL;
        } else {
          r = far * lanes[v].panR;
        }
      }
      const left =
        hist[base + n - lanes[v].d0] * lanes[v].r0 +
        hist[base + n - lanes[v].d2] * lanes[v].r2 +
        hist[base + n - lanes[v].d4] * lanes[v].r4;
      const right =
        hist[base + n - lanes[v].d1] * lanes[v].r1 +
        hist[base + n - lanes[v].d3] * lanes[v].r3 +
        hist[base + n - lanes[v].d5] * lanes[v].r5;
      const g = lanes[v].g;
      outL[v * BLOCK + n] = l + g * (left * 0.8 + right * 0.45);
      outR[v * BLOCK + n] = r + g * (left * 0.45 + right * 0.8);
      send[v * BLOCK + n] = x * lanes[v].send;
    }
  }
}

/**
 * Sums the lanes of each layer: frame `n` of layer `l` in `outL`, `outR` and `outS` (at
 * `i = l * 1,024 + n`, the lane's own index) is the sum, in lane order, of the lanes whose `layer` is `l`.
 */
export function layers(
  outL: array<f32>,
  outR: array<f32>,
  outS: array<f32>,
  inL: array<f32>,
  inR: array<f32>,
  inS: array<f32>,
  lanes: array<Spatial>,
) {
  for (let i: u32 = 0; i < outL.length; i++) {
    const l = i / BLOCK;
    const n = i % BLOCK;
    let sl = 0;
    let sr = 0;
    let ss = 0;
    for (let v: u32 = 0; v < lanes.length; v++) {
      if (lanes[v].layer == l) {
        sl += inL[v * BLOCK + n];
        sr += inR[v * BLOCK + n];
        ss += inS[v * BLOCK + n];
      }
    }
    outL[i] = sl;
    outR[i] = sr;
    outS[i] = ss;
  }
}

/** A one-pole shelf: the lowpass part times `lo` plus the rest times `hi`. */
export class Shelf {
  z: f32 = 0;
  /** The fraction of its way the lowpass moves each frame. */
  k: f32 = 0.1;
  lo: f32 = 1;
  hi: f32 = 1;

  /** One sample. */
  tick(x: f32): f32 {
    this.z = this.z + this.k * (x - this.z);
    return this.lo * this.z + this.hi * (x - this.z);
  }
}

/**
 * The guards of one layer: a ducker that follows a sidechain and pulls the layer down by `depth`
 * (a linear gain, 1 for none) once the sidechain passes `thr`, and the layer's shelf, its slot of the spectrum.
 */
export class Strip {
  /** The sidechain follower's state. */
  env: f32 = 0;
  /** The follower's attack and release, the fraction of its way it moves each frame. */
  atk: f32 = 0.01;
  rel: f32 = 0.0001;
  /** The gain at full ducking, linear. */
  depth: f32 = 1;
  /** The sidechain level at which ducking is full. */
  thr: f32 = 0.05;
  left: Shelf = new Shelf();
  right: Shelf = new Shelf();
  sendBus: Shelf = new Shelf();

  /** The gain for one frame of the sidechain level `sc`. */
  duck(sc: f32): f32 {
    const a = abs(sc);
    let c = this.rel;
    if (a > this.env) {
      c = this.atk;
    }
    this.env = this.env + c * (a - this.env);
    return 1 + (this.depth - 1) * min(this.env / this.thr, 1);
  }
}

/**
 * The guards for every layer, lane `l` being layer `l`: the sidechain is layer 0, dialogue, before
 * its own guards (`inL[n] + inR[n]`, read apart from the lane's own frames); each layer's frames
 * pass through its shelf and are scaled by its ducking gain and by `gain`, the host's gain for the
 * frame (`gain[l * 1,024 + n]`, linear: the pre-impact ducking of `src/spatial/duck.ts`, 1 for none).
 * Dialogue's `depth` is 1.
 */
export function strips(
  outL: array<f32>,
  outR: array<f32>,
  outS: array<f32>,
  inL: array<f32>,
  inR: array<f32>,
  inS: array<f32>,
  gain: array<f32>,
  bank: array<Strip>,
) {
  for (let l: u32 = 0; l < bank.length; l++) {
    for (let n: u32 = 0; n < BLOCK; n++) {
      const g = bank[l].duck(abs(inL[n]) + abs(inR[n]));
      const h = g * gain[l * BLOCK + n];
      outL[l * BLOCK + n] = bank[l].left.tick(inL[l * BLOCK + n]) * h;
      outR[l * BLOCK + n] = bank[l].right.tick(inR[l * BLOCK + n]) * h;
      outS[l * BLOCK + n] = bank[l].sendBus.tick(inS[l * BLOCK + n]) * h;
    }
  }
}

/** The reverb's input: the sum over the layers of their sends, `out[n]`. */
export function sendSum(out: array<f32>, inS: array<f32>) {
  for (let n: u32 = 0; n < BLOCK; n++) {
    let s = 0;
    for (let l: u32 = 0; l < LAYERS; l++) {
      s += inS[l * BLOCK + n];
    }
    out[n] = s;
  }
}

/**
 * Packs a block for one read: rows of 1,024 frames, 0 to 4 the layers' left channels, 5 to 9
 * their right channels, 10 and 11 the reverb's left and right.
 */
export function pack(out: array<f32>, stemL: array<f32>, stemR: array<f32>, wet: array<f32>) {
  for (let i: u32 = 0; i < out.length; i++) {
    const row = i / BLOCK;
    const n = i % BLOCK;
    if (row < 5) {
      out[i] = stemL[row * BLOCK + n];
    } else if (row < 10) {
      out[i] = stemR[(row - 5) * BLOCK + n];
    } else {
      out[i] = wet[(row - 10) * BLOCK + n];
    }
  }
}
