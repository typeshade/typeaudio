"""The ledger: every sound belongs to an event that the frames show, and every such event has a sound.
usage: python3 ledger.py <output directory> [red force finale]

EVENTS lists what the frames show, read at 24 frames a second where things happen. LAYERS gives each layer
of a passage its event. A layer may also belong to one of four groups that are not an event of the picture:
  @hall       the hall itself (its air)
  @echo       what the hall returns of an event that is seen
  @offscreen  a likely consequence that the frame does not show
  @mood       a tone with no source in the picture
The check fails on a layer with no entry and on an event with no layer. The groups are printed, so that a
reader sees how much of the sound has no cause in the picture."""
import json
import re
import sys

EVENTS = {
    'red': [('flight', 20.0, 22.3, 'the camera flies with the orb'), ('passes', 20.1, 22.2, 'rocks pass on both sides'),
            ('strike1', 21.12, 21.2, 'the orb strikes rock; sparks'), ('strike2', 21.80, 21.9, 'the orb strikes rock; sparks'),
            ('rockburst', 21.98, 22.2, 'a rock bursts toward the camera'), ('flame', 22.31, 22.78, 'close: the flame tears stone'),
            ('whip', 22.8, 23.02, 'the camera whips'), ('gather', 23.06, 23.77, 'blocks fly in from all sides and pack around a glowing core'),
            ('lock', 23.81, 24.77, 'close: plates of stone lock; red seams glow; from 24.4 they hold'),
            ('sphere', 24.81, 25.65, 'wide: the ball of stone hangs in the hall'), ('fracture', 25.69, 25.75, 'the ball swells and cracks'),
            ('burst', 25.776, 25.8, 'a full frame of violet rays'), ('rays', 25.8, 26.31, 'a star of 8 to 10 rays reaches the walls and the vault'),
            ('ice', 26.318, 26.5, 'slabs of ice shoot up around the standing figure'), ('block', 26.36, 26.61, 'the rays are on the ice: white lines run over it; a white frame at 26.527; the rest flies off'),
            ('icestands', 26.61, 28.45, 'the ice stands; mist at its feet; specks of frost in the air'),
            ('smoke', 28.53, 30.21, 'wide: a cloud of smoke rolls slowly; thin trails arc out of it; nothing lands in the frame'), ('face', 30.25, 32.3, 'close: her face; hair in the wind')],
    'force': [('residue', 136.5, 137.1, 'the last pieces of the shield fade'), ('lines', 136.75, 142.25, 'close: Fern speaks three lines'),
              ('stare', 142.5, 145.15, 'close: the face of the clone'), ('force', 145.187, 145.3, 'her hair snaps; she is thrown'),
              ('ring', 145.3, 145.76, 'a ring runs through the air; dust lifts where she stood'), ('flight', 145.24, 145.78, 'she flies to the far wall'),
              ('whip', 145.78, 145.9, 'the camera whips to the wall'), ('hit', 145.937, 146.0, 'her body strikes the wall; a first puff of dust'),
              ('jet', 145.98, 146.4, 'a jet of dust shoots out to the left and grows'), ('split', 146.26, 146.45, 'the wall splits along a vertical line'),
              ('breakout', 146.47, 146.65, 'large blocks leave the wall'), ('airborne', 146.5, 147.72, 'the blocks turn in the air and sink out of the frame'),
              ('dust', 146.0, 149.7, 'dust rolls, fills the frame from 147.78 to 148.4, and thins'),
              ('land', 147.76, 149.8, 'in the dust the blocks reach the floor, and the heap settles'), ('crater', 148.49, 149.66, 'close: she hangs in a round crater of cracked wall'),
              ('black', 149.70, 150.02, 'black frames: her eyes are shut'), ('eye', 150.06, 152.2, 'her eye opens on the floor; rubble lies there')],
    'finale': [('swing', 173.62, 174.4, 'the head of the staff comes out of the dust'), ('gather', 174.46, 177.47, 'a lit circle under the clone, the staff behind her; sparks at its tip from 176.0'),
               ('charge', 176.86, 177.47, 'a ball of light forms at the tip of the staff, grows for 0.2 s and holds'),
               ('shot', 177.5105, 177.55, 'wide: a spark where the two stand'), ('hit', 177.552, 177.6, 'a white frame; a dark cloud from the hit'),
               ('blastout', 177.59, 177.68, 'white frames; lines run out from the hit over the floor'), ('walls', 177.678, 177.72, 'the pillars and the walls stand out, struck'),
               ('pillar', 177.803, 177.9, 'a pillar of light from the floor to the vault'), ('floorring', 177.8, 178.15, 'a ring of light runs out over the floor and passes'),
               ('flare', 178.19, 178.3, 'a streak of light crosses the frame'), ('blocks', 178.1, 181.3, 'blocks of the floor lift and tumble around the pillar'),
               ('rings', 178.0, 180.9, 'rings of light rise around the pillar'), ('torrent', 177.552, 183.6, 'the pillar burns; the whiteout from 181.76'),
               ('highcrack', 180.14, 180.4, 'a crack high in the hall'), ('dissolve', 183.77, 185.45, 'the clone thins into strands and specks'),
               ('last', 185.5, 188.3, 'the remnants thin; she stands; a spoken line')],
}
LAYERS = {
    'red': [(r'bed', '@hall'), (r'orb-flight|flight-air|orb-voice$|orb-sparks', 'flight'), (r'rock-pass', 'passes'), (r'spark-hit1|hit1-low', 'strike1'),
            (r'spark-hit2|hit2-low', 'strike2'), (r'hit\d-slap', '@echo'), (r'rock-burst', 'rockburst'), (r'flame-|orb-voice-close', 'flame'), (r'whip', 'whip'),
            (r'clump|pull\d|orb-far|orb-voice-far|target-strike', 'gather'), (r'lock|crack-spread|crack-energy|crack-groan|crack-tone', 'lock'),
            (r'shell-fracture', 'fracture'), (r'shell', 'sphere'), (r'release-slap|ice-slap|block-slap', '@echo'), (r'release', 'burst'), (r'ray-scatter|block-|ice-crush', 'block'), (r'ray-', 'rays'),
            (r'ice-boom|ice-crack|ice-slab|ice-rise', 'ice'), (r'ice-groan|ice-tick|ice-mist|ice-work|ice-frost', 'icestands'), (r'wall-debris', '@offscreen'),
            (r'smoke|debris-rain|chunk|streak', 'smoke'), (r'hair-|wind-tone', 'face'), (r'settle', '@offscreen')],
    'force': [(r'bed', '@hall'), (r'shield-residue', 'residue'), (r'handling', 'lines'), (r'settle|far-', '@offscreen'), (r'stare', '@mood'),
              (r'force-slap', '@echo'), (r'force$|floor-crack', 'force'), (r'shock-ring|blast-dust|grit', 'ring'), (r'travel-', 'flight'), (r'whip', 'whip'),
              (r'wall-hit|wall-boom|wall-crater', 'hit'), (r'dust-jet', 'jet'), (r'wall-split', 'split'), (r'breakout', 'breakout'), (r'wall-rumble|block-knock', 'airborne'),
              (r'dust-hiss|dust-billow', 'dust'), (r'land|rubble|heap-roll', 'land'), (r'trickle|wall-ticks|wall-groan', 'crater')],
    'finale': [(r'bed', '@hall'), (r'staff-', 'swing'), (r'circle|gather-', 'gather'), (r'ignite|charge', 'charge'), (r'fire', 'shot'), (r'blast', 'hit'),
               (r'shock-out|floor-break', 'blastout'), (r'wall-hit', 'walls'), (r'vault-hit|pillar-boom', 'pillar'), (r'floor-ring', 'floorring'), (r'flare', 'flare'),
               (r'rip|blocks', 'blocks'), (r'vault-debris|last-settle', '@offscreen'), (r'ring\d', 'rings'), (r'beam-', 'torrent'), (r'strain', 'highcrack'),
               (r'dissolve-', 'dissolve'), (r'remnants|last-grains', 'last'), (r'rest', '@mood')],
}

