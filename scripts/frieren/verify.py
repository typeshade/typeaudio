"""Audit timing, authored comparison scope, file identities and repeated render determinism."""
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

repository = Path(__file__).resolve().parents[2]
source = repository/'docs/studies/frieren/sound-design'
root = Path(sys.argv[1]).resolve()
repeat = Path(sys.argv[2]).resolve()
session = json.loads((source/'session.json').read_text())
spotting = json.loads((source.parent/'spotting.json').read_text())
anchors = {a['id']: a['pts'] for a in spotting['anchors']}
manifest = json.loads((root/'delivery/manifest.json').read_text())
first = json.loads((root/'render-receipt.json').read_text())
second = json.loads((repeat/'render-receipt.json').read_text())
assert not first['workingTreeDirty'], 'Production source must be committed before rendering'
assert first['sessionSha256'] == second['sessionSha256'] == hashlib.sha256((source/'session.json').read_bytes()).hexdigest()
assert first['programHashes'] == second['programHashes']
regions = set(re.findall(r'FRN-\d{3}', (source/'direction.md').read_text()))
assert regions == {e['id'] for e in spotting['events']}
timing = []
for study in session['studies']:
    assert len({layer['id'] for layer in study['layers']}) == len(study['layers'])
    assert study['variants'][0]['changes'] == {}
    changes = study['variants'][1]['changes']
    assert len(changes) == 1 and len(next(iter(changes.values()))) == 1
    for layer in study['layers']:
        assert 0 < layer['duration'] <= 30 and 0 <= layer['character'] <= 1
        assert 0 < layer['seed'] < 2**24
        for key in ['gain', 'position']:
            assert all(a[0] < b[0] for a, b in zip(layer[key], layer[key][1:]))
            assert layer[key][0][0] == 0 and abs(layer[key][-1][0]-layer['duration']) < 1e-8
        assert layer['gain'][0][1] == layer['gain'][-1][1] == 0
        for point in layer['position']:
            for axis, value in zip('xyz', point[1:]):
                assert session['room']['min'][axis] < value < session['room']['max'][axis]
        if layer['timing'].startswith('anchor:'):
            name = layer['timing'].split(':', 1)[1]
            error = abs(round(layer['start']*48000)/48000-anchors[name])
            assert error <= .5/48000
            timing.append(dict(layer=layer['id'], anchor=name, absoluteSample=round(layer['start']*48000), errorSeconds=error))
    if study['id'] == 'force':
        assert all(l['start'] >= anchors['force-response'] for l in study['layers'] if l['bus'] in ['energy', 'impact'])
    if study['id'] == 'finale':
        assert len([l for l in study['layers'] if l['family'] == 'beam-core']) == 1
for family, digest in first['programHashes'].items():
    assert hashlib.sha256((source/'programs'/(family+'.txt')).read_bytes()).hexdigest() == digest
raw_count = 0
for a, b in zip(first['renders'], second['renders'], strict=True):
    assert a == b, 'A repeated source/room render differs'
    for stem in a['stems']:
        name = a['study']+'-'+a['variant']+'/'+stem['bus']+'.f32'
        for directory in [root, repeat]:
            assert hashlib.sha256((directory/name).read_bytes()).hexdigest() == stem['sha256']
        raw_count += 1
for asset in manifest['assets']:
    path = root/'delivery'/asset['path']
    assert len(path.read_bytes()) == asset['bytes']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256']
comparisons = []
for study in session['studies']:
    a, b = [v for v in manifest['variants'] if v['name'].startswith(study['id']+'-')]
    wav_delta = abs(a['wav']['integratedLufs']-b['wav']['integratedLufs'])
    aac_delta = abs(a['aac']['integratedLufs']-b['aac']['integratedLufs'])
    assert wav_delta <= .15 and aac_delta <= .25
    assert (root/'delivery'/(a['name']+'.wav')).read_bytes() != (root/'delivery'/(b['name']+'.wav')).read_bytes()
    comparisons.append(dict(study=study['id'], wavLoudnessDeltaLu=wav_delta, aacLoudnessDeltaLu=aac_delta))
for variant in manifest['variants']:
    assert variant['signal']['fullScaleSamples'] == variant['signal']['nonFiniteSamples'] == 0
    assert variant['wav']['truePeakDbtp'] <= -2 and variant['aac']['truePeakDbtp'] <= -1
    assert variant['signal']['monoLossDb'] >= -4
    if 'narrativeWindowsDbfs' in variant:
        windows = variant['narrativeWindowsDbfs']
        assert -50 <= windows['beforeForce'] <= -35
        assert 16 <= windows['force']-windows['beforeForce'] <= 30
report = dict(date=datetime.now(timezone.utc).isoformat(), sourceCommit=first['sourceCommit'],
              compiler=first['compiler'], pictureRegionsCovered=len(regions), layers=sum(len(s['layers']) for s in session['studies']),
              anchorMappings=timing, repeatedRawStems=raw_count, repeatedRawStemsBitIdentical=True,
              deliveryFilesVerified=len(manifest['assets']), comparisons=comparisons,
              forceBackgroundTargetPassed=True, outcome='passed', listeningReviewed=False,
              limits=['Same host and toolchain determinism only', 'No physical phone listening or YouTube offset test'])
(root/'verification.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report))
