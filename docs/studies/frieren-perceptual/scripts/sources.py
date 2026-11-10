"""Sound sources of the study, each derived from a physical or a psychoacoustic model."""
import numpy as np
import dsp
from dsp import SR, nsamp, lin

G = 9.81


def norm(x):
    return x / (np.abs(x).max() + 1e-12)


# ---- the hall's own noise: diffuse, band-limited pink, breathing slowly
def hall_air(dur, seed):
    n = nsamp(dur)
    ch = []
    for c in range(2):
        x = dsp.pink(n, seed + c)
        ch.append(dsp.spectral(x, lambda f: dsp.band_gain(f, 70, 1800, 1)))
    y = np.stack(ch, 1)
    m = dsp.smooth(dsp.white(n, seed + 7), 2.5)
    y *= lin(1.5 * m / (np.abs(m).max() + 1e-9))[:, None]
    return y / np.sqrt((y ** 2).mean())


# ---- cloth: many small stick-slip events whose rate follows the motion
def cloth(dur, seed, density=320, f_lo=1200, f_hi=6500):
    n = nsamp(dur)
    r = dsp.rng(seed)
    arc = np.sin(np.pi * (np.arange(n) + 0.5) / n) ** 1.5
    cdf = np.cumsum(arc); cdf /= cdf[-1]
    times = np.interp(np.sort(r.random(r.poisson(density * dur * 0.6))), cdf, np.arange(n) / SR)
    y = np.zeros(n)
    for t0 in times:
        L = nsamp(r.uniform(0.002, 0.009))
        fc = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
        tt = np.arange(L) / SR
        k = (0.6 * np.sin(2 * np.pi * fc * tt + r.uniform(0, 6.28)) + 0.4 * r.standard_normal(L)) * dsp.hann(L) * r.exponential(1.0)
        s = nsamp(t0); e = min(n, s + L)
        y[s:e] += k[: e - s]
    y = dsp.spectral(y, lambda f: dsp.band_gain(f, f_lo * 0.7, f_hi * 1.2, 2))
    return norm(y * arc ** 0.5)


# ---- brittle fracture: a main crack and an avalanche of smaller ones (rate k/(t+c), power-law sizes)
def fracture(seed, f_lo, f_hi, loss, dur=0.5, n_modes=90, k_rate=12.0, c=0.012, hard=0.00015, tilt=0.5, burst=0.9):
    r = dsp.rng(seed)
    fm = np.exp(r.uniform(np.log(f_lo), np.log(f_hi), n_modes))
    taus = dsp.tau_of(fm, loss)
    n = nsamp(dur)
    y = np.zeros(n)
    y += norm(dsp.modal(fm, r.uniform(0.3, 1, n_modes) * (f_lo / fm) ** tilt, taus, dur))
    nb = nsamp(0.03)
    tb = np.arange(nb) / SR
    bn = dsp.spectral(r.standard_normal(nb) * np.exp(-tb / 0.003), lambda f: dsp.band_gain(f, f_lo, f_hi, 2) * (f_lo / np.maximum(f, f_lo)) ** tilt)
    y[:nb] += burst * norm(bn)
    span = dur * 0.8
    count = r.poisson(k_rate * np.log(1 + span / c))
    times = c * ((1 + span / c) ** r.random(count) - 1)
    amin = 0.05
    amps = amin / (1 - r.random(count) * (1 - amin))
    for t0, a in zip(times, amps):
        fe = np.exp(r.uniform(np.log(f_lo), np.log(f_hi), 5))
        k = dsp.modal(fe, a * r.uniform(0.3, 1, 5) * (f_lo / fe) ** tilt, dsp.tau_of(fe, loss), min(dur - t0, 0.25))
        s = nsamp(t0)
        y[s: s + len(k)] += k[: n - s]
    y = norm(dsp.contact(y, hard))
    return np.tanh(2.0 * y) / 2.0            # a crack is dense, not one needle: bound its crest


# ---- aerodynamic noise of a moving body: band limit and level follow the speed (power ~ U^6)
def aero(speed, seed, u0=10.0, k_fc=55.0, fmin=120.0, fmax=5000.0, cap=4.0):
    n = len(speed)
    w = dsp.white(n, seed)

    def g(tf, fr):
        u = np.interp(tf, np.arange(n) / SR, speed)
        fc = np.clip(k_fc * u, fmin, fmax)[:, None]
        amp = np.minimum((u / u0) ** 3, cap)[:, None]
        return amp / np.sqrt(1 + (fr[None, :] / fc) ** 4) / np.sqrt(1 + (60.0 / np.maximum(fr[None, :], 1)) ** 4)

    return dsp.stft_shape(w, g)


# ---- fine dry grains: dust, sand, the last remnants
def sand(dur, seed, rate0=2500.0, tau=0.8, f_lo=2500.0, f_hi=9000.0):
    r = dsp.rng(seed)
    n = nsamp(dur)
    count = r.poisson(rate0 * tau * (1 - np.exp(-dur / tau)))
    times = -tau * np.log(1 - r.random(count) * (1 - np.exp(-dur / tau)))
    y = np.zeros(n)
    L = nsamp(0.0015)
    tt = np.arange(L) / SR
    for t0 in times:
        f = np.exp(r.uniform(np.log(f_lo), np.log(f_hi)))
        k = np.sin(2 * np.pi * f * tt + r.uniform(0, 6.28)) * np.exp(-tt / 0.0004) * r.exponential(1.0)
        s = nsamp(t0); e = min(n, s + L)
        y[s:e] += k[: e - s]
    return norm(y)


