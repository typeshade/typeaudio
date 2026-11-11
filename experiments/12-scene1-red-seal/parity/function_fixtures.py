"""Write the fixture of `test/study-functions.test.ts`: the study's models with numpy's own generator,
as measures that do not depend on the random numbers. For each model, averaged over 24 seeds: the
share of each octave band in the energy (dB), the level in 20 ms frames against the highest (dB),
and the RMS level (dB).

    python3 function_fixtures.py <study scripts directory> <output .json>"""
import json
import sys
import warnings

import numpy as np

warnings.filterwarnings('ignore', category=RuntimeWarning)
sys.path.insert(0, sys.argv[1])
import sources as S  # noqa: E402
from dsp import SR, nsamp  # noqa: E402

CENTRES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]


def measure(xs):
    shares, envs, rms = 0, None, 0
    for x in xs:
        X = np.abs(np.fft.rfft(x)) ** 2
        f = np.fft.rfftfreq(len(x), 1 / SR)
        e = np.array([X[(f >= c / 2 ** 0.5) & (f < c * 2 ** 0.5)].sum() for c in CENTRES])
        shares = shares + e / X[1:].sum()
        k = nsamp(0.02)
        fr = np.array([(x[i:i + k] ** 2).mean() for i in range(0, len(x) - k + 1, k)])
        envs = fr if envs is None else envs + fr
        rms += (x ** 2).mean()
    envs = envs / len(xs)
    return dict(shares=[float(v) for v in 10 * np.log10(shares / len(xs) + 1e-20)],
                env=[float(v) for v in 10 * np.log10(envs / envs.max() + 1e-20)],
                rms=float(10 * np.log10(rms / len(xs))))


seeds = [11 + 12 * k for k in range(24)]
out = {}
out['burst-low'] = measure([S.burst(s, 35, 140, 0.08, rise=0.004) for s in seeds])
out['burst-mid'] = measure([S.burst(s, 200, 2000, 0.05) for s in seeds])
out['boom'] = measure([S.boom(s, f=88.0, tau=0.16) for s in seeds])
out['groan'] = measure([S.groan(0.3, s) for s in seeds])
out['grind'] = measure([S.grind(0.52, s) for s in seeds])
for ten in (0.3, 0.8):
    parts = [S.red_material(nsamp(1.0), np.full(nsamp(1.0), ten), s) for s in seeds]
    for j, name in enumerate(('rumble', 'roar', 'crackle')):
        out['%s-%.1f' % (name, ten)] = measure([p[j] for p in parts])
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print(len(out), 'measures')
