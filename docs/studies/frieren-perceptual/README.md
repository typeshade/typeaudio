# A sound design of three passages from physical and perceptual models

Status: round 3 rendered and signal-checked on 2026-11-10. The owner listened to round 1 and gave three
remarks. Round 2 answers them. Round 3 follows the picture, which the author inspected frame by frame for
the first time. Nobody has listened to rounds 2 and 3.

The owner asked on 2026-11-10 for a sound design that is made by calculation, not by ear. The owner listens
to the result. This study designs the effects of three passages of one fight scene. Each sound has a
model and a number. Each number has a measurement of the rendered audio.

## What this is and what it is not

- The frame anchors come from the picture study on the branch `analysis/frieren-picture-study` at `f53a8c8`
  (`docs/studies/frieren/spotting.json` there). That branch is not on `main`. This study changes nothing on
  it.
- Since round 3 every other time comes from the picture itself. The reference video was read from the
  owner's storage at the locator that `docs/continuity/archive/reference-metadata.json` of that branch
  records. Its SHA-256 equals the recorded one (`6f1856eb…`). The video stays outside the repository.
- The renderer is an offline program in Python with `numpy` (`scripts/`). It is not the TypeAudio engine.
  Deviation, open: the engine has no kind for a sustained source, a noise impact or a moving source. "What the
  engine needs" lists what the study used.
- The audio holds effects and the hall only. It holds no dialogue and no music. The picture has spoken lines
  at 137.25 to 142.25 s, 174.4 to 176.25 s and 186.5 to 188.25 s; the design leaves those places quiet.
- The media stay outside the repository. This directory holds the programs, the receipt and the hashes.

## The passages

| Passage | Picture seconds       | File   | SHA-256 of the 24-bit WAV that `scripts/render.py` writes (round 3) |
| ------- | --------------------- | ------ | ------------------------------------------------------------------- |
| Red     | 20.000 to 30.000      | 12.5 s | `77221e327c421d82416dad16824657cbf1a3770e16ad59901a2a90e13caad38a`  |
| Force   | 136.500 to 149.700    | 15.7 s | `6c3d11aeac348d94ab5788dbb150a905c5c58deeaee1a5351e2bbfd38dff33db`  |
| Finale  | 173.000 to 189.314625 | 18.8 s | `d3ca864e19da3215492d27facdb7cf42992e9216fb808f812c9ae4fb9f60f79f`  |

Each file has a tail of 2.5 s after its picture range. The sample rate is 48,000 Hz. One picture frame is
2,002 samples (24000/1001 frames a second). Rounds 1 and 2 are the commits `b9a6e52` and `1454215`.

## The method

1. Write the dramatic goal of each moment as a perceptual target with a unit.
2. Choose a model that connects the target to parameters.
3. Render, measure the rendered audio, and change the parameters until the measurement meets the target.
4. Look at the spectrogram of each passage for what the numbers do not show.
5. After a listening review, measure the cause of each remark and add that measure to the receipt.
6. Look at the picture: time-stamped contact sheets of every passage (`scripts/sheet.sh`), 4 frames a second
   for the whole passage and 12 to 24 for the moments that carry a sound. Put the sound on the picture
   (`scripts/mux.py`) and measure where the sounds fall.

Every layer is set by a loudness target (ITU-R BS.1770 K-weighting; windows of 0.1 s, 0.4 s or 3 s), not by a
gain. The master applies one gain for a true peak of -2 dBTP and no limiter.

## The first listening review (round 1)

The owner listened to round 1 on 2026-11-10 and said three things. Each remark names what the ear took the
sound for. Round 1 had a target for the level, the timing and the masking of each sound, and none for that.

| The owner heard                         | Measured cause in round 1                                                                                             | Change in round 2                                                                                             | Before and after                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Red: a helicopter far away              | A periodic amplitude modulation at 38 Hz on a low harmonic body: the structure of a rotor. Little energy above 2 kHz  | Modulation with no period; noise in place of the harmonic body; a crackling surface; less hall                | Modulation line 17.9 dB to 5.9 dB over the median (white noise reads 6 dB)   |
| Force: thumps that bounce               | Impacts of a few sine modes and a low tone that falls: the structure of a drum. Fragments bounced as a ball does      | Impacts of noise with no pitch; a fragment lands, may tumble once and scatters; times and sizes are irregular | Share of the column contact's energy in 3 lines 0.93 to 0.53                 |
| Finale: squelching water after the beam | The dissolution was short pitched grains between 0.4 and 4 kHz: the structure of drops. A far pebble with a long tail | A breath of high noise, thin tones that fade one by one, dry ticks above 4 kHz; no pebble                     | Energy share of 0.4 to 4 kHz 0.81 to 0.39; line jumps 0.52 to 0.25 of frames |

The owner also said that the sound must be judged with the picture.

## The picture (round 3)