def wide_noise(dur, seed, lo, hi, order=2, pinkish=True):
    n = nsamp(dur)
    ch = []
    for c in range(2):
        x = dsp.white(n, seed + c)
        x = dsp.spectral(x, lambda f: dsp.band_gain(f, lo, hi, order) / (np.sqrt(np.maximum(f, 50.0)) if pinkish else 1.0))
        ch.append(x / np.sqrt((x ** 2).mean()))
    return np.stack(ch, 1)


def saturate(x, drive=2.2):
    """Soft clip of a hit normalised to its peak: the peak falls about 7 dB against the small-signal gain."""
    y = norm(x)
    return np.tanh(drive * y) / drive


# ================================================================ round 2: what the first listening review changed
# The owner heard a distant helicopter, bouncing thumps and squelching water. The causes were measured
# (analyze.mod_peak, tonal_share, blip_share): a periodic amplitude modulation, impacts made of a few
# sine modes with regular bounces, and short pitched grains. The sources below avoid each of them.

def irregular(n, seed, lo=10.0, hi=90.0):
    """A modulator with no period: band-limited noise, unit deviation, clipped to +-1.5 and scaled to +-1."""
    m = dsp.spectral(dsp.white(n, seed), lambda f: dsp.band_gain(f, lo, hi, 2))
    m = m / (m.std() + 1e-12)
    return np.clip(m, -1.5, 1.5) / 1.5


def red_material(n, tension, seed):
    """The red material without a rotor: a low rumble, a roar whose band narrows and rises with the
    tension, and a crackling surface. Every modulation is irregular. tension is an array in 0..1."""
    t = np.arange(n) / SR
    depth = 0.5 + 0.35 * tension
    shared = irregular(n, seed + 20)
    m1 = 1 + depth * (0.6 * shared + 0.4 * irregular(n, seed + 21))
    m2 = 1 + depth * (0.6 * shared + 0.4 * irregular(n, seed + 22, 15, 120))
    rumble = dsp.spectral(dsp.pink(n, seed), lambda f: dsp.band_gain(f, 38, 150, 2))
    rumble = rumble / np.sqrt((rumble ** 2).mean()) * m1

    def g(tf, fr):
        ten = np.interp(tf, t, tension)
        fc = (480 * (1100 / 480) ** ten)[:, None]
        wd = (1.1 - 0.7 * ten)[:, None]
        return np.exp(-0.5 * (np.log2(np.maximum(fr[None, :], 1) / fc) / wd) ** 2)

    roar = dsp.stft_shape(dsp.white(n, seed + 1), g)
    roar = roar / np.sqrt((roar ** 2).mean()) * m2
    r = dsp.rng(seed + 2)
    lam = (250 + 650 * tension) / SR
    hits = r.random(n) < lam
    cr = np.where(hits, r.uniform(0.4, 1.0, n) * r.choice([-1.0, 1.0], n), 0.0)
    cr = dsp.spectral(cr, lambda f: dsp.band_gain(f, 2200, 9000, 2))
    crackle = cr / (np.sqrt((cr ** 2).mean()) + 1e-12) * (1 + 0.5 * irregular(n, seed + 23, 2, 12))
    return rumble, roar, crackle


def burst(seed, lo, hi, tau, dur=None, rise=0.0005, order=2):
    """A noise burst between lo and hi Hz with an exponential decay: an impact with no pitch."""
    dur = dur or tau * 8
    n = nsamp(dur)
    t = np.arange(n) / SR
    x = dsp.spectral(dsp.white(n + nsamp(0.05), seed)[: n + nsamp(0.05)], lambda f: dsp.band_gain(f, lo, hi, order))[:n]
    e = np.exp(-t / tau)
    k = max(2, nsamp(rise))
    e[:k] *= 0.5 - 0.5 * np.cos(np.pi * (np.arange(k) + 0.5) / k)
    return norm(x * e)


def whump(seed, tplus=0.0035, dur=0.5):
    """An overpressure with no pitch: the Friedlander pulse (one cycle), a low noise body, a mid slap."""
    front = dsp.friedlander(dur, tplus)
    low = np.zeros(nsamp(dur)); k = burst(seed, 35, 130, 0.045, rise=0.002); low[: len(k)] = k[: len(low)]
    slap = np.zeros(nsamp(dur)); k = burst(seed + 1, 250, 2600, 0.016); slap[: len(k)] = k[: len(slap)]
    return front, low, slap


def stone_impact(a, v, r):
    """A fragment of radius a landing at speed v: a clack around ka = 1 (wide, so it has no pitch),
    a low noise thud that grows with the size, and a hard bright tick."""
    fpk = min(54.6 / a, 6000.0)
    seed = int(r.integers(1, 2 ** 31 - 1))
    clack = burst(seed, 0.5 * fpk, 2.6 * fpk, 0.004 + 0.03 * a)
    thud = burst(seed + 1, 55, 320, 0.02 + 0.08 * a, rise=0.002 + 0.01 * a)
    tick = burst(seed + 2, 2200, 8000, 0.0009, dur=0.006)
    n = max(len(clack), len(thud))
    y = np.zeros(n)
    y[: len(clack)] += clack
    y[: len(thud)] += thud * (a / 0.1) ** 2
    y[: len(tick)] += tick * 0.5 * (1 + (a / 0.1) ** 2) * min(1.0, v / 6.0)
    return y * a ** 1.5 * v


