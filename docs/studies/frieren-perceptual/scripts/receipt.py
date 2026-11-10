"""Print what the rendered passages measure: python3 receipt.py <output directory> [red force finale]"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json

import numpy as np

import analyze as A
import dsp
from dsp import SR, nsamp

out = sys.argv[1]
names = sys.argv[2:] or ['red', 'force', 'finale']
CUES = {
    'red': dict(t0=20.0, cues=[('flight with the orb', 20.2, 21.0, 'm'), ('spark hit 1', 21.12, 21.3, 'i'), ('spark hit 2', 21.80, 21.97, 'i'), ('rock bursts near', 21.98, 22.25, 'i'),
                               ('flame, close', 22.33, 22.76, 'm'), ('wide, orb far', 23.1, 23.7, 'm'), ('cracks spread, close', 23.85, 24.6, 'm'), ('shell, wide', 24.8, 25.68, 'm'),
                               ('shell fracture', 25.69, 25.77, 'i'), ('release', 25.775, 26.1, 'i'), ('defence burst', 26.30, 26.6, 'i'), ('sparkles and shards', 26.9, 27.8, 'm'),
                               ('dust cloud', 28.6, 29.9, 'm'), ('wind in hair', 30.4, 32.0, 'm')]),
    'force': dict(t0=136.5, cues=[('shield residue', 136.5, 136.9, 'i'), ('bed under the lines', 137.2, 138.3, 'm'), ('handling', 138.4, 138.9, 'i'),
                                  ('last two seconds before the force', 143.1, 145.1, 'm'), ('force', 145.18, 145.3, 'i'), ('ring and dust', 145.3, 145.75, 'i'),
                                  ('column', 145.93, 146.08, 'i'), ('collapse', 146.4, 147.6, 'm'), ('fog', 147.8, 148.4, 'm'), ('pinned in the wall', 148.5, 149.6, 'm'), ('tail end', 151.2, 152.2, 'm')]),
    'finale': dict(t0=173.0, cues=[('bed', 173.1, 173.6, 'm'), ('staff swing', 173.72, 174.4, 'i'), ('circle under the line', 175.0, 176.7, 'm'), ('preparation', 176.9, 177.49, 'm'),
                                   ('gap before the flash', 177.50, 177.55, 'i'), ('flash', 177.55, 177.8, 'i'), ('beam first second', 177.9, 178.9, 'm'), ('beam third second', 179.9, 180.9, 'm'),
                                   ('beam last second', 180.8, 181.76, 'm'), ('whiteout middle', 182.5, 183.0, 'm'), ('dissolution start', 183.8, 184.4, 'm'), ('dissolution end', 185.0, 185.45, 'm'),
                                   ('last shot under the line', 186.5, 188.2, 'm'), ('fade', 188.8, 189.3, 'm')]),
}
for name in names:
    x = np.load('%s/%s.npy' % (out, name)).astype(float)
    meta = json.load(open('%s/%s-meta.json' % (out, name)))
    c = CUES[name]; t0 = c['t0']
    print('=' * 20, name, 'master gain %+.2f dB' % meta['master_gain_db'], '| integrated %.1f LUFS | true peak %.2f dBTP' % (dsp.integrated_lufs(x), dsp.true_peak_db(x)))
    for label, a, b, k in c['cues']:
        w = 0.4 if k == 'm' else 0.1
        print('  %-36s %7.2f-%7.2f  %s %6.1f LUFS   peak %6.1f dBFS' % (label, a, b, 'L400' if k == 'm' else 'L100', A.lw(x, a - t0, b - t0, w), dsp.db(np.abs(x[nsamp(a - t0): nsamp(b - t0)]).max())))
    pk = np.abs(x).max(axis=1)
    order = np.argsort(-pk); got = []
    for i in order:
        if all(abs(i - g) > 0.15 * SR for g in got): got.append(i)
        if len(got) == 5: break
    print('  top peaks:', ', '.join('%.3f s %.1f dBFS' % (t0 + g / SR, dsp.db(pk[g])) for g in got))
    print('  band shares dB (<60, 60-250, 250-2k, 2k-6k, >6k), whole:', [round(v, 1) for v in A.bands_share(x, 0, len(x) / SR)])
    print('  mono fold-down loss, whole: %.2f dB' % A.mono_loss(x, 0, len(x) / SR))
    # --- checks that belong to one passage
    if name == 'force':
        ph = A.phone(x)
        f0 = 145.186708 - t0
        o = A.onset(x, f0)
        print('  force onset: 1 ms after the anchor the level is %.1f dB below the peak; half the peak after %.2f ms; peak at %.4f s' % (o[0], o[1], t0 + o[2]))
        print('  force: L100 %.1f against the last 2 s before it %.1f -> step %.1f dB' % (A.lw(x, f0, f0 + 0.25, 0.1), A.lavg(x, f0 - 2.0, f0 - 0.01), A.lw(x, f0, f0 + 0.25, 0.1) - A.lavg(x, f0 - 2.0, f0 - 0.01)))
        print('  force: loudest 100 ms in the half second before it: %.1f LUFS (bed average %.1f)' % (A.lw(x, f0 - 0.5, f0 - 0.001, 0.1), A.lavg(x, f0 - 2.0, f0 - 0.5)))
        print('  gap: quietest 100 ms between the force and the column: %.1f LUFS' % min(A.lw(x, a, a + 0.1, 0.1) for a in np.arange(f0 + 0.3, 145.937458 - t0 - 0.1, 0.02)))
        print('  collapse: loudness each half second from 146.3:', [round(A.lavg(x, a - t0, a + 0.5 - t0), 1) for a in (146.3, 146.8, 147.3, 147.8, 148.3, 148.8)])
        print('  phone band (350 Hz to 9 kHz): force L100 %.1f, column L100 %.1f, bed %.1f' % (A.lw(ph, f0, f0 + 0.25, 0.1), A.lw(ph, 145.937458 - t0, 146.3 - t0, 0.1), A.lavg(ph, f0 - 2.0, f0 - 0.01)))
        print('  band shares of the force (0.3 s):', [round(v, 1) for v in A.bands_share(x, f0, f0 + 0.3)], ' of the column:', [round(v, 1) for v in A.bands_share(x, 145.937458 - t0, 146.3 - t0)])
    if name == 'red':
        r0 = 25.77575 - t0
        ph = A.phone(x)
        o = A.onset(x, r0)
        print('  release onset: %.1f dB below the peak after 1 ms, half the peak after %.2f ms; band shares (0.3 s) %s; phone band L100 %.1f' % (o[0], o[1], [round(v, 1) for v in A.bands_share(x, r0, r0 + 0.3)], A.lw(ph, r0, r0 + 0.3, 0.1)))
        print('  the three views of the orb: flight %.1f, close %.1f, far %.1f LUFS' % (A.lw(x, 0.2, 1.0, 0.4), A.lw(x, 2.33, 2.76, 0.4), A.lw(x, 3.1, 3.7, 0.4)))
    if name == 'finale':
        fl = 177.552375 - t0
        ph = A.phone(x)
        o = A.onset(x, fl)
        print('  flash onset: %.1f dB below the peak after 1 ms, half the peak after %.2f ms; L100 %.1f; step over the 60 ms gap %.1f dB' % (o[0], o[1], A.lw(x, fl, fl + 0.25, 0.1), A.lw(x, fl, fl + 0.25, 0.1) - A.lw(x, fl - 0.055, fl - 0.002, 0.05)))
        print('  beam short-term loudness each second:', [round(A.lavg(x, a - t0, a + 1 - t0), 1) for a in (177.85, 178.85, 179.85, 180.75)])
        print('  beam tilt dB/octave %.2f, octave levels %s' % A.tilt(x, 178.5 - t0, 181.5 - t0))
        print('  beam band shares:', [round(v, 1) for v in A.bands_share(x, 178.5 - t0, 181.5 - t0)], ' phone band beam %.1f, flash %.1f' % (A.lavg(ph, 178.5 - t0, 181.5 - t0), A.lw(ph, fl, fl + 0.25, 0.1)))
    # --- is each detail audible against everything else? (ERB bands where it is at least as strong)
    L = np.load('%s/%s-layers.npz' % (out, name))
    g = dsp.lin(meta['master_gain_db'])
    mixsum = sum(L[k].astype(float) for k in L.files)
    checks = {'red': [('rock-pass6', 21.55, 21.75), ('spark-hit1', 21.12, 21.2), ('spark-hit2', 21.80, 21.9), ('crack-spread', 23.85, 24.6), ('shell-strain', 25.2, 25.69),
                      ('shell-fracture', 25.692, 25.76), ('defence-crack', 26.30, 26.4), ('defence-ring', 26.5, 27.0), ('sparkles1', 26.8, 28.0), ('hair-cloth', 30.4, 32.0)],
              'force': [('shield-residue', 136.5, 136.9), ('handling', 138.4, 138.85), ('shock-ring', 145.3, 145.7), ('travel-air', 145.3, 145.75), ('column-crack', 145.967, 146.02),
                        ('collapse1', 146.4, 147.6), ('collapse-gravel', 146.5, 147.6), ('trickle', 148.6, 149.5), ('wall-ticks', 148.7, 149.5), ('staff-shards', 148.85, 149.7)],
              'finale': [('staff-swing', 173.8, 174.3), ('circle', 175.0, 176.7), ('preparation', 176.9, 177.49), ('flash-ring', 177.56, 177.8), ('blocks0', 178.2, 181.0),
                         ('ring2', 179.25, 179.6), ('strain', 180.14, 180.3), ('sky-air', 181.0, 183.0), ('dissolve-breath', 183.8, 185.0), ('dissolve-threads', 183.9, 185.0),
                         ('remnants', 185.9, 187.5)]}[name]
    for k, a, b in checks:
        lay = L[k].astype(float)
        nb, best, fbest = A.audible(lay, mixsum - lay, a - t0, b - t0)
        print('  audible  %-16s %7.2f-%7.2f: %2d of 34 bands, best %+5.1f dB near %5.0f Hz' % (k, a, b, nb, best, fbest))
    if name == 'force':
        c0 = 145.967458 - t0
        print('  column crack, first 20 ms band shares:', [round(v, 1) for v in A.bands_share(x, c0, c0 + 0.02)])
    # --- sync: the first sample of each anchored layer against its anchor
    anchors = {'red': [('spark-hit1', 21.12), ('spark-hit2', 21.80), ('shell-fracture', 25.692333), ('release', 25.77575), ('defence-crack', 26.30)], 'force': [('force', 145.186708), ('column-thud', 145.937458), ('column-crack', 145.967458)],
               'finale': [('flash', 177.552375), ('beam-core', 177.802625), ('dissolve-breath', 183.766917), ('staff-swing', 173.72)]}[name]
    for k, ta in anchors:
        e = np.abs(L[k].astype(float)).max(axis=1)
        first = int(np.argmax(e > e.max() * 1e-3))
        print('  sync  %-14s first sound at %.5f s, anchor %.5f s, difference %+.2f ms' % (k, t0 + first / SR, ta, (t0 + first / SR - ta) * 1000))
    lr = 10 * np.log10((x[:, 0] ** 2).sum() / (x[:, 1] ** 2).sum())
    print('  left against right, whole: %+.2f dB' % lr)
    # --- what the ear takes the sound for (the first listening review: a rotor, a drum and a ball, water)
    if name == 'red':
        print('  periodic modulation: flight %.1f dB at %.1f Hz; shell %.1f dB at %.1f Hz (white noise reads about 6 dB)' % (A.mod_peak(x, 0.1, 2.25) + A.mod_peak(x, 4.8, 5.68)))
        print('  band shares of the flight (20.1 to 22.25 s):', [round(v, 1) for v in A.bands_share(x, 0.1, 2.25)])
    if name == 'force':
        for lab, a, b in (('force', 145.186708, 145.31), ('column', 145.937458, 146.06)):
            print('  share of the 40 to 900 Hz energy in 3 lines, %-16s %.2f (a noise burst reads about 0.3)' % (lab, A.tonal_share(x, a - t0, b - t0)))
    if name == 'finale':
        print('  dissolution 183.8 to 185.7 s: strongest-line share of 400 to 4000 Hz %.2f (white noise 0.12), share of the energy in that band %.2f, the strongest line jumps in %.2f of the frames' % A.blip_share(x, 183.8 - t0, 185.7 - t0))
