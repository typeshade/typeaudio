"""FFmpeg meters the decoded deliverable, including AAC intersample overshoot."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
import numpy as np


def run(*args, data=None):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-v', 'info', *map(str, args)],
                          input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)


def loudness(path):
    path = Path(path)
    input_args = ['-f', 'f32le', '-ar', '48000', '-ac', '2'] if path.suffix == '.f32' else []
    result = run(*input_args, '-i', path, '-af', 'loudnorm=I=-20:TP=-2:LRA=11:print_format=json',
                 '-f', 'null', '-')
    match = re.findall(r'\{\s*"input_i"[^}]+\}', result.stderr.decode())
    if len(match) != 1:
        raise ValueError('Missing loudness result for '+str(path))
    fields = json.loads(match[0])
    return {key: float(fields[value]) for key, value in
            [('integratedLufs', 'input_i'), ('truePeakDbtp', 'input_tp'), ('loudnessRangeLu', 'input_lra')]}


def signal(pcm):
    if not np.isfinite(pcm).all():
        raise ValueError('Non-finite audio samples')
    rms = float(np.sqrt(np.mean(pcm.astype('f8') ** 2)))
    mono_rms = float(np.sqrt(np.mean(pcm.mean(axis=1, dtype='f8') ** 2)))
    return dict(sampleFrames=len(pcm), durationSeconds=len(pcm)/48000,
                samplePeakDbfs=float(20*np.log10(max(1e-12, abs(pcm).max()))),
                rmsDbfs=float(20*np.log10(max(1e-12, rms))),
                monoLossDb=float(20*np.log10(max(1e-12, mono_rms)/max(1e-12, rms))),
                stereoCorrelation=float(np.corrcoef(pcm.T)[0, 1]),
                nonFiniteSamples=0, fullScaleSamples=int((abs(pcm) >= 1).sum()))


def identity(path, root):
    data = path.read_bytes()
    return dict(path=str(path.relative_to(root)), bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