def rock_fall(a, h, seed):
    """A fragment that lands on rubble: one impact, sometimes one more contact as it tumbles, and a
    scatter of small pieces. No train of bounces: rock on rubble does not bounce like a ball."""
    r = dsp.rng(seed)
    v = np.sqrt(2 * G * h)
    y = np.zeros(nsamp(0.9))

    def put(k, t0):
        s = nsamp(t0)
        e = min(len(y), s + len(k))
        if e > s:
            y[s:e] += k[: e - s]

    put(stone_impact(a, v, r), 0.0)
    if r.random() < 0.5:
        put(stone_impact(a * r.uniform(0.5, 0.8), v * r.uniform(0.2, 0.4), r), r.uniform(0.08, 0.26))
    for _ in range(r.poisson(4 + 30 * a)):
        t0 = 0.03 + r.exponential(0.11)
        put(stone_impact(r.uniform(0.008, 0.03), v * r.uniform(0.1, 0.35) * np.exp(-t0 / 0.2), r), t0)
    return y


def dissolve_dry(dur, seed):
    """Matter that leaves as dust and thin threads, with nothing wet in it: a breath of high noise whose
    lower edge rises, a few thin tones that fade one by one, and sparse dry ticks above 4 kHz."""
    n = nsamp(dur)
    t = np.arange(n) / SR
    r = dsp.rng(seed)

    def g(tf, fr):
        lo = np.interp(tf, [0, dur], [1800, 5200])[:, None]
        return 1 / np.sqrt(1 + (lo / np.maximum(fr[None, :], 1)) ** 6) / np.sqrt(1 + (fr[None, :] / 11000.0) ** 4)

    breath = dsp.stft_shape(dsp.white(n, seed), g)
    sl = dsp.smooth(dsp.white(n, seed + 1), 0.15)
    breath = breath / np.sqrt((breath ** 2).mean()) * np.exp(-t / 0.7) * lin(2.0 * sl / (np.abs(sl).max() + 1e-12))
    threads = np.zeros(n)
    for f0 in (1530.0, 2040.0, 2720.0, 3460.0, 4580.0):
        t0 = r.uniform(0.0, 0.35)
        tau = r.uniform(0.25, 0.6)
        att = r.uniform(0.08, 0.15)
        s = nsamp(t0)
        tt = np.arange(n - s) / SR
        fr = f0 * (1 + 0.03 * np.minimum(tt / 1.2, 1.0))
        ph = 2 * np.pi * np.cumsum(fr) / SR
        env = (1 - np.exp(-tt / (att / 3))) * np.exp(-tt / tau)
        threads[s:] += (np.sin(ph + r.uniform(0, 6.28)) + np.sin(ph * 1.0017 + r.uniform(0, 6.28))) * 0.5 * env * r.uniform(0.6, 1.0)
    cnt = r.poisson(40 * 0.5 * (1 - np.exp(-dur / 0.5)))
    times = -0.5 * np.log(1 - r.random(cnt) * (1 - np.exp(-dur / 0.5)))
    ticks = np.zeros(n)
    for t0 in times:
        k = burst(int(r.integers(1, 2 ** 31 - 1)), 4500, 12000, 0.0005, dur=0.004) * r.exponential(1.0)
        s = nsamp(t0); e = min(n, s + len(k))
        ticks[s:e] += k[: e - s]
    return breath, norm(threads), norm(ticks)


# ================================================================ round 3: sources for what the picture shows

def band_sweep(dur, seed, f0, f1, width_oct=0.9, attack=0.3, wide=False):
    """A swish: noise whose band moves from f0 to f1 Hz, with a bell-shaped level (peak at `attack` of dur)."""
    n = nsamp(dur)
    t = np.arange(n) / SR

    def g(tf, fr):
        u = np.clip(tf / dur, 0, 1)
        fc = (f0 * (f1 / f0) ** u)[:, None]
        return np.exp(-0.5 * (np.log2(np.maximum(fr[None, :], 1) / fc) / width_oct) ** 2)

    u = t / dur
    env = np.where(u < attack, np.sin(0.5 * np.pi * u / attack) ** 2, np.cos(0.5 * np.pi * (u - attack) / (1 - attack)) ** 2)
    if wide:
        y = np.stack([dsp.stft_shape(dsp.white(n, seed + c), g) for c in range(2)], axis=1)
        return y / np.sqrt((y ** 2).mean()) * env[:, None]
    y = dsp.stft_shape(dsp.white(n, seed), g)
    return y / np.sqrt((y ** 2).mean()) * env


def sizzle(dur, seed, tau, rate=900.0, f_lo=3000.0, f_hi=11000.0):
    """Sparks: a dense crackle above 3 kHz that dies away."""
    r = dsp.rng(seed)
    n = nsamp(dur)
    t = np.arange(n) / SR
    hits = r.random(n) < rate * np.exp(-t / tau) / SR
    x = np.where(hits, r.uniform(0.3, 1.0, n) * r.choice([-1.0, 1.0], n), 0.0)
    x = dsp.spectral(x, lambda f: dsp.band_gain(f, f_lo, f_hi, 2))
    return norm(x)


