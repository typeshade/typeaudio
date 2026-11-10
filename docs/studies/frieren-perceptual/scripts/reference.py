"""Measure the original sound of the reference against a rendered round, section by section.
usage: python3 reference.py <reference.wav> <output directory>

The reference WAV is the sound of the reference video at 48 kHz, 16 bit, stereo:
  ffmpeg -i <reference video> -vn -ac 2 -ar 48000 -c:a pcm_s16le reference.wav
It stays outside the repository. No sample of it enters a render: it is measured, as a reference
level, a reference spectrum and a reference of timing. It holds music and speech with the effects,
so a section with music or speech says little about the effects alone."""
import os
import sys
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np

import analyze as A
import dsp
from dsp import SR

SPANS = {
    'red': (20.0, [('flight', 20.0, 22.3), ('close', 22.31, 22.79), ('far', 23.06, 23.76), ('cracks', 23.81, 24.65), ('shell', 24.75, 25.69),
                   ('release', 25.78, 26.27), ('ice burst', 26.28, 26.7), ('ice stands', 26.7, 28.4), ('dust', 28.5, 30.0), ('wind', 30.25, 32.3)]),
    'force': (136.5, [('lines', 136.6, 142.4), ('stare', 142.5, 145.1), ('force', 145.13, 145.3), ('ring and flight', 145.3, 145.93),
                      ('column', 145.94, 146.3), ('collapse', 146.3, 147.75), ('fog', 147.75, 148.45), ('wall', 148.5, 149.65)]),
    'finale': (173.0, [('circle, spoken line', 174.46, 176.3), ('charge', 176.84, 177.46), ('gap', 177.48, 177.62), ('eruption', 177.64, 177.8),
                       ('torrent 1st second', 177.8, 178.8), ('torrent 2nd second', 178.8, 179.8), ('torrent 3rd second', 179.8, 180.8),
                       ('torrent 4th second', 180.8, 181.76), ('whiteout', 181.76, 183.6), ('dissolution', 183.77, 185.45), ('last shot', 185.5, 188.3)]),
}
DUR = {'red': 12.5, 'force': 15.7, 'finale': 18.814625}


def bands(x, a, b):
    seg = x[int(a * SR): int(b * SR)].mean(axis=1)
    P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2 / len(seg)
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    return [10 * np.log10(P[(f >= lo) & (f < hi)].sum() / SR * 2 + 1e-20) for lo, hi in ((20, 60), (60, 250), (250, 1000), (1000, 4000), (4000, 12000))]


def crest(x, a, b):
    seg = x[int(a * SR): int(b * SR)]
    return 20 * np.log10(np.abs(seg).max() / np.sqrt((seg ** 2).mean()))


def band_levels(x, t0, lo, hi, a, b, step):
    """The level of a band of a passage in steps, from a to b picture seconds (dBFS)."""
    y = dsp.spectral(x.mean(axis=1)[int((a - t0 - 0.3) * SR): int((b - t0 + 0.3) * SR)], lambda f: dsp.band_gain(f, lo, hi, 4))
    k, off = int(step * SR), int(0.3 * SR)
    return [float(10 * np.log10((y[off + i * k: off + (i + 1) * k] ** 2).mean() + 1e-12)) for i in range(int(round((b - a) / step)))]


def level(x, a, d):
    seg = x[int(a * SR): int((a + d) * SR)]
    return float(10 * np.log10((seg ** 2).mean() + 1e-12))


ref_path, out = sys.argv[1:3]
w = wave.open(ref_path)
assert w.getframerate() == SR and w.getnchannels() == 2 and w.getsampwidth() == 2, 'the reference must be 48 kHz, 16 bit, stereo'
whole = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, 2).astype(float) / 32768
for name, (t0, spans) in SPANS.items():
    ref = whole[int(t0 * SR): int((t0 + DUR[name]) * SR)]
    mine = np.load('%s/%s.npy' % (out, name)).astype(float)
    print('=' * 20, name, '| integrated: original %.1f LUFS, render %.1f LUFS' % (dsp.integrated_lufs(ref), dsp.integrated_lufs(mine)))
    for lab, x in (('original', ref), ('render', mine)):
        for sl, a, b in spans:
            v = A.variety(x, a - t0, b - t0)
            md = A.mod_depth(x, a - t0, b - t0)
            print('  %-8s %-20s %6.1f LUFS  crest %4.1f dB  bands dBFS (20-60, 60-250, 250-1k, 1k-4k, 4k-12k) %s  tones %2.0f %% transients %2.0f %% noise %2.0f %%  deepest periodic line %4.1f %% at %2.0f Hz' % (
                lab, sl, A.lavg(x, a - t0, b - t0), crest(x, a - t0, b - t0), ' '.join('%6.1f' % q for q in bands(x, a - t0, b - t0)), 100 * v[0], 100 * v[1], 100 * v[2], 100 * md[0], md[1]))
    if name == 'finale':
        for lab, x in (('original', ref), ('render', mine)):
            print('  %-8s torrent 178.0 to 181.5 s, third-octave levels against the strongest band, 25 Hz to 12.7 kHz: %s' % (lab, [round(float(q), 1) for q in A.third_octaves(x, 178.0 - t0, 181.5 - t0)]))
            print('  %-8s torrent: the level of 50 ms blocks varies by %.1f dB below 120 Hz, %.1f dB from 200 to 1000 Hz, %.1f dB from 2 to 8 kHz; correlation of left and right %.2f' % (
                (lab,) + A.flutter(x, 178.0 - t0, 181.5 - t0) + (float(np.corrcoef(x[int(5.0 * SR): int(8.5 * SR), 0], x[int(5.0 * SR): int(8.5 * SR), 1])[0, 1]),)))
            print('  %-8s level each 20 ms from 177.40 s (dBFS): %s' % (lab, ' '.join('%5.1f' % level(x, t - t0, 0.02) for t in np.arange(177.40, 177.90, 0.02))))
            print('  %-8s level each 0.25 s from 183.0 s (dBFS): %s' % (lab, ' '.join('%5.1f' % level(x, t - t0, 0.25) for t in np.arange(183.0, 186.0, 0.25))))
            for nm, lo, hi in (('under 120 Hz', 30.0, 120.0), ('200 to 1500 Hz', 200.0, 1500.0), ('2 to 8 kHz', 2000.0, 8000.0)):
                e = band_levels(x, t0, lo, hi, 183.0, 185.25, 0.25)
                print('  %-8s the end of the torrent, %s, each 0.25 s from 183.0 s, against 183.25 s (dB): %s' % (lab, nm, ' '.join('%+5.1f' % (v - e[1]) for v in e)))
    if name == 'force':
        print('  original level each 20 ms from 145.08 s (dBFS): %s' % ' '.join('%5.1f' % level(ref, t - t0, 0.02) for t in np.arange(145.08, 145.44, 0.02)))
        for lab, x in (('original', ref), ('render', mine)):
            print('  %-8s the body of the wall hit, 60 to 150 Hz, each 0.1 s from 145.95 s (dBFS): %s' % (lab, ' '.join('%5.1f' % v for v in band_levels(x, t0, 60.0, 150.0, 145.95, 146.95, 0.1))))
            print('  %-8s the top of the wall hit, 2 to 8 kHz, each 0.1 s from 145.95 s (dBFS): %s' % (lab, ' '.join('%5.1f' % v for v in band_levels(x, t0, 2000.0, 8000.0, 145.95, 146.95, 0.1))))
