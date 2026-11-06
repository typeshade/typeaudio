"""One sustained beam across cuts, followed by loss of material and recovery."""
from common import layer, bed, debris


def build():
    layers = bed('finale', 172, 189.314625,
                 [[0, 0], [.7, .6], [4.75, .35], [5.55, .18], [11.5, .35], [14, .5], [17.314625, 0]])
    layers += [
        layer('finale-arrival', 'FRN-035', 'cloth', 'Close restrained handling', 'movement',
              173.2, .7, seed=4001, gain_db=-17, position=(-.6, 0, -2), send=.15),
        layer('finale-preparation', 'FRN-036', 'preparation', 'Compact close-range preparation', 'energy',
              176.75, .802375, pitch=145, seed=4003, gain_db=-11, position=(-.3, .4, -3), send=.25),
        layer('finale-flash', 'FRN-037', 'fracture', 'Graphic flash attack', 'energy',
              177.552375, .4, pitch=460, decay=.09, seed=4007, gain_db=-5,
              position=(0, .8, -4), send=.55, timing='anchor:final-flash'),
        layer('finale-pressure', 'FRN-037', 'pressure', 'Low pressure under the flash', 'energy',
              177.552375, 1, pitch=43, decay=.2, seed=4013, gain_db=-7,
              position=(0, .8, -4), spread=.5, send=.65, timing='anchor:final-flash'),
        layer('finale-beam', 'FRN-038/039', 'beam-core', 'Single coherent energy source across all cuts', 'energy',
              177.802625, 5.964292, pitch=112, seed=4019, gain_db=-5.5,
              envelope=[[0, 0], [.08, .72], [2.5, .8], [3.962375, 1], [4.6, .65], [5.964292, 0]],
              position=(0, 2, -4), spread=.3, send=.55, timing='anchor:final-established-beam'),
        layer('finale-edge', 'FRN-038/039', 'beam-edge', 'Turbulent edge grows without another launch', 'energy',
              177.802625, 5.964292, seed=4021, gain_db=-10,
              envelope=[[0, 0], [.12, .6], [3.962375, 1], [4.6, .35], [5.964292, 0]],
              position=(0, 2, -4), spread=.65, send=.5, timing='anchor:final-established-beam'),
        layer('finale-strain', 'FRN-038', 'stone', 'One selected structural response', 'impact',
              180.14, 1.1, pitch=91, decay=.25, seed=4027, gain_db=-15, position=(3, 0, -6), send=.8),
        layer('finale-dissolve', 'FRN-040', 'dissolve', 'Clone unravels instead of another impact', 'detail',
              183.766917, 1.983083, pitch=510, seed=4049, character=.1, gain_db=-9,
              position=(.3, .2, -3), spread=.15, send=.2),
        layer('finale-last-grains', 'FRN-041', 'grit', 'Small material remnants before reassurance', 'debris',
              185.8, .9, decay=.18, seed=4051, gain_db=-23,
              position=(.3, -1, -3), send=.25),
    ]
    layers += debris('finale-fragment', 'FRN-038', 178.8, [.09, .37, .97, 1.72], seed=4057,
                     position=(2.5, -1, -6), gain_db=-18)
    return dict(id='finale', title='Final beam, clone dissolution and reassurance', range=[173, 189.314625],
                tailSeconds=2.5, layers=layers, variants=[
                    dict(id='A', label='Dry fibres losing coherence', changes={}),
                    dict(id='B', label='More resonant dissolution', changes={'finale-dissolve': {'character': .85}})])