def tumble(dur, seed, rate, sizes=(0.1, 0.3), speed=(3.0, 8.0), scatter=False):
    """Stone blocks that fall over and onto one another: impacts at random times. rate(t) is impacts a second."""
    r = dsp.rng(seed)
    n = nsamp(dur)
    y = np.zeros(n + nsamp(0.6))
    t = 0.0
    rmax = max(rate(u) for u in np.linspace(0, dur, 50))
    while True:
        t += r.exponential(1.0 / rmax)
        if t >= dur:
            break
        if r.random() > rate(t) / rmax:
            continue
        a = np.exp(r.uniform(np.log(sizes[0]), np.log(sizes[1])))
        k = stone_impact(a, r.uniform(*speed), r)
        s = nsamp(t)
        y[s: s + len(k)] += k[: len(y) - s]
    return y[:n + nsamp(0.4)]


def gravel(dur, seed, lo=300.0, hi=3500.0):
    """Crumbling stone: mid-band noise with an irregular, fast flutter."""
    n = nsamp(dur)
    x = dsp.spectral(dsp.white(n, seed), lambda f: dsp.band_gain(f, lo, hi, 2))
    m = 0.55 + 0.45 * irregular(n, seed + 1, 8, 60)
    return x / np.sqrt((x ** 2).mean()) * np.maximum(m, 0.05)


def wind(dur, seed, lo=250.0, hi=3000.0):
    """Wind in hair and cloth after a blast: wide noise in slow, irregular gusts."""
    n = nsamp(dur)
    ch = []
    for c in range(2):
        x = dsp.spectral(dsp.pink(n, seed + c), lambda f: dsp.band_gain(f, lo, hi, 2))
        ch.append(x / np.sqrt((x ** 2).mean()))
    g = dsp.smooth(dsp.white(n, seed + 5), 0.5)
    g = g / (np.abs(g).max() + 1e-12)
    return np.stack(ch, 1) * lin(4.0 * g)[:, None]


# ================================================================ round 4: more kinds of sound at once
# The owner heard round 3 as flat, one sound at a time. Measured: 80 to 93 % of the energy of nearly every
# section was noise. The sources below add the two other kinds: tones that last and sharp moments.
# What the earlier rounds taught still holds: no periodic amplitude modulation (a rotor), no low
# decaying tone in an impact (a drum), no short pitched grains (water).

def voice(dur, seed, freqs, wander=0.012, rate=4.0, tilt=0.7, breath=0.35):
    """A tone that lasts: a cluster of partials, each with its own slow, irregular drift of pitch and level.
    No partial has a period in its level."""
    r = dsp.rng(seed)
    n = nsamp(dur)
    y = np.zeros(n)
    for i, f in enumerate(freqs):
        w = dsp.spectral(dsp.white(n, seed + 31 * (i + 1)), lambda q: dsp.band_gain(q, 0.2, rate, 1))
        w = w / (w.std() + 1e-12)
        ph = 2 * np.pi * np.cumsum(f * (1 + wander * w)) / SR
        a = dsp.spectral(dsp.white(n, seed + 57 * (i + 1)), lambda q: dsp.band_gain(q, 0.1, 2.0, 1))
        a = 1 + breath * a / (np.abs(a).max() + 1e-12)
        y += a * np.sin(ph + r.uniform(0, 6.28)) / (i + 1) ** tilt
    return norm(y)


def glide(dur, seed, f0, f1, ratios=(1.0, 1.5, 2.0), wander=0.006, shape=1.0, tilt=0.8):
    """A cluster whose pitch moves from f0 to f1 Hz over the whole duration (not a blip: use it for 0.4 s or more)."""
    r = dsp.rng(seed)
    n = nsamp(dur)
    u = (np.arange(n) / n) ** shape
    base = f0 * (f1 / f0) ** u
    y = np.zeros(n)
    for i, q in enumerate(ratios):
        w = dsp.spectral(dsp.white(n, seed + 13 * (i + 1)), lambda z: dsp.band_gain(z, 0.3, 5.0, 1))
        w = w / (w.std() + 1e-12)
        y += np.sin(2 * np.pi * np.cumsum(base * q * (1 + wander * w)) / SR + r.uniform(0, 6.28)) / (i + 1) ** tilt
    return norm(y)


def pops(dur, seed, rate, f_lo=2000.0, f_hi=8000.0, tau=0.0012):
    """Separate sharp pops at random times (sparks that fly off): each a few milliseconds, no pitch."""
    r = dsp.rng(seed)
    n = nsamp(dur)
    y = np.zeros(n)
    t = r.exponential(1.0 / rate)
    L = nsamp(tau * 8)
    tt = np.arange(L) / SR
    while t < dur:
        k = r.standard_normal(L) * np.exp(-tt / tau) * r.uniform(0.35, 1.0)      # bounded: one rare large pop must not set the peak of the mix
        s = nsamp(t)
        e = min(n, s + L)
        y[s:e] += k[: e - s]
        t += r.exponential(1.0 / rate)
    return norm(dsp.spectral(y, lambda f: dsp.band_gain(f, f_lo, f_hi, 2)))


