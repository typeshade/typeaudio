"""Contained pressure becomes a fracture, release and separate defensive response."""
from common import layer, bed, debris


def build():
    layers = bed('red', 19, 30, [[0, 0], [.7, 1], [4.8, .55], [6.7, .3], [8.5, .8], [11, 0]])
    layers += [
        layer('red-core', 'FRN-005/006', 'red-core', 'One persistent red material', 'energy',
              19, 6.77575, pitch=91, seed=1901, character=.22, gain_db=-6,
              envelope=[[0, 0], [.3, .65], [3.8, .65], [4.8, .8], [6.65, 1], [6.77575, 0]],
              path=[[0, -3, 1, -5], [2, 2, 1, -3], [4.8, .6, .5, -4], [6.77575, .4, .5, -4]], send=.22),
        layer('red-pass', 'FRN-005', 'shear', 'Return orbit edge', 'movement',
              20.45, 1.05, seed=2003, gain_db=-9,
              path=[[0, -4, 1, -5], [.5, .6, .3, -1.8], [1.05, 4, .8, -5]], send=.25),
        layer('red-contact', 'FRN-005', 'stone', 'Selective masonry contact', 'impact',
              21.57, .7, pitch=143, decay=.11, seed=2027, gain_db=-12, position=(3, 0, -5), send=.55),
        layer('red-shell', 'FRN-007', 'fracture', 'Containment shell cracks first', 'impact',
              25.692333, .36, pitch=360, decay=.075, seed=2053, gain_db=-8,
              position=(.4, .5, -4), send=.35, timing='anchor:red-fracture'),
        layer('red-release', 'FRN-007', 'pressure', 'Radial pressure release', 'energy',
              25.77575, .8, pitch=54, decay=.18, seed=2063, gain_db=-5,
              position=(.4, .5, -4), spread=.45, send=.5, timing='anchor:red-radial-release'),
        layer('red-expansion', 'FRN-007', 'grit', 'Expanding turbulent body', 'energy',
              25.77575, 1.4, decay=.38, seed=2081, gain_db=-7,
              position=(.4, .5, -4), spread=.65, send=.48, timing='anchor:red-radial-release'),
        layer('red-defence', 'FRN-008', 'shield', 'Defence absorbs remaining energy', 'detail',
              26.34, 1.5, pitch=510, decay=.45, seed=2087, gain_db=-16,
              position=(-1, 0, -3), send=.6),
        layer('red-dust', 'FRN-008', 'grit', 'Dust after the pressure has passed', 'debris',
              26.7, 2.5, decay=.6, seed=2099, gain_db=-16,
              position=(1, -1, -4), spread=.6, send=.65),
    ]
    layers += debris('red-fragment', 'FRN-008', 26.3, [.12, .39, .83, 1.52, 2.16], seed=2111)
    return dict(id='red', title='Contained red pressure and defensive dispersion', range=[20, 30],
                tailSeconds=2.5, layers=layers, variants=[
                    dict(id='A', label='Compressed mineral core', changes={}),
                    dict(id='B', label='Rougher turbulent core', changes={'red-core': {'character': .8}})])
