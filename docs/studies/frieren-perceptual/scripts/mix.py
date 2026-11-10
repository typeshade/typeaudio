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
        mix = np.zeros((self.n, 2))
        for name in self.order:
            mix += self.layer(name)
        mix = dsp.iir(mix, [dsp.rbj('hp', 27.0, 0.7071)], tail=0.5)
        tp = dsp.true_peak_db(mix)
        self.master_gain_db = peak_dbtp - tp
        self.out = dsp.fade(mix[:, 0] * lin(self.master_gain_db), 0.02, 0.3)[:, None] * np.array([1.0, 0.0]) + dsp.fade(mix[:, 1] * lin(self.master_gain_db), 0.02, 0.3)[:, None] * np.array([0.0, 1.0])
        return self.out
