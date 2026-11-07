"""Apply one static gain per candidate, export aligned stems, and verify delivery files."""
import json
import sys
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
from metrics import run, loudness, signal, identity

root = Path(sys.argv[1]).resolve()
session = json.loads((root/'session.json').read_text())
receipt = json.loads((root/'render-receipt.json').read_text())
destination = root/'delivery'
destination.mkdir()  # Never overwrite earlier review media.
filters = butter(2, 27, 'highpass', fs=48000, output='sos')
results = []
assets = []
for study in session['studies']:
    candidates = []
    for variant in study['variants']:
        name = study['id']+'-'+variant['id']
        raw = root/name
        if not raw.is_dir():
            continue
        stems = {p.stem: sosfilt(filters, np.fromfile(p, '<f4').reshape(-1, 2), axis=0).astype('f4')
                 for p in sorted(raw.glob('*.f32'))}
        # Editorial crop fades apply to every stem. A separate 2.5 s tail handle follows picture.
        frames = len(next(iter(stems.values())))
        fade = np.ones(frames, dtype='f4')
        fade[:480] = np.linspace(0, 1, 480)
        fade[-2400:] = np.linspace(1, 0, 2400)
        for value in stems.values():
            value *= fade[:, None]
        mix = sum(stems.values())
        mix.astype('<f4').tofile(raw/'premaster.f32')
        meter = loudness(raw/'premaster.f32')
        ceiling_gain = -2.5-meter['truePeakDbtp']
        (mix*10**(ceiling_gain/20)).astype('<f4').tofile(raw/'calibration.f32')
        # Measure near delivery level first. Absolute loudness gating can change after large gain moves.
        calibrated = loudness(raw/'calibration.f32')
        candidates.append((variant, stems, mix, meter, ceiling_gain, calibrated))
    if not candidates:
        continue
    # A/B share the highest attainable target at or below -20 LUFS, without a limiter.
    target = min([-20] + [m['integratedLufs']-.05 for _, _, _, _, _, m in candidates])
    for variant, stems, mix, meter, ceiling_gain, calibrated in candidates:
        name = study['id']+'-'+variant['id']
        gain_db = ceiling_gain+target-calibrated['integratedLufs']
        gain = 10**(gain_db/20)
        master = (mix*gain).astype('f4')
        stats = signal(master)
        if stats['fullScaleSamples'] or stats['monoLossDb'] < -4:
            raise ValueError('Headroom or mono compatibility failed: '+name)
        raw_master = root/name/'master.f32'
        master.tofile(raw_master)
        wav = destination/(name+'.wav')
        aac = destination/(name+'.m4a')
        run('-f', 'f32le', '-ar', 48000, '-ac', 2, '-i', raw_master, '-c:a', 'pcm_s24le', wav)
        run('-i', wav, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', aac)
        wav_meter, aac_meter = loudness(wav), loudness(aac)
        if wav_meter['truePeakDbtp'] > -2 or aac_meter['truePeakDbtp'] > -1:
            raise ValueError('Delivery true peak failed: '+name)
        if abs(wav_meter['integratedLufs']-target) > .15:
            raise ValueError('Loudness matching failed: '+name)
        decoded = np.frombuffer(run('-i', aac, '-f', 'f32le', '-ar', 48000, '-ac', 2, '-').stdout, '<f4').reshape(-1, 2)
        if not np.isfinite(decoded).all() or abs(len(decoded)-len(master)) > 1024:
            raise ValueError('AAC duration or decoding failed: '+name)
        stem_dir = destination/(name+'-stems')
        stem_dir.mkdir()
        for bus, pcm in stems.items():
            path = stem_dir/(bus+'.wav')
            run('-f', 'f32le', '-ar', 48000, '-ac', 2, '-i', '-', '-c:a', 'pcm_s24le', path,
                data=(pcm*gain).astype('<f4').tobytes())
            assets.append(identity(path, destination))
        reconstruction = sum((p*gain).astype('f4') for p in stems.values())
        error = float(abs(reconstruction-master).max())
        if error > 1e-6:
            raise ValueError('Stem reconstruction failed: '+name)
        details = dict(name=name, label=variant['label'], sourceRangeSeconds=study['range'],
                       tailHandleSeconds=study['tailSeconds'], gainDb=gain_db, targetLufs=target,
                       signal=stats, wav=wav_meter, aac=aac_meter, decodedAacFrames=len(decoded),
                       stemReconstructionMaxError=error, comparisonChanges=variant['changes'])
        if study['id'] == 'force':
            def rms_db(a, b):
                pcm = master[round((a-study['range'][0])*48000):round((b-study['range'][0])*48000)]
                return float(20*np.log10(max(1e-12, np.sqrt(np.mean(pcm.astype('f8')**2)))))
            details['narrativeWindowsDbfs'] = dict(beforeForce=rms_db(144.6, 145.15),
                                                  force=rms_db(145.186708, 145.486708),
                                                  column=rms_db(145.937458, 146.237458))
        results.append(details)
        assets += [identity(wav, destination), identity(aac, destination)]
        print(name, json.dumps(dict(targetLufs=target, gainDb=round(gain_db, 2), wav=wav_meter, aac=aac_meter)))
manifest = dict(schema='typeaudio.sound-design-review', version=1,
                sourceCommit=receipt['sourceCommit'], compiler=receipt['compiler'],
                reference=dict(url=session['picture'], sha256=session['pictureSha256'], onlineOffsetVerified=False),
                status=dict(rendered=True, signalChecked=True, listeningReviewed=False, selected=False),
                sampleRate=48000, channels=2, masterBitDepth=24,
                normalization='Static gain per complete passage; shared A/B target; no per-cue normalization, compression or limiting.',
                perspective='Authored stereo room proxy. No HRTF or front/back/height listening claim.',
                variants=results, assets=assets)
(destination/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
