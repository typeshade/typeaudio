"""Receipts: what the rendered passages measure, against what the design asks for."""
import sys, json
import numpy as np
import dsp
from dsp import SR, nsamp


def lw(x, a, b, w):
    """Max loudness (window w seconds) of stereo x between a and b seconds (file time)."""
    seg = x[max(0, nsamp(a)): nsamp(b)]
    if len(seg) < nsamp(w) + 2:
        seg = np.concatenate([seg, np.zeros((nsamp(w) + 2 - len(seg), 2))])
    _, l = dsp.loudness_blocks(seg, w, w / 8)
    return float(l.max())


def lavg(x, a, b):
    seg = dsp.k_weight(x[max(0, nsamp(a)): nsamp(b)])
    return float(-0.691 + 10 * np.log10(max((seg ** 2).sum(axis=1).mean(), 1e-12)))


def rise_time(x, t, pre=0.02, post=0.05):
    """10 to 90 % rise of the envelope at an onset near file time t, in ms; and the peak time."""
    a, b = nsamp(t - pre), nsamp(t + post)
    e = np.abs(x[a:b]).max(axis=1)
    k = 6
    e = np.array([e[max(0, i - k): i + 1].max() for i in range(len(e))])
    pk = e.max()
    ip = int(np.argmax(e >= 0.9 * pk))
    base = e[: nsamp(pre) - 12].max() if nsamp(pre) > 12 else 0.0
    thr = base + 0.1 * (pk - base)
    i10 = int(np.argmax(e >= thr))
    return (ip - i10) / SR * 1000, (a + ip) / SR


def onset(x, t, look=0.06):
    """At an onset at file time t: level 1 ms after it against the peak of the next `look` s (dB),
    the time to reach half that peak (ms), and the time of the peak (s)."""
    a = nsamp(t)
    e = np.abs(x[a - 2: a + nsamp(look)]).max(axis=1)
    pk = e.max()
    first = e[: nsamp(0.001) + 2].max()
    t50 = int(np.argmax(e >= 0.5 * pk)) / SR * 1000
    return 20 * np.log10(max(first, 1e-12) / pk), t50, t + (int(np.argmax(e)) - 2) / SR


def bands_share(x, a, b):
    seg = x[nsamp(a): nsamp(b)].mean(axis=1)
    P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    edges = [0, 60, 250, 2000, 6000, 24000]
    tot = P.sum()
    return [float(10 * np.log10(max(P[(f >= edges[i]) & (f < edges[i + 1])].sum() / tot, 1e-12))) for i in range(5)]


def tilt(x, a, b):
    seg = x[nsamp(a): nsamp(b)].mean(axis=1)
    P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    oc = [(f0, f0 * 2) for f0 in (62.5, 125, 250, 500, 1000, 2000, 4000, 8000)]
    lv = [10 * np.log10(max(P[(f >= lo) & (f < hi)].sum(), 1e-20)) for lo, hi in oc]
    return float(np.polyfit(np.arange(len(lv)), lv, 1)[0]), [round(v - max(lv), 1) for v in lv]


def audible(layer, rest, a, b):
    """ERB bands in which the layer is at least as strong as everything else, in its window."""
    t, L, edges = dsp.band_levels(layer.mean(axis=1))
    _, R, _ = dsp.band_levels(rest.mean(axis=1))
    sel = (t >= a) & (t <= b)
    snr = (L[sel] - R[sel])
    best = snr.max(axis=0)
    return int((best >= 0).sum()), float(best.max()), float(edges[int(best.argmax())])


def phone(x):
    return dsp.iir(x, [dsp.rbj('hp', 350, 0.54), dsp.rbj('hp', 350, 1.31), dsp.rbj('lp', 9000, 0.7071)], tail=0.2)


def mono_loss(x, a, b):
    seg = x[nsamp(a): nsamp(b)]
    st = (seg ** 2).mean()
    mo = (((seg[:, 0] + seg[:, 1]) / 2) ** 2).mean()
    return float(10 * np.log10(max(mo, 1e-20) / max(st, 1e-20)))


def profile(x, step=0.5):
    t, l = dsp.loudness_blocks(x, 0.4, 0.1)
    out = []
    for a in np.arange(0, len(x) / SR, step):
        s = (t >= a) & (t < a + step)
        if s.any():
            out.append((a, float(l[s].max())))
    return out


def roughness(x, a, b):
    """A proxy: modulation energy between 25 and 120 Hz of the band envelopes, loudness weighted."""
    seg = x[nsamp(a): nsamp(b)].mean(axis=1)
    edges = dsp.erb_bands(80, 6000, 18)
    nfft, hop = 512, 64
    win = dsp.hann(nfft)
    nf = 1 + (len(seg) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(nf)[:, None]
    P = np.abs(np.fft.rfft(seg[idx] * win, axis=1)) ** 2
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    fs_env = SR / hop
    tot, wsum = 0.0, 0.0
    for i in range(len(edges) - 1):
        msk = (fr >= edges[i]) & (fr < edges[i + 1])
        if not msk.any():
            continue
        env = np.sqrt(P[:, msk].sum(axis=1))
        if env.mean() <= 0:
            continue
        E = np.abs(np.fft.rfft((env - env.mean()) * np.hanning(len(env)))) ** 2
        fe = np.fft.rfftfreq(len(env), 1 / fs_env)
        mod = E[(fe >= 25) & (fe <= 120)].sum() / max((env.mean() ** 2) * len(env) ** 2 / 4, 1e-20)
        w = env.mean() ** 0.6
        tot += w * mod; wsum += w
    return float(tot / max(wsum, 1e-20))
