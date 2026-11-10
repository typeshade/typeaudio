"""The three passages. Times are picture seconds (source presentation timestamps of the study).
Every level is a loudness target in LUFS before the master gain; every position is in metres."""
import numpy as np
import dsp
import sources as S
from dsp import SR, nsamp, lin
from mix import Mix

# anchors of the picture study (frame-accurate)
RED_FRACTURE = 25.692333
RED_RELEASE = 25.77575
FORCE = 145.186708
COLUMN = 145.937458
FLASH = 177.552375
BEAM = 177.802625
WHITEOUT = 181.765
DISSOLVE = 183.766917
REASSURE = 185.75
END = 189.314625


def curve(points, t0, n):
    """Envelope from (picture seconds, value) points for a layer that starts at t0."""
    return dsp.env_points([(p[0] - t0, p[1]) for p in points], n)


def speed_of(P):
    v = np.linalg.norm(np.diff(P, axis=0), axis=1) * SR
    return dsp.smooth(np.concatenate([v[:1], v]), 0.05)


# =============================================================== red, 20 to 30 s
def red():
    m = Mix('red', 20.0, 30.0)
    T0 = 20.0
    # the hall's air; it gives way a little while the red material is contained
    bed = S.hall_air(12.5, 101)
    bed *= lin(curve([(20, 0), (23.8, 0), (25.2, -4), (25.7, -4), (26.6, 0), (32.5, 0)], T0, len(bed)))[:, None]
    m.add_wide('bed', bed, T0, target=-46, kind='a')

    # one red source from the orbit to the rupture
    n = nsamp(RED_RELEASE - T0)
    path = [(20.0, (-7.0, 2.0, -9.0)), (20.45, (-4.0, 1.2, -5.0)), (20.95, (0.5, 1.4, -1.3)), (21.5, (4.0, 1.2, -5.0)),
            (21.57, (3.3, 0.8, -5.3)), (22.3, (2.5, 2.5, -8.0)), (23.0, (0.8, 2.5, -6.5)), (23.8, (0.4, 1.2, -4.2)),
            (RED_RELEASE, (0.4, 1.2, -4.0))]
    P = m.positions(path, T0, n)
    fmod = curve([(20, 38), (23.8, 38), (24.8, 48), (RED_FRACTURE, 66), (RED_RELEASE, 66)], T0, n)
    depth = curve([(20, 0.55), (23.8, 0.55), (RED_FRACTURE, 0.95), (RED_RELEASE, 0.95)], T0, n)
    f0 = curve([(20, 58), (23.8, 58), (RED_FRACTURE, 66), (RED_RELEASE, 66)], T0, n)
    fc = curve([(20, 550), (23.8, 550), (RED_FRACTURE, 800), (RED_RELEASE, 800)], T0, n)
    wd = curve([(20, 0.9), (23.8, 0.9), (RED_FRACTURE, 0.35), (RED_RELEASE, 0.35)], T0, n)
    low, mid = S.red_core(n, fmod, depth, f0, fc, wd, 111)
    src = curve([(20, 0), (20.05, 1), (23.8, 1), (RED_FRACTURE, 1.6), (RED_RELEASE - 0.004, 1.6), (RED_RELEASE, 0)], T0, n)
    core = (low + mid) * src
    m.add('orb', core, T0, P, target=-21, kind='m', send_db=-9)
    edge = S.aero(speed_of(P), 113, u0=10.0) * src
    m.add('orb-edge', edge, T0, P, target=-25, kind='m', send_db=-9)

    # the orb tears through loose masonry, and three fragments land later
    r = dsp.rng(120)
    hits = np.zeros(nsamp(0.6))
    for dt, a in ((0.0, 0.14), (0.05, 0.09), (0.13, 0.11)):
        k = S.stone_click(a, 10.0, r)
        s = nsamp(dt)
        hits[s: s + len(k)] += k[: len(hits) - s]
    m.add('masonry', hits, 21.57, (3.3, 0.8, -5.3), target=-27, kind='i', focus_db=3)
    for i, (t, a, h, pos) in enumerate(((21.97, 0.04, 0.8, (2.6, 0, -4.6)), (22.06, 0.05, 1.2, (3.8, 0, -5.8)), (22.21, 0.03, 2.0, (2.9, 0, -6.4)))):
        m.add('masonry-frag%d' % i, S.debris(a, h, 121 + i), t, pos, target=-37, kind='i')

    # the lattice strains: micro-cracks whose rate rises toward the failure (rate ~ 1 / time to failure)
    span, c = RED_FRACTURE - 23.8, 0.03
    rr = dsp.rng(130)
    cnt = rr.poisson(9 * np.log((span + c) / c))
    tt = span + c - (span + c) * (c / (span + c)) ** rr.random(cnt)
    crack = np.zeros(nsamp(span + 0.15))
    for t in np.sort(tt):
        fm = np.exp(rr.uniform(np.log(2500), np.log(8000), 3))
        k = S.norm(dsp.contact(dsp.modal(fm, rr.uniform(0.4, 1, 3), dsp.tau_of(fm, 0.003), 0.12), 0.0002)) * (0.35 + 0.65 * (t / span) ** 2) * rr.uniform(0.6, 1.0)
        s = nsamp(t)
        crack[s: s + len(k)] += k[: len(crack) - s]
    m.add('lattice-strain', crack, 23.8, (0.4, 1.2, -4.0), target=-33, kind='i', send_db=-3)

    # the shell fractures (glassy), then the pressure is released two frames later
    m.add('shell-fracture', S.fracture(140, 1800, 9000, 0.003, dur=0.4, k_rate=10), RED_FRACTURE, (0.4, 1.2, -4.0),
          target=-25, kind='i', focus_db=2)
    front, body = S.pressure(dur=0.9, tplus=0.0035, f_body=(62, 46), tau_body=0.18)
    pn = np.zeros(len(front)); k = S.punch(141); pn[: len(k)] = k
    m.add('release', S.saturate(0.55 * front + 0.7 * body + 0.6 * pn), RED_RELEASE, (0.4, 1.2, -4.0), target=-13, kind='i', focus_db=3)

    # the release spreads: a wide burst whose band falls as the front expands
    dur = 1.6
    nw = nsamp(dur)

    def sweep(tf, fr):
        fcn = 300 + 1500 * np.exp(-np.maximum(tf, 0) / 0.16)
        return np.exp(-0.5 * (np.log2(np.maximum(fr[None, :], 1) / fcn[:, None]) / 1.0) ** 2)

    t = np.arange(nw) / SR
    env = np.exp(-t / 0.35)
    env[: nsamp(0.004)] *= np.linspace(0, 1, nsamp(0.004))
    wash = np.stack([dsp.stft_shape(dsp.white(nw, 150 + c), sweep) for c in range(2)], axis=1) * env[:, None]
    m.add_wide('release-wash', wash, RED_RELEASE, target=-17, kind='i', send_db=-3)

    # the defence answers: a glassy surface rings, and particles stream away
    m.add('defence', S.shield(160, f1=510, loss=0.0025, dur=2.4), 26.34, (-1.0, 1.4, -3.2), target=-25, kind='i')
    m.add('defence-2', S.shield(161, f1=510 * 1.19, loss=0.0025, dur=1.8, hard=0.0008), 26.92, (-1.3, 1.6, -3.3), target=-31, kind='i')
    freqs = 510 * S.SHIELD_RATIOS[:7] * 2
    for i, pos in enumerate(((-2.5, 1.5, -3.0), (-1.0, 2.2, -3.5), (0.5, 1.2, -3.0))):
        sp, _ = S.sparkle(3.5, 170 + i, rate0=18, tau=1.1, freqs=freqs, spread=0.02)
        m.add('particles%d' % i, sp, 26.3, pos, target=-39, kind='m')

    # what the release threw up comes down
    frag = ((26.42, 0.12, 1.2, (0.8, 0, -4.5), -30), (26.69, 0.09, 1.5, (-0.6, 0, -5.2), -32), (27.13, 0.06, 1.8, (1.6, 0, -3.8), -35),
            (27.82, 0.045, 2.0, (0.2, 0, -6.0), -37), (28.46, 0.03, 1.0, (2.2, 0, -4.4), -39))
    for i, (t, a, h, pos, tg) in enumerate(frag):
        m.add('fragment%d' % i, S.debris(a, h, 180 + i), t, pos, target=tg, kind='i')
    for i, pos in enumerate(((-1.5, 0.3, -4.5), (2.0, 0.3, -4.2))):
        m.add('dust%d' % i, S.sand(2.7, 190 + i, rate0=1100, tau=0.9), 26.7, pos, target=-44, kind='m')
    return m


