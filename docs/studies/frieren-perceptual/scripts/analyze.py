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


# ---------------------------------------------------------------- what the ear takes a sound for
def mod_peak(x, a, b, lo=12.0, hi=95.0):
    """Periodic amplitude modulation: the strongest line of the envelope spectrum between lo and hi Hz,
    in dB over the median of that range, and its frequency. A rotor or an engine has a strong line."""
    seg = x[nsamp(a): nsamp(b)].mean(axis=1)
    k = nsamp(0.004)
    env = np.sqrt(np.convolve(seg ** 2, np.ones(k) / k, mode='same'))
    env = env[::k // 2]
    fs = SR / (k // 2)
    E = np.abs(np.fft.rfft((env - env.mean()) * np.hanning(len(env)))) ** 2
    f = np.fft.rfftfreq(len(env), 1 / fs)
    m = (f >= lo) & (f <= hi)
    # smooth over 1 Hz so that a random spectrum does not show false lines
    w = max(1, int(round(1.0 / (f[1] - f[0]))))
    Es = np.convolve(E, np.ones(w) / w, mode='same')[m]
    return float(10 * np.log10(Es.max() / np.median(Es))), float(f[m][int(np.argmax(Es))])


def tonal_share(x, a, b, lo=40.0, hi=900.0, lines=3):
    """Share of the energy between lo and hi Hz that sits in the strongest few spectral lines.
    A drum or a knock on a hollow body has a high share; a noisy thud has a low one."""
    seg = x[nsamp(a): nsamp(b)].mean(axis=1)
    n = 1 << int(np.ceil(np.log2(len(seg) * 4)))
    P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), n)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    m = (f >= lo) & (f <= hi)
    Pm, fm = P[m].copy(), f[m]
    tot = Pm.sum()
    res = SR / len(seg)                      # the width of one line of this window
    got = 0.0
    for _ in range(lines):
        i = int(np.argmax(Pm))
        sel = np.abs(fm - fm[i]) <= 1.5 * res
        got += Pm[sel].sum()
        Pm[sel] = 0
    return float(got / max(tot, 1e-30))