def slap(sig, cutoff=1800.0):
    """What comes back from a far wall: the same sound, duller."""
    return dsp.lp(np.concatenate([sig, np.zeros(nsamp(0.05))]), cutoff)


# ================================================================ round 5: the size of things
# The owner heard round 4 as glass marbles: too light, the ice above all. Measured: the sharp and the
# pitched parts of the ice lay near 1.1 to 1.7 kHz. A body speaks near ka = 1, which is 54.6 / a Hz for a
# radius of a metres, so that is a body of 3 to 5 cm; the picture shows slabs of several metres. From here
# every solid thing has a size in metres, and its sound starts near 54.6 / size Hz. Nothing rings: a large,
# cracked or rough body is heavily damped.

def tilted_burst(seed, lo, hi, tau, tilt=0.8, dur=None, rise=0.0005):
    """A noise burst between lo and hi Hz whose spectrum falls toward the top (amplitude ~ f^-tilt)."""
    dur = dur or tau * 8
    n = nsamp(dur)
    t = np.arange(n) / SR
    x = dsp.spectral(dsp.white(n + nsamp(0.05), seed), lambda f: dsp.band_gain(f, lo, hi, 2) * (lo / np.maximum(f, lo)) ** tilt)[:n]
    e = np.exp(-t / tau)
    k = max(2, nsamp(rise))
    e[:k] *= 0.5 - 0.5 * np.cos(np.pi * (np.arange(k) + 0.5) / k)
    return norm(x * e)


def heavy_crack(seed, size=0.5, dur=0.5, k_rate=10.0, loss=0.03, bright=0.5):
    """A crack through a thick solid of about `size` metres (a slab of ice, a block of stone): a low knock
    of noise around ka = 1 whose band and length follow the size, a dense fracture above it whose modes are
    damped so that nothing rings, and a short dry edge. The low part is noise, not modes: no drum."""
    fk = 54.6 / size
    top = min(700.0, max(250.0, 2.6 * fk))                 # the knock is noise up to here (three octaves, so no pitch); the modes start here
    body = fracture(seed, top, 5000.0, loss, dur=dur, k_rate=k_rate, tilt=0.6, hard=0.0004)
    knock = burst(seed + 1, max(28.0, 0.5 * fk), top, 0.04 + 0.1 * min(size, 2.0), rise=0.003)
    edge = tilted_burst(seed + 2, 900.0, 7000.0, 0.012, tilt=0.5)      # the dry edge of the crack: noise, no pitch
    y = np.zeros(max(len(body), len(knock)))
    y[: len(body)] += body
    y[: len(knock)] += 0.7 * knock
    y[: len(edge)] += bright * edge
    return norm(y)


def stone_crack(r, size=0.3, bright=0.4):
    """A small crack in stone: a noise burst from ka = 1 of the piece up to 4.5 kHz that falls toward the
    top, a low knock under it, a short dry edge."""
    fk = 54.6 / size
    seed = int(r.integers(1, 2 ** 31 - 1))
    top = tilted_burst(seed, max(80.0, fk), 4500.0, 0.008 + 0.03 * size)
    knock = burst(seed + 1, max(35.0, 0.5 * fk), min(700.0, 2.6 * fk), 0.02 + 0.1 * size, rise=0.002)
    edge = burst(seed + 2, 1500.0, 7000.0, 0.003, dur=0.02)
    y = np.zeros(max(len(top), len(knock)))
    y[: len(top)] += top
    y[: len(knock)] += 1.2 * knock
    y[: len(edge)] += bright * edge
    return norm(y)


def groan(dur, seed, r_lo=110.0, r_hi=240.0, res=(140.0, 260.0, 470.0), jitter=0.25, q=2.5):
    """A large solid under stress: stick and slip. The slips come at a rate that wanders between r_lo and
    r_hi a second, each interval is drawn (no period), and each slip excites wide low resonances."""
    r = dsp.rng(seed)
    n = nsamp(dur)
    path = r_lo * (r_hi / r_lo) ** (0.5 + 0.5 * irregular(n, seed + 1, 0.7, 5.0))
    y = np.zeros(n + nsamp(0.1))
    t = r.uniform(0, 0.01)
    while t < dur:
        i = min(n - 1, nsamp(t))
        y[i] += r.uniform(0.4, 1.0)
        t += (1.0 / path[i]) * (1 + jitter * r.uniform(-1, 1))
    out = sum(dsp.bp(y, f, q) / (k + 1) ** 0.5 for k, f in enumerate(res))
    return norm(dsp.fade(out, 0.03, 0.08))


def crush(dur, seed, tau, lo=700.0, hi=6000.0):
    """Ice or stone that is crushed: dense noise with a fast, irregular flutter and a decay. It gives a
    crack its brightness with no pitch, so it speaks of no small ringing body."""
    n = nsamp(dur)
    x = dsp.spectral(dsp.white(n, seed), lambda f: dsp.band_gain(f, lo, hi, 2) * (lo / np.maximum(f, lo)) ** 0.4)
    m = 0.5 + 0.5 * irregular(n, seed + 1, 15, 90)
    e = np.exp(-np.arange(n) / (tau * SR))
    k = nsamp(0.003)
    e[:k] *= np.linspace(0, 1, k)
    return norm(x * np.maximum(m, 0.05) * e)