# =============================================================== force, 136.5 to 149.7 s
def force():
    m = Mix('force', 136.5, 149.7)
    T0 = 136.5
    bed = S.hall_air(15.7, 201)
    bed *= lin(curve([(136.5, 0), (143.0, -2), (FORCE, -3), (FORCE + 0.02, -3), (147.0, 0), (152.2, 0)], T0, len(bed)))[:, None]
    m.add_wide('bed', bed, T0, target=-43, kind='a')

    # two distant pin drops in a large quiet hall; none in the last five seconds
    m.add('tick0', S.debris(0.012, 0.6, 210), 137.6, (-6.0, 0, -11.0), target=-45, kind='i')
    m.add('tick1', S.debris(0.016, 0.4, 211), 140.3, (5.0, 0, -9.0), target=-46, kind='i')
    m.add('handling', S.cloth(0.45, 212), 138.4, (-0.5, 1.2, -2.0), target=-40, kind='i', send_db=-6)

    # the unseen force: no cue before it; pressure front, falling body, the struck body's modes, hair and cloth
    front, body = S.pressure(dur=0.7, tplus=0.0035, f_body=(58, 42), tau_body=0.09)
    n = len(front)
    ribs = np.zeros(n); k = S.body_modes(220); ribs[: len(k)] = k
    snap = np.zeros(n)
    sn = dsp.spectral(dsp.white(nsamp(0.08), 221), lambda f: dsp.band_gain(f, 1500, 6000, 2)) * np.exp(-np.arange(nsamp(0.08)) / (0.011 * SR))
    s = nsamp(0.008); snap[s: s + len(sn)] = S.norm(sn)
    pn = np.zeros(n); k = S.punch(222); pn[: len(k)] = k
    hit = 0.55 * front + 0.7 * body + 0.5 * ribs + 0.8 * pn + 0.55 * snap
    m.add('force', S.saturate(hit), FORCE, (0.0, 1.3, -2.2), target=-10, kind='i', er_db=-3, send_db=-8)

    # the body travels: fast at first; air and cloth follow it away from us
    T = COLUMN - FORCE - 0.02
    nt = nsamp(T)
    u = 1 - (1 - np.arange(nt) / nt) ** 1.6
    a, b = np.array([0.0, 1.3, -2.2]), np.array([1.4, 1.2, -7.0])
    P = a[None, :] + (b - a)[None, :] * u[:, None]
    m.add('travel-air', S.aero(speed_of(P), 230, u0=8.0) * dsp.fade(np.ones(nt), 0.01, 0.03), FORCE + 0.02, P, target=-32, kind='m')
    fl = S.cloth(T, 231, density=520) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * np.arange(nt) / SR))[: nt]
    m.add('travel-cloth', fl, FORCE + 0.02, P, target=-36, kind='m')

    # the column: a soft body first, then the stone breaks 30 ms later
    fm = np.array([72.0, 118.0, 163.0, 221.0, 287.0])
    thud = S.norm(dsp.contact(dsp.modal(fm, [1, 0.8, 0.6, 0.45, 0.3], dsp.tau_of(fm, 0.03), 0.9), 0.009))
    bm = S.body_modes(240, soft=0.006)
    thud[: len(bm)] += 0.5 * bm
    col = (1.4, 1.2, -7.0)
    m.add('column-thud', S.saturate(thud, 1.6), COLUMN, col, target=-11, kind='i', focus_db=8, send_db=-2)
    m.add('column-crack', S.fracture(241, 500, 10000, 0.02, dur=0.5, k_rate=12, tilt=-0.1, hard=0.0001), COLUMN + 0.030, col, target=-14, kind='i', focus_db=8, send_db=-2)
    nr = nsamp(1.3)
    groan = dsp.spectral(dsp.white(nr, 242), lambda f: dsp.band_gain(f, 40, 110, 3)) * np.exp(-np.arange(nr) / (0.45 * SR))
    m.add('column-groan', dsp.fade(groan, 0.05, 0.1), COLUMN + 0.06, col, target=-26, kind='m', focus_db=6)

    chunks = ((146.107, 0.22, 0.6, (1.5, 0, -6.6), -19), (146.357, 0.16, 1.0, (2.3, 0, -7.2), -21), (146.607, 0.11, 1.4, (1.0, 0, -7.4), -24),
              (147.067, 0.08, 1.8, (2.0, 0, -6.4), -27), (147.597, 0.055, 2.2, (1.3, 0, -7.0), -30), (148.337, 0.035, 2.5, (2.6, 0, -6.9), -33))
    for i, (t, a_, h, pos, tg) in enumerate(chunks):
        m.add('chunk%d' % i, S.debris(a_, h, 250 + i), t, pos, target=tg, kind='i', focus_db=6)
    m.add('dust', S.sand(2.9, 260, rate0=2600, tau=0.95), 146.35, (1.6, 0.4, -7.0), target=-38, kind='m', focus_db=6)
    return m


