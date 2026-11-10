# A sound design of three passages from physical and perceptual models

Status: rendered and signal-checked on 2026-11-10. No listening review. No check against the picture.

The owner asked on 2026-11-10 for a sound design that is made by calculation, not by ear. The owner listens
to the result. This study designs the effects of three passages of one fight scene. Each sound has a
model and a number. Each number has a measurement of the rendered audio.

## What this is and what it is not

- The picture facts come from the picture study on the branch `analysis/frieren-picture-study` at `f53a8c8`
  (`docs/studies/frieren/` there): the frame anchors of `spotting.json` and the event times of
  `sound-design/session.json`. That branch is not on `main`. This study changes nothing on it.
- The renderer is an offline program in Python with `numpy` (`scripts/`). It is not the TypeAudio engine.
  Deviation, open: the engine has no kind for a sustained source, a modal impact or a moving source. "What the
  engine needs" lists what the study used.
- The audio holds effects and the hall only. It holds no dialogue and no music.
- The media stay outside the repository. This directory holds the programs, the receipt and the hashes.

## The passages

| Passage | Picture seconds       | File   | SHA-256 of the 24-bit WAV master                                   |
| ------- | --------------------- | ------ | ------------------------------------------------------------------ |
| Red     | 20.000 to 30.000      | 12.5 s | `8871d205c9467674307c1bdcdb0aadf955be96c6e4385ccd24d416a58f4d6549` |
| Force   | 136.500 to 149.700    | 15.7 s | `4cbe7dd9dd53784940c5b2dbbc1ba0c14e61285757f7feee8b9637b29dbc2196` |
| Finale  | 173.000 to 189.314625 | 18.8 s | `44e61a4fe952166476cb17e4704edc0818bd6ce60ff40dd59d29f910fe579d7d` |

Each file has a tail of 2.5 s after its picture range. The sample rate is 48,000 Hz. One picture frame is
2,002 samples (24000/1001 frames a second).

## The method

1. Write the dramatic goal of each moment as a perceptual target with a unit.
2. Choose a model that connects the target to parameters.
3. Render, measure the rendered audio, and change the parameters until the measurement meets the target.
4. Look at the spectrogram of each passage for what the numbers do not show.

Every layer is set by a loudness target (ITU-R BS.1770 K-weighting; windows of 0.1 s, 0.4 s or 3 s), not by a
gain. The master applies one gain for a true peak of -2 dBTP and no limiter.

## The models

| Sound                         | Model                                                                                        | Parameters                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Stone, shield, cracks         | Damped modes. The decay time of a mode is `1 / (pi * f * loss)`                              | Loss factor 0.02 for stone, 0.0025 for the glassy shield               |
| Brittle fracture              | A broadband main crack and an avalanche of small cracks: rate `k / (t + c)`, power-law sizes | Each small crack draws its own modes, so the result is noise, no chord |
| Strain before a failure       | Micro-cracks whose rate rises as `1 / (time to failure)`                                     | 23.8 s to the fracture anchor                                          |
| Pressure with no visible body | Friedlander blast wave, a falling low body with harmonics, damped modes of the struck body   | Positive phase 3.5 ms; the harmonics keep the pitch on a small speaker |
| Air of a moving body          | Aerodynamic noise: power follows the sixth power of the speed, the band follows the speed    | Strouhal 0.2 gives no tone for a body of 0.4 m at 10 m/s               |
| A falling fragment            | Radiation peak at `c / (2 pi a)` for a radius `a`; bounces from a restitution of 0.35        | Fall height gives the impact speed and the bounce intervals            |
| The red material              | A low harmonic body and a rough mid band under one amplitude modulation                      | Modulation 38 Hz to 66 Hz and depth 0.55 to 0.95 in the containment    |
| Surprise                      | A level step over the bed, a rise under 10 ms, and no sound in the 0.5 s before              | See the force passage below                                            |
| The hall                      | Image sources of a box of 18 by 24 by 14 m; late field with echo density `4 pi c^3 t^2 / V`  | Decay 2.6 s; late level from the critical distance, lowered by 5 dB    |
| A moving source               | The change of the propagation delay                                                          | The Doppler shift follows from the path                                |

Two choices are style, not physics, and the study says so. A bare stone hall of this size has a decay of about
8 to 13 s by Sabine's formula. The study uses 2.6 s so that the events stay readable. The direct sound of the
far events is raised against the late field by 2 to 8 dB.

## Targets and measurements

`receipt.txt` is the whole output of `scripts/receipt.py`. The table holds the lines that carry the design.

| Passage | Target                                                | Measured                                             |
| ------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Red     | The pass of the orb is readable from its level        | -28.8 LUFS far, -19.0 LUFS at 1.4 m                  |
| Red     | The roughness rises in the containment                | Roughness proxy 0.105 to 0.158                       |
| Red     | The fracture and the release sit on their anchors     | 0.00 ms and 0.00 ms                                  |
| Force   | A level step of 20 dB or more over the bed            | 34.8 dB (-13.3 LUFS over -48.1 LUFS)                 |
| Force   | The level is near its peak 1 ms after the anchor      | 1.4 dB below the peak                                |
| Force   | No cue in the 0.5 s before the force                  | 0.1 dB over the bed                                  |
| Force   | The force and the column contact are two events       | -33.8 LUFS between them, 20 dB below both            |
| Force   | The force reads on a small speaker (350 Hz and above) | -20.1 LUFS over a bed of -50.1 LUFS                  |
| Finale  | The flash is the loudest moment                       | -11.0 LUFS over 0.1 s; 21.2 dB over the gap before   |
| Finale  | The beam holds its loudness for 4 s                   | -16.2, -16.4, -15.7, -16.8 LUFS for each second      |
| Finale  | The falling stones are audible under the beam         | 15 and 26 of 34 bands at least as strong as the rest |
| All     | True peak                                             | -2.00 dBTP                                           |

Integrated loudness: red -21.6 LUFS, force -21.5 LUFS, finale -17.0 LUFS.

## Reproduce

```
python3 docs/studies/frieren-perceptual/scripts/render.py <output directory>
python3 docs/studies/frieren-perceptual/scripts/receipt.py <output directory>
python3 docs/studies/frieren-perceptual/scripts/spectro.py <output directory>
```

Python 3.13.18 and numpy 2.5.3 gave the masters above, twice, bit for bit, on 2026-11-10. `render.py` writes a
24-bit WAV, the samples and the layers of each passage. `spectro.py` writes a spectrogram picture of each.

## What is not verified

- Nobody has listened to these files. The receipt proves signal properties. It does not prove that the stone
  sounds like stone or that the surprise works.
- The files were not played against the picture. The event times that are not anchors are editorial times of
  the other study.
- The models of loudness, roughness and masking are approximations. The roughness number is a proxy for
  comparison inside one passage, not a calibrated unit.

## What the engine needs

The study used these things, and the plan format of experiment 8 does not have them:

1. A source that lasts across cuts, with a path: the orb, the beam.
2. Linked events with fixed offsets: the fracture and the release (2 frames); the body and the crack (30 ms).
3. A switch for a guard on one event: the force must have no anticipation and no dip before it.
4. Kinds from models: a modal impact with a size and a loss factor, a fracture, a pressure hit, air that
   follows a speed, a sustained beam, a dissolution.
5. Analyzers of perception: the step and the rise of an onset, a roughness measure, audibility of one layer
   against the others.