# ================================================================ round 6: the beam as turbulence
# The owner heard the beam of round 5 as artificial and its firing as light. The original sound of the
# reference was measured as a reference (no sample of it is used). Its beam is 88 to 91 % noise with no steady
# line. Its third-octave levels are flat from 80 to 800 Hz and fall above 1 kHz. Its level in 50 ms blocks
# varies by 2.3 dB below 120 Hz, 1.1 dB from 200 to 1000 Hz and 3.0 dB from 2 to 8 kHz. The beam of round 5
# was a stack of the harmonics of 49 Hz with a steady hiss above.

# the third-octave levels of a torrent of energy, dB against the strongest band (Hz, dB)
BEAM_CURVE = ((25, -18), (31, -13), (39, -6), (50, -4.5), (62, -4), (79, -1), (125, -1), (250, -2), (500, -2), (800, -2.5), (1000, -4),
              (2000, -6), (3175, -9), (4000, -12.5), (5040, -15.5), (6350, -20), (8000, -24.5), (10079, -27), (12699, -30))


def curve_noise(n, seed, curve=BEAM_CURVE):
    """Noise whose third-octave levels follow `curve` ((Hz, dB) points on a log axis)."""
    lf = np.log([c[0] for c in curve])
    lv = np.array([c[1] for c in curve], float)

    def g(f):
        f = np.maximum(f, 1.0)
        t = np.interp(np.log(f), lf, lv, left=lv[0] - 30, right=lv[-1] - 12)
        return 10 ** ((t - 10 * np.log10(f)) / 20)          # a third-octave band grows with f, so the density falls with it

    return dsp.spectral(dsp.white(n, seed), g)


def level_walk(n, seed, sd_db, lo, hi):
    """A level that wanders with no period: noise between lo and hi Hz, as a gain with a deviation of sd_db."""
    m = dsp.spectral(dsp.white(n, seed), lambda f: dsp.band_gain(f, lo, hi, 1))
    m = m / (m.std() + 1e-12)
    return 10 ** (sd_db * np.clip(m, -2.5, 2.5) / 20)


TURBULENCE_BANDS = ((25.0, 110.0, 1.0, 0.4, 6.0), (110.0, 900.0, 1.3, 0.5, 8.0), (900.0, 4000.0, 5.5, 1.0, 11.0), (4000.0, 13000.0, 6.5, 1.0, 13.0))


def turbulence(dur, seed, curve=BEAM_CURVE, bands=TURBULENCE_BANDS, corr=0.5):
    """A torrent as turbulence: one spectrum, cut into bands (lo, hi, deviation dB, slowest and fastest rate Hz).
    Each band has its own noise and its own wandering level, so the parts do not move together. Left and
    right share a common part for a correlation of `corr`. Returns (n, 2) arrays at their true relative levels."""
    n = nsamp(dur)
    a, b = np.sqrt(corr), np.sqrt(1 - corr)
    out = []
    for i, (lo, hi, sd, r_lo, r_hi) in enumerate(bands):
        p = [dsp.spectral(curve_noise(n, seed + 10 * i + c, curve), lambda f: dsp.band_gain(f, lo, hi, 4)) for c in range(3)]
        walk = level_walk(n, seed + 10 * i + 5, sd, r_lo, r_hi)
        out.append(np.stack([a * p[0] + b * p[1], a * p[0] + b * p[2]], axis=1) * walk[:, None])
    return out


def howl(dur, seed, centres, q=7.0, wander=0.05, rate=1.5):
    """A breath with a pitch, as wind in a wide pipe: narrow bands of noise whose centres wander. Each band is
    a carrier with a random envelope and a random phase, which is Gaussian noise of width centre / q. No sine."""
    n = nsamp(dur)
    y = np.zeros(n)
    for i, fc in enumerate(centres):
        bw = fc / q
        ab = [dsp.spectral(dsp.white(n, seed + 7 * i + c), lambda f: dsp.band_gain(f, 0.01, bw / 2, 2)) for c in (1, 2)]
        w = dsp.spectral(dsp.white(n, seed + 7 * i + 3), lambda f: dsp.band_gain(f, 0.1, rate, 1))
        w = w / (w.std() + 1e-12)
        ph = 2 * np.pi * np.cumsum(fc * 2 ** (wander * np.clip(w, -2.5, 2.5))) / SR
        y += (ab[0] * np.cos(ph) - ab[1] * np.sin(ph)) / (ab[0].std() + 1e-12) / (i + 1) ** 0.5
    return norm(y)


# ================================================================ round 7: every event of the picture has its sound
# The owner named what the picture shows and the sound left out: heavy stones that are pulled together and
# lock, an explosion of many rays that reach the walls, smoke and debris after it, slabs of a wall that fall
# and their dust, a charge that must be quiet, and a firing that is a shot, a hit and three changes of view.

