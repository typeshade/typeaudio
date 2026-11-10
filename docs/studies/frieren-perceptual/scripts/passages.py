"""The three passages, round 5. Times are picture seconds (source presentation timestamps).
Every event follows the picture: the frames of the reference were inspected on 2026-11-10.
Every level is a loudness target in LUFS before the master gain; every position is in metres
(+x right, +y up, forward is -z, the listener is the camera).
Round 5: every solid thing has the size the picture shows, and its sound starts near 54.6 / size Hz."""
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

    # 23.06 to 23.75: wide; the orb is far and closes on its target among falling rock
    n3 = nsamp(23.76 - 23.06)
    rumble, roar, crackle = S.red_material(n3, np.full(n3, 0.3), 118)
    m.add('orb-far', dsp.fade(0.8 * rumble + 1.0 * roar + 0.3 * crackle, 0.01, 0.01), 23.06, line((2.0, 3.0, -10.0), (0.0, 2.0, -9.0), n3), target=-26, kind='m', send_db=-4)
    for i, (t, a, pos, tg) in enumerate(((23.12, 0.25, (-3.0, 0, -8.0), -26), (23.30, 0.40, (2.5, 0, -9.0), -24), (23.47, 0.18, (-1.0, 0, -7.0), -29), (23.62, 0.30, (1.0, 0, -10.0), -25))):
        m.add('wide-rock%d' % i, S.rock_fall(a, 1.5, 125 + i), t, pos, target=tg, kind='i')
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
    m.add('crack-spread', crack, 23.81, close, target=-20, kind='i', send_db=-8)
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
    m.add_wide('release-wash', wash, RED_RELEASE, target=-15, kind='i', send_db=-3)

    # 26.276: ice. Slabs far taller than the figure shoot up around her within six frames and stand; from
    # 26.7 mist spreads at their feet. Every part has the size of the picture: a boom under 100 Hz, cracks
    # of thick ice, slabs that groan as they settle, cold mist. Nothing small falls and nothing rings.
    ICE = 26.27625
    fig = (0.0, 1.4, -4.0)
    m.add('ice-boom', S.burst(160, 28, 95, 0.20, rise=0.03), ICE, (0.0, 0.5, -4.5), target=-15, kind='i', send_db=-4)
    ic = S.heavy_crack(161, size=1.6, dur=0.7, k_rate=14, bright=0.8)
    m.add('ice-crack', ic, ICE, fig, target=-13, kind='i', focus_db=2)
    m.add('ice-slap', S.slap(ic, 800), ICE + 0.26, (0.0, 3.0, -15.0), target=-23, kind='i', focus_db=6)
    # the slabs come at irregular times: equal steps of 40 ms would be a rattle at 25 Hz
    for i, (dt, size, pos) in enumerate(((0.021, 1.0, (-3.0, 1.0, -5.0)), (0.072, 1.4, (3.2, 1.5, -5.5)), (0.098, 0.8, (-1.5, 2.5, -6.5)),
                                         (0.169, 1.8, (1.2, 3.0, -7.0)), (0.187, 1.1, (-3.5, 3.5, -6.0)), (0.258, 0.7, (2.5, 4.0, -6.5)))):
        m.add('ice-slab%d' % i, S.heavy_crack(162 + i, size=size, dur=0.45, k_rate=8, bright=0.6), ICE + dt, pos, target=-17, kind='i', focus_db=2)
    m.add_wide('ice-light', S.band_sweep(0.5, 169, 700, 3000, width_oct=1.4, attack=0.3, wide=True), ICE, target=-21, kind='i', send_db=-4)
    for i, pos in enumerate(((-2.2, 1.5, -5.0), (2.2, 2.5, -5.5))):
        m.add('ice-crush%d' % i, S.crush(0.9, 187 + i, 0.16), ICE + 0.01 + 0.05 * i, pos, target=-21, kind='i', focus_db=2)
    for i, (t, d, pos, tg) in enumerate(((26.47, 0.45, (-2.5, 2.0, -5.5), -22), (26.78, 0.5, (2.8, 2.5, -6.0), -24), (27.42, 0.4, (-1.0, 3.0, -6.5), -28), (28.02, 0.35, (2.0, 2.0, -6.0), -30))):
        m.add('ice-groan%d' % i, S.groan(d, 172 + i), t, pos, target=tg, kind='m', focus_db=2)
    for i, (t, size, pos, tg) in enumerate(((26.93, 0.5, (1.8, 1.0, -5.0), -27), (27.21, 0.35, (-2.6, 2.0, -5.5), -30), (27.74, 0.45, (0.6, 3.0, -6.5), -31), (28.19, 0.3, (-1.4, 1.2, -5.0), -33))):
        m.add('ice-tick%d' % i, S.heavy_crack(180 + i, size=size, dur=0.25, k_rate=3, bright=0.3), t, pos, target=tg, kind='i', focus_db=2)
    mist = S.wide_noise(1.9, 185, 180, 1400) * curve([(26.6, 0), (27.0, 1), (28.0, 0.7), (28.5, 0)], 26.6, nsamp(1.9))[:, None]
    m.add_wide('ice-mist', mist, 26.6, target=-33, kind='m', send_db=-6)
    m.add('ice-glints', S.sand(1.6, 186, rate0=400, tau=0.6), 26.7, (0.5, 2.5, -4.5), target=-46, kind='m')

    # 27.3 to 30.0: dust rises and hangs; 30.25 on: wind in hair, close
    du = S.wind(3.4, 180, 120, 1200)
    du *= curve([(27.0, 0), (28.3, 1), (30.0, 0.6), (30.4, 0)], 27.0, len(du))[:, None]
    m.add_wide('dust-cloud', du, 27.0, target=-36, kind='m', send_db=-8)
    m.add('dust-grains', S.sand(2.5, 181, rate0=600, tau=1.0), 27.0, (-1.5, 0.3, -5.0), target=-42, kind='m')
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
    m.add('release-fall', dsp.fade(fall, 0.004, 0.05), RED_RELEASE, far, target=-15.5, kind='m', focus_db=10, send_db=-2)
    rel = S.saturate(0.55 * front + 0.9 * low + 0.6 * slap)
    m.add('release-slap', S.slap(rel, 900), RED_RELEASE + 0.24, (0.0, 3.0, -15.0), target=-19, kind='i', focus_db=6)
    for i, (t, a, pos) in enumerate(((28.7, 0.15, (-4.0, 0, -9.0)), (29.25, 0.12, (3.0, 0, -7.0)), (29.8, 0.2, (-1.0, 0, -11.0)))):
        m.add('settle%d' % i, S.rock_fall(a, 0.3, 415 + i), t, pos, target=-35, kind='i')

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

    # 145.937: the column, seen from the side: a body, then stone, then a plume of dust
    col = (1.0, 1.5, -5.0)
    thud = np.zeros(nsamp(0.9))
    for k_, w_ in ((S.burst(244, 50, 320, 0.07, rise=0.008), 1.0), (S.burst(245, 35, 90, 0.09, rise=0.01), 0.6), (S.burst(246, 120, 600, 0.03, rise=0.005), 0.45)):
        thud[: len(k_)] += w_ * k_[: len(thud)]
    m.add('column-thud', S.saturate(S.norm(thud), 1.6), COLUMN, col, target=-10, kind='i', focus_db=5, send_db=-2)
    m.add('column-crack', S.heavy_crack(241, size=1.5, dur=0.5, k_rate=12, bright=0.9), COLUMN + 0.030, col, target=-14.5, kind='i', focus_db=5, send_db=-2)
    m.add_wide('column-plume', S.band_sweep(0.7, 247, 300, 1500, width_oct=1.2, attack=0.1, wide=True), COLUMN + 0.03, target=-21, kind='i', send_db=-6)

    # 146.30 to 147.75: the column comes down: blocks fall over one another, a low rumble, crumbling stone
    for i, pos in enumerate(((0.2, 0.8, -4.5), (1.2, 0.5, -5.2), (2.0, 1.0, -5.8))):
        tu = S.tumble(1.45, 270 + i, lambda t: 3.2 - 1.1 * t, sizes=(0.2, 0.6), speed=(3.0, 7.0))
        m.add('collapse%d' % i, tu, 146.30, pos, target=-19, kind='m', focus_db=5)
    ru = S.wide_noise(3.2, 274, 30, 110, order=3)
    ru *= curve([(146.05, 0), (146.6, 1), (147.6, 0.8), (148.0, 0.12), (148.6, 0)], 146.05, len(ru))[:, None]
    m.add_wide('collapse-rumble', ru, 146.05, target=-24, kind='m', send_db=-6)
    gv = S.gravel(2.1, 275) * curve([(146.2, 0), (146.6, 1), (147.6, 0.8), (148.3, 0)], 146.2, nsamp(2.1))
    m.add('collapse-gravel', gv, 146.2, (1.0, 0.6, -5.0), target=-24, kind='m', focus_db=5)

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
    # the column cracks before it falls: six sharp cracks, and the contact comes back from the far wall
    cc = ticks([0.10, 0.19, 0.31, 0.42, 0.55, 0.71], lambda i: S.heavy_crack(434 + i, size=rr.uniform(0.5, 1.0), dur=0.2, k_rate=4, bright=0.8) * rr.uniform(0.6, 1.0), 1.6)
    m.add('column-cracks', cc, COLUMN, col, target=-14, kind='i', focus_db=5)
    # her staff breaks at the contact and its pieces land on the stone: dry wood, damped, at irregular times
    m.add('staff-snap', S.wood_snap(460), COLUMN + 0.012, (0.9, 1.5, -5.0), target=-18, kind='i', focus_db=5)
    for i, (t, x) in enumerate(((146.42, 0.2), (146.61, 1.6), (147.03, 0.8))):
        m.add('staff-piece%d' % i, S.wood_clack(461 + i), t, (x, 0.2, -4.8), target=-25, kind='i', focus_db=5)
    m.add('column-slap', S.slap(S.saturate(S.norm(thud), 1.6), 1000), COLUMN + 0.21, (-8.5, 2.0, -8.0), target=-21, kind='i', send_db=-4)

    # 147.75 to 148.45: dust fills the frame: two dull knocks and a hiss
    kn = ticks([0.0, 0.26], lambda i: dsp.lp(np.concatenate([S.stone_impact(0.2, 3.0, rr), np.zeros(2400)]), 500), 0.9)
    m.add('fog-knocks', kn, 147.88, (0.8, 0.5, -5.0), target=-30, kind='i', focus_db=3)
    m.add('fog-dust', S.sand(1.6, 276, rate0=2500, tau=0.6), 147.55, (0.5, 0.6, -4.0), target=-33, kind='m', focus_db=3)

    # 148.5 to 149.65: she is pinned in the cracked wall, close: pebbles, the wall ticking, shards of her staff
    near = (0.0, 1.2, -2.5)
    tr = ticks([0.12, 0.28, 0.45, 0.58, 0.80, 1.02], lambda i: S.stone_impact(rr.uniform(0.05, 0.1), 2.0, rr), 1.4)
    m.add('trickle', tr, 148.5, (0.4, 0.2, -2.3), target=-30, kind='i', send_db=-8)
    wc = ticks([0.20, 0.65, 0.95], lambda i: S.stone_crack(rr, size=rr.uniform(0.2, 0.4)) * rr.uniform(0.6, 1.0), 1.5)
    m.add('wall-ticks', wc, 148.5, near, target=-28, kind='i', send_db=-8)
    m.add('wall-groan', S.groan(0.4, 285), 148.88, near, target=-34, kind='m', send_db=-8)
    m.add('splinters', ticks([0.35, 1.10], lambda i: S.wood_clack(286 + i, 400, 2200, 0.006) * rr.uniform(0.6, 1.0), 1.4), 148.5, (-0.6, 0.6, -2.4), target=-36, kind='i', send_db=-8)
    return m


