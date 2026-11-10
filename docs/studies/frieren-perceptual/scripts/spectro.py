"""Spectrogram pictures (log frequency), written as PNG with the standard library only."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json
import struct
import zlib

import numpy as np

import dsp
from dsp import SR, nsamp


def png(path, rgb):
    h, w, _ = rgb.shape
    raw = b''.join(b'\x00' + rgb[y].astype(np.uint8).tobytes() for y in range(h))
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def cmap(v):
    """v in 0..1 -> rgb, dark blue to yellow-white."""
    pts = np.array([[0, 0, 0, 12], [0.25, 40, 20, 110], [0.5, 150, 40, 110], [0.72, 235, 110, 50], [0.9, 250, 210, 90], [1.0, 255, 255, 235]], float)
    out = np.zeros(v.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(v, pts[:, 0], pts[:, c + 1])
    return out


def spectrogram(x, px_per_s=100, height=360, fmin=30.0, fmax=20000.0, lo=-95.0, hi=-15.0, nfft=4096):
    mono = x.mean(axis=1)
    hop = SR // px_per_s
    win = dsp.hann(nfft)
    xp = np.concatenate([np.zeros(nfft // 2), mono, np.zeros(nfft)])
    nf = len(mono) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(nf)[:, None]
    P = np.abs(np.fft.rfft(xp[idx] * win, axis=1)) ** 2 / (win.sum() ** 2) * 4
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    edges = np.exp(np.linspace(np.log(fmin), np.log(fmax), height + 1))
    img = np.zeros((height, nf))
    for b in range(height):
        m = (fr >= edges[b]) & (fr < edges[b + 1])
        if m.any():
            img[b] = P[:, m].sum(axis=1)
        else:
            img[b] = P[:, np.argmin(np.abs(fr - np.sqrt(edges[b] * edges[b + 1])))]
    d = 10 * np.log10(np.maximum(img, 1e-20))
    return np.clip((d - lo) / (hi - lo), 0, 1)[::-1], edges


def render(path, x, t0, marks=(), px_per_s=100):
    v, edges = spectrogram(x, px_per_s)
    rgb = cmap(v)
    h, w = v.shape
    # one-second ticks along the bottom, and frequency lines at 100 Hz, 1 kHz, 10 kHz
    first = int(np.ceil(t0))
    for s in np.arange(first, t0 + w / px_per_s, 1.0):
        c = int(round((s - t0) * px_per_s))
        if 0 <= c < w:
            rgb[h - (14 if int(s) % 5 == 0 else 7):, c] = [255, 255, 255]
    for f in (100, 1000, 10000):
        r = h - 1 - int(np.searchsorted(edges, f))
        rgb[r, ::6] = [120, 120, 120]
    for tm in marks:
        c = int(round((tm - t0) * px_per_s))
        if 0 <= c < w:
            rgb[: 18, c] = [80, 255, 120]
    png(path, rgb)


if __name__ == '__main__':
    out = sys.argv[1]
    marks = {'red': [21.12, 21.80, 23.06, 23.81, 24.81, 25.692333, 25.77575, 26.317958, 26.5265, 28.53, 30.25], 'force': [142.5, 145.02, 145.186708, 145.270125, 145.937458, 146.479667, 147.772625, 148.05, 148.34, 149.7],
             'finale': [173.66, 174.46, 176.86, 177.510542, 177.552375, 177.802625, 181.765, 183.766917, 185.75, 189.314625]}
    for name in sys.argv[2:] or ['red', 'force', 'finale']:
        x = np.load('%s/%s.npy' % (out, name)).astype(float)
        meta = json.load(open('%s/%s-meta.json' % (out, name)))
        render('%s/%s-spectrogram.png' % (out, name), x, meta['t0'], marks[name])
        print(name, 'spectrogram written')
