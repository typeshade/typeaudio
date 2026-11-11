"""Write the fixture of `test/study.test.ts`: each model of the study, called with the random numbers
of `src/study/rng.ts`, as a short signature (length, energy and 24 samples of each channel).

    python3 fixtures.py <study scripts directory> <output .json>

The calls here and in the test are the same, one for one."""
import json
import os
import sys
import warnings

import numpy as np

warnings.filterwarnings('ignore', category=RuntimeWarning)
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp  # noqa: E402
import shared_rng  # noqa: E402

shared_rng.use(dsp)
import mix  # noqa: E402
import sources as S  # noqa: E402
from dsp import SR, nsamp  # noqa: E402

out = {}


def sig(name, x):
    x = np.asarray(x, float)
    chans = [x] if x.ndim == 1 else [x[:, c] for c in range(x.shape[1])]
    rows = []
    for c in chans:
        n = len(c)
        idx = [int(k * (n - 1) / 23) for k in range(24)] if n > 1 else [0]
        rows.append(dict(n=n, energy=float((c ** 2).sum()), peak=float(np.abs(c).max()), idx=idx, v=[float(c[i]) for i in idx]))
    out[name] = rows


ramp = np.linspace(0.6, 1.0, nsamp(0.5))
sig('rng', np.array([dsp.rng(7).random() for _ in range(1)] + list(dsp.rng(8).standard_normal(5)) + [dsp.rng(9).poisson(12.5), dsp.rng(9).poisson(400.0)]))
sig('hall_air', S.hall_air(0.5, 101))
sig('wide_noise', S.wide_noise(0.4, 104, 28, 90, order=3))
for k, v in zip(('rumble', 'roar', 'crackle'), S.red_material(nsamp(0.5), ramp, 133)):
    sig('red_material.' + k, v)
sig('wind', S.wind(0.5, 114, 150, 1500))
sig('stone_impact', S.stone_impact(0.35, 14.0, dsp.rng(120)))
sig('sizzle', S.sizzle(0.6, 121, 0.12))
sig('heavy_crack', S.heavy_crack(122, size=0.5, dur=0.3, k_rate=8))
sig('rock_fall', S.rock_fall(0.35, 1.5, 124))
sig('gravel', S.gravel(0.48, 116))
sig('band_sweep', S.band_sweep(0.22, 117, 400, 3000, wide=True))
sig('block_hit', S.block_hit(530, size=0.9, v=5.0))
sig('grind', S.grind(0.52, 526))
sig('burst', S.burst(129, 35, 140, 0.08, rise=0.004))
sig('stone_crack', S.stone_crack(dsp.rng(130), size=0.3))
sig('groan', S.groan(0.3, 136))
for k, v in zip(('front', 'low', 'slap'), S.whump(141, tplus=0.0035, dur=0.6)):
    sig('whump.' + k, v)
sig('boom', S.boom(160, f=88.0, tau=0.16))
sig('slap', S.slap(S.burst(129, 35, 140, 0.08, rise=0.004), 800))
sig('tilted_burst', S.tilted_burst(193, 500.0, 9000.0, 0.045, tilt=0.4, rise=0.002))
sig('sear', S.sear(0.36, 190, 280.0, 1300.0, sd=5.0))
sig('crush', S.crush(0.9, 187, 0.14))
sig('lance', S.lance(195, dur=0.13, f0=5200.0, f1=600.0))
sig('dust', S.dust(0.5, 186, 3500.0, 11000.0, sd=2.0, grain=0.5, tilt=0.2))
sig('billow', S.billow(0.6, 580, 60.0, 600.0))
sig('slab_fall', S.slab_fall(566, size=0.5))
sig('tumble', S.tumble(0.8, 572, lambda t: 6.0 * np.exp(-t / 0.9) + 0.8, sizes=(0.15, 0.5), speed=(4.0, 9.0)))
sig('voice', S.voice(0.5, 401, [185.0, 311.0, 466.0]))
sig('glide', S.glide(0.5, 410, 220, 311, ratios=(1.0, 1.5, 2.4, 3.2), shape=1.3))
sig('pops', S.pops(0.5, 404, 16.0, 500, 4000, tau=0.005))
sig('cloth', S.cloth(0.5, 183, density=260))
sig('irregular', S.irregular(24000, 170, 20, 110))
sig('saturate', S.saturate(S.boom(160, f=88.0, tau=0.16)))
for i, b in enumerate(S.turbulence(0.3, 700)):
    sig('turbulence.%d' % i, b)
sig('howl', S.howl(0.4, 710, [300.0, 450.0]))
sig('rubble', S.rubble(0.6, 720, lambda t: 20.0, sizes=(0.3, 1.0), body=0.5))
sig('puff', S.puff(0.4, 730))
sig('aero', S.aero(np.linspace(2.0, 30.0, nsamp(0.4)), 740))
sig('sand', S.sand(0.3, 750))
sig('fracture', S.fracture(760, 300.0, 5000.0, 0.03, dur=0.3))
# the processing
room = dsp.Room()
b = S.burst(129, 200, 2000, 0.05)
P = np.stack([np.linspace(-6, 6, len(b)), np.full(len(b), 1.5), np.full(len(b), -2.0)], axis=1)
d, er = dsp.place(b, P, room, focus_db=3.0)
sig('place.direct', d)
sig('place.er', er)
sig('reverb_ir', dsp.reverb_ir(room))
x = np.stack([S.boom(160, f=88.0, tau=0.16), 0.5 * S.boom(161, f=70.0, tau=0.16)], axis=1) * 3.0
y, g = mix.limiter(x, 0.7, release=0.06)
sig('limiter', g)
sig('hp27', dsp.iir(x[:, 0], [dsp.rbj('hp', 27.0, 0.7071)]))
sig('meters', np.array([mix.meter(x, k) for k in ('m', 'i', 's', 'a', 'r')] + [dsp.true_peak_db(x), dsp.integrated_lufs(np.tile(x, (8, 1)))]))
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print(len(out), 'signatures')
