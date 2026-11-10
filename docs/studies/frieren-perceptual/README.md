# A sound design of three passages from physical and perceptual models

Status: round 2 rendered and signal-checked on 2026-11-10. The owner listened to round 1 and gave three
remarks; round 2 answers them. Nobody has listened to round 2. The author has not seen the picture.

The owner asked on 2026-11-10 for a sound design that is made by calculation, not by ear. The owner listens
to the result. This study designs the effects of three passages of one fight scene. Each sound has a
model and a number. Each number has a measurement of the rendered audio.

## What this is and what it is not

- The picture facts come from the picture study on the branch `analysis/frieren-picture-study` at `f53a8c8`
  (`docs/studies/frieren/` there): the frame anchors of `spotting.json` and the event times of
  `sound-design/session.json`. That branch is not on `main`. This study changes nothing on it.
- The renderer is an offline program in Python with `numpy` (`scripts/`). It is not the TypeAudio engine.
  Deviation, open: the engine has no kind for a sustained source, a noise impact or a moving source. "What the
  engine needs" lists what the study used.
- The audio holds effects and the hall only. It holds no dialogue and no music.
- The media stay outside the repository. This directory holds the programs, the receipt and the hashes.

## The passages

| Passage | Picture seconds       | File   | SHA-256 of the 24-bit WAV that `scripts/render.py` writes (round 2) |
| ------- | --------------------- | ------ | ------------------------------------------------------------------- |
| Red     | 20.000 to 30.000      | 12.5 s | `826f44527c553ada562276d2a633c16dc8ab09ec886e2075554403eedc1a91ee`  |
| Force   | 136.500 to 149.700    | 15.7 s | `ce973688b041ea4df23a1b83f6bf51b5796102411c241c127ba612b131e14f6a`  |
| Finale  | 173.000 to 189.314625 | 18.8 s | `c3902dd2820d49d720e6ed4fa745642ed8ab621c3f715c890a194a41b72f9e83`  |

Each file has a tail of 2.5 s after its picture range. The sample rate is 48,000 Hz. One picture frame is
2,002 samples (24000/1001 frames a second).

The round 2 files that the owner received were written from the 32-bit float samples, not by `render.py`.
They differ from the files above by at most one step of 24 bits, in 0.2 to 0.5 % of the samples. Their
SHA-256 values begin `d93b2bbe` (red), `0ec6d434` (force) and `2bf8f1e6` (finale). The round 1 masters are in
the first commit of this study (`b9a6e52`).

## The method

1. Write the dramatic goal of each moment as a perceptual target with a unit.
2. Choose a model that connects the target to parameters.
3. Render, measure the rendered audio, and change the parameters until the measurement meets the target.
4. Look at the spectrogram of each passage for what the numbers do not show.
5. After a listening review, measure the cause of each remark and add that measure to the receipt.

Every layer is set by a loudness target (ITU-R BS.1770 K-weighting; windows of 0.1 s, 0.4 s or 3 s), not by a
gain. The master applies one gain for a true peak of -2 dBTP and no limiter.

## The first listening review

The owner listened to round 1 on 2026-11-10 and said three things. Each remark names what the ear took the
sound for. Round 1 had a target for the level, the timing and the masking of each sound, and none for that.

| The owner heard                         | Measured cause in round 1                                                                                             | Change in round 2                                                                                             | Before and after                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Red: a helicopter far away              | A periodic amplitude modulation at 38 Hz on a low harmonic body: the structure of a rotor. Little energy above 2 kHz  | Modulation with no period; noise in place of the harmonic body; a crackling surface; less hall                | Modulation line 17.9 dB to 5.9 dB over the median (white noise reads 6 dB)   |
| Force: thumps that bounce               | Impacts of a few sine modes and a low tone that falls: the structure of a drum. Fragments bounced as a ball does      | Impacts of noise with no pitch; a fragment lands, may tumble once and scatters; times and sizes are irregular | Share of the column contact's energy in 3 lines 0.93 to 0.53                 |
| Finale: squelching water after the beam | The dissolution was short pitched grains between 0.4 and 4 kHz: the structure of drops. A far pebble with a long tail | A breath of high noise, thin tones that fade one by one, dry ticks above 4 kHz; no pebble                     | Energy share of 0.4 to 4 kHz 0.81 to 0.39; line jumps 0.52 to 0.25 of frames |

The owner also said that the sound must be judged with the picture. The review page now plays a video file
that the viewer chooses on the viewer's own device, in step with the sound. The file does not leave the
device. A test with a synthetic video held the picture within 20 ms of the sound.

## The models

