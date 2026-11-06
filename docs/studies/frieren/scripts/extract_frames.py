"""Extract identified source frames and contact sheets for visual analysis; never upload media."""
import argparse
import bisect
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--plan', type=Path, default=Path(__file__).resolve().parents[1] / 'sampling.json')
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text())
    digest = hashlib.sha256(args.input.read_bytes()).hexdigest()
    if digest != plan['referenceSha256']:
        raise SystemExit('Reference hash differs from the sampling plan.')
    if args.output.exists():
        raise SystemExit('Use a new output directory to preserve the previous extraction.')
    decoded = subprocess.run([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_streams', '-show_frames',
        '-show_entries', 'stream=r_frame_rate,width,height,nb_frames:frame=best_effort_timestamp_time',
        '-of', 'json', str(args.input),
    ], capture_output=True, text=True, check=True)
    probe = json.loads(decoded.stdout)
    stream = probe['streams'][0]
    rate = Fraction(stream['r_frame_rate'])
    pts = [float(row['best_effort_timestamp_time']) for row in probe['frames']]
    if any(b <= a for a, b in zip(pts, pts[1:])):
        raise SystemExit('Source presentation timestamps must increase.')
    groups = {}
    for row in plan['ranges']:
        if 'frames' in row:
            groups[row['id']] = sorted(set(row['frames']))
            continue
        count = round((row['end'] - row['start']) / row['step'])
        selected = []
        for i in range(count + 1):
            target = row['start'] + i * row['step']
            if target < pts[0] or target > pts[-1]:
                raise SystemExit('Sampling range exceeds decoded presentation timestamps.')
            insertion = bisect.bisect_left(pts, target)
            candidates = range(max(0, insertion - 1), min(len(pts), insertion + 1))
            selected.append(min(candidates, key=lambda frame: abs(pts[frame] - target)))
        groups[row['id']] = sorted(set(selected))
    frames = sorted({frame for group in groups.values() for frame in group})
    if min(frames) < 0 or max(frames) >= len(pts):
        raise SystemExit('Sampling range exceeds the source frames.')
    args.output.mkdir(parents=True)
    images = args.output / 'frames'
    images.mkdir()
    # A balanced expression avoids FFmpeg's recursive parser limit on long sums.
    terms = [f'eq(n,{frame})' for frame in frames]
    while len(terms) > 1:
        terms = [f'({terms[i]}+{terms[i+1]})' if i+1 < len(terms) else terms[i]
                 for i in range(0, len(terms), 2)]
    expression = terms[0]
    extraction = subprocess.run([
        'ffmpeg', '-v', 'error', '-i', str(args.input), '-an',
        '-vf', f"select='{expression}'", '-fps_mode', 'vfr', '-q:v', '3',
        str(images / 'extract-%05d.jpg'),
    ], capture_output=True, text=True)
    if extraction.returncode:
        raise SystemExit('Frame extraction failed: ' + extraction.stderr[-1500:])
    extracted = sorted(images.glob('extract-*.jpg'))
    if len(extracted) != len(frames):
        raise SystemExit('Extracted frame count differs from the requested inventory.')
    inventory = []
    for frame, path in zip(frames, extracted):
        destination = images / f'f{frame:05d}.jpg'
        path.rename(destination)
        inventory.append({'frame': frame, 'pts': pts[frame], 'path': str(destination.relative_to(args.output)),
                          'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()})
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(font_path, 16) if Path(font_path).exists() else ImageFont.load_default()
    sheets = []
    for name, group in groups.items():
        for page, start in enumerate(range(0, len(group), 16), 1):
            subset = group[start:start + 16]
            sheet = Image.new('RGB', (1536, 240 * ((len(subset) + 3) // 4)), '#111111')
            draw = ImageDraw.Draw(sheet)
            for cell, frame in enumerate(subset):
                x, y = (cell % 4) * 384, (cell // 4) * 240
                with Image.open(images / f'f{frame:05d}.jpg') as source:
                    sheet.paste(source.resize((384, 216)), (x, y + 24))
                t = pts[frame]
                draw.text((x + 4, y + 2), f'{int(t // 60):02}:{t % 60:06.3f}  f{frame}', fill='white', font=font)
            destination = args.output / f'{name}-{page:02d}.jpg'
            sheet.save(destination, quality=90)
            sheets.append({'path': destination.name, 'frames': subset})
    gaps = [{'afterFrame': i, 'startPts': a, 'nextPts': b} for i, (a, b) in enumerate(zip(pts, pts[1:]))
            if abs(b - a - 1 / float(rate)) > 0.000002]
    result = {'referenceSha256': digest, 'frameRate': str(rate), 'sourceFrames': len(pts),
              'declaredFrames': int(stream['nb_frames']),
              'samplingPlanSha256': hashlib.sha256(args.plan.read_bytes()).hexdigest(),
              'ffmpeg': subprocess.check_output(['ffmpeg', '-version'], text=True).splitlines()[0],
              'frameNumbering': 'zero-based decoded presentation order',
              'selection': 'nearest decoded source presentation timestamp',
              'timestampGaps': gaps, 'partialFileWarning': 'partial file' in decoded.stderr,
              'frames': inventory, 'sheets': sheets}
    (args.output / 'extraction.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'frames': len(inventory), 'contactSheets': len(sheets), 'output': str(args.output)}))


if __name__ == '__main__':
    main()
