"""Render the three passages: python3 render.py <output directory> [red force finale]"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json
import time

import numpy as np

import dsp
import passages
from dsp import SR, nsamp

out = sys.argv[1]
names = sys.argv[2:] or list(passages.PASSAGES)
for name in names:
    t0 = time.time()
    m = passages.PASSAGES[name]()
    x = m.render()
    dsp.write_wav('%s/%s.wav' % (out, name), x, 24)
    np.save('%s/%s.npy' % (out, name), x.astype(np.float32))
    np.savez_compressed('%s/%s-layers.npz' % (out, name), **{k: (v['dry'] + v['wet']) for k, v in m.layers.items()})
    meta = dict(name=name, t0=m.t0, t1=m.t1, tail=m.tail, master_gain_db=m.master_gain_db, drive_db=m.drive_db, limit_db=m.limit_db, limited_share=m.limited_share, rev_db=m.rev_db,
                critical_distance=m.room.dc, layers={k: dict(gain_db=round(float(v['gain_db']), 2), target=v['target'], meter=v['meter'], t=v['t']) for k, v in m.layers.items()})
    json.dump(meta, open('%s/%s-meta.json' % (out, name), 'w'), indent=1)
    print('%s: %d layers, master gain %+.2f dB, drive %.1f dB (limiter: deepest %.1f dB, active %.1f %% of the time), integrated %.1f LUFS, true peak %.2f dBTP, %.1f s' % (
        name, len(m.layers), m.master_gain_db, m.drive_db, m.limit_db, 100 * m.limited_share, dsp.integrated_lufs(x), dsp.true_peak_db(x), time.time() - t0))
