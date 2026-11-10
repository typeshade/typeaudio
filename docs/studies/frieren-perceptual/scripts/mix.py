"""The mix: every layer is placed in the hall, sent to the shared late field, and set by a loudness target."""
import numpy as np
import dsp
from dsp import SR, nsamp, lin


def meter(st, kind):
    """Loudness of a stereo layer: 'm' max momentary (0.4 s), 'i' max over 0.1 s (transients),
    's' max short-term (3 s), 'a' average over the active part, 'r' unweighted RMS in dBFS."""
    if kind == 'r':
        p = (st ** 2).sum(axis=1)
        act = p > p.max() * 1e-6
        return 10 * np.log10(max(p[act].mean() / 2, 1e-12))      # dBFS RMS, unweighted
    if kind == 'a':
        k = dsp.k_weight(st)
        p = (k ** 2).sum(axis=1)
        act = p > p.max() * 1e-6
        return -0.691 + 10 * np.log10(max(p[act].mean(), 1e-12))
    w = {'m': 0.4, 'i': 0.1, 's': 3.0}[kind]
    if len(st) < nsamp(w) + 2:
        st = np.concatenate([st, np.zeros((nsamp(w) + 2 - len(st), 2))])
    _, l = dsp.loudness_blocks(st, w, w / 8)
    return float(l.max())


