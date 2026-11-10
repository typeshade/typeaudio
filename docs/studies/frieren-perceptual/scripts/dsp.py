"""Signal primitives for the perceptual-model sound design study. numpy only; 48 kHz; float64."""
import numpy as np
import wave

SR = 48000
C_AIR = 343.0


def rng(seed):
    return np.random.default_rng(seed)


def db(x):
    return 20 * np.log10(np.maximum(np.abs(x), 1e-12))


def lin(d):
    return 10 ** (d / 20)


def nsamp(seconds):
    return int(round(seconds * SR))


# ---------------------------------------------------------------- envelopes

def env_points(points, n):
    """Piecewise-linear envelope through (seconds, value) points, n samples."""
    t = np.arange(n) / SR
    ts = np.array([p[0] for p in points], float)
    vs = np.array([p[1] for p in points], float)
    return np.interp(t, ts, vs)


def fade(x, fin=0.003, fout=0.003):
    y = np.array(x, float, copy=True)
    a = min(nsamp(fin), len(y) // 2)
    b = min(nsamp(fout), len(y) // 2)
    if a > 0:
        y[:a] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    if b > 0:
        y[-b:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(b) / b)
    return y


def smooth(x, seconds):
    """Moving average (zero-phase), for control signals only."""
    k = max(1, nsamp(seconds))
    if k == 1:
        return x
    pad = np.concatenate([np.full(k, x[0]), x, np.full(k, x[-1])])
    c = np.cumsum(pad)
    y = (c[k:] - c[:-k]) / k
    return y[k // 2: k // 2 + len(x)]


# ---------------------------------------------------------------- filters (exact IIR response on the FFT grid: causal, no pre-ringing)

def rbj(kind, f0, q=0.7071, gain_db=0.0):
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    a_ = 10 ** (gain_db / 40)
    alpha = sw / (2 * q)
    if kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'bp':
        b = [alpha, 0, -alpha]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'peak':
        b = [1 + alpha * a_, -2 * cw, 1 - alpha * a_]; a = [1 + alpha / a_, -2 * cw, 1 - alpha / a_]
    elif kind in ('ls', 'hs'):
        al = sw / 2 * np.sqrt(2.0)
        r = 2 * np.sqrt(a_) * al
        if kind == 'ls':
            b = [a_ * ((a_ + 1) - (a_ - 1) * cw + r), 2 * a_ * ((a_ - 1) - (a_ + 1) * cw), a_ * ((a_ + 1) - (a_ - 1) * cw - r)]
            a = [(a_ + 1) + (a_ - 1) * cw + r, -2 * ((a_ - 1) + (a_ + 1) * cw), (a_ + 1) + (a_ - 1) * cw - r]
        else:
            b = [a_ * ((a_ + 1) + (a_ - 1) * cw + r), -2 * a_ * ((a_ - 1) + (a_ + 1) * cw), a_ * ((a_ + 1) + (a_ - 1) * cw - r)]
            a = [(a_ + 1) - (a_ - 1) * cw + r, 2 * ((a_ - 1) - (a_ + 1) * cw), (a_ + 1) - (a_ - 1) * cw - r]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a[1:]) / a[0]
    return b, a


def _resp(sections, w):
    z1 = np.exp(-1j * w)
    z2 = z1 * z1
    h = np.ones_like(z1)
    for b, a in sections:
        h = h * (b[0] + b[1] * z1 + b[2] * z2) / (1 + a[0] * z1 + a[1] * z2)
    return h


def iir(x, sections, tail=0.5):
    """Apply biquad sections exactly (circular convolution with enough zero padding). Keeps length."""
    x = np.asarray(x, float)
    if x.ndim == 2:
        return np.stack([iir(x[:, c], sections, tail) for c in range(x.shape[1])], axis=1)
    n = len(x)
    m = n + nsamp(tail)
    nfft = 1 << int(np.ceil(np.log2(m)))
    w = 2 * np.pi * np.fft.rfftfreq(nfft)
    return np.fft.irfft(np.fft.rfft(x, nfft) * _resp(sections, w), nfft)[:n]


def lp(x, f, q=0.7071): return iir(x, [rbj('lp', f, q)])
def hp(x, f, q=0.7071): return iir(x, [rbj('hp', f, q)])
def bp(x, f, q=1.0): return iir(x, [rbj('bp', f, q)])


def spectral(x, mag_fn):
    """Zero-phase magnitude shaping, for stationary noise only. mag_fn(freq_hz) -> gain."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * mag_fn(f), n)


def band_gain(f, lo, hi, order=2):
    """Smooth band-pass magnitude (Butterworth-like skirts)."""
    f = np.maximum(f, 1e-3)
    return 1 / np.sqrt(1 + (lo / f) ** (2 * order)) / np.sqrt(1 + (f / hi) ** (2 * order))


def stft_shape(x, gain_fn, nfft=1024, hop=256):
    """Time-varying magnitude shaping of a noise-like signal. gain_fn(t_frames, freqs) -> (F, K) gains."""
    win = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(nfft) / nfft)
    n = len(x)
    xp = np.concatenate([np.zeros(nfft), x, np.zeros(nfft)])
    nf = 1 + (len(xp) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(nf)[:, None]
    X = np.fft.rfft(xp[idx] * win, axis=1)
    tf = (hop * np.arange(nf) + nfft / 2 - nfft) / SR
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    Y = np.fft.irfft(X * gain_fn(tf, fr), nfft, axis=1) * win
    out = np.zeros(len(xp))
    np.add.at(out, idx, Y)
    return out[nfft: nfft + n] / 1.5


# ---------------------------------------------------------------- sources

def white(n, seed):
    return rng(seed).standard_normal(n)


def pink(n, seed):
    x = white(n, seed)
    return spectral(x, lambda f: 1 / np.sqrt(np.maximum(f, 20.0)))


def modal(freqs, amps, taus, dur, phases=None):
    """Sum of damped sinusoids: the response of a struck solid."""
    n = nsamp(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for i, (f, a, tau) in enumerate(zip(freqs, amps, taus)):
        if f >= 0.45 * SR:
            continue
        m = min(n, int(9 * tau * SR) + 2)
        ph = 0.0 if phases is None else phases[i]
        y[:m] += a * np.exp(-t[:m] / tau) * np.sin(2 * np.pi * f * t[:m] + ph)
    return y


def tau_of(f, loss):
    """Decay time of a mode at f for a material with internal friction `loss` (tan phi)."""
    return 1.0 / (np.pi * np.asarray(f, float) * loss)


def contact(y, tc):
    """Convolve with a half-sine force pulse of duration tc: the hardness of the contact."""
    k = max(2, nsamp(tc))
    p = np.sin(np.pi * (np.arange(k) + 0.5) / k)
    return np.convolve(y, p / p.sum())[: len(y)]


def friedlander(dur, tplus, rise=0.000125):
    """Blast-wave pressure: instant rise, then (1 - t/t+) exp(-t/t+). Zero net area."""
    n = nsamp(dur)
    t = np.arange(n) / SR
    y = (1 - t / tplus) * np.exp(-t / tplus)
    k = max(2, nsamp(rise))
    y[:k] *= 0.5 - 0.5 * np.cos(np.pi * (np.arange(k) + 0.5) / k)
    return y


def glide(f_points, n):
    """Phase of a tone whose frequency follows (seconds, hz) points."""
    f = env_points(f_points, n)
    return 2 * np.pi * np.cumsum(f) / SR


def grains(n, times, make, seed=0):
    """Place short kernels: make(i) -> array; times in seconds."""
    y = np.zeros(n)
    for i, t0 in enumerate(times):
        k = make(i)
        s = nsamp(t0)
        if s >= n or s + len(k) <= 0:
            continue
        a, b = max(s, 0), min(n, s + len(k))
        y[a:b] += k[a - s: b - s]
    return y


def hann(n):
    return 0.5 - 0.5 * np.cos(2 * np.pi * (np.arange(n) + 0.5) / n)


# ---------------------------------------------------------------- space

def vdelay(x, delay_seconds):
    """Read x at t - delay(t): propagation delay with Doppler when the delay changes."""
    n = len(x)
    idx = np.arange(n) - delay_seconds * SR
    return np.interp(idx, np.arange(n), x, left=0.0, right=0.0)


class Room:
    """A shoebox hall. Coordinates in metres: +x right, +y up (floor at 0), forward is -z."""

    def __init__(self, x=(-9, 9), y=(0, 14), z=(-16, 8), listener=(0, 1.6, 0), rt_mid=2.6,
                 beta=None):
        self.x, self.y, self.z = x, y, z
        self.listener = np.array(listener, float)
        self.volume = (x[1] - x[0]) * (y[1] - y[0]) * (z[1] - z[0])
        self.rt_mid = rt_mid
        self.dc = 0.057 * np.sqrt(self.volume / rt_mid)      # critical distance
        # pressure reflection coefficients of the six surfaces
        self.beta = beta or {'x0': 0.85, 'x1': 0.85, 'y0': 0.45, 'y1': 0.8, 'z0': 0.85, 'z1': 0.85}

    def images(self, pos):
        """First-order image sources of pos (n,3) -> list of (name, (n,3))."""
        out = []
        for name, axis, plane in (('x0', 0, self.x[0]), ('x1', 0, self.x[1]), ('y0', 1, self.y[0]),
                                  ('y1', 1, self.y[1]), ('z0', 2, self.z[0]), ('z1', 2, self.z[1])):
            p = np.array(pos, float, copy=True)
            p[:, axis] = 2 * plane - p[:, axis]
            out.append((name, p))
        return out


def pan_gains(az):
    """Equal-power stereo from azimuth (rad, 0 front, + right). Sources behind fold to the front."""
    p = np.clip(np.sin(az) * 0.9, -1, 1)
    th = (p + 1) * np.pi / 4
    return np.cos(th), np.sin(th)


def place(x, pos, room, focus_db=0.0, er_db=0.0, sync=None, doppler=True, min_d=1.0):
    """Render a mono source at pos (n,3 or 3,) into direct stereo and early reflections.
    The direct sound is in sync at sample `sync` (default: the closest approach); elsewhere the
    change of the propagation delay gives the Doppler shift. Gain is 1/d."""
    n = len(x)
    pos = np.asarray(pos, float)
    if pos.ndim == 1:
        pos = np.broadcast_to(pos, (n, 3))
    rel = pos - room.listener
    d = np.linalg.norm(rel, axis=1)
    s = int(np.argmin(d)) if sync is None else int(sync)
    d_sync = d[s]
    moving = doppler and (np.ptp(d) > 0.02)
    xd = vdelay(x, (d - d_sync) / C_AIR) if moving else x
    g = lin(focus_db) / np.maximum(d, min_d)
    gl, gr = pan_gains(np.arctan2(rel[:, 0], -rel[:, 2]))
    direct = np.stack([xd * g * gl, xd * g * gr], axis=1)
    er = np.zeros((n, 2))
    if er_db is not None:
        for name, ip in room.images(pos):
            r = ip - room.listener
            di = np.linalg.norm(r, axis=1)
            xi = vdelay(x, (di - d_sync) / C_AIR)
            gi = lin(focus_db + er_db) * room.beta[name] / np.maximum(di, min_d)
            l, rr = pan_gains(np.arctan2(r[:, 0], -r[:, 2]))
            er[:, 0] += xi * gi * l
            er[:, 1] += xi * gi * rr
    return direct, er


def reverb_ir(room, seconds=None, seed=11, predelay=0.03):
    """Late field: decaying noise with a frequency-dependent decay time, decorrelated L/R.
    Energy is set so that, for a steady source, reverberant power equals direct power at the
    critical distance of the room."""
    rt = room.rt_mid
    dur = seconds or (rt * 1.6)
    n = nsamp(dur)

    def rt_of(f):
        # stone hall shape: long lows and mids, highs shortened by the air
        f = np.maximum(f, 20.0)
        return rt * np.interp(np.log2(f), np.log2([63, 125, 500, 2000, 4000, 8000, 16000]),
                              [1.05, 1.08, 1.0, 0.82, 0.62, 0.36, 0.2])

    out = []
    for c in range(2):
        t = np.arange(n) / SR + predelay
        p = np.minimum(1.0, 4 * np.pi * C_AIR ** 3 * t ** 2 / room.volume / SR)      # echoes per sample
        r = rng(seed + c)
        w = np.where(r.random(n) < p, r.choice([-1.0, 1.0], n) / np.sqrt(p), 0.0)
        y = stft_shape(w, lambda tf, fr: np.exp(-6.908 * np.maximum(tf, 0)[:, None] / rt_of(fr)[None, :])
                       * (1 / (1 + (fr[None, :] / 9000.0) ** 2)) ** 0.5, nfft=1024, hop=256)
        k = nsamp(0.012)
        y[:k] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
        out.append(np.concatenate([np.zeros(nsamp(predelay)), y]))
    ir = np.stack(out, axis=1)
    e = (ir ** 2).sum(axis=0)
    ir = ir / np.sqrt(e)[None, :] * np.sqrt(1.0 / (2 * room.dc ** 2))
    return ir


def convolve(x, ir):
    """x mono (n,), ir (m,2) -> (n+m-1, 2)"""
    n = len(x) + len(ir) - 1
    nfft = 1 << int(np.ceil(np.log2(n)))
    X = np.fft.rfft(x, nfft)
    return np.stack([np.fft.irfft(X * np.fft.rfft(ir[:, c], nfft), nfft)[:n] for c in range(2)], axis=1)


# ---------------------------------------------------------------- measures

K_STAGE1 = (np.array([1.53512485958697, -2.69169618940638, 1.19839281085285]), np.array([-1.69065929318241, 0.73248077421585]))
K_STAGE2 = (np.array([1.0, -2.0, 1.0]), np.array([-1.99004745483398, 0.99007225036621]))


def k_weight(x):
    return iir(x, [K_STAGE1, K_STAGE2], tail=0.2)


def loudness_blocks(x, window=0.4, hop=0.1):
    """Momentary (0.4 s) or short-term (3 s) loudness of stereo x, LUFS, with block centre times."""
    k = k_weight(x if x.ndim == 2 else np.stack([x, x], axis=1) / np.sqrt(2))
    p = (k ** 2).sum(axis=1)
    w, h = nsamp(window), nsamp(hop)
    c = np.concatenate([[0], np.cumsum(p)])
    starts = np.arange(0, max(1, len(p) - w + 1), h)
    ms = (c[starts + w] - c[starts]) / w
    return (starts + w / 2) / SR, -0.691 + 10 * np.log10(np.maximum(ms, 1e-12))


def integrated_lufs(x):
    _, l = loudness_blocks(x, 0.4, 0.1)
    p = 10 ** ((l + 0.691) / 10)
    g = l > -70
    if not g.any():
        return -99.0
    rel = -0.691 + 10 * np.log10(p[g].mean()) - 10
    g2 = g & (l > rel)
    return -0.691 + 10 * np.log10(p[g2].mean())


def true_peak_db(x, over=4):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = x[:, None]
    pk = 0.0
    for c in range(x.shape[1]):
        n = len(x)
        X = np.fft.rfft(x[:, c])
        Y = np.zeros(over * n // 2 + 1, complex)
        Y[: len(X)] = X
        y = np.fft.irfft(Y, over * n) * over
        pk = max(pk, np.abs(y).max())
    return 20 * np.log10(max(pk, 1e-12))


def erb_bands(lo=30.0, hi=16000.0, n=34):
    e = lambda f: 21.4 * np.log10(4.37e-3 * f + 1)
    inv = lambda x: (10 ** (x / 21.4) - 1) / 4.37e-3
    return inv(np.linspace(e(lo), e(hi), n + 1))


def band_levels(x, nfft=2048, hop=512, edges=None):
    """Power per ERB band over time for mono x: (frames, bands) in dB, plus frame times."""
    edges = erb_bands() if edges is None else edges
    win = hann(nfft)
    xp = np.concatenate([np.zeros(nfft // 2), x, np.zeros(nfft)])
    nf = 1 + (len(xp) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(nf)[:, None]
    P = np.abs(np.fft.rfft(xp[idx] * win, axis=1)) ** 2
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    out = np.zeros((nf, len(edges) - 1))
    for b in range(len(edges) - 1):
        m = (fr >= edges[b]) & (fr < edges[b + 1])
        if m.any():
            out[:, b] = P[:, m].sum(axis=1)
    t = hop * np.arange(nf) / SR
    return t, 10 * np.log10(np.maximum(out, 1e-20)), edges


def write_wav(path, x, bits=24):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = x[:, None]
    full = 2 ** (bits - 1) - 1
    r = rng(1234)
    dither = (r.random(x.shape) - r.random(x.shape)) / full          # TPDF, 1 LSB
    q = np.clip(np.round((x + dither) * full), -full - 1, full).astype(np.int64)
    with wave.open(path, 'wb') as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(bits // 8); w.setframerate(SR)
        if bits == 16:
            w.writeframes(q.astype('<i2').tobytes())
        else:
            b = q.astype('<i4').view(np.uint8).reshape(-1, 4)[:, :3]
            w.writeframes(b.tobytes())
