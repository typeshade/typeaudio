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
    'red': dict(t0=20.0, cues=[('bed before the orb is near', 20.0, 20.3, 'm'), ('orb passes closest', 20.6, 21.4, 'm'), ('masonry', 21.55, 21.85, 'i'),
                               ('orbit far', 22.4, 23.2, 'm'), ('containment start', 23.8, 24.4, 'm'), ('containment end', 25.0, 25.68, 'm'),
                               ('shell fracture', 25.69, 25.77, 'i'), ('release', 25.775, 26.1, 'i'), ('defence ring', 26.34, 26.7, 'i'),
                               ('fragments', 27.1, 28.6, 'i'), ('late dust and tail', 29.0, 30.0, 'm'), ('tail end', 31.5, 32.5, 'm')]),
    'force': dict(t0=136.5, cues=[('bed', 136.6, 137.5, 'm'), ('pin drop 1', 137.6, 137.9, 'i'), ('handling', 138.4, 138.9, 'i'), ('pin drop 2', 140.3, 140.6, 'i'),
                                  ('last two seconds before the force', 143.1, 145.1, 'm'), ('force', 145.18, 145.45, 'i'), ('travel', 145.45, 145.9, 'i'),
                                  ('column', 145.93, 146.3, 'i'), ('chunks', 146.35, 147.2, 'i'), ('late chunks', 147.5, 148.6, 'i'), ('settled', 149.0, 149.7, 'm'), ('tail end', 151.2, 152.2, 'm')]),
    'finale': dict(t0=173.0, cues=[('bed', 173.0, 173.15, 'm'), ('arrival', 173.2, 173.9, 'i'), ('bed before preparation', 175.0, 176.7, 'm'), ('preparation', 176.9, 177.49, 'm'),
                                   ('gap before the flash', 177.50, 177.55, 'i'), ('flash', 177.55, 177.8, 'i'), ('beam first second', 177.9, 178.9, 'm'), ('beam third second', 179.9, 180.9, 'm'),
                                   ('beam last second', 180.8, 181.76, 'm'), ('whiteout middle', 182.5, 183.0, 'm'), ('dissolution start', 183.8, 184.4, 'm'), ('dissolution end', 185.2, 185.75, 'm'),
                                   ('reassurance', 186.0, 188.3, 'm'), ('fade', 188.8, 189.3, 'm')]),
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
        print('  phone band (350 Hz to 9 kHz): force L100 %.1f, column L100 %.1f, bed %.1f' % (A.lw(ph, f0, f0 + 0.25, 0.1), A.lw(ph, 145.937458 - t0, 146.3 - t0, 0.1), A.lavg(ph, f0 - 2.0, f0 - 0.01)))
        print('  band shares of the force (0.3 s):', [round(v, 1) for v in A.bands_share(x, f0, f0 + 0.3)], ' of the column:', [round(v, 1) for v in A.bands_share(x, 145.937458 - t0, 146.3 - t0)])
    if name == 'red':
        r0 = 25.77575 - t0
        ph = A.phone(x)
        o = A.onset(x, r0)
        print('  release onset: %.1f dB below the peak after 1 ms, half the peak after %.2f ms; band shares (0.3 s) %s; phone band L100 %.1f' % (o[0], o[1], [round(v, 1) for v in A.bands_share(x, r0, r0 + 0.3)], A.lw(ph, r0, r0 + 0.3, 0.1)))
        print('  roughness proxy: orbit far %.4f, containment end %.4f' % (A.roughness(x, 22.4 - t0, 23.4 - t0), A.roughness(x, 24.7 - t0, 25.68 - t0)))
        print('  pass-by swing: far (20.05-20.35) %.1f, closest %.1f, far again (22.4-23.2) %.1f LUFS' % (A.lw(x, 0.05, 0.35, 0.4), A.lw(x, 0.6, 1.4, 0.4), A.lw(x, 2.4, 3.2, 0.4)))
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
    checks = {'red': [('lattice-strain', 25.0, 25.69), ('shell-fracture', 25.692, 25.76), ('masonry', 21.57, 21.75), ('defence', 26.34, 26.6), ('particles1', 26.6, 29.0), ('fragment2', 27.13, 27.2), ('dust0', 27.5, 29.0)],
              'force': [('handling', 138.4, 138.85), ('tick0', 137.6, 137.7), ('travel-air', 145.3, 145.9), ('travel-cloth', 145.3, 145.9), ('column-crack', 145.967, 146.02), ('chunk3', 147.067, 147.12), ('dust', 146.6, 148.5)],
              'finale': [('arrival-cloth', 173.2, 173.9), ('preparation', 176.9, 177.49), ('flash-ring', 177.56, 177.8), ('stone0', 178.89, 178.95), ('stone2', 179.77, 179.83), ('strain', 180.14, 180.3),
                         ('sky-air', 181.0, 183.0), ('dissolve-low', 183.8, 184.6), ('dissolve-high', 184.4, 185.6), ('pebble', 186.95, 187.05), ('closing-cloth', 187.35, 187.85)]}[name]
    for k, a, b in checks:
        lay = L[k].astype(float)
        nb, best, fbest = A.audible(lay, mixsum - lay, a - t0, b - t0)
        print('  audible  %-16s %7.2f-%7.2f: %2d of 34 bands, best %+5.1f dB near %5.0f Hz' % (k, a, b, nb, best, fbest))
    if name == 'force':
        c0 = 145.967458 - t0
        print('  column crack, first 20 ms band shares:', [round(v, 1) for v in A.bands_share(x, c0, c0 + 0.02)])
    # --- sync: the first sample of each anchored layer against its anchor
    anchors = {'red': [('shell-fracture', 25.692333), ('release', 25.77575)], 'force': [('force', 145.186708), ('column-thud', 145.937458), ('column-crack', 145.967458)],
               'finale': [('flash', 177.552375), ('beam-core', 177.802625), ('dissolve-low', 183.766917)]}[name]
    for k, ta in anchors:
        e = np.abs(L[k].astype(float)).max(axis=1)
        first = int(np.argmax(e > e.max() * 1e-3))
        print('  sync  %-14s first sound at %.5f s, anchor %.5f s, difference %+.2f ms' % (k, t0 + first / SR, ta, (t0 + first / SR - ta) * 1000))
    lr = 10 * np.log10((x[:, 0] ** 2).sum() / (x[:, 1] ** 2).sum())
    print('  left against right, whole: %+.2f dB' % lr)