def _min_forward(x, w):
    """The minimum of x[i : i + w] for every i (ones beyond the end)."""
    n = len(x)
    m = (n // w + 2) * w
    p = np.concatenate([x, np.ones(m - n)]).reshape(-1, w)
    pre = np.minimum.accumulate(p, axis=1).ravel()
    suf = np.minimum.accumulate(p[:, ::-1], axis=1)[:, ::-1].ravel()
    i = np.arange(n)
    return np.minimum(suf[i], pre[i + w - 1])


def limiter(x, ceiling, lookahead=0.004, release=0.12):
    """A look-ahead peak limiter for a (n, 2) signal. One gain for both channels. The gain falls over the
    look-ahead time before a peak arrives, so that no sample passes the ceiling, and it recovers with the
    release time. Returns the limited signal and the gain."""
    pk = np.abs(x).max(axis=1)
    need = np.minimum(1.0, ceiling / np.maximum(pk, 1e-12))
    a = float(np.exp(-1.0 / (release * SR)))
    env = np.empty(len(need))
    g = 1.0
    for i, t in enumerate(need.tolist()):          # the release: the gain rises slowly, and falls at once
        g = 1.0 - (1.0 - g) * a
        if t < g:
            g = t
        env[i] = g
    k = max(2, nsamp(lookahead))
    lo = _min_forward(env, k)                      # the lowest gain needed within the look-ahead
    c = np.cumsum(np.concatenate([np.full(k, lo[0]), lo]))
    gain = (c[k:] - c[:-k]) / k                    # a ramp of that length down to it
    return x * gain[:, None], gain


class Mix:
    def __init__(self, name, t0, t1, tail=2.5, room=None, rev_db=-5.0):
        self.name, self.t0, self.t1, self.tail = name, t0, t1, tail
        self.n = nsamp(t1 - t0 + tail)
        self.room = room or dsp.Room()
        self.ir = dsp.reverb_ir(self.room) * lin(rev_db)
        self.rev_db = rev_db
        self.layers = {}      # name -> dict(dry, wet, gain_db, target, meter, t)
        self.order = []

    def positions(self, pos, t, n):
        if isinstance(pos, np.ndarray) and pos.ndim == 2:
            return pos                      # already one position for each sample
        if isinstance(pos, (tuple, np.ndarray)) and np.ndim(pos) == 1:
            return np.asarray(pos, float)
        ts = np.array([k[0] for k in pos], float)
        ps = np.array([k[1] for k in pos], float)
        tt = t + np.arange(n) / SR
        P = np.stack([np.interp(tt, ts, ps[:, c]) for c in range(3)], axis=1)
        return np.stack([dsp.smooth(P[:, c], 0.12) for c in range(3)], axis=1)

    def _fit(self, x, t):
        """Put a (m,2) signal that starts at absolute time t into a (n,2) buffer."""
        out = np.zeros((self.n, 2), np.float32)
        s = nsamp(t - self.t0)
        a, b = max(s, 0), min(self.n, s + len(x))
        if b > a:
            out[a:b] = x[a - s: b - s]
        return out

    def _store(self, name, dry, send, t, target, kind, gain_db):
        wet = dsp.convolve(send, self.ir) if send is not None else np.zeros((len(dry), 2))
        m = max(len(dry), len(wet))
        full = np.zeros((m, 2))
        full[: len(dry)] += dry
        full[: len(wet)] += wet
        g = lin(gain_db)
        measured = None
        if target is not None:
            measured = meter(full, kind)
            g *= lin(target - measured)
        d = np.zeros((m, 2)); d[: len(dry)] = dry
        self.layers[name] = dict(dry=self._fit(d * g, t), wet=self._fit((full - d) * g, t), gain_db=20 * np.log10(g),
                                 target=target, meter=kind, t=t)
        self.order.append(name)

    def add(self, name, sig, t, pos, target=None, kind='m', gain_db=0.0, focus_db=0.0, er_db=0.0,
            send_db=0.0, doppler=True, sync=None):
        P = self.positions(pos, t, len(sig))
        d, er = dsp.place(sig, P, self.room, focus_db=focus_db, er_db=er_db, sync=sync, doppler=doppler)
        send = sig * lin(send_db) if send_db is not None else None
        self._store(name, d + er, send, t, target, kind, gain_db)

    def add_wide(self, name, sig2, t, target=None, kind='m', gain_db=0.0, send_db=None):
        send = sig2.mean(axis=1) * lin(send_db) if send_db is not None else None
        self._store(name, sig2, send, t, target, kind, gain_db)

    def layer(self, name):
        l = self.layers[name]
        return l['dry'].astype(float) + l['wet'].astype(float)

    def render(self, peak_dbtp=-2.0):
        """Sum the layers. The highest true peak goes to peak_dbtp. With `drive_db` set on the mix, the sum is then
        raised by that much; a look-ahead limiter and a soft clip hold the peaks at the same ceiling. The peaks
        of a roar lose a few dB and its level rises by as much: the sound is denser."""
        mix = np.zeros((self.n, 2))
        for name in self.order:
            mix += self.layer(name)
        mix = dsp.iir(mix, [dsp.rbj('hp', 27.0, 0.7071)], tail=0.5)
        tp = dsp.true_peak_db(mix)
        self.master_gain_db = peak_dbtp - tp           # the gain of every layer before the limiter
        drive = float(getattr(self, 'drive_db', 0.0))
        self.limit_db, self.limited_share = 0.0, 0.0
        y = mix * lin(self.master_gain_db)
        if drive > 0:
            c = lin(peak_dbtp - 0.3)
            y, gain = limiter(y * lin(drive), c * lin(4.0), release=0.06)     # the limiter leaves peaks up to 4 dB over
            y = c * np.tanh(y / c)                                            # and a soft clip rounds them under the ceiling
            y = y * lin(peak_dbtp - dsp.true_peak_db(y))
            self.limit_db = float(-20 * np.log10(gain.min()))
            self.limited_share = float((gain < 0.99).mean())
        self.drive_db = drive
        # a level that the limiter would flatten is set after it: (seconds in the mix, dB) points, never above 0 dB
        env = getattr(self, 'after_db', None)
        if env:
            ts = np.array([p[0] - self.t0 for p in env]); vs = np.minimum(np.array([p[1] for p in env], float), 0.0)
            y = y * lin(np.interp(np.arange(len(y)) / SR, ts, vs))[:, None]
        self.out = dsp.fade(y[:, 0], 0.02, 0.3)[:, None] * np.array([1.0, 0.0]) + dsp.fade(y[:, 1], 0.02, 0.3)[:, None] * np.array([0.0, 1.0])
        return self.out
