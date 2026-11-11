"""Render a passage of the study with the random numbers of `src/study/rng.ts`.

    python3 render_shared.py <study scripts directory> <passage> <output .f64>

The output is the master as float64, the left channel then the right, and a JSON file of the layer
gains beside it. `parity.ts` compares it with the engine's render of the same passage."""
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
import passages  # noqa: E402

m = passages.PASSAGES[sys.argv[2]]()
x = m.render()
np.concatenate([x[:, 0], x[:, 1]]).astype('<f8').tofile(sys.argv[3])
json.dump(dict(master_gain_db=m.master_gain_db, limit_db=m.limit_db, limited_share=m.limited_share,
               layers={k: float(v['gain_db']) for k, v in m.layers.items()}), open(sys.argv[3] + '.json', 'w'), indent=1)
print('%s: %d layers, master %+.3f dB, limit %.3f dB, share %.4f' % (sys.argv[2], len(m.layers), m.master_gain_db, m.limit_db, m.limited_share))
