"""Put the rendered sound on the picture, for a private review: one MP4 for each passage.
usage: python3 mux.py <reference video> <directory with red.wav, force.wav, finale.wav> <output directory>
The clip starts on the first picture frame at or after the passage start, and the sound is cut by the
same amount, so that a sound at picture time t plays at clip time t minus the time of that frame."""
import math
import subprocess
import sys

video, wavs, out = sys.argv[1:4]
for name, t0, dur in (('red', 20.0, 12.5), ('force', 136.5, 15.7), ('finale', 173.0, 16.6)):
    k = math.ceil(t0 * 24000 / 1001 - 1e-9)
    tf = k * 1001 / 24000
    off = tf - t0
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '%.6f' % (tf - 0.004), '-i', video,
                    '-ss', '%.6f' % off, '-i', '%s/%s.wav' % (wavs, name), '-t', '%.3f' % (dur - off),
                    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '%s/%s-preview.mp4' % (out, name)], check=True)
    print('%s: first frame %d at %.5f s, sound cut by %.5f s' % (name, k, tf, off))
