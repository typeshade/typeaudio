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


# ---- a stone fragment landing: radiation peak at ka = 1 (f = c / (2 pi a)), a damped floor thud,
#      and bounces from the restitution of rock on rock
def stone_click(a, v, r):
    fpk = min(54.6 / a, 9000.0)
    tau = 0.004 + 0.03 * a
    L = nsamp(tau * 7)
    t = np.arange(L) / SR
    click = dsp.iir(r.standard_normal(L) * np.exp(-t / tau), [dsp.rbj('bp', fpk, 1.1)], tail=0.05)
    fm = np.sort(r.uniform(90, 420, 6)) * (0.1 / a) ** 0.35
    thud = dsp.contact(dsp.modal(fm, r.uniform(0.4, 1.0, 6) / np.arange(1, 7) ** 0.5, dsp.tau_of(fm, 0.06), 0.3), 0.0015 + 0.01 * a)
    n = max(L, len(thud))
    y = np.zeros(n)
    y[:L] += norm(click)
    lt = nsamp(0.006)
    tick = dsp.iir(r.standard_normal(lt) * np.exp(-np.arange(lt) / (0.0009 * SR)), [dsp.rbj('hp', 2200, 0.7), dsp.rbj('lp', 8000, 0.7)], tail=0.02)
    y[:lt] += norm(tick) * 0.5 * (1 + (a / 0.1) ** 2) * min(1.0, v / 6.0)
    y[: len(thud)] += norm(thud) * (a / 0.1) ** 2      # small fragments click, large ones thud
    return y * a ** 1.5 * v


def debris(a, h, seed, e=0.35, max_bounces=4):
    """A fragment of radius a (m) falling from h (m): first impact at t = 0, then bounces."""
    r = dsp.rng(seed)
    v = np.sqrt(2 * G * h)
    events, t = [], 0.0
    for _ in range(max_bounces + 1):
        events.append((t, v))
        v = v * e * r.uniform(0.8, 1.15)
        dt = 2 * v / G
        if dt < 0.03:
            break
        t += dt
    y = np.zeros(nsamp(t + 0.5))
    for t0, vv in events:
        k = stone_click(a, vv, r)
        s = nsamp(t0)
        y[s: s + len(k)] += k[: len(y) - s]
    return y


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


# ---- a pressure wave with no visible source: Friedlander front, a falling low body with harmonics
#      (the pitch survives on small speakers), and the struck body's own damped modes
def pressure(dur=0.7, tplus=0.0035, f_body=(58.0, 42.0), tau_body=0.09, harmonics=(0.8, 0.75, 0.55, 0.4, 0.28, 0.18)):
    n = nsamp(dur)
    t = np.arange(n) / SR
    front = dsp.friedlander(dur, tplus)
    ph = dsp.glide([(0, f_body[0]), (0.25, f_body[1]), (dur, f_body[1])], n)
    body = sum(a * np.sin(k * ph) for k, a in enumerate(harmonics, start=1)) * np.exp(-t / tau_body)
    return front, norm(body)


def body_modes(seed, freqs=(140, 205, 290, 380), tau=(0.03, 0.026, 0.02, 0.016), dur=0.2, soft=0.004):
    r = dsp.rng(seed)
    y = dsp.modal(np.array(freqs) * r.uniform(0.96, 1.04, len(freqs)), [1, 0.8, 0.6, 0.4], tau, dur)
    return norm(dsp.contact(y, soft))


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


# ---- the red material: a low harmonic body and a rough mid band under one amplitude modulation.
#      The modulation rate and depth set the roughness (the tension); they rise in containment.
def red_core(n, fmod, depth, f0, mid_fc, mid_width_oct, seed):
    r = dsp.rng(seed)
    m = (1 + depth * np.sin(2 * np.pi * np.cumsum(fmod) / SR)) / (1 + depth)
    ph0 = 2 * np.pi * np.cumsum(f0) / SR
    low = sum(a * np.sin(k * ph0 + r.uniform(0, 6.28)) for k, a in ((1, 0.6), (2, 0.9), (3, 0.7), (4, 0.5), (6, 0.3)))

    def g(tf, fr):
        fc = np.interp(tf, np.arange(n) / SR, mid_fc)[:, None]
        wd = np.interp(tf, np.arange(n) / SR, mid_width_oct)[:, None]
        return np.exp(-0.5 * (np.log2(np.maximum(fr[None, :], 1) / fc) / wd) ** 2)

    mid = dsp.stft_shape(dsp.white(n, seed + 1), g)
    return norm(low) * m, mid / np.sqrt((mid ** 2).mean() + 1e-12) * 0.3 * m


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


# ---- the mid part of a pressure hit: a short broadband slap and a few damped modes, so that the
#      hit reads on a small speaker that has no bass
def punch(seed, dur=0.25, slap=(400.0, 2500.0), slap_tau=0.012, modes=(150, 230, 330, 470, 640), loss=0.09):
    r = dsp.rng(seed)
    n = nsamp(dur)
    t = np.arange(n) / SR
    sl = dsp.spectral(r.standard_normal(n), lambda f: dsp.band_gain(f, slap[0], slap[1], 2)) * np.exp(-t / slap_tau)
    fm = np.array(modes) * r.uniform(0.95, 1.05, len(modes))
    md = dsp.contact(dsp.modal(fm, 1 / np.arange(1, len(fm) + 1) ** 0.5, dsp.tau_of(fm, loss), dur), 0.0015)
    return norm(norm(sl) * 0.7 + norm(md))


def saturate(x, drive=2.2):
    """Soft clip of a hit normalised to its peak: the peak falls about 7 dB against the small-signal gain."""
    y = norm(x)
    return np.tanh(drive * y) / drive
