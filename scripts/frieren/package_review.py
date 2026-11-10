"""Package authored review media and portable recipes without any reference video or audio."""
import json
import subprocess
import sys
import zipfile
from pathlib import Path

repository = Path(__file__).resolve().parents[2]
root = Path(sys.argv[1]).resolve()
delivery = root/'delivery'
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=repository).strip(), 'Commit packaging sources first'
package_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repository, text=True).strip()
manifest = json.loads((delivery/'manifest.json').read_text())
assert json.loads((root/'verification.json').read_text())['outcome'] == 'passed'
readme = '''Frieren procedural sound studies — review, not a selected soundtrack

Picture reference: https://www.youtube.com/watch?v=YHCqcyX9N3s
Source: https://github.com/typeshade/typeaudio/pull/28

red-A/B.m4a: picture 00:20.000–00:30.000. Compare red-core roughness.
force-A/B.m4a: picture 02:16.500–02:29.700. Compare force impulse duration.
finale-A/B.m4a: picture 02:53.000–03:09.315. Compare dissolution material.

Every file adds a 2.5-second tail handle after its picture range.
Play A and B at the same comfortable device volume. Do not normalize individual events.
Use headphones, then a phone speaker. Compare the same picture passage for both candidates.
The files contain original procedural effects and ambience only.
Muting YouTube also removes the original dialogue and music. They are not isolated here.
The live YouTube offset has not been verified. Manual simultaneous playback is approximate.

Ask: Is the action readable? Does the material stay identifiable? Does the room stay coherent?
Do the force and column contact remain separate? Does dissolution release the tension?
Record candidate, picture time, device, observation and requested change in review-notes.json.

The manifest records signal checks. No listening-capable reviewer has selected a candidate.
This is stereo room rendering, not HRTF, Atmos or a game real-time performance result.
'''
(delivery/'README.txt').write_text(readme)
notes = dict(status='awaiting-listening-review', reviewer=None, playbackDevice=None, playbackLevel=None,
             observations=[dict(study=s, candidate=None, pictureTimeSeconds=None, observation=None,
                                requestedChange=None, selected=None) for s in ['red', 'force', 'finale']])
(delivery/'review-notes.json').write_text(json.dumps(notes, indent=2)+'\n')
(root/'package-receipt.json').write_text(json.dumps(dict(packagingCommit=package_commit,
    renderSourceCommit=manifest['sourceCommit'], sourceVideoIncluded=False, referenceAudioIncluded=False), indent=2)+'\n')
with zipfile.ZipFile(delivery/'mobile-review.zip', 'x', compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(delivery.glob('*.m4a')):
        archive.write(path, path.name)
    for name in ['README.txt', 'review-notes.json', 'manifest.json']:
        archive.write(delivery/name, name)
    archive.write(repository/'docs/studies/frieren/sound-design/direction.md', 'sound-direction.md')
with zipfile.ZipFile(delivery/'aligned-stems.zip', 'x', compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(delivery.glob('*-stems/*.wav')):
        archive.write(path, str(path.relative_to(delivery)))
    archive.write(delivery/'manifest.json', 'manifest.json')
with zipfile.ZipFile(delivery/'source-recipes.zip', 'x', compression=zipfile.ZIP_DEFLATED) as archive:
    tracked = subprocess.check_output(['git', 'ls-files', '-z', 'scripts/frieren',
                                      'docs/studies/frieren/sound-design', 'package.json', 'bun.lock'], cwd=repository)
    for name in tracked.decode().split('\0'):
        if name:
            archive.write(repository/name, name)
    for folder in ['graphs', 'generated']:
        for path in sorted((root/folder).glob('*')):
            archive.write(path, 'rendered/'+str(path.relative_to(root)))
    for name in ['render-receipt.json', 'verification.json', 'package-receipt.json']:
        archive.write(root/name, 'rendered/'+name)
print('Packaged six mobile candidates, aligned stems and source recipes. No reference media included.')
