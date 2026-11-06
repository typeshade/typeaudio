# Frieren procedural sound design studies

Status: three effects studies rendered and signal-checked. Listening review and candidate selection remain pending.

The picture-analysis baseline is `68a33d85799e4cf70a10a8f5fc211b9472043d5a`.
The reference is [YHCqcyX9N3s](https://www.youtube.com/watch?v=YHCqcyX9N3s).
The source hash and observed anchors remain in [the picture study](../README.md).

## Delivered design and sound

The [sonic direction](direction.md) covers all 41 observed regions.
Three passages contain 47 newly authored layers from 13 scalar TypeShade programs.
Each passage has A/B candidates with one changed design parameter and measured whole-passage gain matching.

| Study | Picture range | Audible comparison |
| --- | --- | --- |
| Red | 20–30 s | Contained material, fracture, release and defence; vary core roughness |
| Force | 136.5–149.7 s | Quiet space, unannounced force, travel and column contact; vary pressure decay |
| Finale | 173–189.314625 s | Preparation, continuous beam, dissolution and recovery; vary dissolution texture |

Delivery includes six stereo WAV masters, six mobile M4A files and 34 aligned bus stems.
Each candidate has a 2.5-second tail handle after its picture range.
The [session](session.json) holds exact timings, envelopes, pitches, seeds, trajectories, gains and room sends.
The [reproduction procedure](reproduce.md) explains the source, mix and artifact contracts.

Render source: `87295117341448ddf56e0352903f0baf6051ce85`, with unchanged TypeShade pin `87af4eb0d9d15f02b66b8341b72cab0944290472`.
The [render receipt](render-receipt.json), [delivery manifest](delivery-manifest.json) and [verification](verification.json) preserve measured evidence.
Two complete runs produced 34 bit-identical raw stems on the same host and toolchain.
WAV A/B differences are at most 0.01 LU; AAC differences are at most 0.04 LU.
The lowest decoded AAC true-peak headroom is 2.43 dB. Mono RMS loss is below 0.17 dB.

The quiet force passage retains approximately −42 dBFS RMS room texture after the draft's near-silent bed was revised.
The force contrast remains approximately 21–24 dB in the measured windows.
These are signal properties, not proof of physical-phone audibility or creative quality.

These are authored effects studies. They do not reproduce the reference dialogue or music.
Signal checks do not constitute a listening review.
The full scene mix and Web timeline import remain separate production work.
No new site or production deployment is part of this study.

## Recovery

Resume on branch `feat/frieren-sound-design-studies` in `typeshade/typeaudio`.
Read this directory and [PR #28](https://github.com/typeshade/typeaudio/pull/28) before changing the engine or old v2 renders.
Keep generated media outside the repository. Preserve recipes and artifact hashes in Git.