Rounds 1 and 2 took the times that are not anchors from the other study's editorial estimates. The frames
show a different scene in several places. Round 3 follows the frames.

| Picture seconds  | What the frames show                                                                               | Round 2                                   | Round 3                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| 20.00 to 22.30   | The camera flies with the orb. Sparks at 21.12 and 21.80; a rock bursts toward the camera at 21.98 | The orb passes from left to right         | The orb stays in front; nine rocks pass on both sides; two spark hits; a near burst   |
| 22.31 to 23.75   | A close shot of flame tearing stone; a whip of the camera; a wide shot with the orb far            | One source with one perspective           | Close flame, a swish, a far orb among falling rock                                    |
| 23.81 to 25.69   | Red cracks spread over stone, close; then the cracked shell hangs in the hall, wide                | One containment sound                     | Close cracking; then a far shell that tightens, with micro-cracks toward the fracture |
| 26.30 to 28.2    | Cold light and crystal burst around the standing figure; sparkles thin                             | A small shield ring and falling fragments | A glassy crack, a burst of light, the shield's ring, sparkles and shards              |
| 28.5 to 32.5     | A dust cloud; then hair in the wind, close                                                         | Fragments that land                       | Dust, then wind with hair and cloth                                                   |
| 145.19 to 145.78 | A ring runs through the air and dust lifts; the body flies to the far column                       | Air and cloth only                        | A ring and a low dust burst, then air and cloth that recede                           |
| 146.30 to 147.75 | The column comes down: many blocks for 1.4 s                                                       | Six separate fragments                    | Blocks that fall onto one another at random times, a low rumble, crumbling stone      |
| 147.75 to 149.67 | Dust fills the frame; then she is pinned in a cracked wall, close                                  | Late fragments and dust                   | Two dull knocks and a hiss; then pebbles, the wall ticking, shards                    |
| 173.72 to 174.40 | The staff swings into the frame                                                                    | Cloth at 173.2                            | A swing of air with the sleeve                                                        |
| 174.46 to 177.49 | A lit circle on the floor; a spoken line                                                           | Nothing                                   | A low steady pad that the preparation grows from                                      |
| 177.50           | One wide frame before the flash                                                                    | A gap of 60 ms (kept)                     | The same gap; it falls on that wide frame                                             |
| 177.9 to 181.3   | Floor blocks lift and tumble around the beam; rings of light pass                                  | Four falling stones                       | Blocks that tumble all the time; five soft swishes for the rings                      |
| 185.5 to 188.0   | The remnants keep thinning in the last shot; a spoken line                                         | A far pebble and cloth                    | A thin high noise that fades; nothing in the band of speech                           |

The preview clips put the sound on the picture. Measured on the decoded sound of the clips: the force
starts at picture time 145.1868 s (anchor 145.1867 s) and the flash at 177.5524 s (anchor 177.5524 s).

## The models

| Sound                          | Model                                                                                         | Parameters                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Shield and glassy cracks       | Damped modes. The decay time of a mode is `1 / (pi * f * loss)`                               | Loss factor 0.0025 to 0.006                                         |
| Brittle fracture               | A broadband main crack and an avalanche of small cracks: rate `k / (t + c)`, power-law sizes  | Each small crack draws its own modes, so the result is noise        |
| Strain before a failure        | Micro-cracks whose rate rises as `1 / (time to failure)`                                      | 24.75 s to the fracture anchor                                      |
| Pressure with no visible body  | One Friedlander pulse, a low noise body, a mid slap                                           | Positive phase 3.5 ms; nothing in it has a pitch                    |
| Impacts of stone and of a body | Noise bursts with an exponential decay                                                        | Band and decay follow the size and the softness of the contact      |
| A falling column               | Impacts at random times (a Poisson process whose rate falls), sizes drawn on a log scale      | Three streams at three places; a low rumble and gravel under them   |
| Air of a moving body           | Aerodynamic noise: power follows the sixth power of the speed, the band follows the speed     | Strouhal 0.2 gives no tone for a body of 0.4 m at 10 m/s            |
| A rock that passes the camera  | A steady noise source on a path of 50 m/s; the level and the Doppler shift come from the path | Nearest distance 1.1 to 2.6 m                                       |
| The red material               | A low rumble, a roar whose band narrows and rises with the tension, a crackling surface       | Every modulation is band-limited noise between 10 and 120 Hz        |
| Surprise                       | A level step over the bed, a rise under 10 ms, and no sound in the 0.5 s before               | See the force passage below                                         |
| Dissolution                    | A breath of high noise whose lower edge rises, thin tones that fade one by one, dry ticks     | Nothing short and pitched between 0.4 and 4 kHz                     |
| The hall                       | Image sources of a box of 18 by 24 by 14 m; late field with echo density `4 pi c^3 t^2 / V`   | Decay 2.6 s; late level from the critical distance, lowered by 5 dB |
| A moving source                | The change of the propagation delay                                                           | The Doppler shift follows from the path                             |

