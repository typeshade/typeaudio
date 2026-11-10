"""Write the deterministic authoring manifest. Media rendering is a separate operation."""
import json
from pathlib import Path
import red
import force
import finale

ROOT = Path(__file__).resolve().parents[3]
DESTINATION = ROOT / 'docs/studies/frieren/sound-design/session.json'
session = dict(schema='typeaudio.sound-design-study', version=1, sampleRate=48000,
               picture='https://www.youtube.com/watch?v=YHCqcyX9N3s',
               pictureSha256='6f1856eb09d5522f05dfbb5e813df208e99b94fe391c346139e62bb5b0fba87c',
               status='authored; listening review pending', onlineOffsetVerified=False,
               coordinates='Artist-authored metres: +X right, +Y up, forward -Z. Not measured picture geometry.',
               listener=dict(position=dict(x=0, y=0, z=0)),
               room=dict(min=dict(x=-9, y=-3, z=-12), max=dict(x=9, y=9, z=8),
                         earlyGain=.65, lateGain=.28, decaySeconds=2.1,
                         walls={wall: dict(reflection=.78, damping=.42) for wall in
                                ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax']}),
               studies=[red.build(), force.build(), finale.build()])
DESTINATION.write_text(json.dumps(session, indent=2)+'\n')
print(f'Wrote {len(session["studies"])} studies and {sum(len(s["layers"]) for s in session["studies"])} layers.')