| Sound                          | Model                                                                                        | Parameters                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Shield and glassy cracks       | Damped modes. The decay time of a mode is `1 / (pi * f * loss)`                              | Loss factor 0.0025 to 0.003                                         |
| Brittle fracture               | A broadband main crack and an avalanche of small cracks: rate `k / (t + c)`, power-law sizes | Each small crack draws its own modes, so the result is noise        |
| Strain before a failure        | Micro-cracks whose rate rises as `1 / (time to failure)`                                     | 23.8 s to the fracture anchor                                       |
| Pressure with no visible body  | One Friedlander pulse, a low noise body, a mid slap                                          | Positive phase 3.5 ms; nothing in it has a pitch                    |
| Impacts of stone and of a body | Noise bursts with an exponential decay                                                       | Band and decay follow the size and the softness of the contact      |
| Air of a moving body           | Aerodynamic noise: power follows the sixth power of the speed, the band follows the speed    | Strouhal 0.2 gives no tone for a body of 0.4 m at 10 m/s            |
| A falling fragment             | A clack around `c / (2 pi a)` for a radius `a`, a low thud, a bright tick, a scatter         | No train of bounces                                                 |
| The red material               | A low rumble, a roar whose band narrows and rises with the tension, a crackling surface      | Every modulation is band-limited noise between 10 and 120 Hz        |
| Surprise                       | A level step over the bed, a rise under 10 ms, and no sound in the 0.5 s before              | See the force passage below                                         |
| Dissolution                    | A breath of high noise whose lower edge rises, thin tones that fade one by one, dry ticks    | Nothing short and pitched between 0.4 and 4 kHz                     |
| The hall                       | Image sources of a box of 18 by 24 by 14 m; late field with echo density `4 pi c^3 t^2 / V`  | Decay 2.6 s; late level from the critical distance, lowered by 5 dB |
| A moving source                | The change of the propagation delay                                                          | The Doppler shift follows from the path                             |

Two choices are style, not physics, and the study says so. A bare stone hall of this size has a decay of about
8 to 13 s by Sabine's formula. The study uses 2.6 s so that the events stay readable. The direct sound of the
far events is raised against the late field by 2 to 8 dB.

## Targets and measurements of round 2

`receipt.txt` is the whole output of `scripts/receipt.py`. The table holds the lines that carry the design.

| Passage | Target                                                | Measured                                           |
| ------- | ----------------------------------------------------- | -------------------------------------------------- |
| Red     | No periodic modulation                                | Line 5.9 dB over the median in the orbit           |
| Red     | The pass of the orb is readable from its level        | -29.5 LUFS far, -18.7 LUFS at 1.4 m                |
| Red     | The fracture and the release sit on their anchors     | 0.00 ms and 0.00 ms                                |
| Force   | A level step of 20 dB or more over the bed            | 34.8 dB (-11.5 LUFS over -46.2 LUFS)               |
| Force   | Half the peak within 10 ms of the anchor              | 0.15 ms                                            |
| Force   | No cue in the 0.5 s before the force                  | 0.1 dB over the bed                                |
| Force   | The force and the column contact are two events       | -33.9 LUFS between them, 22 dB below both          |
| Force   | The force reads on a small speaker (350 Hz and above) | -15.8 LUFS over a bed of -48.2 LUFS                |
| Force   | The column contact has no pitch                       | Share of its energy in 3 lines 0.53                |
| Finale  | The flash is the loudest moment                       | -11.4 LUFS over 0.1 s; 21.5 dB over the gap before |
| Finale  | The beam holds its loudness for 4 s                   | -18.0, -17.4, -16.4, -17.5 LUFS for each second    |
| Finale  | The dissolution has no pitched grains                 | Energy share of 0.4 to 4 kHz 0.39                  |
| All     | True peak                                             | -2.00 dBTP                                         |

Integrated loudness: red -22.1 LUFS, force -20.8 LUFS, finale -18.0 LUFS.

The share of energy in 3 lines does not fall below about 0.5 for a short low burst, because a window of
0.12 s holds few lines below 300 Hz. The measure separates round 1 from round 2. It is no proof that the
thumps are gone.

## Reproduce

```
python3 docs/studies/frieren-perceptual/scripts/render.py <output directory>
python3 docs/studies/frieren-perceptual/scripts/receipt.py <output directory>
python3 docs/studies/frieren-perceptual/scripts/spectro.py <output directory>
```

Python 3.13.18 and numpy 2.5.3 gave the files above on 2026-11-10. `render.py` writes a 24-bit WAV, the
samples and the layers of each passage. `spectro.py` writes a spectrogram picture of each.

## What is not verified

- Nobody has listened to round 2. The receipt proves signal properties. It does not prove that the stone
  sounds like stone or that the surprise works. Round 1 met every target of its receipt and still sounded
  like a helicopter, a drum and water.
- The author has not played the files against the picture. The event times that are not anchors are editorial
  times of the other study.
- The models of loudness, roughness and masking are approximations. The measures of the first listening
  review compare one round with another; they are not calibrated units.

## What the engine needs

The study used these things, and the plan format of experiment 8 does not have them:

1. A source that lasts across cuts, with a path: the orb, the beam.
2. Linked events with fixed offsets: the fracture and the release (2 frames); the body and the crack (30 ms).
3. A switch for a guard on one event: the force must have no anticipation and no dip before it.
4. Kinds from models: a noise impact with a size, a fracture, a pressure hit, air that follows a speed, a
   sustained beam, a dissolution.
5. Analyzers of perception: the step and the rise of an onset, audibility of one layer against the others.
6. Analyzers of recognition, which the first listening review showed to be missing: a periodic modulation
   (a machine), a few strong lines in an impact (a drum), regular intervals (a ball), short pitched grains
   (water). A sound can meet every target of level and timing and still be taken for another thing.