Two choices are style, not physics, and the study says so. A bare stone hall of this size has a decay of about
8 to 13 s by Sabine's formula. The study uses 2.6 s so that the events stay readable. The direct sound of the
far events is raised against the late field by 2 to 10 dB.

## Targets and measurements of round 3

`receipt.txt` is the whole output of `scripts/receipt.py`. The table holds the lines that carry the design.

| Passage | Target                                               | Measured                                                |
| ------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Red     | The perspective changes with the cut                 | -20.5 LUFS in flight, -16.7 close, -25.4 far            |
| Red     | No periodic modulation                               | Line 8.6 dB over the median in the flight               |
| Red     | The hits, the fracture and the release are on time   | 0.02 ms or less from each picture time                  |
| Red     | The release is the loudest moment                    | -11.9 LUFS over 0.1 s                                   |
| Force   | A level step of 20 dB or more over the bed           | 36.4 dB (-13.5 LUFS over -49.9 LUFS)                    |
| Force   | Half the peak within 10 ms of the anchor             | 0.15 ms                                                 |
| Force   | No cue in the 0.5 s before the force                 | 0.6 dB over the bed                                     |
| Force   | The force and the column contact are two events      | -31.9 LUFS between them, 18 dB below both               |
| Force   | The column comes down and dies away                  | -19.7, -18.2, -21.2, -28.1, -36.0 LUFS each half second |
| Force   | The column contact has no pitch                      | Share of its energy in 3 lines 0.52                     |
| Finale  | The flash is the loudest moment                      | -11.4 LUFS over 0.1 s; 21.5 dB over the gap before      |
| Finale  | The beam holds its loudness for 4 s                  | -17.7, -17.8, -16.4, -17.5 LUFS for each second         |
| Finale  | The pad and the remnants stay under the spoken lines | -43.6 LUFS and -46.2 LUFS                               |
| Finale  | The dissolution has no pitched grains                | Energy share of 0.4 to 4 kHz 0.38                       |
| All     | True peak                                            | -2.00 dBTP                                              |

Integrated loudness: red -20.7 LUFS, force -19.8 LUFS, finale -18.1 LUFS.

The share of energy in 3 lines does not fall below about 0.5 for a short low burst, because a window of
0.12 s holds few lines below 300 Hz. The measure separates round 1 from the later rounds. It is no proof that
the thumps are gone.

## Reproduce

```
python3 docs/studies/frieren-perceptual/scripts/render.py <output directory>
python3 docs/studies/frieren-perceptual/scripts/receipt.py <output directory>
python3 docs/studies/frieren-perceptual/scripts/spectro.py <output directory>
bash docs/studies/frieren-perceptual/scripts/sheet.sh <video> <start> <seconds> <frames a second> <columns> <png>
python3 docs/studies/frieren-perceptual/scripts/mux.py <video> <output directory> <preview directory>
```

Python 3.13.18 and numpy 2.5.3 gave the files above on 2026-11-10; the files the owner received for round 3
are those files. `render.py` writes a 24-bit WAV, the samples and the layers of each passage. `spectro.py`
writes a spectrogram picture of each. `sheet.sh` and `mux.py` need `ffmpeg` and the reference video.

## What is not verified

- Nobody has listened to rounds 2 and 3. The receipt proves signal properties. It does not prove that the
  stone sounds like stone or that the surprise works. Round 1 met every target of its receipt and still
  sounded like a helicopter, a drum and water.
- The author read the picture from contact sheets of still frames, not from the moving picture. A sound that
  fits a frame can still feel wrong in motion.
- The models of loudness and masking are approximations. The measures of the first listening review compare
  one round with another; they are not calibrated units.

## What the engine needs

The study used these things, and the plan format of experiment 8 does not have them:

1. A source that lasts across cuts, with a path: the orb, the beam.
2. A perspective that changes at a cut while the source goes on: close, far and close again in 3 s of red.
3. Linked events with fixed offsets: the fracture and the release (2 frames); the body and the crack (30 ms).
4. A switch for a guard on one event: the force must have no anticipation and no dip before it.
5. Kinds from models: a noise impact with a size, a fracture, a falling structure, a pressure hit, air that
   follows a speed, a sustained beam, a dissolution.
6. Analyzers of perception: the step and the rise of an onset, audibility of one layer against the others.
7. Analyzers of recognition, which the first listening review showed to be missing: a periodic modulation
   (a machine), a few strong lines in an impact (a drum), regular intervals (a ball), short pitched grains
   (water). A sound can meet every target of level and timing and still be taken for another thing.
8. The picture as an input. A plan that is written without the frames puts sounds where nothing happens.
   Round 3 exists because the frames contradicted the plan of rounds 1 and 2.
