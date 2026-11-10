"""The three passages, round 10. Times are picture seconds (source presentation timestamps).
Every event follows the picture: the frames of the reference were inspected on 2026-11-10.
Every level is a loudness target in LUFS before the master gain; every position is in metres
(+x right, +y up, forward is -z, the listener is the camera).
Round 5: every solid thing has the size the picture shows, and its sound starts near 54.6 / size Hz."""
import numpy as np
import dsp
import sources as S
from dsp import SR, nsamp, lin
from mix import Mix, meter

# anchors of the picture study (frame-accurate)
RED_FRACTURE = 25.692333
RED_RELEASE = 25.77575
FORCE = 145.186708
COLUMN = 145.937458
FIRE = 177.510542           # frame 4256: the wide shot; a spark where the two stand
FLASH = 177.552375          # frame 4257, the first white frame: the hit
BEAM = 177.802625           # frame 4263, the first frame that shows the pillar
WHITEOUT = 181.765
DISSOLVE = 183.766917
REASSURE = 185.75
END = 189.314625


def curve(points, t0, n):
    """Envelope from (picture seconds, value) points for a layer that starts at t0."""
    return dsp.env_points([(p[0] - t0, p[1]) for p in points], n)


def line(a, b, n):
    """n positions on a straight path from a to b."""
    a, b = np.array(a, float), np.array(b, float)
    return a[None, :] + (b - a)[None, :] * np.linspace(0, 1, n)[:, None]


def speed_of(P):
    v = np.linalg.norm(np.diff(P, axis=0), axis=1) * SR
    return dsp.smooth(np.concatenate([v[:1], v]), 0.05)


def steady(dur, seed, lo, hi):
    """Steady band noise with short fades: a source whose envelope comes from its path."""
    n = nsamp(dur)
    return dsp.fade(dsp.spectral(dsp.white(n, seed), lambda f: dsp.band_gain(f, lo, hi, 2)), 0.02, 0.04)


def full_bed(m, t0, dur, seed, level, duck):
    """The hall between the events: air, a very low rumble, a thin high air. duck: (picture seconds, dB) points."""
    for name, sig, tg, kind in (('bed', S.hall_air(dur, seed), level, 'a'),
                                ('bed-low', S.wide_noise(dur, seed + 3, 28, 90, order=3), -47.0, 'r'),
                                ('bed-high', S.wide_noise(dur, seed + 5, 5000, 12000), level - 9.0, 'a')):
        sig = sig * lin(curve(duck, t0, len(sig)))[:, None]
        m.add_wide(name, sig, t0, target=tg, kind=kind)


def ticks(times, make, dur):
    y = np.zeros(nsamp(dur))
    for i, t in enumerate(times):
        k = make(i)
        s = nsamp(t)
        e = min(len(y), s + len(k))
        if e > s:
            y[s:e] += k[: e - s]
    return y


