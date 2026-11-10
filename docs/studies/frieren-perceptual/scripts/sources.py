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


# ---- a glassy resonant surface: inharmonic plate modes with a low loss factor
SHIELD_RATIOS = np.array([1.0, 1.56, 2.31, 3.02, 3.89, 4.93, 6.1, 7.4])


def shield(seed, f1=510.0, loss=0.0025, dur=1.8, hard=0.0004, tilt=1.0):
    r = dsp.rng(seed)
    fm = f1 * SHIELD_RATIOS * r.uniform(0.985, 1.015, len(SHIELD_RATIOS))
    y = dsp.modal(fm, r.uniform(0.6, 1.0, len(fm)) / np.arange(1, len(fm) + 1) ** tilt, dsp.tau_of(fm, loss), dur)
    return norm(dsp.contact(y, hard))


# ---- sparse tonal grains whose rate decays: particles streaming away, or matter losing coherence
def sparkle(dur, seed, rate0, tau, freqs, glen=(0.008, 0.02), spread=0.03, rise=0.0, noisy=0.0, bw=220.0):
    r = dsp.rng(seed)
    n = nsamp(dur)
    count = r.poisson(rate0 * tau * (1 - np.exp(-dur / tau)))
    times = -tau * np.log(1 - r.random(count) * (1 - np.exp(-dur / tau)))
    y = np.zeros(n)
    for t0 in times:
        L = nsamp(r.uniform(*glen))
        f = r.choice(freqs) * 2 ** (r.normal(0, spread + rise * t0 / dur))
        tt = np.arange(L) / SR
        car = np.sin(2 * np.pi * f * tt + r.uniform(0, 6.28))
        if noisy > 0:
            mw = max(2, int(SR / (2 * bw)))
            nb = np.convolve(r.standard_normal(L + mw), np.ones(mw) / np.sqrt(mw))[mw: mw + L]
            car = (1 - noisy) * car + noisy * nb * car * 1.4
        k = car * dsp.hann(L) * r.exponential(1.0)
        s = nsamp(t0); e = min(n, s + L)
        y[s:e] += k[: e - s]
    return y, times


# ---- settling dust: thousands of tiny impacts whose rate decays
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


# ---- the beam: a coherent harmonic core with slow beating, a turbulent body and a crackling edge
def beam_core(dur, seed, f0=49.0, partials=24, tilt=0.7):
    r = dsp.rng(seed)
    n = nsamp(dur)
    t = np.arange(n) / SR
    z = dsp.smooth(dsp.white(n, seed + 3), 0.05)
    jit = 1 + 0.004 * z / (z.std() + 1e-12)
    ph = 2 * np.pi * np.cumsum(f0 * jit) / SR
    y = np.zeros(n)
    for k in range(1, partials + 1):
        a = k ** (-tilt) * (0.5 if k == 1 else 1.0)
        for det in (r.uniform(0.12, 0.5), -r.uniform(0.12, 0.5)):
            y += 0.5 * a * np.sin(k * ph + 2 * np.pi * det * t + r.uniform(0, 6.28))
    return norm(y)


def beam_body(dur, seed, lo=150.0, hi=3500.0):
    n = nsamp(dur)
    x = dsp.spectral(dsp.pink(n, seed), lambda f: dsp.band_gain(f, lo, hi, 2))
    m = dsp.smooth(dsp.pink(n, seed + 5), 0.12)
    m = m / (np.abs(m).max() + 1e-9)
    return x / np.sqrt((x ** 2).mean()) * lin(3.0 * m)


def beam_edge(dur, seed, rate=(600.0, 2500.0), f_lo=3500.0, f_hi=11000.0):
    r = dsp.rng(seed)
    n = nsamp(dur)
    t = np.arange(n) / SR
    lam = (rate[0] + (rate[1] - rate[0]) * t / dur) / SR
    hits = r.random(n) < lam
    x = np.where(hits, r.uniform(0.4, 1.0, n) * r.choice([-1, 1], n), 0.0)
    x = dsp.spectral(x, lambda f: dsp.band_gain(f, f_lo, f_hi, 2))
    return x / (np.sqrt((x ** 2).mean()) + 1e-12)


def comb_sweep(x, rate_hz=0.45, d_lo=0.0015, d_hi=0.004, mix=0.25):
    """A slowly swept comb: motion of the rings without moving the image."""
    n = len(x)
    d = d_lo + (d_hi - d_lo) * (0.5 - 0.5 * np.cos(2 * np.pi * rate_hz * np.arange(n) / SR))
    return x + mix * dsp.vdelay(x, d)


# ---- preparation: inharmonic partials converge to a harmonic series while the pitch rises
def prep(dur, seed, f_start=196.0, f_end=294.0):
    n = nsamp(dur)
    t = np.arange(n) / SR
    u = t / dur
    f0 = f_start * (f_end / f_start) ** u
    inh = np.array([1.0, 1.37, 1.93, 2.54, 3.41, 4.2])
    har = np.arange(1, 7, dtype=float)
    r = dsp.rng(seed)
    y = np.zeros(n)
    for k in range(6):
        ratio = inh[k] + (har[k] - inh[k]) * u ** 0.7
        y += np.sin(2 * np.pi * np.cumsum(f0 * ratio) / SR + r.uniform(0, 6.28)) / (k + 1) ** 0.8
    return norm(y * lin(-18 * (1 - u)))


def flash_noise(dur, seed, tau=0.06, lo=200.0, hi=12000.0):
    n = nsamp(dur)
    t = np.arange(n) / SR
    ch = []
    for c in range(2):
        x = dsp.spectral(dsp.white(n, seed + c), lambda f: dsp.band_gain(f, lo, hi, 2) / np.sqrt(np.maximum(f, 100.0)))
        ch.append(x / np.sqrt((x ** 2).mean()))
    env = np.exp(-t / tau)
    k = nsamp(0.0015)
    env[:k] *= 0.5 - 0.5 * np.cos(np.pi * (np.arange(k) + 0.5) / k)
    return np.stack(ch, 1) * env[:, None]


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
