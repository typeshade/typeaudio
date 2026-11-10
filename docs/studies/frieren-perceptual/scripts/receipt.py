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
                               ('flame, close', 22.33, 22.76, 'm'), ('stones are pulled in, wide', 23.1, 23.75, 'm'), ('plates lock, close', 23.83, 24.4, 'm'), ('plates hold, close', 24.42, 24.75, 'm'), ('sphere, wide', 24.8, 25.68, 'm'),
                               ('shell fracture', 25.69, 25.77, 'i'), ('release', 25.775, 26.1, 'i'), ('rays and walls', 25.82, 26.26, 'm'), ('ice burst', 26.276, 26.6, 'i'), ('ice stands', 26.9, 27.8, 'm'),
                               ('smoke and debris', 28.6, 30.1, 'm'), ('wind in hair', 30.4, 32.0, 'm')]),
    'force': dict(t0=136.5, cues=[('shield residue', 136.5, 136.9, 'i'), ('bed under the lines', 137.2, 138.3, 'm'), ('handling', 138.4, 138.9, 'i'),
                                  ('last two seconds before the force', 143.1, 145.1, 'm'), ('force', 145.18, 145.3, 'i'), ('ring and dust', 145.3, 145.75, 'i'),
                                  ('wall hit', 145.93, 146.08, 'i'), ('jet of dust', 146.03, 146.25, 'm'), ('split and breakout', 146.26, 146.65, 'i'), ('blocks in the air', 146.7, 147.7, 'm'), ('landings in the dust', 147.8, 148.45, 'i'), ('crater', 148.9, 149.6, 'm'), ('tail end', 151.2, 152.2, 'm')]),
    'finale': dict(t0=173.0, cues=[('bed', 173.1, 173.6, 'm'), ('staff swing', 173.72, 174.4, 'i'), ('circle under the line', 175.0, 176.8, 'm'), ('charge', 176.9, 177.46, 'm'),
                                   ('shot', 177.5105, 177.552, 'i'), ('hit', 177.552, 177.72, 'i'), ('pillar, wide', 177.8, 178.1, 'm'), ('torrent, close', 178.15, 179.15, 'm'), ('torrent third second', 179.9, 180.9, 'm'),
                                   ('torrent last second', 180.8, 181.76, 'm'), ('whiteout middle', 182.5, 183.0, 'm'), ('dissolution start', 183.8, 184.4, 'm'), ('dissolution end', 185.0, 185.45, 'm'),
                                   ('last shot under the line', 186.5, 188.2, 'm'), ('fade', 188.8, 189.3, 'm')]),
}
for name in names:
    x = np.load('%s/%s.npy' % (out, name)).astype(float)
    meta = json.load(open('%s/%s-meta.json' % (out, name)))
    c = CUES[name]; t0 = c['t0']
    print('=' * 20, name, 'master gain %+.2f dB' % meta['master_gain_db'], '| integrated %.1f LUFS | true peak %.2f dBTP' % (dsp.integrated_lufs(x), dsp.true_peak_db(x)))
    print('  master: drive %.1f dB into a look-ahead limiter and a soft clip; the limiter goes %.1f dB deep and works %.1f %% of the time' % (meta['drive_db'], meta['limit_db'], 100 * meta['limited_share']))
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
        lowb = dsp.spectral(x.mean(axis=1), lambda f: dsp.band_gain(f, 60.0, 150.0, 4))
        topb = dsp.spectral(x.mean(axis=1), lambda f: dsp.band_gain(f, 2000.0, 8000.0, 4))
        print('  the body of the wall hit, 60 to 150 Hz, each 0.1 s from 145.95 (dBFS):', [round(float(10 * np.log10((lowb[nsamp(a - t0): nsamp(a + 0.1 - t0)] ** 2).mean() + 1e-12)), 1) for a in np.arange(145.95, 146.95, 0.1)])
        print('  the top of the wall hit, 2 to 8 kHz, each 0.1 s from 145.95 (dBFS):', [round(float(10 * np.log10((topb[nsamp(a - t0): nsamp(a + 0.1 - t0)] ** 2).mean() + 1e-12)), 1) for a in np.arange(145.95, 146.95, 0.1)])
        print('  after the wall hit: level each 0.1 s from 145.9 (dBFS):', [round(float(10 * np.log10((x[nsamp(a - t0): nsamp(a + 0.1 - t0)] ** 2).mean() + 1e-12)), 1) for a in np.arange(145.9, 147.75, 0.1)])
        print('  landings in the dust: rise of the level at each landing (80 ms after against 80 ms before):', ['%.2f s %+.1f dB' % (a, 10 * np.log10(((x[nsamp(a - t0): nsamp(a + 0.08 - t0)] ** 2).mean() + 1e-12) / ((x[nsamp(a - 0.08 - t0): nsamp(a - t0)] ** 2).mean() + 1e-12))) for a in (147.84, 148.05, 148.34, 148.62, 148.93)])
        print('  phone band (350 Hz to 9 kHz): force L100 %.1f, column L100 %.1f, bed %.1f' % (A.lw(ph, f0, f0 + 0.25, 0.1), A.lw(ph, 145.937458 - t0, 146.3 - t0, 0.1), A.lavg(ph, f0 - 2.0, f0 - 0.01)))
        print('  band shares of the force (0.3 s):', [round(v, 1) for v in A.bands_share(x, f0, f0 + 0.3)], ' of the column:', [round(v, 1) for v in A.bands_share(x, 145.937458 - t0, 146.3 - t0)])
    if name == 'red':
        r0 = 25.77575 - t0
        ph = A.phone(x)
        o = A.onset(x, r0)
        print('  release onset: %.1f dB below the peak after 1 ms, half the peak after %.2f ms; band shares (0.3 s) %s; phone band L100 %.1f' % (o[0], o[1], [round(v, 1) for v in A.bands_share(x, r0, r0 + 0.3)], A.lw(ph, r0, r0 + 0.3, 0.1)))
        print('  the three views of the orb: flight %.1f, close %.1f, far %.1f LUFS' % (A.lw(x, 0.2, 1.0, 0.4), A.lw(x, 2.33, 2.76, 0.4), A.lw(x, 3.1, 3.7, 0.4)))
    if name == 'finale':
        er = 177.552375 - t0
        fi = 177.510542 - t0
        ph = A.phone(x)
        o = A.onset(x, er)
        print('  hit onset: %.1f dB below the peak after 1 ms, half the peak after %.2f ms; L100 %.1f' % (o[0], o[1], A.lw(x, er, er + 0.16, 0.1)))
        print('  stealth: the circle %.1f LUFS and the charge %.1f LUFS; the hit is %.1f dB over the charge; the frame before the shot %.1f dBFS' % (
            A.lavg(x, 174.9 - t0, 176.8 - t0), A.lavg(x, 176.9 - t0, 177.46 - t0), A.lw(x, er, er + 0.16, 0.1) - A.lavg(x, 176.9 - t0, 177.46 - t0),
            float(10 * np.log10((x[nsamp(177.472 - t0): nsamp(177.507 - t0)] ** 2).mean() + 1e-12))))
        print('  the charge follows the light: level each 0.1 s from 176.76 (dBFS):', [round(float(10 * np.log10((x[nsamp(a - t0): nsamp(a + 0.1 - t0)] ** 2).mean() + 1e-12)), 1) for a in np.arange(176.76, 177.46, 0.1)])
        print('  shot, hit, pillar: level each frame from 177.469 (dBFS):', [round(float(10 * np.log10((x[nsamp(a - t0): nsamp(a + 1001 / 24000 - t0)] ** 2).mean() + 1e-12)), 1) for a in 177.468833 + np.arange(16) * 1001 / 24000])
        print('  the view moves in from 177.80 to 178.12: share of the energy above 1 kHz %.1f dB at 177.80 to 177.95, %.1f dB at 178.15 to 178.6' % (
            10 * np.log10(sum(10 ** (v / 10) for v in A.bands_share(x, 177.80 - t0, 177.95 - t0)[3:]) + 1e-12), 10 * np.log10(sum(10 ** (v / 10) for v in A.bands_share(x, 178.15 - t0, 178.6 - t0)[3:]) + 1e-12)))
        print('  torrent, loudness of each second from 177.8, then the whiteout:', [round(A.lavg(x, a - t0, a + 1 - t0), 1) for a in (177.8, 178.8, 179.8, 180.76)], round(A.lavg(x, 181.76 - t0, 183.6 - t0), 1))
        for nm_, lo_, hi_ in (('under 120 Hz', 30.0, 120.0), ('200 to 1500 Hz', 200.0, 1500.0), ('2 to 8 kHz', 2000.0, 8000.0)):
            yb = dsp.spectral(x.mean(axis=1), lambda f: dsp.band_gain(f, lo_, hi_, 4))
            print('  the end of the torrent, %s, each 0.25 s from 183.0 (dBFS):' % nm_, [round(float(10 * np.log10((yb[nsamp(a - t0): nsamp(a + 0.25 - t0)] ** 2).mean() + 1e-12)), 1) for a in np.arange(183.0, 185.0, 0.25)])
        print('  torrent, level each 0.25 s from 183.5 (dBFS):', [round(float(10 * np.log10((x[nsamp(a - t0): nsamp(a + 0.25 - t0)] ** 2).mean() + 1e-12)), 1) for a in np.arange(183.5, 185.5, 0.25)])
        seg = x[nsamp(178.0 - t0): nsamp(181.5 - t0)]
        print('  torrent 178.0 to 181.5 s: crest %.1f dB; correlation of left and right %.2f; tones %.0f %%, transients %.0f %%, noise %.0f %%; deepest periodic line %.1f %% at %.0f Hz' % (
            (20 * np.log10(np.abs(seg).max() / np.sqrt((seg ** 2).mean())), float(np.corrcoef(seg[:, 0], seg[:, 1])[0, 1])) + tuple(100 * v for v in A.variety(x, 178.0 - t0, 181.5 - t0)) + (100 * A.mod_depth(x, 178.0 - t0, 181.5 - t0)[0], A.mod_depth(x, 178.0 - t0, 181.5 - t0)[1])))
        print('  torrent, third-octave levels against the strongest band, 25 Hz to 12.7 kHz:', [round(float(v), 1) for v in A.third_octaves(x, 178.0 - t0, 181.5 - t0)])
        print('  torrent, the level of 50 ms blocks varies by %.1f dB below 120 Hz, %.1f dB from 200 to 1000 Hz, %.1f dB from 2 to 8 kHz' % A.flutter(x, 178.0 - t0, 181.5 - t0))
        print('  torrent band shares:', [round(v, 1) for v in A.bands_share(x, 178.5 - t0, 181.5 - t0)], ' phone band torrent %.1f, hit %.1f' % (A.lavg(ph, 178.5 - t0, 181.5 - t0), A.lw(ph, er, er + 0.16, 0.1)))
    # --- is each detail audible against everything else? (ERB bands where it is at least as strong)
    L = np.load('%s/%s-layers.npz' % (out, name))
    g = dsp.lin(meta['master_gain_db'])
    mixsum = sum(L[k].astype(float) for k in L.files)
    checks = {'red': [('orb-flight', 20.2, 22.2), ('orb-voice', 20.2, 22.2), ('orb-sparks0', 20.2, 22.2), ('rock-pass6', 21.55, 21.75), ('spark-hit1', 21.12, 21.2), ('spark-hit2', 21.80, 21.9),
                      ('flame-close', 22.33, 22.76), ('orb-voice-close', 22.33, 22.76), ('flame-cracks', 22.33, 22.76), ('clump-c', 23.1, 23.77), ('clump-l', 23.1, 23.77), ('pull1', 23.17, 23.43), ('clump-grind', 23.3, 23.77),
                      ('lock2', 24.09, 24.3), ('lock-grind', 23.85, 24.4), ('crack-spread', 23.85, 24.6), ('crack-tone', 23.85, 24.6),
                      ('shell', 24.8, 25.68), ('shell-tone', 24.8, 25.68), ('shell-strain', 25.2, 25.69), ('shell-fracture', 25.692, 25.76), ('release-fall', 25.8, 26.2), ('release-slap', 26.02, 26.2), ('ray-hit0', 25.82, 26.0), ('ray-hit4', 25.92, 26.1), ('ray-sear1', 25.84, 26.25), ('ray-debris0', 25.98, 26.4),
                      ('shell-groan1', 25.28, 25.64), ('ice-boom', 26.28, 26.6), ('ice-crack', 26.28, 26.5), ('ice-slab3', 26.445, 26.7), ('ice-crush0', 26.29, 26.6), ('ice-groan1', 26.78, 27.28), ('ice-tick0', 26.93, 27.15),
                      ('ice-mist', 27.0, 28.3), ('wall-debris0', 26.9, 28.4), ('smoke', 28.6, 30.1), ('smoke-hiss', 28.6, 30.1), ('smoke-swell', 28.9, 29.6), ('debris-rain0', 28.6, 30.1),
                      ('hair-cloth', 30.4, 32.0), ('wind-tone', 30.6, 32.0)],
              'force': [('shield-residue', 136.5, 136.9), ('settle0', 137.05, 137.4), ('handling', 138.4, 138.85), ('far-thump0', 138.95, 139.3), ('stare', 143.3, 145.1),
                        ('floor-crack', 145.2, 145.6), ('shock-ring', 145.3, 145.7), ('grit0', 145.27, 145.6), ('force-slap0', 145.34, 145.6), ('travel-air', 145.3, 145.75),
                        ('wall-hit', 145.94, 146.0), ('wall-boom', 145.94, 146.6), ('wall-crater', 145.967, 146.02), ('dust-jet', 146.03, 146.5), ('wall-split', 146.26, 146.45), ('breakout', 146.47, 146.7), ('block-knock1', 146.97, 147.2),
                        ('wall-rumble', 146.6, 147.3), ('dust-hiss', 146.4, 148.4), ('dust-billow', 146.4, 148.4), ('land0', 147.84, 148.04), ('land1', 148.05, 148.3), ('land2', 148.34, 148.6),
                        ('land3', 148.62, 148.9), ('land4', 148.93, 149.2), ('land-patter', 147.95, 148.9),
                        ('trickle', 148.6, 149.5), ('wall-ticks', 148.7, 149.5), ('wall-groan', 148.88, 149.3)],
              'finale': [('staff-swing', 173.8, 174.3), ('circle', 175.0, 176.7), ('charge', 177.05, 177.46), ('charge-air', 177.05, 177.46), ('fire', 177.51, 177.55),
                         ('blast', 177.552, 177.7), ('blast-wall', 177.552, 177.7), ('floor-break1', 177.64, 177.8), ('wall-hit0', 177.68, 177.85), ('vault-hit', 177.83, 178.0), ('floor-ring', 177.9, 178.2),
                         ('flare', 178.19, 178.3), ('rip2', 178.31, 178.5), ('vault-debris0', 178.55, 178.9),
                         ('beam-rumble', 178.2, 181.0), ('beam-body', 178.2, 181.0), ('beam-tear', 178.2, 181.0), ('beam-sear', 178.2, 181.0), ('beam-howl', 178.2, 181.0),
                         ('beam-crackle0', 178.2, 181.0), ('blocks0', 178.2, 181.0), ('ring2', 179.25, 179.6), ('strain', 180.14, 180.3),
                         ('dissolve-breath', 183.8, 185.0), ('dissolve-threads', 183.9, 185.0), ('dissolve-tone', 183.9, 185.0), ('remnants', 185.9, 187.5), ('rest', 186.6, 188.3)]}[name]
    for k, a, b in checks:
        lay = L[k].astype(float)
        nb, best, fbest = A.audible(lay, mixsum - lay, a - t0, b - t0)
        print('  audible  %-16s %7.2f-%7.2f: %2d of 34 bands, best %+5.1f dB near %5.0f Hz' % (k, a, b, nb, best, fbest))
    if name == 'force':
        c0 = 145.967458 - t0
        print('  column crack, first 20 ms band shares:', [round(v, 1) for v in A.bands_share(x, c0, c0 + 0.02)])
    # --- sync: the first sample of each anchored layer against its anchor
    anchors = {'red': [('spark-hit1', 21.12), ('spark-hit2', 21.80), ('lock0', 23.83), ('shell-fracture', 25.692333), ('release', 25.77575), ('ray-hit0', 25.82075), ('ice-crack', 26.27625), ('smoke', 28.53)], 'force': [('force', 145.186708), ('wall-hit', 145.937458), ('wall-crater', 145.967458), ('wall-split', 146.26), ('breakout', 146.47), ('land1', 148.05), ('land2', 148.34)],
               'finale': [('ignite', 176.86), ('fire', 177.510542), ('blast', 177.552375), ('beam-body', 177.552375), ('vault-hit', 177.832625), ('dissolve-breath', 183.766917), ('staff-swing', 173.72)]}[name]
    for k, ta in anchors:
        e = np.abs(L[k].astype(float)).max(axis=1)
        first = int(np.argmax(e > e.max() * 1e-3))
        print('  sync  %-14s first sound at %.5f s, anchor %.5f s, difference %+.2f ms' % (k, t0 + first / SR, ta, (t0 + first / SR - ta) * 1000))
    lr = 10 * np.log10((x[:, 0] ** 2).sum() / (x[:, 1] ** 2).sum())
    print('  left against right, whole: %+.2f dB' % lr)
    # --- what the ear takes the sound for (the first listening review: a rotor, a drum and a ball, water)
    if name == 'red':
        print('  periodic modulation: flight %.1f dB at %.1f Hz; shell %.1f dB at %.1f Hz (white noise reads about 6 dB)' % (A.mod_peak(x, 0.1, 2.25) + A.mod_peak(x, 4.8, 5.68)))
        print('  depth of the strongest modulation line: flight %.1f %% at %.1f Hz; shell %.1f %% at %.1f Hz (white noise about 1 %%; the first version read 27 and 25 %%)' % (
            100 * A.mod_depth(x, 0.1, 2.25)[0], A.mod_depth(x, 0.1, 2.25)[1], 100 * A.mod_depth(x, 4.8, 5.68)[0], A.mod_depth(x, 4.8, 5.68)[1]))
        print('  band shares of the flight (20.1 to 22.25 s):', [round(v, 1) for v in A.bands_share(x, 0.1, 2.25)])
    if name == 'force':
        for lab, a, b in (('force', 145.186708, 145.31), ('column', 145.937458, 146.06)):
            print('  share of the 40 to 900 Hz energy in 3 lines, %-16s %.2f (a noise burst reads about 0.3)' % (lab, A.tonal_share(x, a - t0, b - t0)))
    if name == 'finale':
        print('  dissolution 183.8 to 185.7 s: strongest-line share of 400 to 4000 Hz %.2f (white noise 0.12), share of the energy in that band %.2f, the strongest line jumps in %.2f of the frames' % A.blip_share(x, 183.8 - t0, 185.7 - t0))
    # --- one sound or several (the second listening review: flat, one sound at a time)
    SPANS = {'red': [('flight', 20.0, 22.3), ('close and whip', 22.3, 23.05), ('stones pulled in', 23.06, 23.78), ('plates lock', 23.8, 24.77), ('sphere', 24.8, 25.69), ('burst and rays', 25.77, 26.27), ('ice', 26.28, 28.45), ('smoke', 28.53, 30.2), ('wind', 30.25, 32.3)],
             'force': [('before the force', 136.6, 145.1), ('force and flight', 145.19, 145.93), ('hit, jet and breakout', 145.94, 146.65), ('blocks in the air', 146.65, 147.75), ('landings in the dust', 147.78, 148.45), ('crater', 148.5, 149.65)],
             'finale': [('before the circle', 173.0, 174.46), ('circle and charge', 174.46, 177.46), ('shot, hit and pillar', 177.51, 178.12), ('torrent', 178.12, 181.76), ('whiteout', 181.76, 183.76), ('dissolution', 183.77, 185.45), ('last shot', 185.5, 188.3)]}[name]
    LL = {k: L[k] for k in L.files}
    ts, cnt, full, heard = A.streams(LL, g)
    for lab, a, b in SPANS:
        lead, near, order = A.balance(LL, a - t0, b - t0)
        v = A.variety(x, a - t0, b - t0)
        sel = (ts >= a - t0) & (ts < b - t0)
        print('  layers  %-24s loudest layer %5.1f dB under the sum, %2d within 6 dB of it; heard at once: median %d, three or more %3.0f %% of the time; tones %2.0f %%, transients %2.0f %%, noise %2.0f %%' % (
            lab, lead, near, np.median(cnt[sel]), 100 * (cnt[sel] >= 3).mean(), 100 * v[0], 100 * v[1], 100 * v[2]))
    # --- the size of things (the third listening review: glass marbles, too light)
    SIZES = {'red': [('flight', 20.0, 22.3), ('stones pulled in', 23.06, 23.78), ('plates lock', 23.8, 24.77), ('burst and rays', 25.77, 26.27), ('ice burst', 26.28, 26.7), ('ice stands', 26.7, 28.4), ('smoke', 28.53, 30.2)],
             'force': [('before the force', 136.6, 145.1), ('force', 145.19, 145.6), ('wall hit', 145.94, 146.3), ('blocks in the air', 146.65, 147.75), ('landings in the dust', 147.78, 148.45), ('crater', 148.5, 149.65)],
             'finale': [('circle and charge', 174.46, 177.46), ('hit', 177.552, 177.8), ('torrent', 177.9, 181.7), ('whiteout', 181.76, 183.6), ('dissolution', 183.77, 185.45)]}[name]
    for lab, a, b in SIZES:
        fc, rad, share = A.size_cue(x, a - t0, b - t0)
        print('  size  %-24s sharp and pitched parts centre at %5.0f Hz (ka = 1 of a body of %5.1f cm); %4.1f %% of the energy is sharp or pitched above 2 kHz; 30-250 Hz over 2-10 kHz %+5.1f dB; band shares %s' % (
            lab, fc, 100 * rad, 100 * share, A.weight(x, a - t0, b - t0), [round(v, 1) for v in A.bands_share(x, a - t0, b - t0)]))