def puff(dur, seed, lo=150.0, hi=5000.0, rise=0.04, tau=0.5, tilt=0.5):
    """Dust that is thrown out: a wide burst of noise with a soft rise and a long fall. Returns (n, 2)."""
    n = nsamp(dur)
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    k = max(2, nsamp(rise))
    e[:k] *= (0.5 - 0.5 * np.cos(np.pi * (np.arange(k) + 0.5) / k))
    ch = [dsp.spectral(dsp.white(n, seed + c), lambda f: dsp.band_gain(f, lo, hi, 2) * (lo / np.maximum(f, lo)) ** tilt) for c in range(2)]
    y = np.stack(ch, axis=1) * e[:, None]
    return y / (np.abs(y).max() + 1e-12)


def dust(dur, seed, lo=1500.0, hi=10000.0, sd=2.0, grain=0.35, tilt=0.3):
    """Dust and grit that hang and fall: a hiss whose level wanders, with a fine grain of tiny impacts in it.
    Returns (n, 2); the two sides share nothing, as a cloud around the listener."""
    n = nsamp(dur)
    ch = []
    for c in range(2):
        x = dsp.spectral(dsp.white(n, seed + c), lambda f: dsp.band_gain(f, lo, hi, 2) * (lo / np.maximum(f, lo)) ** tilt)
        x = x / np.sqrt((x ** 2).mean()) * level_walk(n, seed + 10 + c, sd, 0.4, 7.0)
        g = sand(dur, seed + 20 + c, rate0=1800.0, tau=dur * 4, f_lo=2500.0, f_hi=9000.0)
        ch.append(x + 2.0 * g[:n] / (np.sqrt((g[:n] ** 2).mean()) + 1e-12) * grain)
    return np.stack(ch, axis=1)


def billow(dur, seed, lo=70.0, hi=700.0, sd=3.0):
    """A cloud of smoke or dust that rolls: low noise in slow, irregular surges. Returns (n, 2)."""
    n = nsamp(dur)
    ch = []
    for c in range(2):
        x = dsp.spectral(dsp.white(n, seed + c), lambda f: dsp.band_gain(f, lo, hi, 2) * (lo / np.maximum(f, lo)) ** 0.5)
        ch.append(x / np.sqrt((x ** 2).mean()) * level_walk(n, seed + 10 + c, sd, 0.3, 3.0))
    return np.stack(ch, axis=1)


def slab_fall(seed, size=1.0, tail=1.0):
    """A slab of stone that lands: the floor answers with a deep thud of noise under 100 Hz that lasts, the
    slab cracks, and small pieces scatter after it. `tail` shortens the thud, for landings that follow one
    another and must each be heard alone."""
    hc = heavy_crack(seed, size=size, dur=0.35, k_rate=6, bright=0.3)
    thud = burst(seed + 5, 26.0, 95.0, tail * (0.18 + 0.1 * min(size, 2.0)), rise=0.006)
    body = boom(seed + 9, f=110.0 / max(size, 0.3) ** 0.3, tau=tail * (0.28 + 0.12 * min(size, 2.0)))       # the larger the slab, the lower and longer
    sc = tumble(0.7, seed + 7, lambda t: 16.0 * np.exp(-t / 0.22), sizes=(0.05, 0.15), speed=(2.0, 5.0))
    y = np.zeros(max(len(hc), len(thud), len(sc), len(body)))
    y[: len(hc)] += 0.6 * hc
    y[: len(thud)] += 0.5 * thud
    y[: len(body)] += 1.3 * body
    y[: len(sc)] += 0.2 * norm(sc)
    return norm(y)


def block_hit(seed, size=0.6, v=8.0):
    """A block of stone that strikes another: the clack and thud of its size, and the crack of both."""
    r = dsp.rng(seed)
    k = norm(stone_impact(size, v, r))
    c = heavy_crack(seed + 3, size=size, dur=0.2, k_rate=3, bright=0.4)
    b = boom(seed + 5, f=125.0 / max(size, 0.3) ** 0.3, tau=0.12 + 0.14 * size)
    y = np.zeros(max(len(k), len(c), len(b)))
    y[: len(k)] += 0.8 * k
    y[: len(c)] += 0.7 * c
    y[: len(b)] += 0.9 * b
    return norm(y)


def grind(dur, seed, r_lo=60.0, r_hi=200.0, res=(90.0, 210.0, 480.0), jitter=0.6, scrape=1.2):
    """Stone that grinds on stone: stick and slip. The slips come 60 to 200 times a second with a jitter of
    60 %, so there is no period and no rattle; each is a short burst of noise through wide low resonances. A
    scrape of noise lies over them and follows their level."""
    r = dsp.rng(seed)
    n = nsamp(dur)
    path = r_lo * (r_hi / r_lo) ** (0.5 + 0.5 * irregular(n, seed + 1, 0.7, 5.0))
    y = np.zeros(n + nsamp(0.1))
    L = nsamp(0.004)
    t = r.uniform(0, 0.02)
    while t < dur:
        i = min(n - 1, nsamp(t))
        y[i: i + L] += r.standard_normal(L)[: len(y) - i] * r.uniform(0.3, 1.0)
        t += (1.0 / path[i]) * (1 + jitter * r.uniform(-1, 1))
    low = sum(dsp.bp(y, f, 2.0) / (k + 1) ** 0.5 for k, f in enumerate(res))
    env = dsp.smooth(np.abs(low), 0.03)
    sc = dsp.spectral(dsp.white(len(y), seed + 2), lambda f: dsp.band_gain(f, 500.0, 4000.0, 2) * (500.0 / np.maximum(f, 500.0)) ** 0.5)
    out = norm(low) + scrape * norm(sc * env)
    return norm(dsp.fade(out, 0.03, 0.08))