# =============================================================== finale, 173 to 189.314625 s
def finale():
    m = Mix('finale', 173.0, END)
    T0 = 173.0
    bed = S.hall_air(END - T0 + 2.5, 301)
    bed *= lin(curve([(173, 0), (176.75, 0), (FLASH - 0.06, -6), (FLASH - 0.05, -40), (FLASH, -40), (FLASH + 0.3, 0), (DISSOLVE, -2),
                      (REASSURE, 0), (188.3, 0), (END, -60), (END + 2.5, -90)], T0, len(bed)))[:, None]
    m.add_wide('bed', bed, T0, target=-42, kind='a')

    # the arrival behind the clone: cloth and a small displacement of air, close and dry
    m.add('arrival-cloth', S.cloth(0.7, 310), 173.2, (-0.6, 1.3, -2.0), target=-35, kind='i', send_db=-6)
    na = nsamp(0.6)
    m.add('arrival-air', S.aero(4.0 * np.sin(np.pi * np.arange(na) / na) ** 2, 311, u0=4.0), 173.15, (-0.6, 1.3, -2.0), target=-41, kind='m', send_db=-6)

    # preparation: small, rising, converging to a harmonic series; cut 60 ms before the flash
    pr = dsp.fade(S.prep(FLASH - 0.06 - 176.75, 320), 0.02, 0.01)
    m.add('preparation', pr, 176.75, (-0.3, 1.5, -3.0), target=-24, kind='m', send_db=-4)

    # the flash: pressure front with a sub body, a wide white burst, a bright glassy ring
    front, body = S.pressure(dur=1.4, tplus=0.004, f_body=(49, 40), tau_body=0.35, harmonics=(0.7, 0.8, 0.6, 0.45, 0.3, 0.2, 0.0, 0.12))
    pn = np.zeros(len(front)); k = S.punch(332, dur=0.3); pn[: len(k)] = k
    m.add('flash', S.saturate(0.55 * front + 0.7 * body + 0.6 * pn), FLASH, (0.0, 1.5, -4.0), target=-9, kind='i', focus_db=3)
    m.add_wide('flash-white', S.flash_noise(0.6, 330, tau=0.07), FLASH, target=-11, kind='i', send_db=-3)
    m.add('flash-ring', S.shield(331, f1=1400, loss=0.002, dur=0.9, hard=0.00015, tilt=0.6), FLASH, (0.0, 2.0, -4.0), target=-20, kind='i')

    # the beam: one source from 177.80 to the whiteout; the world's answer grows, the beam does not
    D = DISSOLVE - BEAM + 0.4
    nb = nsamp(D)
    tb = BEAM

    def lows_out(x):
        # in the whiteout the lows leave first
        def g(tf, fr):
            fcut = np.interp(tf + tb, [tb, WHITEOUT, DISSOLVE], [20, 20, 600])[:, None]
            return 1 / np.sqrt(1 + (fcut / np.maximum(fr[None, :], 1)) ** 4)
        return dsp.stft_shape(x, g)

    core = lows_out(S.beam_core(D, 340, f0=49.0)) * curve([(tb, 0), (tb + 0.06, 1), (tb + 1.5, 1), (WHITEOUT, 0.88), (DISSOLVE, 0.03), (tb + D, 0)], tb, nb)
    m.add('beam-core', core, tb, (0.0, 4.0, -4.5), target=-15.5, kind='s', send_db=-3, er_db=-9)   # a tall source: no single floor bounce
    body = np.stack([lows_out(S.comb_sweep(S.beam_body(D, 341 + c))) for c in range(2)], axis=1)
    body *= curve([(tb, 0), (tb + 0.08, 0.8), (WHITEOUT, 1.1), (DISSOLVE, 0.05), (tb + D, 0)], tb, nb)[:, None]
    m.add_wide('beam-body', body, tb, target=-17, kind='s', send_db=-3)
    edge = np.stack([S.beam_edge(D, 343 + c) for c in range(2)], axis=1)
    edge *= curve([(tb, 0), (tb + 0.12, 0.5), (WHITEOUT, 1.0), (DISSOLVE, 0.07), (tb + D, 0)], tb, nb)[:, None]
    m.add_wide('beam-edge', edge, tb, target=-25, kind='s', send_db=-6)
    sky = S.wide_noise(D, 345, 7000, 15000, pinkish=False) * curve([(tb, 0), (179.5, 0.05), (WHITEOUT, 0.8), (182.6, 1.0), (DISSOLVE, 0.12), (tb + D, 0)], tb, nb)[:, None]
    m.add_wide('sky-air', sky, tb, target=-33, kind='s', send_db=-6)
    ns = nsamp(5.0)
    shake = S.wide_noise(5.0, 347, 25, 70, order=3) * lin(3 * dsp.smooth(dsp.white(ns, 349), 0.4) / 0.1).clip(0.3, 3)[:, None]
    shake *= curve([(177.9, 0), (178.6, 0.6), (WHITEOUT, 1.0), (182.9, 0)], 177.9, ns)[:, None]
    m.add_wide('hall-shake', shake, 177.9, target=-36, kind='r')

    # the hall answers: a strain crack high up and four falling stones
    m.add('strain', S.fracture(350, 300, 4000, 0.02, dur=0.6, k_rate=9), 180.14, (3.0, 6.0, -6.0), target=-16, kind='i', focus_db=6)
    stones = ((178.89, 0.18, 4.0, (2.5, 0, -6.0), -16), (179.17, 0.12, 5.0, (-2.0, 0, -5.5), -17), (179.77, 0.08, 6.0, (3.5, 0, -7.0), -19), (180.52, 0.06, 7.0, (-3.0, 0, -6.5), -21))
    for i, (t, a_, h, pos, tg) in enumerate(stones):
        m.add('stone%d' % i, S.debris(a_, h, 360 + i), t, pos, target=tg, kind='i', focus_db=6)

    # the clone dissolves: tonal grains lose rate and coherence, and the lighter ones last longer
    base = 510 * S.SHIELD_RATIOS[:6]
    lo, _ = S.sparkle(2.0, 370, rate0=150, tau=0.35, freqs=base, glen=(0.012, 0.03), spread=0.01, rise=0.25, noisy=0.55)
    hi, _ = S.sparkle(2.0, 371, rate0=90, tau=0.8, freqs=base * 2.52, glen=(0.008, 0.02), spread=0.02, rise=0.3, noisy=0.7, bw=500.0)
    m.add('dissolve-low', dsp.fade(lo, 0.03, 0.2), DISSOLVE, (0.3, 1.0, -3.0), target=-31, kind='m', send_db=-6)
    m.add('dissolve-high', dsp.fade(hi, 0.03, 0.3), DISSOLVE, (0.3, 1.4, -3.0), target=-33, kind='m', send_db=-6)

    # human scale returns: last grains, one pebble far away in the big hall, cloth close by
    m.add('last-grains', S.sand(0.9, 380, rate0=180, tau=0.35), 185.8, (0.3, 0.1, -3.0), target=-42, kind='m', send_db=-6)
    m.add('pebble', S.debris(0.014, 0.5, 381), 186.95, (3.5, 0, -8.0), target=-39, kind='i')
    m.add('closing-cloth', S.cloth(0.5, 382, density=220), 187.35, (-0.4, 1.2, -1.8), target=-40, kind='i', send_db=-6)
    return m


PASSAGES = {'red': red, 'force': force, 'finale': finale}