# =============================================================== red, 20 to 30 s
def red():
    m = Mix('red', 20.0, 30.0)
    T0 = 20.0
    full_bed(m, T0, 12.5, 101, -41.0, [(20, 0), (24.7, 0), (25.3, -4), (25.7, -4), (26.6, 0), (32.5, 0)])

    # 20.00 to 22.30: the camera flies with the orb. The orb stays in front of us; rocks pass on both sides.
    n = nsamp(22.30 - T0)
    rumble, roar, crackle = S.red_material(n, np.full(n, 0.15), 111)
    m.add('orb-flight', dsp.fade(0.8 * rumble + 1.0 * roar + 0.4 * crackle, 0.03, 0.01), T0, (0.0, 1.5, -3.0), target=-21.5, kind='m', send_db=-12)
    rush = S.wind(22.30 - T0, 114, 150, 1500)
    m.add_wide('flight-air', rush * dsp.fade(np.ones(len(rush)), 0.03, 0.01)[:, None], T0, target=-25, kind='m')
    passes = ((20.15, -1, 2.2, -26), (20.42, 1, 2.6, -27), (20.63, -1, 1.8, -25), (20.88, 1, 2.4, -26), (21.02, -1, 2.0, -26),
              (21.52, 1, 2.2, -26), (21.66, -1, 1.2, -23), (21.74, 1, 1.3, -23), (22.08, -1, 1.1, -22))
    for i, (t, side, near, tg) in enumerate(passes):
        src = steady(0.36, 300 + i, 150, 3000)
        k = len(src)
        P = np.concatenate([line((side * 0.6, 1.5, -9.0), (side * near, 1.5, 0.0), k // 2), line((side * near, 1.5, 0.0), (side * (near + 0.8), 1.5, 9.0), k - k // 2)])
        m.add('rock-pass%d' % i, src, t - 0.18, P, target=tg, kind='i', send_db=-10)

    # the orb strikes rock twice (sparks at 21.12 and 21.80), and a rock bursts toward the camera at 21.98
    r = dsp.rng(120)
    hit1 = np.zeros(nsamp(0.6)); k = S.stone_impact(0.35, 14.0, r); hit1[: len(k)] += S.norm(k); hit1 += 0.3 * S.sizzle(0.6, 121, 0.12)
    m.add('spark-hit1', hit1, 21.12, (0.3, 1.5, -3.0), target=-19, kind='i', send_db=-6)
    hit2 = np.zeros(nsamp(0.7)); k = S.stone_impact(0.5, 16.0, r); hit2[: len(k)] += S.norm(k)
    k = S.heavy_crack(122, size=0.5, dur=0.3, k_rate=8)[: len(hit2)]; hit2[: len(k)] += 0.6 * k; hit2 += 0.35 * S.sizzle(0.7, 123, 0.16)
    m.add('spark-hit2', hit2, 21.80, (-0.2, 1.5, -3.0), target=-16, kind='i', send_db=-6)
    rb = S.norm(S.rock_fall(0.35, 1.5, 124)); k = S.heavy_crack(126, size=0.7, dur=0.4, k_rate=8)[: len(rb)]; rb[: len(k)] += 0.9 * k
    m.add('rock-burst', rb, 21.98, (-0.8, 1.2, -1.5), target=-16, kind='i', send_db=-6)

    # 22.31 to 22.78: close on the flame as it tears through stone
    n2 = nsamp(22.79 - 22.31)
    rumble, roar, crackle = S.red_material(n2, np.full(n2, 0.35), 115)
    m.add('flame-close', dsp.fade(0.8 * rumble + 1.0 * roar + 0.4 * crackle, 0.008, 0.01), 22.31, (0.6, 1.2, -1.4), target=-18.5, kind='m', send_db=-12)
    m.add('flame-crumble', dsp.fade(S.gravel(22.79 - 22.31, 116), 0.008, 0.01), 22.31, (1.0, 0.8, -2.0), target=-22, kind='m', send_db=-8)
    # 22.80 to 23.02: the camera whips
    m.add_wide('whip', S.band_sweep(0.22, 117, 400, 3000, wide=True), 22.80, target=-22, kind='i')

    # 23.06 to 23.77: wide; the red core is far, and the stone of the hall is pulled to it
    rr_g = dsp.rng(127)
    n3 = nsamp(23.76 - 23.06)
    rumble, roar, crackle = S.red_material(n3, np.full(n3, 0.3), 118)
    m.add('orb-far', dsp.fade(0.8 * rumble + 1.0 * roar + 0.3 * crackle, 0.01, 0.01), 23.06, line((2.0, 3.0, -10.0), (0.0, 2.0, -9.0), n3), target=-26, kind='m', send_db=-4)
    # The frames show blocks of stone that fly in from all sides and pack around a glowing core (the core from
    # 23.31, a dense clump by 23.6). Blocks strike blocks, faster and faster, and the mass grinds as it closes.
    core = (0.0, 2.5, -9.0)
    gt, t = [], 0.03
    while t < 0.70:
        gt.append(t)
        t += rr_g.exponential(1.0 / (7.0 + 22.0 * t / 0.70))
    for side, x0 in (('l', -4.5), ('c', 0.0), ('r', 4.5)):
        mine = [q for k, q in enumerate(gt) if k % 3 == ('l', 'c', 'r').index(side)]
        cl = ticks(mine, lambda i: S.block_hit(500 + 7 * i + ('l', 'c', 'r').index(side), size=rr_g.uniform(0.35, 1.0), v=rr_g.uniform(6.0, 11.0)) * (0.5 + 0.5 * mine[i] / 0.70), 1.5)
        P = line((x0, 1.0 + abs(x0) * 0.4, -8.0), core, len(cl))
        m.add('clump-%s' % side, cl, 23.06, P, target=-19, kind='i', focus_db=4, send_db=-4)
    for i, (t, a_, b_) in enumerate(((23.08, (-7.0, 1.0, -4.0), core), (23.17, (6.5, 4.0, -5.0), core), (23.29, (-5.0, 5.0, -12.0), core), (23.38, (7.0, 0.5, -11.0), core), (23.5, (-6.0, 2.0, -6.0), core))):
        src = steady(0.26, 520 + i, 150, 2500)
        m.add('pull%d' % i, src, t, line(a_, b_, len(src)), target=-26, kind='i', send_db=-8)
    gr = S.grind(0.52, 526) * np.linspace(0.3, 1.0, len(S.grind(0.52, 526)))
    m.add('clump-grind', gr, 23.26, core, target=-22, kind='m', focus_db=4, send_db=-4)
    m.add('target-strike', S.burst(129, 35, 140, 0.08, rise=0.004), 23.70, (0.0, 2.0, -9.0), target=-22, kind='i', focus_db=4)

    # 23.81 to 24.65: close on red cracks that spread across the stone
    span = 24.65 - 23.81
    rr = dsp.rng(130)
    tt, t = [], 0.0
    while t < span:
        tt.append(t)
        t += rr.exponential(1.0 / (12 + 16 * t / span))
    def one_crack(i):
        return S.stone_crack(rr, size=rr.uniform(0.12, 0.4)) * rr.uniform(0.5, 1.0)

    crack = ticks(tt, one_crack, span + 0.4)
    close = (0.3, 1.4, -1.6)
    m.add('crack-spread', crack, 23.81, close, target=-21, kind='i', send_db=-8)
    # the plates of stone lock into one another: five heavy seatings, and the grind between them; from 24.4 they hold
    for i, (t, size, x) in enumerate(((23.83, 0.9, -0.6), (23.97, 0.6, 0.7), (24.09, 1.0, 0.1), (24.22, 0.7, -0.4), (24.36, 0.8, 0.5))):
        m.add('lock%d' % i, S.block_hit(530 + i, size=size, v=5.0), t, (x, 1.3, -1.7), target=-18, kind='i', send_db=-8)
    gc = S.grind(0.62, 536)
    m.add('lock-grind', gc * curve([(23.81, 0.6), (24.2, 1.0), (24.43, 0.0)], 23.81, len(gc)), 23.81, (0.2, 1.2, -1.5), target=-21, kind='m', send_db=-8)
    for i, (t, d) in enumerate(((24.45, 0.22), (24.60, 0.17))):
        m.add('lock-creak%d' % i, S.groan(d, 538 + i), t, close, target=-27, kind='m', send_db=-8)
    n4 = nsamp(span)
    _, _, crackle = S.red_material(n4, np.full(n4, 0.6), 131)
    m.add('crack-energy', dsp.fade(crackle, 0.005, 0.01), 23.81, close, target=-25, kind='m', send_db=-8)
    groan = dsp.spectral(dsp.white(n4, 132), lambda f: dsp.band_gain(f, 180, 420, 3)) * np.linspace(0.4, 1.0, n4)
    m.add('crack-groan', dsp.fade(groan, 0.005, 0.01), 23.81, close, target=-26, kind='m', send_db=-8)

    # 24.75 to the fracture: wide; the cracked shell hangs in the hall and tightens
    far = (0.0, 2.5, -9.0)
    n5 = nsamp(RED_RELEASE - 24.75)
    tension = curve([(24.75, 0.6), (RED_FRACTURE, 1.0), (RED_RELEASE, 1.0)], 24.75, n5)
    rumble, roar, crackle = S.red_material(n5, tension, 133)
    src = curve([(24.75, 0), (24.79, 1), (RED_FRACTURE, 1.5), (RED_RELEASE - 0.004, 1.5), (RED_RELEASE, 0)], 24.75, n5)
    m.add('shell', (0.8 * rumble + 1.0 * roar + 0.3 * crackle) * src, 24.75, far, target=-23.5, kind='m', focus_db=4, send_db=-2)
    span, c = RED_FRACTURE - 24.75, 0.03
    cnt = rr.poisson(7 * np.log((span + c) / c))
    tt = np.sort(span + c - (span + c) * (c / (span + c)) ** rr.random(cnt))
    strain = ticks(tt, lambda i: S.stone_crack(rr, size=rr.uniform(0.2, 0.5), bright=0.3) * (0.35 + 0.65 * (tt[i] / span) ** 2) * rr.uniform(0.6, 1.0), span + 0.4)
    m.add('shell-strain', strain, 24.75, far, target=-25, kind='i', focus_db=4, send_db=-3)
    for i, (t, d) in enumerate(((24.95, 0.3), (25.28, 0.36))):
        m.add('shell-groan%d' % i, S.groan(d, 136 + i), t, far, target=-27, kind='m', focus_db=4, send_db=-3)

    # the shell fractures; the pressure leaves two frames later as a violet burst
    m.add('shell-fracture', S.heavy_crack(140, size=1.0, dur=0.4, k_rate=10, bright=0.8), RED_FRACTURE, far, target=-21, kind='i', focus_db=8)
    front, low, slap = S.whump(141, tplus=0.0035, dur=0.6)
    m.add('release', S.saturate(0.55 * front + 0.9 * low + 0.6 * slap), RED_RELEASE, far, target=-12, kind='i', focus_db=10)
    nw = nsamp(1.6)

    def sweep(tf, fr):
        fcn = 300 + 1500 * np.exp(-np.maximum(tf, 0) / 0.16)
        return np.exp(-0.5 * (np.log2(np.maximum(fr[None, :], 1) / fcn[:, None]) / 1.0) ** 2)

    t = np.arange(nw) / SR
    env = np.exp(-t / 0.35)
    env[: nsamp(0.004)] *= np.linspace(0, 1, nsamp(0.004))
    wash = np.stack([dsp.stft_shape(dsp.white(nw, 150 + c), sweep) for c in range(2)], axis=1) * env[:, None]
    m.add_wide('release-wash', wash, RED_RELEASE, target=-17, kind='i', send_db=-3)

    # The ice, read again from the frames (round 10). Frame 630 (26.276) still shows the star of rays; the ice is
    # in frame 631. Round 9 had the ice one frame early and ended the rays there, so the rays only stopped.
    #   26.318  frame 631  slabs of ice stand around her, far taller than she is
    #   26.36 to 26.49     the rays are on the ice: white lines run over it
    #   26.527  frame 635  a white frame: the rays break on the ice
    #   26.568  frame 636  what is left of the rays flies off to the sides
    #   26.61 to 26.69     the glow behind the ice dies
    #   26.69 on           the ice stands; specks of frost hang in the air; mist at its feet
    # Every part has the size of the picture. Nothing small falls and nothing rings.
    ICE = 26.317958
    ICE_FLASH = 26.5265
    ICE_CLEAR = 26.609917
    fig = (0.0, 1.4, -4.0)
    wall = (0.0, 2.0, -5.0)
    # The ice comes up: a short deep thump, the crack of thick ice, and a crunch whose band climbs with the slabs.
    # It is short: the long body belongs to the white frame, where the rays break, and the two must be heard apart.
    m.add('ice-boom', S.boom(160, f=88.0, tau=0.16), ICE, (0.0, 0.5, -4.5), target=-10, kind='i', send_db=-8)
    ic = S.heavy_crack(161, size=1.6, dur=0.22, k_rate=14, bright=0.8)
    m.add('ice-crack', ic, ICE, fig, target=-11, kind='i', focus_db=2, send_db=-6)
    m.add('ice-slap', S.slap(ic, 800), ICE + 0.26, (0.0, 3.0, -15.0), target=-23, kind='i', focus_db=6)
    up = S.band_sweep(0.2, 169, 350, 3800, width_oct=1.5, attack=0.5, wide=True)
    up *= (0.55 + 0.45 * S.irregular(len(up), 170, 20, 110))[:, None]
    # a run of sharp cracks whose band climbs as the slabs shoot up: 26 cracks in 0.17 s at irregular times
    zt = np.sort(rr.uniform(0.0, 0.17, 26))
    zip_ = ticks(zt, lambda i: S.tilted_burst(900 + i, 400.0 * 6.0 ** (zt[i] / 0.17), 1400.0 * 6.0 ** (zt[i] / 0.17), 0.004, tilt=0.3) * rr.uniform(0.5, 1.0), 0.2)
    up = 0.6 * up / np.abs(up).max() + (S.norm(zip_)[: len(up)] if len(zip_) >= len(up) else np.pad(S.norm(zip_), (0, len(up) - len(zip_))))[:, None]
    m.add_wide('ice-rise', up, ICE - 0.005, target=-14, kind='i', send_db=-4)
    # the slabs come at irregular times: equal steps of 40 ms would be a rattle at 25 Hz
    for i, (dt, size, pos) in enumerate(((0.012, 1.0, (-3.0, 1.0, -5.0)), (0.049, 1.4, (3.2, 1.5, -5.5)), (0.071, 0.8, (-1.5, 2.5, -6.5)),
                                         (0.118, 1.8, (1.2, 3.0, -7.0)), (0.137, 1.1, (-3.5, 3.5, -6.0)), (0.181, 0.7, (2.5, 4.0, -6.5)))):
        m.add('ice-slab%d' % i, S.heavy_crack(162 + i, size=size, dur=0.2, k_rate=5, bright=0.2), ICE + dt, pos, target=-18, kind='i', focus_db=2, send_db=-6)
    # The rays are on the ice. The ice takes their top at once: the sound goes dull when the ice stands, and that
    # is what tells the ear that something stands in the way. The lines of light run over the ice as a few
    # cracks, and the pressure grows until the white frame.
    nb = nsamp(0.36)
    benv = curve([(ICE, 0.0), (ICE + 0.012, 0.45), (ICE + 0.09, 0.6), (ICE_FLASH - 0.012, 1.0), (ICE_FLASH + 0.03, 0.55), (ICE_CLEAR, 0.18), (ICE + 0.36, 0.0)], ICE, nb)
    # Behind the ice the rays are dull: the ice takes their top. What is heard is their pressure on it, low, and a
    # thin hiss where they touch it.
    for i, (pos, lo, hi) in enumerate((((-2.6, 2.0, -5.0), 280.0, 1300.0), ((2.6, 2.6, -5.5), 380.0, 1700.0))):
        m.add('block-press%d' % i, S.sear(0.36, 190 + i, lo, hi, sd=5.0) * benv, ICE, pos, target=-18, kind='m', focus_db=3, send_db=-8)
    m.add('block-hiss', S.sear(0.36, 197, 2500.0, 9000.0, sd=6.0) * benv, ICE, wall, target=-27, kind='m', focus_db=3, send_db=-8)
    fz = ICE_FLASH - ICE
    ft = np.sort(rr.uniform(0.02, fz, 9))
    fis = ticks(ft, lambda i: S.stone_crack(rr, size=rr.uniform(0.35, 0.9), bright=0.4) * (0.45 + 0.55 * ft[i] / fz), fz + 0.3)
    m.add('block-fissure', fis, ICE, wall, target=-19, kind='i', focus_db=3, send_db=-6)
    # the white frame: the rays break on the ice. This is the hit that stops them.
    brk = np.zeros(nsamp(2.6))
    for k_, w_ in ((S.heavy_crack(192, size=1.4, dur=0.5, k_rate=12, bright=1.0), 1.0), (S.tilted_burst(193, 500.0, 9000.0, 0.045, tilt=0.4, rise=0.002), 0.8),
                   (S.boom(194, f=92.0, tau=0.55), 1.3)):
        brk[: len(k_)] += w_ * k_[: len(brk)]
    m.add('block-break', S.norm(brk), ICE_FLASH, wall, target=-8, kind='i', focus_db=3, send_db=-3)
    m.add('block-slap', S.slap(S.norm(brk), 900), ICE_FLASH + 0.2, (0.0, 3.0, -15.0), target=-22, kind='i', focus_db=6)
    # the ice that the rays broke is crushed: bright, with no pitch
    for i, pos in enumerate(((-2.2, 1.5, -5.0), (2.2, 2.5, -5.5))):
        m.add('ice-crush%d' % i, S.crush(0.9, 187 + i, 0.14), ICE_FLASH + 0.004 + 0.03 * i, pos, target=-17, kind='i', focus_db=2)
    # one frame later what is left of the rays flies off to the sides and up
    for i, (gl, gr_) in enumerate(((1.0, 0.3), (0.3, 1.0), (0.75, 0.75))):
        m.add_wide('ray-scatter%d' % i, S.lance(195 + i, dur=0.13, f0=5200.0 - 900.0 * i, f1=600.0) * np.array([gl, gr_])[None, :], 26.568208 + 0.012 * i, target=-20, kind='i', send_db=-6)
    # the ice stands. It keeps working for a second: it cracks less and less often, it groans, frost hangs in the air.
    wt = 26.62 + np.cumsum(rr.exponential(1.0, 16) * 0.035 * 1.32 ** np.arange(16))
    wt = wt[wt < 28.35]
    work = ticks(wt - 26.62, lambda i: S.stone_crack(rr, size=rr.uniform(0.25, 0.7), bright=0.6) * rr.uniform(0.5, 1.0) * np.exp(-(wt[i] - 26.62) / 0.9), 28.6 - 26.62)
    m.add('ice-work', work, 26.62, (-0.8, 2.0, -5.2), target=-21, kind='i', focus_db=2, send_db=-4)
    for i, (t, d, pos, tg) in enumerate(((26.66, 0.45, (-2.5, 2.0, -5.5), -21), (26.95, 0.5, (2.8, 2.5, -6.0), -23), (27.42, 0.4, (-1.0, 3.0, -6.5), -27), (28.02, 0.35, (2.0, 2.0, -6.0), -30))):
        m.add('ice-groan%d' % i, S.groan(d, 172 + i), t, pos, target=tg, kind='m', focus_db=2)
    for i, (t, size, pos, tg) in enumerate(((26.93, 0.5, (1.8, 1.0, -5.0), -26), (27.21, 0.35, (-2.6, 2.0, -5.5), -29), (27.74, 0.45, (0.6, 3.0, -6.5), -31), (28.19, 0.3, (-1.4, 1.2, -5.0), -33))):
        m.add('ice-tick%d' % i, S.heavy_crack(180 + i, size=size, dur=0.25, k_rate=3, bright=0.3), t, pos, target=tg, kind='i', focus_db=2)
    mist = S.wide_noise(1.9, 185, 180, 1400) * curve([(26.6, 0), (27.0, 1), (28.0, 0.7), (28.5, 0)], 26.6, nsamp(1.9))[:, None]
    m.add_wide('ice-mist', mist, 26.6, target=-33, kind='m', send_db=-6)
    fr = S.dust(1.9, 186, 3500.0, 11000.0, sd=2.0, grain=0.5, tilt=0.2) * curve([(26.62, 0), (26.85, 1), (27.3, 0.7), (28.0, 0.3), (28.5, 0)], 26.62, nsamp(1.9))[:, None]
    m.add_wide('ice-frost', fr, 26.62, target=-31, kind='m')

    # 25.776 to 26.31: the burst is a star of eight to ten rays that reach the walls and the vault and hold for
    # half a second. Each ray leaves with a tear, strikes stone where it lands, and sears while it holds; what
    # it broke falls after it.
    rays = ((0.045, (-8.5, 2.0, -7.0), 1.2), (0.060, (8.5, 3.5, -8.0), 1.0), (0.085, (-3.0, 13.0, -8.0), 1.4), (0.110, (5.5, 1.0, -16.5), 0.9),
            (0.140, (3.5, 13.0, -11.0), 1.1), (0.170, (-5.5, 4.5, -16.5), 1.3), (0.215, (-6.5, 0.0, -9.5), 0.8), (0.260, (6.0, 0.0, -6.5), 1.0))
    for i, (dt, pos, size) in enumerate(rays):
        m.add_wide('ray-lance%d' % i, S.lance(540 + i) * np.array([1.0 if pos[0] <= 0 else 0.45, 1.0 if pos[0] >= 0 else 0.45])[None, :], RED_RELEASE + dt - 0.035, target=-19, kind='i', send_db=-8)
        m.add('ray-hit%d' % i, S.heavy_crack(550 + i, size=size, dur=0.35, k_rate=7, bright=0.9), RED_RELEASE + dt, pos, target=-13, kind='i', focus_db=5, send_db=-7)      # little of it goes to the hall: the ice must be heard to arrive
    for i, (pos, lo, hi) in enumerate((((-7.0, 3.0, -8.0), 700.0, 1600.0), ((7.0, 4.0, -9.0), 1600.0, 3600.0), ((0.0, 11.0, -9.0), 3600.0, 8000.0))):
        # the rays hold until the ice stands in them; behind the ice they are dull, and they end when they break on it
        se = S.sear(0.86, 560 + i, lo, hi) * curve([(25.80, 0), (25.84, 1), (26.2, 0.8), (ICE, 0.8), (ICE + 0.012, 0.22), (ICE_FLASH, 0.22), (ICE_CLEAR, 0.06), (26.66, 0)], 25.80, nsamp(0.86))
        m.add('ray-sear%d' % i, se, 25.80, pos, target=-15, kind='m', focus_db=5, send_db=-8)
    for i, (t, pos) in enumerate(((25.98, (-8.0, 0.0, -7.5)), (26.07, (8.0, 0.0, -8.5)), (26.2, (-2.5, 0.0, -9.0)), (26.72, (4.5, 0.0, -14.0)), (26.88, (-5.0, 0.0, -15.0)))):
        m.add('ray-debris%d' % i, S.slab_fall(566 + i, size=(0.5, 0.4, 0.7, 0.5, 0.6)[i]), t, pos, target=-20, kind='i', focus_db=4)
    # 26.7 to 28.45: behind the ice, stone keeps coming down from the walls and the vault
    for i, pos in enumerate(((-7.5, 0.0, -9.0), (7.0, 0.0, -11.0))):
        wd = S.tumble(2.0, 572 + i, lambda t: 6.0 * np.exp(-t / 0.9) + 0.8, sizes=(0.15, 0.5), speed=(4.0, 9.0))
        m.add('wall-debris%d' % i, wd, 26.7, pos, target=-24, kind='m', focus_db=3)

    # 28.53 to 30.21: wide: a cloud of smoke fills the hall and rolls; debris flies out of it and rains down
    SMK = 28.53
    # The frames show one slow motion: the cloud rolls, drawn anew every fourth frame, with thin trails that
    # arc out of it. Nothing lands in the frame. So the sound is one roll that swells and sinks (the reference
    # has a low swell near 29.0 s), a soft hiss, and a far, thin patter of what the trails drop.
    sm = S.billow(2.4, 580, 60.0, 600.0) * curve([(SMK, 0), (SMK + 0.3, 0.75), (29.05, 1.0), (29.7, 0.7), (30.3, 0.4), (30.9, 0)], SMK, nsamp(2.4))[:, None]
    m.add_wide('smoke', sm, SMK, target=-20, kind='m', send_db=-6)
    m.add('smoke-swell', S.boom(581, f=85.0, tau=0.55) * curve([(28.85, 0.0), (29.0, 1.0), (31.0, 1.0)], 28.85, len(S.boom(581, f=85.0, tau=0.55))), 28.85, (0.0, 3.0, -10.0), target=-22, kind='m', send_db=-2)
    sh = S.dust(2.2, 582, 700.0, 6000.0, grain=0.15, tilt=0.6) * curve([(SMK, 0), (SMK + 0.3, 1), (29.6, 0.8), (30.25, 0.35), (30.73, 0)], SMK, nsamp(2.2))[:, None]
    m.add_wide('smoke-hiss', sh, SMK, target=-26, kind='m')
    for i, pos in enumerate(((-6.0, 0.0, -11.0), (5.0, 0.0, -13.0))):
        dr = S.tumble(1.9, 584 + i, lambda t: 6.0 * np.exp(-t / 1.1) + 1.0, sizes=(0.05, 0.2), speed=(3.0, 7.0))
        m.add('debris-rain%d' % i, dr, SMK + 0.1, pos, target=-28, kind='m')
    # ---- round 4: tones that last, sharp moments, what comes back from the walls
    ORB = [185.0, 311.0, 466.0, 740.0, 1109.0]            # a dissonant cluster; no two partials closer than 100 Hz
    m.add('orb-voice', dsp.fade(S.voice(22.30 - T0, 401, ORB), 0.03, 0.01), T0, (0.0, 1.5, -3.0), target=-20.5, kind='m', send_db=-12)
    m.add('orb-voice-close', dsp.fade(S.voice(22.79 - 22.31, 402, ORB + [1480.0], wander=0.02), 0.008, 0.01), 22.31, (0.6, 1.2, -1.4), target=-18, kind='m', send_db=-12)
    m.add('orb-voice-far', dsp.fade(S.voice(23.76 - 23.06, 403, ORB[:4]), 0.01, 0.01), 23.06, line((2.0, 3.0, -10.0), (0.0, 2.0, -9.0), nsamp(23.76 - 23.06)), target=-26, kind='m', send_db=-4)
    for i, pos in enumerate(((-1.2, 1.6, -3.2), (1.2, 1.4, -3.2))):
        m.add('orb-sparks%d' % i, dsp.fade(S.pops(22.30 - T0, 404 + i, 16.0, 500, 4000, tau=0.005), 0.02, 0.01), T0, pos, target=-28, kind='m', send_db=-10)
    for nm, sig, t, tg in (('hit1', hit1, 21.12, -26), ('hit2', hit2, 21.80, -23)):
        m.add(nm + '-slap0', S.slap(sig), t + 0.17, (-8.5, 2.0, -6.0), target=tg, kind='i', send_db=-6)
        m.add(nm + '-slap1', S.slap(sig, 1200), t + 0.27, (8.5, 2.0, -9.0), target=tg - 2, kind='i', send_db=-6)
        m.add(nm + '-low', S.burst(406 + (nm == 'hit2'), 40, 140, 0.12, rise=0.004), t, (0.0, 1.0, -3.0), target=tg + 4, kind='i', send_db=-8)
    ck = ticks([0.05, 0.21, 0.37], lambda i: S.heavy_crack(408 + i, size=(0.5, 0.8, 0.6)[i], dur=0.2, k_rate=5), 1.3)
    m.add('flame-cracks', ck, 22.31, (1.0, 0.8, -1.8), target=-17.5, kind='i', send_db=-8)
    m.add('crack-tone', dsp.fade(S.glide(24.65 - 23.81, 410, 220, 311, ratios=(1.0, 1.5, 2.4, 3.2), shape=1.3), 0.02, 0.02), 23.81, close, target=-23, kind='m', send_db=-8)
    sh = S.glide(RED_FRACTURE - 24.75, 411, 311, 466, ratios=(1.0, 2.0, 3.0)) * curve([(24.75, 0), (24.85, 0.5), (RED_FRACTURE - 0.005, 1.0), (RED_FRACTURE, 0)], 24.75, nsamp(RED_FRACTURE - 24.75))
    m.add('shell-tone', sh, 24.75, far, target=-22.5, kind='m', focus_db=4, send_db=-2)
    fall = S.glide(0.7, 412, 900, 180, ratios=(1.0, 1.5, 2.25), shape=0.6) * np.exp(-np.arange(nsamp(0.7)) / (0.22 * SR))
    m.add('release-fall', dsp.fade(fall, 0.004, 0.05), RED_RELEASE, far, target=-18, kind='m', focus_db=10, send_db=-2)
    rel = S.saturate(0.55 * front + 0.9 * low + 0.6 * slap)
    m.add('release-slap', S.slap(rel, 900), RED_RELEASE + 0.24, (0.0, 3.0, -15.0), target=-19, kind='i', focus_db=6)
    # under the close shot of her face the smoke is still there, far and soft, and two last stones land
    for i, (t, a_, pos) in enumerate(((30.62, 0.2, (-5.0, 0, -10.0)), (31.34, 0.15, (4.0, 0, -12.0)))):
        m.add('settle%d' % i, S.rock_fall(a_, 0.5, 415 + i), t, pos, target=-33, kind='i')
    m.drive_db = 8.8
    wi = S.wind(2.25, 182, 300, 3500)
    wi *= curve([(30.25, 0), (30.45, 1), (32.1, 0.8), (32.5, 0)], 30.25, len(wi))[:, None]
    m.add_wide('hair-wind', wi, 30.25, target=-33, kind='m')
    fl = S.cloth(2.2, 183, density=260) * (0.6 + 0.4 * S.irregular(nsamp(2.2), 184, 2, 9))
    m.add('hair-cloth', fl, 30.27, (0.2, 1.5, -0.8), target=-34, kind='m', send_db=-10)
    wt = S.voice(2.2, 416, [620.0, 930.0, 1395.0], wander=0.03, rate=2.0, breath=0.7) * curve([(30.25, 0), (30.6, 1), (32.0, 0.7), (32.45, 0)], 30.25, nsamp(2.2))
    m.add('wind-tone', wt, 30.25, (-0.6, 1.8, -1.5), target=-39, kind='m', send_db=-4)
    return m


# =============================================================== force, 136.5 to 149.7 s
def force():
    m = Mix('force', 136.5, 149.7)
    T0 = 136.5
    full_bed(m, T0, 15.7, 201, -41.0, [(136.5, 0), (142.4, 0), (142.6, -2.5), (FORCE + 0.05, -2.5), (146.5, 0), (152.2, 0)])
    rr = dsp.rng(210)

    # 136.5: the last pieces of the clone's shield fade; then two close faces and three spoken lines: only air
    m.add('shield-residue', S.sand(0.7, 211, rate0=900, tau=0.25), 136.5, (-2.0, 1.5, -6.0), target=-40, kind='m')
    m.add('handling', S.cloth(0.45, 212), 138.4, (-0.5, 1.2, -2.0), target=-37, kind='i', send_db=-6)
    m.add('handling2', S.cloth(0.35, 213, density=300), 140.75, (0.4, 1.1, -2.0), target=-39, kind='i', send_db=-6)
    # far away in the dungeon something heavy lands, twice; dust runs down a wall
    for i, (t, pos) in enumerate(((138.95, (-6.0, 0.0, -11.0)), (141.55, (5.0, 0.0, -12.0)))):
        m.add('far-thump%d' % i, S.burst(214 + i, 35, 110, 0.16, rise=0.012), t, pos, target=-36, kind='i')
    m.add('far-trickle', S.sand(1.4, 216, rate0=500, tau=0.7), 139.1, (3.5, 0.5, -7.0), target=-42, kind='m')

    # 145.187: the force. Nothing announces it and nothing in it has a pitch.
    front, low, slap = S.whump(220, tplus=0.0035, dur=0.7)
    n = len(front)
    ribs = np.zeros(n); k = S.burst(223, 90, 450, 0.028, rise=0.004); ribs[: len(k)] = k
    snap = np.zeros(n)
    sn = dsp.spectral(dsp.white(nsamp(0.08), 221), lambda f: dsp.band_gain(f, 1500, 6000, 2)) * np.exp(-np.arange(nsamp(0.08)) / (0.011 * SR))
    s = nsamp(0.008); snap[s: s + len(sn)] = S.norm(sn)
    hit = 0.55 * front + 0.9 * low + 0.5 * ribs + 0.7 * slap + 0.55 * snap
    m.add('force', S.saturate(hit), FORCE, (0.0, 1.3, -2.2), target=-10, kind='i', er_db=-3, send_db=-8)

    # 145.30 to 145.76: a ring runs through the air and dust lifts where she stood
    m.add_wide('shock-ring', S.band_sweep(0.5, 261, 600, 2600, width_oct=1.3, attack=0.12, wide=True), FORCE + 0.05, target=-16, kind='i', send_db=-6)
    m.add('blast-dust', S.burst(262, 40, 160, 0.14, rise=0.02), FORCE + 0.06, (0.0, 0.5, -1.5), target=-20, kind='i', send_db=-6)

    # she flies back to the far column: air and cloth go with her
    T = 145.78 - (FORCE + 0.05)
    nt = nsamp(T)
    u = 1 - (1 - np.arange(nt) / nt) ** 1.6
    a, b = np.array([0.0, 1.3, -2.2]), np.array([0.3, 1.6, -9.5])
    P = a[None, :] + (b - a)[None, :] * u[:, None]
    m.add('travel-air', S.aero(speed_of(P), 230, u0=8.0) * dsp.fade(np.ones(nt), 0.01, 0.03), FORCE + 0.05, P, target=-26, kind='m')
    fl = S.cloth(T, 231, density=520) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * np.arange(nt) / SR))
    m.add('travel-cloth', fl, FORCE + 0.05, P, target=-29, kind='m')
    m.add_wide('whip', S.band_sweep(0.16, 232, 500, 3500, wide=True), 145.78, target=-22, kind='i')

    # ---- the wall, read from the frames at 24 a second. Every sound here belongs to one event of this list, and
    # an event that the frames do not show gets no sound (ledger.py checks both).
    #   145.937           hit       her body strikes the wall; a first puff of dust
    #   145.98 to 146.4   jet       a jet of dust shoots out to the left and grows
    #   146.26            split     the wall splits along a vertical line
    #   146.47            breakout  large blocks leave the wall, in front of the dust
    #   146.5 to 147.72   airborne  the blocks turn in the air and sink out of the frame
    #   147.76 to 148.9   land      dust fills the frame; the blocks reach the floor in it (the original: 148.05 and 148.34 s)
    #   148.49 to 149.66  crater    she hangs in a round crater of cracked wall; dust drifts across
    #   149.70 to 150.02  black     her eyes are shut
    #   150.06 to 152.2   eye       her eye opens on the floor: rubble lies there
    col = (1.0, 1.5, -5.0)
    thud = np.zeros(nsamp(0.9))
    for k_, w_ in ((S.burst(244, 50, 320, 0.07, rise=0.008), 1.0), (S.burst(245, 35, 90, 0.09, rise=0.01), 0.6), (S.burst(246, 120, 600, 0.03, rise=0.005), 0.45)):
        thud[: len(k_)] += w_ * k_[: len(thud)]
    # The hit is a body near 100 Hz that lasts for a second (the reference holds 60 to 150 Hz within 3 dB for 0.8 s),
    # with the short thud of the contact in front of it. The crack and the dust are darker and lie under it.
    m.add('wall-hit', S.saturate(S.norm(thud), 1.6), COLUMN, col, target=-13, kind='i', focus_db=5, send_db=-2)
    m.add('wall-boom', S.boom(243, f=112.0, tau=1.0), COLUMN, col, target=-9, kind='i', focus_db=5, send_db=-2)
    m.add('wall-crater', S.heavy_crack(241, size=1.5, dur=0.5, k_rate=12, bright=0.3), COLUMN + 0.030, col, target=-18, kind='i', focus_db=5, send_db=-2)
    m.add_wide('dust-jet', S.puff(1.8, 247, 100.0, 1600.0, rise=0.05, tau=0.55, tilt=0.9), COLUMN + 0.05, target=-25, kind='i', send_db=-6)
    m.add('dust-jet-left', S.puff(1.4, 249, 100.0, 1200.0, rise=0.06, tau=0.45).mean(axis=1), COLUMN + 0.06, line((0.8, 1.5, -5.0), (-3.5, 1.5, -4.0), nsamp(1.4)), target=-25, kind='i', send_db=-6)
    m.add('wall-split', S.heavy_crack(434, size=1.0, dur=0.3, k_rate=6, bright=0.35), 146.26, col, target=-20, kind='i', focus_db=5)
    bo = S.heavy_crack(435, size=1.6, dur=0.5, k_rate=10, bright=0.35); bb = S.boom(436, f=98.0, tau=0.45)
    bk = np.zeros(max(len(bo), len(bb))); bk[: len(bo)] += 0.7 * bo; bk[: len(bb)] += 1.0 * bb
    m.add('breakout', S.norm(bk), 146.47, col, target=-19, kind='i', focus_db=5)
    # in the air the blocks only knock one another now and then; the wall still gives, low, and that dies away
    ru = S.wide_noise(1.3, 274, 45, 150, order=3)
    ru *= curve([(146.45, 0), (146.6, 1), (147.0, 0.6), (147.75, 0)], 146.45, len(ru))[:, None]
    m.add_wide('wall-rumble', ru, 146.45, target=-22, kind='m', send_db=-6)
    for i, (t, size, pos) in enumerate(((146.69, 0.7, (0.6, 2.2, -4.8)), (146.97, 0.5, (0.0, 1.8, -4.5)), (147.26, 0.8, (0.9, 1.3, -4.9)), (147.52, 0.6, (-0.4, 0.9, -4.4)))):
        m.add('block-knock%d' % i, S.block_hit(270 + i, size=size, v=3.0), t, pos, target=-23, kind='i', focus_db=5)
    # The dust: it is thrown out at 146.0, it fills the frame from 147.78 to 148.4, and it thins while she hangs in the
    # wall. The owner heard noise here (round 9), so the dust is low and soft now: a roll under 500 Hz, and a hiss
    # that is 7 dB lower and has no top.
    dh = S.dust(3.9, 610, 250.0, 2200.0, grain=0.06, tilt=0.9) * curve([(146.0, 0), (146.25, 0.8), (147.0, 0.9), (147.78, 1.0), (148.4, 1.0), (148.9, 0.3), (149.7, 0.1), (149.9, 0)], 146.0, nsamp(3.9))[:, None]
    m.add_wide('dust-hiss', dh, 146.0, target=-29, kind='m')
    db = S.billow(3.4, 612, 60.0, 450.0) * curve([(146.0, 0), (146.3, 1), (147.6, 0.9), (148.4, 0.6), (149.0, 0.25), (149.4, 0)], 146.0, nsamp(3.4))[:, None]
    m.add_wide('dust-billow', db, 146.0, target=-25, kind='m', send_db=-8)
    # The blocks reach the floor in the dust: five landings, the two large ones where the original has its two.
    # Round 9 ended there: after the last large landing the level fell by 25 dB in a second, and the picture ran on
    # for three seconds. A heap of stone does not stop at once. The landings get smaller and rarer, the heap rolls
    # and knocks as it settles, the floor keeps a low roll, and all of it dies away through the black frames.
    for i, (t, size, pos, tg) in enumerate(((147.84, 0.7, (0.3, 0.0, -4.4), -16), (148.05, 1.3, (1.2, 0.0, -5.0), -12.5), (148.34, 1.1, (1.9, 0.0, -5.4), -13.5),
                                            (148.62, 0.6, (0.6, 0.0, -3.6), -18), (148.93, 0.5, (-0.9, 0.0, -3.4), -20), (149.31, 0.4, (1.5, 0.0, -4.2), -23),
                                            (149.78, 0.3, (-0.3, 0.0, -3.9), -27))):
        m.add('land%d' % i, S.slab_fall(600 + i, size=size, tail=1.0 if size >= 1.0 else 0.6), t, pos, target=tg, kind='i', focus_db=5)
    pt = S.tumble(1.1, 614, lambda t: 9.0 - 6.0 * t, sizes=(0.03, 0.08), speed=(2.0, 4.0))
    m.add('land-patter', pt, 147.9, (0.5, 0.0, -3.5), target=-28, kind='m', focus_db=3)
    for i, (pos, tg) in enumerate((((1.6, 0.0, -4.6), -21), ((-0.7, 0.0, -3.8), -23))):
        rb = S.tumble(3.3, 616 + i, lambda t: 11.0 * np.exp(-t / 0.85) + 0.7, sizes=(0.12, 0.45), speed=(1.5, 4.0))
        rb *= curve([(148.5, 1.0), (149.7, 1.0), (150.1, 0.5), (151.6, 0.25), (152.0, 0.0)], 148.3 + 0.2 * i, len(rb))
        m.add('rubble%d' % i, rb, 148.3 + 0.2 * i, pos, target=tg, kind='m', focus_db=3)
    sr = S.billow(4.0, 618, 38.0, 150.0, sd=2.5) * curve([(148.0, 0), (148.5, 1), (149.2, 0.6), (150.2, 0.3), (151.3, 0.1), (152.0, 0)], 148.0, nsamp(4.0))[:, None]
    m.add_wide('heap-roll', sr, 148.0, target=-24, kind='m', send_db=-6)

    # ---- round 4: a tone that holds, the walls' answers, sharp cracks, grit, small bells
    # the hall is alive under the spoken lines: a stone settles now and then, far away
    for i, (t, a, pos) in enumerate(((137.05, 0.15, (-5.0, 0, -10.0)), (139.4, 0.12, (4.0, 0, -8.0)), (141.3, 0.2, (-2.0, 0, -12.0)))):
        m.add('settle%d' % i, S.rock_fall(a, 0.3, 420 + i), t, pos, target=-37, kind='i')
    # the clone's stare, 142.5 to the force: a dark, low tone that only holds; the force cuts it
    st = S.voice(FORCE - 142.5, 424, [110.0, 165.0, 247.0, 370.0], wander=0.004, breath=0.3)
    st *= curve([(142.5, 0), (143.3, 1), (FORCE - 0.003, 1), (FORCE, 0)], 142.5, len(st))
    m.add('stare', st, 142.5, (0.0, 1.6, -6.0), target=-40, kind='m', send_db=-2)
    # the force comes back from two walls, and the stone floor cracks where she stood
    fs = S.saturate(hit)
    m.add('force-slap0', S.slap(fs, 1200), FORCE + 0.15, (-8.5, 2.0, -5.0), target=-22, kind='i', send_db=-4)
    m.add('force-slap1', S.slap(fs, 900), FORCE + 0.26, (8.5, 3.0, -10.0), target=-25, kind='i', send_db=-4)
    m.add('floor-crack', S.heavy_crack(430, size=1.2, dur=0.5, k_rate=9, bright=0.7), FORCE + 0.012, (0.0, 0.1, -2.0), target=-17, kind='i', send_db=-4)
    for i, pos in enumerate(((-1.8, 0.3, -1.2), (1.8, 0.3, -1.2))):
        gr = S.gravel(0.55, 431 + i) * np.exp(-np.arange(nsamp(0.55)) / (0.2 * SR))
        m.add('grit%d' % i, gr, FORCE + 0.08, pos, target=-26, kind='m', send_db=-8)
    m.drive_db = 6.0
    # 148.49 to 149.66, the crater: she hangs in the cracked wall, close: small stone runs down it, the wall ticks and
    # groans. It goes on, thinner, while her eyes are shut and when her eye opens on the rubble.
    near = (0.0, 1.2, -2.5)
    tt_ = 0.12 + np.cumsum(rr.exponential(1.0, 22) * 0.1 * 1.09 ** np.arange(22))
    tr = ticks(tt_, lambda i: S.stone_impact(rr.uniform(0.05, 0.1), 2.0, rr) * np.exp(-tt_[i] / 1.6), 3.6)
    m.add('trickle', tr, 148.5, (0.4, 0.2, -2.3), target=-28, kind='i', send_db=-8)
    wc = ticks([0.20, 0.65, 0.95, 1.52, 2.31], lambda i: S.stone_crack(rr, size=rr.uniform(0.2, 0.4)) * rr.uniform(0.6, 1.0) * (1.0, 1.0, 1.0, 0.6, 0.4)[i], 2.9)
    m.add('wall-ticks', wc, 148.5, near, target=-28, kind='i', send_db=-8)
    m.add('wall-groan', S.groan(0.4, 285), 148.88, near, target=-34, kind='m', send_db=-8)
    return m


# =============================================================== finale, 173 to 189.314625 s
def finale():
    m = Mix('finale', 173.0, END)
    T0 = 173.0
    full_bed(m, T0, END - T0 + 2.5, 301, -41.0, [(173, 0), (174.3, 0), (174.7, -4), (177.46, -4), (177.47, -40), (FLASH, -40), (FLASH + 0.3, 0), (DISSOLVE, -2),
                                                   (REASSURE, 0), (188.3, 0), (END, -60), (END + 2.5, -90)])
    rr = dsp.rng(305)

    # 173.6 to 174.4: the head of the staff comes out of the dust, from the right. Round 9 had a rustle of cloth with
    # it, which the owner heard as a jingle that does not belong: the staff only moves air now, low and soft.
    ns = nsamp(0.74)
    sp = 12.0 * np.sin(np.pi * np.arange(ns) / ns) ** 1.5 + 1.0
    P = line((1.8, 1.3, -1.0), (0.4, 1.3, -1.6), ns)
    m.add('staff-swing', S.aero(sp, 311, u0=8.0, fmax=1800.0) * dsp.fade(np.ones(ns), 0.03, 0.08), 173.66, P, target=-31, kind='m', send_db=-8)
    m.add_wide('staff-air', S.band_sweep(0.7, 313, 160.0, 420.0, width_oct=1.2, attack=0.5, wide=True), 173.68, target=-33, kind='i', send_db=-6)

    # 174.46 to 176.86, the gathering. The cut shows the lit circle under the clone and the staff behind her; from
    # 176.0 sparks stand at the tip. Rounds 7 to 9 kept this at the edge of hearing, and the owner heard nothing
    # where the picture shows mana that gathers. It is heard now and it grows with the picture: air that is drawn
    # in, a low breath of the circle, a breath whose pitch climbs, and sparks at the tip. The charge at its end
    # stays under the level of round 6, which the owner found loud enough to warn the clone.
    CH0, CH1 = 176.86, 177.469           # the ball of light forms at the tip of the staff; the last frame of the two-shot
    G0 = 174.46
    tip = (-0.3, 1.5, -1.2)
    dc = CH1 - G0
    ng = nsamp(dc)
    grow = curve([(G0, 0.0), (174.9, 0.45), (175.6, 0.6), (176.3, 0.8), (CH0, 1.0), (CH1 - 0.02, 1.0), (CH1, 0.0)], G0, ng)
    hum = S.howl(dc, 312, (98.0, 147.0, 220.0), q=8.0, wander=0.02) * grow
    m.add('circle', hum, G0, (0.0, 0.2, -2.5), target=-40.5, kind='m', send_db=-4)

    def climb(tf, fr):
        fc = (260.0 * (1100.0 / 260.0) ** np.clip(tf / dc, 0, 1))[:, None]
        return np.exp(-0.5 * (np.log2(np.maximum(fr[None, :], 1) / fc) / 0.9) ** 2)

    air = np.stack([dsp.stft_shape(dsp.white(ng, 451 + c), climb) for c in range(2)], axis=1)
    air = air / np.sqrt((air ** 2).mean()) * (grow * S.level_walk(ng, 453, 1.5, 0.3, 3.0))[:, None]
    m.add_wide('gather-air', air, G0, target=-35.5, kind='m', send_db=-8)
    gt = np.arange(ng) / SR
    br = np.zeros(ng)
    for i, (f0, f1) in enumerate(((300.0, 420.0), (640.0, 880.0), (1400.0, 1900.0))):
        ab = [dsp.spectral(dsp.white(ng, 455 + 5 * i + c), lambda f: dsp.band_gain(f, 0.01, f0 / 10.0, 2)) for c in (1, 2)]
        ph = 2 * np.pi * np.cumsum(f0 * (f1 / f0) ** np.clip(gt / (CH0 - G0), 0, 1)) / SR
        br += (ab[0] * np.cos(ph) - ab[1] * np.sin(ph)) / (ab[0].std() + 1e-12) / (i + 1) ** 0.5
    m.add('gather-breath', S.norm(br) * grow, G0, tip, target=-36.5, kind='m', send_db=-6)
    mo = S.pops(CH1 - 175.9, 470, 16.0, 1200, 6000, tau=0.003) * curve([(175.9, 0.0), (176.2, 0.4), (CH0, 1.0), (CH1 - 0.012, 1.0), (CH1, 0.0)], 175.9, nsamp(CH1 - 175.9))
    m.add('gather-sparks', mo, 175.9, tip, target=-37.5, kind='m', send_db=-10)

    # 176.86 to 177.47, the charge: a ball of light forms at the tip, grows for 0.2 s and holds. The sound does
    # what the light does: a soft ignition, and a breath that comes up with the ball and holds. It is the top of the
    # gathering, not a new sound.
    dch = CH1 - CH0
    cenv = curve([(CH0, 0), (CH0 + 0.19, 1), (CH1 - 0.012, 1), (CH1, 0)], CH0, nsamp(dch))
    m.add('ignite', S.tilted_burst(320, 120.0, 900.0, 0.05, tilt=0.6, rise=0.02), CH0, tip, target=-35.5, kind='i', send_db=-10)
    m.add('charge', S.howl(dch, 452, (420.0, 880.0, 1900.0), q=4.0, wander=0.05) * cenv, CH0, tip, target=-33.5, kind='m', send_db=-10)
    m.add_wide('charge-air', S.wide_noise(dch, 472, 3000, 9000) * cenv[:, None], CH0, target=-39.5, kind='m')

    # 177.511, the shot (the wide frame, a spark where they stand): a dry crack and a tear, heard across the hall.
    m.add('fire', S.shot(330), FIRE, (0.0, 1.2, -8.0), target=-17, kind='i', focus_db=6, send_db=-2)
    # 177.552, the hit (the first white frame): a pressure front, a long low boom, a wall of noise and a crack.
    front, low, slap = S.whump(332, tplus=0.006, dur=1.4)
    boom = np.zeros(len(front)); k = S.burst(333, 28, 110, 0.32, rise=0.008); boom[: min(len(k), len(boom))] = k[: len(boom)]
    m.add('blast', S.saturate(0.5 * front + 0.8 * low + 0.9 * boom + 0.6 * slap), FLASH, (0.0, 1.5, -6.0), target=-10, kind='i', focus_db=3)
    nw = nsamp(1.2)
    wenv = np.exp(-np.arange(nw) / (0.28 * SR)); wenv[: nsamp(0.012)] *= np.linspace(0, 1, nsamp(0.012))
    wall = np.stack([S.curve_noise(nw, 334 + c) for c in range(2)], axis=1) * wenv[:, None]
    m.add_wide('blast-wall', wall, FLASH, target=-11, kind='i', send_db=-3)
    m.add('blast-crack', S.heavy_crack(331, size=2.0, dur=0.9, k_rate=14, bright=1.0), FLASH, (0.0, 2.0, -6.0), target=-14, kind='i')
    # 177.59 to 177.68, the white frames with lines that run out from the hit: the blast runs over the floor and
    # breaks it, and at 177.68 the frame shows the pillars and the walls struck by it.
    m.add_wide('shock-out', S.band_sweep(0.2, 335, 300, 2500, width_oct=1.5, attack=0.8, wide=True), FLASH + 0.02, target=-15, kind='i', send_db=-4)
    for i, (dt, size, pos) in enumerate(((0.050, 0.8, (-2.0, 0.0, -7.0)), (0.088, 1.0, (2.5, 0.0, -8.5)))):
        m.add('floor-break%d' % i, S.heavy_crack(336 + i, size=size, dur=0.3, k_rate=6, bright=0.8), FLASH + dt, pos, target=-15, kind='i', focus_db=4)
    for i, pos in enumerate(((-8.5, 3.0, -7.0), (8.5, 3.0, -8.0), (0.0, 4.0, -17.0))):
        m.add('wall-hit%d' % i, S.heavy_crack(338 + i, size=1.5, dur=0.4, k_rate=8, bright=0.9), FLASH + 0.126, pos, target=-15, kind='i', focus_db=5)
    # 177.80, the pillar stands from the floor to the vault: it strikes the vault, a ring of light runs out over
    # the floor and passes us, and what the vault lost comes down later. 178.19: a streak of light crosses the frame.
    m.add('vault-hit', S.heavy_crack(342, size=2.0, dur=0.6, k_rate=10, bright=0.8), BEAM + 0.03, (0.0, 13.0, -6.0), target=-11, kind='i', focus_db=5)
    pb = S.burst(343, 26, 80, 0.3, rise=0.03)
    m.add('pillar-boom', pb, BEAM, (0.0, 0.5, -6.0), target=-10, kind='i', send_db=-4)
    m.add_wide('floor-ring', S.band_sweep(0.42, 344, 200, 1800, width_oct=1.4, attack=0.75, wide=True), BEAM, target=-15, kind='i', send_db=-6)
    m.add_wide('flare', S.band_sweep(0.11, 345, 3000, 9000, width_oct=0.8, attack=0.3, wide=True), 178.19, target=-22, kind='i', send_db=-8)
    for i, (t, size, pos) in enumerate(((178.12, 0.8, (-1.8, 0.0, -3.5)), (178.21, 0.6, (1.5, 0.0, -3.0)), (178.31, 1.0, (-0.6, 0.0, -4.5)), (178.43, 0.7, (2.4, 0.0, -4.0)))):
        m.add('rip%d' % i, S.heavy_crack(346 + i, size=size, dur=0.3, k_rate=5, bright=0.7), t, pos, target=-15, kind='i', focus_db=4)
    for i, (t, size, pos) in enumerate(((178.55, 0.9, (-4.0, 0.0, -7.0)), (179.1, 0.7, (3.5, 0.0, -6.0)), (179.75, 1.1, (-2.0, 0.0, -8.0)))):
        m.add('vault-debris%d' % i, S.slab_fall(350 + i, size=size), t, pos, target=-16, kind='i', focus_db=4)

    # the torrent: turbulence in four bands, each with its own noise and its own wandering level. The level of
    # each band over time follows what the original does: the top falls during the four seconds, the bottom grows,
    # and the whiteout is the climax. It ends within a second when the picture returns.
    R1 = 186.3
    RD = R1 - FLASH
    nr = nsamp(RD)
    # The end. The top goes first and fast, the body follows, the bottom last: in the reference the band from 2 to
    # 8 kHz falls by 14 dB in the half second after 183.5 s, and the band under 120 Hz holds to 183.75 s.
    # The limiter works 10 dB deep on the torrent, so the first 10 dB of a fall do not show after it: the falls here are
    # steeper than what is heard.
    ends = {'beam-rumble': [(183.8, 0.0), (184.05, -10.0), (184.3, -18.0), (184.55, -25.0), (184.8, -31.0), (185.1, -37.0), (185.6, -46.0), (R1, -70.0)],
            'beam-body': [(183.55, 0.0), (183.75, -9.0), (184.0, -16.0), (184.25, -21.0), (184.5, -25.0), (184.75, -28.0), (185.0, -32.0), (185.5, -42.0), (R1, -70.0)],
            'beam-tear': [(183.5, 0.0), (183.75, -18.0), (184.0, -26.0), (184.25, -31.0), (184.5, -35.0), (184.75, -38.0), (185.0, -42.0), (185.5, -50.0), (R1, -70.0)]}
    ends['beam-sear'] = ends['beam-tear']
    end = ends['beam-body']
    # the wide shot of the pillar (177.80) moves in to its foot by 178.12: the top of the torrent comes up with the view
    arcs = {'beam-rumble': [(FLASH, 0.0), (178.8, 0.0), (179.3, 2.0), (180.3, 0.5), (181.3, 0.5), (182.3, 6.0), (183.4, 6.5)],
            'beam-body': [(FLASH, 0.0), (178.8, 0.0), (179.8, -1.5), (180.8, -2.5), (181.5, -2.0), (182.3, 1.5), (183.4, 1.5)],
            'beam-tear': [(FLASH, -3.0), (BEAM, -3.0), (178.12, 4.0), (178.6, 4.0), (179.3, 0.0), (180.3, -3.0), (181.3, -3.5), (182.3, 1.0), (183.4, 1.0)],
            'beam-sear': [(FLASH, -11.0), (BEAM, -11.0), (178.12, -5.0), (178.6, -5.0), (179.3, -7.0), (180.3, -10.0), (181.3, -15.0), (182.3, -5.0), (183.4, -5.0)]}
    # it is low while the white frames run, and it is full when the pillar stands
    rise = curve([(FLASH, 0.0), (FLASH + 0.03, 0.3), (177.745, 0.5), (BEAM + 0.012, 1.0), (R1, 1.0)], FLASH, nr)
    parts = {}
    for nm, st in zip(arcs, S.turbulence(RD, 340, corr=0.6)):
        pts = arcs[nm] + [(t, arcs[nm][-1][1] + d) for t, d in ends[nm]]
        parts[nm] = st * (lin(curve(pts, FLASH, nr)) * rise)[:, None]
    comp = sum(parts.values())
    g = -12.5 - meter(comp[nsamp(0.25): nsamp(2.75)], 's')    # the torrent as a whole: -12.5 LUFS over 2.5 s from the pillar on
    for nm, st in parts.items():
        m.add_wide(nm, st, FLASH, gain_db=g, send_db=-16 if nm in ('beam-rumble', 'beam-body') else -22)          # little of the torrent goes to the hall: its end must be quick
    # a breath with a pitch inside the torrent, and sharp crackles at its edge
    hw = S.howl(RD, 345, (165.0, 440.0, 1180.0), q=6.0, wander=0.06) * lin(curve(arcs['beam-body'] + [(t, arcs['beam-body'][-1][1] + d) for t, d in end], FLASH, nr)) * rise
    m.add('beam-howl', hw, FLASH, (0.0, 6.0, -4.5), target=-22, kind='s', send_db=-3, er_db=-9)
    for i, pos in enumerate(((-2.0, 3.0, -4.5), (2.0, 5.0, -4.5))):
        ck = S.pops(183.6 - BEAM, 454 + i, 30.0, 1500, 7000, tau=0.004) * lin(curve(arcs['beam-tear'], BEAM, nsamp(183.6 - BEAM)))
        m.add('beam-crackle%d' % i, dsp.fade(ck, 0.02, 0.1), BEAM, pos, target=-27, kind='m', send_db=-6)

    # 177.9 to 181.3: floor blocks lift and tumble around the pillar; rings of light rise; one crack high up
    for i, pos in enumerate(((-3.0, 1.0, -6.0), (2.5, 0.5, -5.5), (0.5, 2.0, -7.0))):
        tu = S.tumble(3.4, 360 + i, lambda t: 1.8, sizes=(0.2, 0.6), speed=(3.0, 7.0))
        m.add('blocks%d' % i, tu, 177.9, pos, target=-18, kind='m', focus_db=4)
    for i, t in enumerate((178.0, 178.6, 179.25, 179.85, 180.5)):
        m.add_wide('ring%d' % i, S.band_sweep(0.4, 365 + i, 1200, 5000, width_oct=0.8, attack=0.4, wide=True), t, target=-21, kind='i', send_db=-6)
    m.add('strain', S.fracture(350, 300, 4000, 0.02, dur=0.6, k_rate=9), 180.14, (3.0, 6.0, -6.0), target=-15, kind='i', focus_db=6)
    m.add('last-settle', S.rock_fall(0.15, 0.3, 456), 185.95, (3.5, 0, -9.0), target=-37, kind='i')
    m.drive_db = 14.0
    # After the limiter the hit and the pillar would lie at one level. The hit stays 2.5 dB under the pillar. The black
    # frame between them is not a gap: the owner found a gap there strange.
    m.after_db = [(173.0, 0.0), (FLASH - 0.001, 0.0), (FLASH, -2.5), (BEAM - 0.02, -2.5), (BEAM + 0.004, 0.0), (END + 2.5, 0.0)]

    # 183.767: the clone thins into strands and specks, dry; in the last shot the remnants keep thinning.
    # Round 9 had five thin tones here that faded one by one and a tone that fell from 1760 to 1175 Hz. Measured:
    # they stood 25 dB out of the spectrum from 183.8 to 185.4 s. The owner heard a falling whistle with no cause.
    # The thinning has no pitch now: a dry breath and dry ticks.
    breath, _, tk = S.dissolve_dry(185.45 - DISSOLVE + 0.25, 370)
    m.add('dissolve-breath', dsp.fade(breath, 0.04, 0.2), DISSOLVE, (0.3, 1.2, -3.0), target=-37, kind='m', send_db=-10)
    m.add('dissolve-ticks', tk, DISSOLVE, (0.4, 0.9, -3.0), target=-40, kind='m', send_db=-10)
    na = nsamp(187.9 - 185.5)
    ash = dsp.spectral(dsp.white(na, 372), lambda f: dsp.band_gain(f, 5000, 12000, 2)) * curve([(185.5, 0), (185.8, 1), (187.2, 0.5), (187.9, 0)], 185.5, na)
    m.add('remnants', ash, 185.5, (-1.2, 1.0, -1.5), target=-39, kind='m', send_db=-10)
    m.add('last-grains', S.sand(0.9, 380, rate0=180, tau=0.35), 185.8, (-1.0, 0.1, -1.6), target=-39, kind='m', send_db=-6)
    # the last shot has the one consonant sound of the three passages
    lt = S.voice(END - 185.9, 382, [392.0, 587.0, 784.0], wander=0.002, rate=1.0, breath=0.3) * curve([(185.9, 0), (187.0, 1), (188.3, 0.8), (END, 0)], 185.9, nsamp(END - 185.9))
    m.add('rest', lt, 185.9, (0.0, 2.0, -4.0), target=-39, kind='m', send_db=0)
    return m


PASSAGES = {'red': red, 'force': force, 'finale': finale}
