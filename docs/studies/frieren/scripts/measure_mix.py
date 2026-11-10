"""Measure the supplied mixed soundtrack; these measurements do not identify isolated sound sources."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
import subprocess

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--end', type=float, default=188)
    args = parser.parse_args()
    expected = json.loads((Path(__file__).resolve().parents[1] / 'sampling.json').read_text())['referenceSha256']
    if hashlib.sha256(args.input.read_bytes()).hexdigest() != expected:
        raise SystemExit('Reference hash differs from the study.')
    if args.output.exists() or args.end <= 0:
        raise SystemExit('Use a new output directory and a positive analysis duration.')
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(args.input)]))
    stream = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    rate, channels = int(stream['sample_rate']), int(stream['channels'])
    if channels != 2 or float(stream['start_time']) != 0:
        raise SystemExit('This study expects zero-origin stereo audio.')
    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(args.input), '-t', str(args.end),
                              '-map', '0:a:0', '-vn', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'],
                             capture_output=True, check=True)
    audio = np.frombuffer(decoded.stdout, dtype='<f4').reshape(-1, channels).astype(np.float64)
    if not np.isfinite(audio).all() or abs(len(audio) / rate - args.end) > 1 / rate:
        raise SystemExit('Decoded samples are invalid or the requested analysis range is incomplete.')
    block = round(rate * 0.25)
    frequency = np.fft.rfftfreq(block, 1 / rate)
    window = np.hanning(block)[:, None]
    bands = [(20, 120), (120, 500), (500, 2000), (2000, 8000), (8000, 20000)]
    rows = []
    for start in range(0, len(audio) - block + 1, block):
        chunk = audio[start:start + block]
        rms = float(np.sqrt(np.mean(chunk ** 2)))
        left, right = chunk.T
        mid, side = (left + right) / 2, (left - right) / 2
        denominator = float(np.sqrt(np.var(left) * np.var(right)))
        correlation = float(np.mean((left-left.mean()) * (right-right.mean())) / denominator) if denominator > 1e-15 else None
        spectrum = np.mean(abs(np.fft.rfft(chunk * window, axis=0)) ** 2, axis=1)
        total = float(spectrum[(frequency >= 20) & (frequency < 20000)].sum())
        row = {'start': round(start / rate, 6), 'end': round((start + block) / rate, 6),
               'rmsDbfs': 20 * np.log10(max(rms, 1e-15)),
               'samplePeakDbfs': 20 * np.log10(max(float(abs(chunk).max()), 1e-15)),
               'correlation': correlation,
               'sideToMidDb': 10 * np.log10(max(float(np.mean(side ** 2)), 1e-30) / max(float(np.mean(mid ** 2)), 1e-30)),
               'powerCentroidHz': float((spectrum * frequency).sum() / max(spectrum.sum(), 1e-30))}
        for low, high in bands:
            row[f'energyFraction_{low}_{high}Hz'] = float(spectrum[(frequency >= low) & (frequency < high)].sum() / max(total, 1e-30))
        rows.append(row)
    loudness = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(args.input), '-t', str(args.end),
                               '-map', '0:a:0', '-vn', '-af', f'atrim=start=0:end={args.end},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
                               '-f', 'null', '-'], capture_output=True, text=True, check=True)
    match = re.search(r'\{\s*"input_i"[\s\S]*?\}', loudness.stderr)
    if not match:
        raise SystemExit('FFmpeg did not provide the input loudness measurement.')
    measured = json.loads(match.group())
    summary = {
        'referenceSha256': expected, 'rangeSeconds': [0, args.end], 'sampleRate': rate,
        'channels': channels, 'decodedFrames': len(audio), 'windowSeconds': block / rate,
        'samplePeakDbfs': float(20 * np.log10(max(float(abs(audio).max()), 1e-15))),
        'rmsDbfs': float(20 * np.log10(max(float(np.sqrt(np.mean(audio ** 2))), 1e-15))),
        'samplesAtOrAboveFullScale': int((abs(audio) >= 1).sum()),
        'integratedLufs': float(measured['input_i']), 'truePeakDbtp': float(measured['input_tp']),
        'loudnessRangeLu': float(measured['input_lra']), 'gatingThresholdLufs': float(measured['input_thresh']),
        'method': 'Explicit atrim before FFmpeg loudnorm first-pass input measurements; no normalized audio is saved.',
        'fft': 'Per-channel Hann-window power averaged across stereo; fractions normalized to 20 Hz–20 kHz.',
        'interpretation': 'Original dialogue, music and effects are mixed together. RMS, width and spectra do not identify sources or establish sound-design quality.',
        'tools': {'ffmpeg': subprocess.check_output(['ffmpeg', '-version'], text=True).splitlines()[0],
                  'numpy': np.__version__, 'matplotlib': matplotlib.__version__},
    }
    args.output.mkdir(parents=True)
    (args.output / 'mix-measurements.json').write_text(json.dumps(summary, indent=2) + '\n')
    with (args.output / 'mix-windows.csv').open('w') as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    (args.output / 'loudness.log').write_text(loudness.stderr)
    fig, axes = plt.subplots(3, 1, figsize=(13, 8), sharex=True, constrained_layout=True)
    time = [row['start'] for row in rows]
    axes[0].plot(time, [row['rmsDbfs'] for row in rows], color='#296da8', lw=0.9)
    axes[0].set(ylabel='250 ms RMS (dBFS)', ylim=(-65, 0), title=f'Supplied reference: original mixed soundtrack, 0–{args.end:g} s')
    axes[1].plot(time, [row['energyFraction_20_120Hz'] for row in rows], color='#985a23', lw=0.9)
    axes[1].set(ylabel='20–120 Hz energy fraction', ylim=(0, 1))
    axes[2].plot(time, [row['sideToMidDb'] for row in rows], color='#6b4898', lw=0.9)
    axes[2].set(ylabel='Side / mid energy (dB)', xlabel='Source presentation time (seconds)', ylim=(-45, 15))
    for axis in axes:
        axis.grid(alpha=0.2)
        axis.set_xlim(0, args.end)
    fig.savefig(args.output / 'reference-mix-profile.png', dpi=150)
    plt.close(fig)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
