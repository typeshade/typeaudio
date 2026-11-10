#!/usr/bin/env python3
"""Verify and restore authored recovery files into a new directory; optionally render one event."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile


def restore():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path, help='New directory; an existing path is refused.')
    parser.add_argument('--engine', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--web', type=Path, help='Optional recovered Web checkout for v1 scripts.')
    parser.add_argument('--smoke-render', action='store_true', help='Compile and render the first archived v2 event with Bun.')
    args = parser.parse_args()
    engine = args.engine.resolve()
    output = args.output.resolve()
    archive_root = Path(__file__).resolve().parents[2] / 'docs/continuity/archive'
    manifest = json.loads((archive_root / 'authored-source.manifest.json').read_text())
    archive = archive_root / manifest['archive']
    if output.exists():
        raise SystemExit('Refusing to overwrite an existing recovery directory: ' + str(output))
    if not (engine / 'src/graph/compiler/index.ts').is_file():
        raise SystemExit('--engine must point to a TypeAudio checkout with the portable graph compiler.')
    if args.web and not (args.web.resolve() / 'apps/typeaudio').is_dir():
        raise SystemExit('--web must point to the existing Web monorepo checkout.')
    if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['archiveSha256']:
        raise SystemExit('Archive SHA-256 mismatch.')

    expected = {row['path']: row for row in manifest['files']}
    content = {}
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar.getmembers():
            name = PurePosixPath(member.name)
            if not member.isfile() or name.is_absolute() or '..' in name.parts or member.name in content:
                raise SystemExit('Unsafe or duplicate archive member: ' + member.name)
            stream = tar.extractfile(member)
            if stream is None:
                raise SystemExit('Unreadable archive member: ' + member.name)
            content[member.name] = stream.read()
    embedded = json.loads(content.pop('archive-manifest.json'))
    if embedded['files'] != manifest['files'] or set(content) != set(expected):
        raise SystemExit('Archive member inventory mismatch.')
    for name, data in content.items():
        row = expected[name]
        if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
            raise SystemExit('Recovered file hash mismatch: ' + name)

    output.mkdir(parents=True)
    for name, data in content.items():
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    # Patch only restored copies. The hashed archive remains an unchanged source checkpoint.
    patched = []
    workflow = engine / 'docs/continuity/production-workflow.md'
    for study in ['frieren-sound-design', 'frieren-sound-design-v2']:
        for path in (output / study / 'source').iterdir():
            if path.suffix not in ['.ts', '.py']:
                continue
            before = path.read_text()
            after = before.replace('/workspace/typeaudio-feedback', engine.as_posix())
            if path.suffix == '.py':
                after = after.replace("'/workspace/web/docs/typeaudio-sound-design-workflow.md'", repr(str(workflow)))
            if args.web:
                after = after.replace('/workspace/web', args.web.resolve().as_posix())
            # Original TS imports use single-quoted strings; reject unsafe paths instead of injecting code.
            if path.suffix == '.ts' and any(character in str(engine) + str(args.web or '') for character in ["'", '\\', '\n', '\r']):
                raise SystemExit('Recovery checkout paths must not contain quotes, backslashes or newlines.')
            if after != before:
                path.write_text(after)
                patched.append(str(path.relative_to(output)))
        if workflow.is_file():
            shutil.copyfile(workflow, output / study / 'PRODUCTION-WORKFLOW.md')

    report = {
        'date': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'archiveSha256': manifest['archiveSha256'], 'verifiedFiles': len(expected),
        'engine': str(engine), 'output': str(output), 'patchedCopies': patched,
        'web': str(args.web.resolve()) if args.web else None,
        'legacySpatial': 'Preserved only; remote spatial PR #23 supersedes this interrupted state.',
        'v1WebImports': 'mapped' if args.web else 'Require --web or manual mapping before running v1 scripts.',
        'smokeRender': None,
    }
    if args.smoke_render:
        study = output / 'frieren-sound-design-v2'
        session = json.loads((study / 'source/session.json').read_text())
        event = session['cues'][0]['eventId']
        env = os.environ.copy()
        env['EVENT_ONLY'] = event
        subprocess.run(['bun', 'source/render.ts'], cwd=study, env=env, check=True)
        rendered = json.loads((study / 'analysis/render-report.json').read_text())
        if not rendered['cues'] or any(cue['invalid'] or cue['clipped'] or cue['rms'] <= 0 for cue in rendered['cues']):
            raise SystemExit('Restored event failed numerical smoke checks.')
        report['smokeRender'] = {
            'event': event, 'cues': len(rendered['cues']), 'families': rendered['families'],
            'engineCommit': rendered['engine'], 'compilerPin': rendered['compiler'],
            'invalidSamples': sum(cue['invalid'] for cue in rendered['cues']),
            'clippedSamples': sum(cue['clipped'] for cue in rendered['cues']),
            'scope': 'One recovered procedural event; no full remix, physical-device or listening claim.',
        }
    (output / 'restoration-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    restore()
