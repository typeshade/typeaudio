"""Negative space, instantaneous force, travel and delayed structural contact."""
from common import layer, bed, debris


def build():
    layers = bed('force', 135.5, 149.7,
                 [[0, 0], [.7, .65], [6, .55], [8.9, .25], [9.65, .22], [10.6, .4], [14.2, 0]])
    layers += [
        layer('force-handling', 'FRN-030', 'cloth', 'Small bodily scale before threat', 'movement',
              138.4, .45, seed=3011, gain_db=-22, position=(-.5, 0, -2), send=.12),
        layer('force-pressure', 'FRN-031', 'pressure', 'Unannounced displacement of the body', 'energy',
              145.186708, .46, pitch=58, decay=.105, character=.55, seed=3019,
              gain_db=-4, position=(0, 0, -2.2), spread=.3, send=.18, timing='anchor:force-response'),
        layer('force-edge', 'FRN-031', 'fracture', 'Compact air compression edge', 'energy',
              145.186708, .18, pitch=240, decay=.025, seed=3023, gain_db=-13,
              position=(0, 0, -2.2), send=.12, timing='anchor:force-response'),
        layer('force-travel', 'FRN-031', 'shear', 'Air follows the thrown body', 'movement',
              145.23, .69, seed=3037, gain_db=-10,
              path=[[0, 0, .2, -2], [.35, .6, .6, -4], [.69, 1.4, .6, -7]], send=.25),
        layer('force-fabric', 'FRN-031', 'cloth', 'Moving fabric stays below the attack', 'movement',
              145.27, .57, seed=3041, gain_db=-13,
              path=[[0, 0, .3, -2], [.57, 1.4, .6, -7]], send=.12),
        layer('force-body', 'FRN-032', 'pressure', 'Separate blunt body contact', 'impact',
              145.937458, .48, pitch=84, decay=.075, character=.85, seed=3049,
              gain_db=-4.5, position=(1.4, .6, -7), send=.32, timing='anchor:column-contact'),
        layer('force-column', 'FRN-032', 'stone', 'Column mass responds at contact', 'impact',
              145.937458, 1.1, pitch=77, decay=.22, seed=3061, gain_db=-3,
              position=(1.4, .6, -7), send=.8, timing='anchor:column-contact'),
        layer('force-fracture', 'FRN-032', 'fracture', 'Stone breaks after contact', 'impact',
              145.967458, .43, pitch=320, decay=.09, seed=3067, gain_db=-7,
              position=(1.4, .6, -7), send=.8),
        layer('force-dust', 'FRN-032', 'grit', 'Late grains settle into the hall', 'debris',
              146.35, 2.75, decay=.75, seed=3079, gain_db=-13,
              position=(1.6, -1, -7), spread=.6, send=.65),
    ]
    layers += debris('force-chunk', 'FRN-032', 145.937458,
                     [.17, .42, .67, 1.13, 1.66, 2.4], seed=3083, position=(1.5, -1, -7), gain_db=-9)
    return dict(id='force', title='Unseen force, body flight and column impact', range=[136.5, 149.7],
                tailSeconds=2.5, layers=layers, variants=[
                    dict(id='A', label='Compact pressure with body', changes={}),
                    dict(id='B', label='Shorter pressure impulse', changes={'force-pressure': {'decay': .055}})])