def lance(seed, dur=0.09, f0=6000.0, f1=700.0):
    """A ray that leaves its source: a short tear whose band falls fast. Returns (n, 2)."""
    return band_sweep(dur, seed, f0, f1, width_oct=1.3, attack=0.12, wide=True)


def sear(dur, seed, lo=900.0, hi=6000.0, sd=4.0):
    """A ray that is held: noise in a band whose level moves fast and with no period."""
    n = nsamp(dur)
    x = dsp.spectral(dsp.white(n, seed), lambda f: dsp.band_gain(f, lo, hi, 2) * (lo / np.maximum(f, lo)) ** 0.6)
    return norm(x / np.sqrt((x ** 2).mean()) * level_walk(n, seed + 1, sd, 3.0, 30.0))


def shot(seed):
    """The discharge of a staff: a dry crack, a short low pop, and a tear that falls. No ring."""
    crack = tilted_burst(seed, 800.0, 9000.0, 0.006, tilt=0.4)
    pop = burst(seed + 1, 80.0, 320.0, 0.02, rise=0.001)
    zap = band_sweep(0.07, seed + 2, 7000.0, 900.0, width_oct=1.2, attack=0.1)
    y = np.zeros(max(len(crack), len(pop), len(zap)))
    y[: len(crack)] += crack
    y[: len(pop)] += 0.7 * pop
    y[: len(zap)] += 0.6 * norm(zap)
    return norm(y)


# ================================================================ round 9: the weight of a hit is a body that lasts
# The owner missed the deep, long sound of a heavy hit, heard noise in its place, and found the top harsh.
# Measured on the reference: after the wall hit the band from 60 to 150 Hz stays within 3 dB for 0.8 s, and
# one line near 120 Hz holds 39 % of the energy under 150 Hz. Round 8 had a burst under 90 Hz that was gone
# in 0.2 s. The weight is not in the lowest octave and not in the first instant: it is a body near 100 Hz
# that lasts.

def boom(seed, f=110.0, tau=0.4, tone=0.3, dur=None):
    """The body of a heavy hit: a band of noise around f Hz and two damped modes in it that sink by a
    twelfth of their pitch, with a fast rise and a decay of tau seconds. One long sound, not a row of short
    ones: nothing here bounces."""
    dur = dur or min(2.5, tau * 7)
    n = nsamp(dur)
    t = np.arange(n) / SR
    env = np.exp(-t / tau)
    k = max(2, nsamp(0.006))
    env[:k] *= 0.5 - 0.5 * np.cos(np.pi * (np.arange(k) + 0.5) / k)
    nz = dsp.spectral(dsp.white(n + nsamp(0.05), seed), lambda q: dsp.band_gain(q, 0.55 * f, 1.5 * f, 3))[:n]
    nz = nz / (np.abs(nz).max() + 1e-12)
    r = dsp.rng(seed + 1)
    glide = 1.0 - 0.08 * (1 - np.exp(-t / (0.6 * tau)))
    md = np.zeros(n)
    for fm, a in ((f, 1.0), (0.72 * f, 0.7)):
        md += a * np.sin(2 * np.pi * np.cumsum(fm * glide) / SR + r.uniform(0, 6.28))
    md = md / (np.abs(md).max() + 1e-12)
    return norm(((1 - tone) * nz + tone * md) * env)


# ================================================================ round 11: a wall that fails is many blocks
# The owner found the breaking of the wall strange. The frames show about 35 blocks that leave the wall within
# two frames and fall together for 1.2 s. Round 10 had one crack for them and four knocks. Stone that falls in
# a mass is heard as its impacts: blocks on blocks and blocks on the wall, at random times, each with the knock
# and the crack of its size. It is no hiss.

def rubble(dur, seed, rate, sizes=(0.3, 1.0), bright=0.25, body=0.0):
    """Blocks of stone that strike one another while they fall: impacts at random times, rate(t) a second.
    Each is the knock and the crack of its size (`stone_crack`), and the larger block is the louder one
    (amplitude ~ size ** 1.5). With body > 0 a block of more than 0.6 m also has the short boom of its size."""
    r = dsp.rng(seed)
    n = nsamp(dur)
    y = np.zeros(n + nsamp(1.2))
    rmax = max(rate(u) for u in np.linspace(0, dur, 60))
    t = 0.0
    while True:
        t += r.exponential(1.0 / rmax)
        if t >= dur:
            break
        if r.random() > rate(t) / rmax:
            continue
        a = np.exp(r.uniform(np.log(sizes[0]), np.log(sizes[1])))
        k = stone_crack(r, size=a, bright=bright) * a ** 1.5 * r.uniform(0.5, 1.0)
        s = nsamp(t)
        y[s: s + len(k)] += k[: len(y) - s]
        if body and a > 0.6:
            b = boom(int(r.integers(1, 2 ** 31 - 1)), f=125.0 / a ** 0.3, tau=0.1 + 0.12 * a) * body * a ** 1.5
            y[s: s + len(b)] += b[: len(y) - s]
    return y[: n + nsamp(0.6)]