def blip_share(x, a, b, lo=400.0, hi=4000.0):
    """How much of a passage is short pitched blips between lo and hi Hz (what bubbles and drops are made of):
    the mean, over 23 ms frames, of the strongest line's share of the frame's energy in that band,
    weighted by the frame's energy, and the share of the whole energy that lies in the band."""
    seg = x[nsamp(a): nsamp(b)].mean(axis=1)
    nfft, hop = 1024, 256
    win = dsp.hann(nfft)
    nf = max(1, 1 + (len(seg) - nfft) // hop)
    idx = np.arange(nfft)[None, :] + hop * np.arange(nf)[:, None]
    P = np.abs(np.fft.rfft(seg[idx] * win, axis=1)) ** 2
    f = np.fft.rfftfreq(nfft, 1 / SR)
    m = (f >= lo) & (f <= hi)
    band = P[:, m]
    e = band.sum(axis=1)
    pk = np.array([band[i, max(0, j - 1): j + 2].sum() for i, j in enumerate(band.argmax(axis=1))])
    line = float((pk / np.maximum(e, 1e-30) * e).sum() / max(e.sum(), 1e-30))
    fpk = f[m][band.argmax(axis=1)]
    w = np.minimum(e[1:], e[:-1])
    jump = float((w * (np.abs(np.log2(fpk[1:] / fpk[:-1])) > 0.045)).sum() / max(w.sum(), 1e-30))
    return line, float(e.sum() / max(P[:, f >= 60].sum(), 1e-30)), jump


# ---------------------------------------------------------------- how many sounds at once
def streams(layers, gain, hop=0.05, margin=-6.0, floor=-66.0, need=3):
    """For every 50 ms: how many layers can be heard beside the others. A layer counts when, in at least
    `need` ERB bands, it is within `margin` dB of the sum of all the other layers and above `floor` dBFS.
    Also the fullness: the share of the 34 bands that lie within 25 dB of the loudest band of the mix.
    layers: dict name -> (n, 2) array. Returns times, counts, fullness, and the names heard at each time."""
    names = list(layers)
    edges = dsp.erb_bands()
    nfft, h = 4096, nsamp(hop)
    win = dsp.hann(nfft)
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    sel = [(fr >= edges[b]) & (fr < edges[b + 1]) for b in range(len(edges) - 1)]
    n = len(next(iter(layers.values())))
    nf = max(1, (n - nfft) // h)
    idx = np.arange(nfft)[None, :] + h * np.arange(nf)[:, None]
    P = np.zeros((len(names), nf, len(sel)))
    for k, nm in enumerate(names):
        x = layers[nm].astype(float).mean(axis=1) * gain
        S = np.abs(np.fft.rfft(x[idx] * win, axis=1)) ** 2 / (win.sum() ** 2) * 4
        for b, m in enumerate(sel):
            P[k, :, b] = S[:, m].sum(axis=1)
    tot = P.sum(axis=0)
    rest = tot[None, :, :] - P
    snr = 10 * np.log10(np.maximum(P, 1e-30) / np.maximum(rest, 1e-30))
    lev = 10 * np.log10(np.maximum(P, 1e-30))
    heard = ((snr >= margin) & (lev >= floor)).sum(axis=2) >= need          # (layers, frames)
    totdb = 10 * np.log10(np.maximum(tot, 1e-30))
    full = (totdb >= totdb.max(axis=1, keepdims=True) - 25).mean(axis=1)
    t = (h * np.arange(nf) + nfft / 2) / SR
    return t, heard.sum(axis=0), full, [[names[k] for k in np.nonzero(heard[:, i])[0]] for i in range(nf)]


def variety(x, a, b, nfft=2048, hop=512):
    """What the sound is made of, between a and b seconds: the shares of its energy that are steady lines
    (tones), broadband moments (transients) and neither (noise). The spectrogram is median-filtered along
    time (about 0.2 s) and along frequency (about 500 Hz); a cell belongs to tones when the time median is
    twice the frequency median, to transients in the opposite case, and to noise otherwise."""
    seg = x[max(0, nsamp(a)): nsamp(b)].mean(axis=1)
    win = dsp.hann(nfft)
    nf = max(3, 1 + (len(seg) - nfft) // hop)
    idx = np.arange(nfft)[None, :] + hop * np.arange(nf)[:, None]
    idx = np.minimum(idx, len(seg) - 1)
    S = np.abs(np.fft.rfft(seg[idx] * win, axis=1))
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    keep = (fr >= 60) & (fr <= 12000)
    S = S[:, keep]
    kt = max(3, int(round(0.2 * SR / hop)) | 1)
    kf = max(3, int(round(500 / (SR / nfft))) | 1)

    def med(a_, k, axis):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (k // 2, k // 2)
        p = np.pad(a_, pad, mode='edge')
        sl = np.lib.stride_tricks.sliding_window_view(p, k, axis=axis)
        return np.median(sl, axis=-1)

    H = med(S, kt, 0)
    P = med(S, kf, 1)
    E = S ** 2
    tone = E[H > 2 * P].sum()
    hit = E[P > 2 * H].sum()
    tot = E.sum() + 1e-30
    return float(tone / tot), float(hit / tot), float(1 - (tone + hit) / tot)


def balance(layers, a, b, within=6.0):
    """One sound or several, between a and b seconds: the share of the power that the loudest layer
    holds (dB below the sum of the layers) and how many layers lie within `within` dB of the loudest.
    A lead near 0 dB with one layer in reach means that one sound is heard at a time."""
    i0, i1 = max(0, nsamp(a)), nsamp(b)
    p = {k: float((v[i0:i1].astype(float) ** 2).mean()) for k, v in layers.items()}
    tot = sum(p.values()) + 1e-30
    top = max(p.values())
    lead = 10 * np.log10(top / tot)
    near = sum(1 for v in p.values() if v > 0 and 10 * np.log10(v / top) >= -within)
    order = sorted(p, key=p.get, reverse=True)
    return float(lead), int(near), order


def mod_depth(x, a, b, lo=12.0, hi=95.0):
    """How deep the periodic modulation is: the envelope (the squared signal low-passed at 120 Hz, so that
    no ripple of a partial folds into the range) and the amplitude of its strongest line between lo and hi Hz
    as a share of the mean envelope. A rotor reads tens of per cent; a steady tone or a noise reads a few."""
    seg = x[nsamp(a): nsamp(b)].mean(axis=1)
    e2 = dsp.lp(dsp.lp(seg ** 2, 120.0), 120.0)
    env = np.sqrt(np.maximum(e2, 0))[:: SR // 500]
    w = np.hanning(len(env))
    E = 2 * np.abs(np.fft.rfft((env - env.mean()) * w)) / (w.sum() * max(env.mean(), 1e-30))
    f = np.fft.rfftfreq(len(env), 1 / 500.0)
    m = (f >= lo) & (f <= hi)
    i = int(np.argmax(E[m]))
    return float(E[m][i]), float(f[m][i])


def size_cue(x, a, b, nfft=2048, hop=512, split=2000.0):
    """What size of thing the sharp and the pitched parts speak of, between a and b seconds. The cells that
    `variety` counts as tones or transients are taken alone. Returns their centre frequency (the mean on a
    log scale, weighted by energy), the radius of a body whose ka = 1 lies there (54.6 / f, in metres), and
    the share of the whole energy that is sharp or pitched above `split` Hz. A marble rings at several
    kilohertz; a block of a metre speaks near 55 Hz."""
    seg = x[max(0, nsamp(a)): nsamp(b)].mean(axis=1)
    win = dsp.hann(nfft)
    nf = max(3, 1 + (len(seg) - nfft) // hop)
    idx = np.minimum(np.arange(nfft)[None, :] + hop * np.arange(nf)[:, None], len(seg) - 1)
    S = np.abs(np.fft.rfft(seg[idx] * win, axis=1))
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    keep = (fr >= 60) & (fr <= 12000)
    S, f = S[:, keep], fr[keep]
    kt = max(3, int(round(0.2 * SR / hop)) | 1)
    kf = max(3, int(round(500 / (SR / nfft))) | 1)

    def med(a_, k, axis):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (k // 2, k // 2)
        sl = np.lib.stride_tricks.sliding_window_view(np.pad(a_, pad, mode='edge'), k, axis=axis)
        return np.median(sl, axis=-1)

    H, P = med(S, kt, 0), med(S, kf, 1)
    E = S ** 2
    sharp = E * ((H > 2 * P) | (P > 2 * H))
    w = sharp.sum(axis=0)
    fc = float(np.exp((w * np.log(f)).sum() / max(w.sum(), 1e-30)))
    return fc, 54.6 / fc, float(sharp[:, f >= split].sum() / max(E.sum(), 1e-30))


def weight(x, a, b):
    """How heavy a stretch is: the level between 30 and 250 Hz against the level between 2 and 10 kHz, in dB."""
    seg = x[max(0, nsamp(a)): nsamp(b)].mean(axis=1)
    P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    lo = P[(f >= 30) & (f < 250)].sum()
    hi = P[(f >= 2000) & (f < 10000)].sum()
    return float(10 * np.log10(max(lo, 1e-30) / max(hi, 1e-30)))


def third_octaves(x, a, b):
    """Third-octave levels from 25 Hz to 12.7 kHz between a and b seconds, in dB against the strongest band."""
    seg = x[max(0, nsamp(a)): nsamp(b)].mean(axis=1)
    n = 16384
    P = np.zeros(n // 2 + 1)
    for i in range(0, max(1, len(seg) - n), 4096):
        P += np.abs(np.fft.rfft(seg[i:i + n] * np.hanning(n))) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    fc = 1000 * 2 ** (np.arange(-16, 12) / 3.0)
    out = np.array([10 * np.log10(P[(f >= q / 2 ** (1 / 6)) & (f < q * 2 ** (1 / 6))].sum() + 1e-20) for q in fc])
    return out - out.max()


def flutter(x, a, b, bands=((30.0, 120.0), (200.0, 1000.0), (2000.0, 8000.0)), block=0.05):
    """How much a steady sound moves: the standard deviation, in dB, of the level of `block`-second blocks
    in each band. Steady noise of a band B Hz wide reads about 4.34 / sqrt(B * block) dB by itself."""
    seg = x[max(0, nsamp(a)): nsamp(b)].mean(axis=1)
    k = nsamp(block)
    out = []
    for lo, hi in bands:
        y = dsp.spectral(seg, lambda f: dsp.band_gain(f, lo, hi, 4))
        out.append(float(np.std([10 * np.log10((y[i:i + k] ** 2).mean() + 1e-20) for i in range(k, len(y) - 2 * k, k)])))
    return tuple(out)