# =============================================================== finale, 173 to 189.314625 s
def finale():
    m = Mix('finale', 173.0, END)
    T0 = 173.0
    full_bed(m, T0, END - T0 + 2.5, 301, -41.0, [(173, 0), (176.75, 0), (FLASH - 0.06, -6), (FLASH - 0.05, -40), (FLASH, -40), (FLASH + 0.3, 0), (DISSOLVE, -2),
                                                   (REASSURE, 0), (188.3, 0), (END, -60), (END + 2.5, -90)])
    rr = dsp.rng(305)

    # 173.72 to 174.40: the staff swings into frame from the right; the sleeve follows
    ns = nsamp(0.68)
    sp = 14.0 * np.sin(np.pi * np.arange(ns) / ns) ** 1.5 + 1.0
    P = line((1.8, 1.3, -1.0), (0.4, 1.3, -1.6), ns)
    m.add('staff-swing', S.aero(sp, 311, u0=8.0) * dsp.fade(np.ones(ns), 0.02, 0.05), 173.72, P, target=-31, kind='m', send_db=-8)
    m.add('staff-cloth', S.cloth(0.6, 310, density=380), 173.76, P[: nsamp(0.6)], target=-31, kind='i', send_db=-8)

    # 174.46 to the preparation: the circle on the floor is lit: a low, steady pad under the spoken line
    pd = S.pad(177.49 - 174.46, 312) * curve([(174.46, 0), (174.9, 1), (176.75, 1), (177.48, 0.6), (177.49, 0)], 174.46, nsamp(177.49 - 174.46))
    m.add('circle', pd, 174.46, (0.0, 0.2, -2.5), target=-38, kind='m', send_db=-4)

    # preparation: small, rising, converging to a harmonic series; cut 60 ms before the flash (a wide shot)
    pr = dsp.fade(S.prep(FLASH - 0.06 - 176.75, 320), 0.02, 0.01)
    m.add('preparation', pr, 176.75, (-0.3, 1.5, -3.0), target=-24, kind='m', send_db=-4)

    # the flash: pressure with no pitch, a wide white burst, a crack as of thunder
    front, low, slap = S.whump(332, tplus=0.004, dur=1.0)
    lowlong = np.zeros(len(front)); k = S.burst(333, 32, 110, 0.16, rise=0.003); lowlong[: len(k)] = k[: len(lowlong)]
    m.add('flash', S.saturate(0.55 * front + 0.7 * low + 0.6 * lowlong + 0.6 * slap), FLASH, (0.0, 1.5, -4.0), target=-9, kind='i', focus_db=3)
    m.add_wide('flash-white', S.flash_noise(0.6, 330, tau=0.07), FLASH, target=-11, kind='i', send_db=-3)
    m.add('flash-crack', S.heavy_crack(331, size=2.0, dur=0.9, k_rate=14, bright=1.0), FLASH, (0.0, 2.0, -4.0), target=-14, kind='i')

    # the beam: one source from 177.80 to the whiteout; the world's answer grows, the beam does not
    D = DISSOLVE - BEAM + 0.4
    nb = nsamp(D)
    tb = BEAM

    def lows_out(x):
        def g(tf, fr):
            fcut = np.interp(tf + tb, [tb, WHITEOUT, DISSOLVE], [20, 20, 600])[:, None]
            return 1 / np.sqrt(1 + (fcut / np.maximum(fr[None, :], 1)) ** 4)
        return dsp.stft_shape(x, g)

    core = lows_out(S.beam_core(D, 340, f0=49.0)) * curve([(tb, 0), (tb + 0.06, 1), (tb + 1.5, 1), (WHITEOUT, 0.88), (DISSOLVE, 0.03), (tb + D, 0)], tb, nb)
    m.add('beam-core', core, tb, (0.0, 4.0, -4.5), target=-14.5, kind='s', send_db=-3, er_db=-9)
    body = np.stack([lows_out(S.comb_sweep(S.beam_body(D, 341 + c))) for c in range(2)], axis=1)
    body *= curve([(tb, 0), (tb + 0.08, 0.8), (WHITEOUT, 1.1), (DISSOLVE, 0.05), (tb + D, 0)], tb, nb)[:, None]
    m.add_wide('beam-body', body, tb, target=-18, kind='s', send_db=-3)
    edge = np.stack([S.beam_edge(D, 343 + c) for c in range(2)], axis=1)
    edge *= curve([(tb, 0), (tb + 0.12, 0.5), (WHITEOUT, 1.0), (DISSOLVE, 0.07), (tb + D, 0)], tb, nb)[:, None]
    m.add_wide('beam-edge', edge, tb, target=-21, kind='s', send_db=-6)
    sky = S.wide_noise(D, 345, 7000, 15000, pinkish=False) * curve([(tb, 0), (179.5, 0.05), (WHITEOUT, 0.8), (182.6, 1.0), (DISSOLVE, 0.12), (tb + D, 0)], tb, nb)[:, None]
    m.add_wide('sky-air', sky, tb, target=-28, kind='s', send_db=-6)
    nk = nsamp(5.0)
    shake = S.wide_noise(5.0, 347, 25, 70, order=3) * lin(3 * dsp.smooth(dsp.white(nk, 349), 0.4) / 0.1).clip(0.3, 3)[:, None]
    shake *= curve([(177.9, 0), (178.6, 0.6), (WHITEOUT, 1.0), (182.9, 0)], 177.9, nk)[:, None]
    m.add_wide('hall-shake', shake, 177.9, target=-36, kind='r')

    # 177.9 to 181.3: floor blocks lift and tumble around the beam; rings of light pass; one crack high up
    for i, pos in enumerate(((-3.0, 1.0, -6.0), (2.5, 0.5, -5.5), (0.5, 2.0, -7.0))):
        tu = S.tumble(3.4, 360 + i, lambda t: 1.8, sizes=(0.2, 0.6), speed=(3.0, 7.0))
        m.add('blocks%d' % i, tu, 177.9, pos, target=-19, kind='m', focus_db=4)
    for i, t in enumerate((178.0, 178.6, 179.25, 179.85, 180.5)):
        m.add_wide('ring%d' % i, S.band_sweep(0.4, 365 + i, 1200, 5000, width_oct=0.8, attack=0.4, wide=True), t, target=-23, kind='i', send_db=-6)
    m.add('strain', S.fracture(350, 300, 4000, 0.02, dur=0.6, k_rate=9), 180.14, (3.0, 6.0, -6.0), target=-16, kind='i', focus_db=6)

    # ---- round 4: a bell, air and glints over the circle, an inhale, a voice over the beam, the walls' answer
    ca = S.wide_noise(177.49 - 174.46, 451, 6000, 12000) * curve([(174.46, 0), (175.0, 1), (177.4, 1), (177.49, 0)], 174.46, nsamp(177.49 - 174.46))[:, None]
    m.add_wide('circle-air', ca, 174.46, target=-44, kind='m')
    cl = S.wide_noise(177.49 - 174.46, 457, 40, 110, order=3) * curve([(174.46, 0), (175.0, 1), (177.4, 1), (177.49, 0)], 174.46, nsamp(177.49 - 174.46))[:, None]
    m.add_wide('circle-low', cl, 174.46, target=-52, kind='r')
    m.add_wide('inhale', S.band_sweep(FLASH - 0.06 - 176.75, 452, 300, 4000, width_oct=1.0, attack=0.85, wide=True), 176.75, target=-26, kind='m')
    span, c = FLASH - 0.06 - 176.75, 0.03
    cnt = rr.poisson(6 * np.log((span + c) / c))
    tg_ = np.sort(span + c - (span + c) * (c / (span + c)) ** rr.random(cnt))
    m.add('gather', ticks(tg_, lambda i: S.tilted_burst(470 + i, 500.0, 4000.0, 0.004) * (0.3 + 0.7 * (tg_[i] / span) ** 2), span + 0.13)[: nsamp(span)], 176.75, (-0.3, 1.5, -3.0), target=-29, kind='i', send_db=-4)
    gl = S.wide_noise(span, 472, 35, 140, order=3) * curve([(176.75, 0), (FLASH - 0.07, 1), (FLASH - 0.06, 0)], 176.75, nsamp(span))[:, None]
    m.add_wide('gather-low', gl, 176.75, target=-36, kind='r')
    bv = S.voice(D, 453, [196.0, 294.0, 392.0, 588.0, 784.0], wander=0.008, breath=0.4)       # harmonics 4, 6, 8, 12, 16 of the core
    bv *= curve([(tb, 0), (tb + 0.15, 1), (WHITEOUT, 1.0), (DISSOLVE, 0.05), (tb + D, 0)], tb, nb)
    m.add('beam-voice', bv, tb, (0.0, 6.0, -4.5), target=-20.5, kind='s', send_db=-3, er_db=-9)
    for i, pos in enumerate(((-2.0, 3.0, -4.5), (2.0, 5.0, -4.5))):
        bp = S.pops(WHITEOUT - tb, 454 + i, 18.0, 600, 5000, tau=0.005)
        m.add('beam-sparks%d' % i, dsp.fade(bp, 0.05, 0.2), tb, pos, target=-27, kind='m', send_db=-6)
    fz = S.saturate(0.55 * front + 0.7 * low + 0.6 * lowlong + 0.6 * slap)
    m.add('flash-slap0', S.slap(fz, 900), FLASH + 0.20, (-8.5, 3.0, -8.0), target=-19, kind='i', send_db=-4)
    m.add('flash-slap1', S.slap(fz, 700), FLASH + 0.31, (8.5, 4.0, -12.0), target=-22, kind='i', send_db=-4)
    m.add('last-settle', S.rock_fall(0.15, 0.3, 456), 185.95, (3.5, 0, -9.0), target=-37, kind='i')

    # 183.767: the clone thins into strands and specks, dry; in the last shot the remnants keep thinning
    breath, threads, tk = S.dissolve_dry(185.45 - DISSOLVE + 0.25, 370)
    m.add('dissolve-breath', dsp.fade(breath, 0.04, 0.2), DISSOLVE, (0.3, 1.2, -3.0), target=-32, kind='m', send_db=-10)
    m.add('dissolve-threads', dsp.fade(threads, 0.02, 0.2), DISSOLVE, (0.3, 1.5, -3.0), target=-33, kind='m', send_db=-8)
    m.add('dissolve-ticks', tk, DISSOLVE, (0.4, 0.9, -3.0), target=-41, kind='m', send_db=-10)
    na = nsamp(187.9 - 185.5)
    ash = dsp.spectral(dsp.white(na, 372), lambda f: dsp.band_gain(f, 5000, 12000, 2)) * curve([(185.5, 0), (185.8, 1), (187.2, 0.5), (187.9, 0)], 185.5, na)
    m.add('remnants', ash, 185.5, (-1.2, 1.0, -1.5), target=-39, kind='m', send_db=-10)
    m.add('last-grains', S.sand(0.9, 380, rate0=180, tau=0.35), 185.8, (-1.0, 0.1, -1.6), target=-39, kind='m', send_db=-6)
    # the thinning has a thin falling tone; the last shot has the one consonant sound of the three passages
    dt = S.glide(185.45 - DISSOLVE, 381, 1760, 1175, ratios=(1.0, 1.5)) * curve([(DISSOLVE, 0), (DISSOLVE + 0.3, 1), (185.2, 0.6), (185.45, 0)], DISSOLVE, nsamp(185.45 - DISSOLVE))
    m.add('dissolve-tone', dt, DISSOLVE, (0.3, 1.5, -3.0), target=-38, kind='m', send_db=-4)
    lt = S.voice(END - 185.9, 382, [392.0, 587.0, 784.0], wander=0.002, rate=1.0, breath=0.3) * curve([(185.9, 0), (187.0, 1), (188.3, 0.8), (END, 0)], 185.9, nsamp(END - 185.9))
    m.add('rest', lt, 185.9, (0.0, 2.0, -4.0), target=-39, kind='m', send_db=0)
    return m


PASSAGES = {'red': red, 'force': force, 'finale': finale}