# events that the frames show and that make no sound of their own
QUIET = {'force': {'stare', 'black', 'eye'}}

out = sys.argv[1]
bad = 0
for name in sys.argv[2:] or list(EVENTS):
    meta = json.load(open('%s/%s-meta.json' % (out, name)))
    got = {e[0]: [] for e in EVENTS[name]}
    groups = {'@hall': [], '@echo': [], '@offscreen': [], '@mood': []}
    none = []
    for layer, info in meta['layers'].items():
        for pat, ev in LAYERS[name]:
            if re.match(pat, layer):
                (groups if ev.startswith('@') else got)[ev].append(layer)
                break
        else:
            none.append(layer)
    n = len(meta['layers'])
    print('=' * 20, name, '| %d layers | %d events of the picture' % (n, len(EVENTS[name])))
    for ev, a, b, text in EVENTS[name]:
        ls = got[ev]
        quiet = ev in QUIET.get(name, ())
        print('  %-10s %8.3f to %8.3f  %-72s %2d layers%s' % (ev, a, b, text, len(ls), '' if ls else ('   (makes no sound of its own)' if quiet else '   <-- NO SOUND')))
        bad += not ls and not quiet
    for g, ls in groups.items():
        print('  %-10s %2d layers: %s' % (g, len(ls), ', '.join(ls)))
    if none:
        print('  NO EVENT   %2d layers: %s' % (len(none), ', '.join(none)))
        bad += len(none)
    seen = sum(len(v) for v in got.values())
    print('  of %d layers: %d belong to an event that is seen, %d to the hall, %d are echoes, %d are off the frame, %d are tones with no source' % (
        n, seen, len(groups['@hall']), len(groups['@echo']), len(groups['@offscreen']), len(groups['@mood'])))
print('ledger: %s' % ('clean' if not bad else '%d open' % bad))
sys.exit(1 if bad else 0)
