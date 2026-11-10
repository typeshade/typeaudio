# A sound design of three passages from physical and perceptual models

Status: round 7 rendered and signal-checked on 2026-11-10. The owner listened to round 1 and gave three
remarks. Round 2 answers them. Round 3 follows the picture, which the author inspected frame by frame for
the first time. The owner watched round 3 with the picture and found it flat. Round 4 answers that. The
owner found round 4 light, like glass marbles. Round 5 answers that. The owner found the last passage of
round 5 far from the original sound. Round 6 answers that. The owner named six events of the picture that
round 6 gave no sound or the wrong sound. Round 7 answers that. Nobody has listened to round 7.

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
- Since round 6 the original sound of the reference video is a measurement reference: its level, its spectrum
  and the times of its events (`scripts/reference.py`). No sample of it enters a render. It holds music and
  speech with the effects, so a section with music or speech says little about the effects alone.
- The audio holds effects and the hall only. It holds no dialogue and no music. The picture has spoken lines
  at 137.25 to 142.25 s, 174.4 to 176.25 s and 186.5 to 188.25 s; the design leaves those places quiet.
- The media stay outside the repository. This directory holds the programs, the receipt and the hashes.

## The passages

| Passage | Picture seconds       | File   | SHA-256 of the 24-bit WAV that `scripts/render.py` writes (round 7) |
| ------- | --------------------- | ------ | ------------------------------------------------------------------- |
| Red     | 20.000 to 30.000      | 12.5 s | `3478e38cd7a6d31ad101f7de0b01d29f3abd81e06c83b7db976c365c0310fbea`  |
| Force   | 136.500 to 149.700    | 15.7 s | `ed3e162f28d0e56dec2daf656fad4207c017ab85190fa467ea24617697db1327`  |
| Finale  | 173.000 to 189.314625 | 18.8 s | `ac1b43f74d3ef102c45d1138fb916dcb667ae9b1d31f2ee475e8f2e8c518f0b9`  |

Each file has a tail of 2.5 s after its picture range. The sample rate is 48,000 Hz. One picture frame is
2,002 samples (24000/1001 frames a second). Rounds 1 to 6 are the commits `b9a6e52`, `1454215`, `c0a4b69`,
`ee41d60`, `1a5b241` and `a3288f0`.

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
gain. The four bands of the torrent share one gain, so that their spectrum holds. The master puts the highest
true peak at -2 dBTP. Since round 6 it then raises the sum by a drive (8 dB for red, 6 dB for force, 14 dB
for the finale); a look-ahead limiter and a soft clip hold the peaks at the same ceiling. A limiter that
works 10 dB deep flattens every step of level. Where a step carries the picture, round 7 sets it after the
limiter (`after_db`): the hit lies 2.5 dB under the pillar, and the black frame between them 11 dB.

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

The preview clips put the sound on the picture. Measured on the decoded sound of the clips of round 4: the
force starts at picture time 145.1868 s (anchor 145.1867 s) and the flash at 177.5524 s (anchor 177.5524 s).
The peak of the release is at 25.7886 s in the clip and in the master.

## The second listening review (round 3)

The owner watched round 3 with the picture on 2026-11-10 and said that it feels flat, as if one sound plays
at a time. Round 3 had a target for the audibility of each layer against the others. It had none for how
many layers are heard at once, and none for what the sound is made of.

Measured cause in round 3, in the 16 sections of the three passages:

- One layer held most of the power. The loudest layer lay 0.2 to 3.4 dB under the sum of all layers in 14
  sections. In 10 sections no other layer lay within 6 dB of it.
- The sound was of one kind. Noise held 80 to 93 % of the energy in 11 sections. Layers of one kind fuse
  into one sound.

Changes in round 4:

- The loudness targets of the layers of a section lie near one another.
- Tones that last: a dissonant cluster on the orb, a rising cluster under the cracks and in the shell, a
  falling one in the release and in the dissolution, a held tone in the stare before the force, a high
  cluster over the beam, one consonant chord in the last shot.
- Sharp moments: sparks that fly off the orb and the beam, cracks of stone, the broken staff and its pieces.
- The far walls answer: a duller copy of each large event comes back 0.15 to 0.31 s later.
- The bed has three bands. Under the spoken lines a far stone settles, something heavy lands far away and
  dust runs down a wall.

`scripts/analyze.py` has three measures for this: `balance` (the loudest layer against the sum, and the
layers within 6 dB of it), `streams` (the layers heard beside the others in each 50 ms) and `variety` (the
shares of the energy that are steady lines, broadband moments and neither).

| Section                        | Loudest layer under the sum, dB | Layers heard at once, median | Tones / transients / noise, % of the energy |
| ------------------------------ | ------------------------------- | ---------------------------- | ------------------------------------------- |
| Red: flight                    | 2.0 to 5.1                      | 3 to 5                       | 2 / 12 / 86 to 26 / 7 / 67                  |
| Red: close, whip, far          | 1.6 to 5.6                      | 2 to 4                       | 4 / 6 / 90 to 23 / 4 / 73                   |
| Red: cracks and shell          | 3.3 to 6.8                      | 3 to 4                       | 7 / 9 / 85 to 39 / 6 / 55                   |
| Red: release and defence       | 1.8 to 4.9                      | 4 to 6                       | 11 / 37 / 52 to 14 / 22 / 64                |
| Red: aftermath                 | 2.7 to 8.0                      | 3 to 4                       | 24 / 3 / 73 to 65 / 3 / 32                  |
| Red: wind                      | 0.7 to 2.9                      | 3 to 4                       | 1 / 8 / 92 to 19 / 13 / 68                  |
| Force: before the force        | 0.2 to 4.0                      | 1 to 2                       | 5 / 4 / 91 to 17 / 7 / 76                   |
| Force: force and flight        | 1.5 to 3.1                      | 4 to 6                       | 9 / 5 / 85 to 11 / 5 / 84                   |
| Force: column and collapse     | 4.5 to 5.5                      | 3 to 4                       | 6 / 10 / 83 to 10 / 9 / 81                  |
| Force: fog and wall            | 4.1 to 8.2                      | 4 to 4                       | 3 / 17 / 80 to 12 / 15 / 74                 |
| Finale: before the circle      | 0.9 to 3.0                      | 1 to 2                       | 1 / 5 / 93 to 7 / 9 / 84                    |
| Finale: circle and preparation | 0.7 to 2.5                      | 2 to 3                       | 84 / 0 / 16 to 68 / 2 / 31                  |
| Finale: flash and beam         | 3.4 to 5.0                      | 3 to 6                       | 17 / 3 / 80 to 28 / 2 / 69                  |
| Finale: whiteout               | 2.4 to 4.2                      | 4 to 5                       | 25 / 1 / 73 to 44 / 1 / 55                  |
| Finale: dissolution            | 3.4 to 7.3                      | 3 to 5                       | 26 / 6 / 68 to 49 / 10 / 41                 |
| Finale: last shot              | 0.8 to 4.0                      | 1 to 3                       | 3 / 9 / 89 to 27 / 9 / 64                   |

Each cell is round 3 to round 4.

Deviation, open: the aim of round 4 was a share of tones of 20 % or more and a share of transients of 15 % or
more in the sections with action. The force passage stays at 81 to 84 % noise, and transients stay under
15 % in most sections. A short event holds little energy, so the share of transients says little. The count
of layers heard at once carries the claim.

The measures of the first listening review, read again on round 4:

| Measure                                                    | Round 1        | Round 3      | Round 4       |
| ---------------------------------------------------------- | -------------- | ------------ | ------------- |
| Depth of the strongest modulation line, flight and shell   | 26.7 %, 24.5 % | 7.5 %, 9.1 % | 7.2 %, 10.5 % |
| Share of the energy in 3 lines, force and column           | 0.73, 0.93     | 0.58, 0.52   | 0.57, 0.51    |
| Dissolution: the strongest line jumps, share of the frames | 0.52           | 0.21         | 0.26          |
| Dissolution: share of the energy between 0.4 and 4 kHz     | 0.81           | 0.38         | 0.56          |

The depth is a new measure (`mod_depth`). The older measure reads a line over the median of the envelope
spectrum, and a steady tone lowers that median: it reads 11.2 dB in the flight of round 4 and 8.6 dB in round
3, while the depth of the modulation did not grow. The share between 0.4 and 4 kHz grew in the dissolution
because the falling tone lies there. That tone lasts 1.7 s and is no grain, but the ear decides it.

## The third listening review (round 4)

The owner watched round 4 with the picture on 2026-11-10 and said that it feels like glass marbles and too
light, and named the ice of the first passage. Round 4 had no target for the size that a sound speaks of.

Measured cause in round 4: a body of radius `a` metres speaks near `ka = 1`, which is `54.6 / a` Hz. The sharp
moments and the rings that round 4 added lay between 2.5 and 9 kHz: glass ticks of three damped modes, bells,
a shield ring, sparkles, pops. That is the pitch of a body of 1 to 2 cm. The frames from 26.28 to 28.45 s
show slabs of ice that are far taller than the standing figure. They shoot up within six frames and stand,
and mist spreads at their feet. Nothing small falls.

`scripts/analyze.py` has two measures for this. `size_cue` takes the parts that `variety` counts as tones
or transients and gives their centre frequency, the radius whose `ka = 1` lies there, and the share of the
whole energy that is sharp or pitched above 2 kHz. `weight` is the level between 30 and 250 Hz against the
level between 2 and 10 kHz.

Changes in round 5:

- Every ring of a small body is gone: the shield ring, the sparkles, the shards, the shimmer, the bells of
  the staff, the thin tone of the stare, the glints of the circle, the ring of the flash.
- The ice is a boom of noise under 100 Hz, seven cracks of thick ice (1.6 m and six slabs of 0.7 to 1.8 m,
  at irregular times), crushed ice (noise with no pitch), the answer of the far wall, slabs that groan as they
  settle, and mist. Its first sound is on the first frame of the ice, at 26.27625 s.
- A crack has a size. `heavy_crack` is a low knock of noise around `ka = 1`, a dense damped fracture above
  it and a dry edge of noise. Larger sizes are lower and longer. The low part is noise over three octaves, so
  it has no pitch.
- The stone that hits, bursts, settles and tumbles is 1.7 to 6 times larger. The staff is dry wood.
- The stare before the force is a dark low cluster. The voice over the beam lies on harmonics 4 to 16 of the
  beam's core.

| Section               | Centre of the sharp and pitched parts, Hz | Radius with `ka = 1` there, cm | Sharp or pitched above 2 kHz, % of the energy | `weight`, dB   |
| --------------------- | ----------------------------------------- | ------------------------------ | --------------------------------------------- | -------------- |
| Red: ice burst        | 1083 to 232                               | 5.0 to 23.5                    | 15.7 to 0.3                                   | -5.5 to +10.9  |
| Red: ice stands       | 1731 to 210                               | 3.2 to 26.0                    | 32.8 to 0.1                                   | -9.1 to +13.7  |
| Red: cracks and shell | 430 to 364                                | 12.7 to 15.0                   | 5.3 to 0.9                                    | +0.5 to +4.6   |
| Red: release          | 283 to 241                                | 19.3 to 22.7                   | 0.5 to 0.2                                    | +13.7 to +18.1 |
| Force: before         | 1177 to 179                               | 4.6 to 30.5                    | 16.6 to 1.4                                   | +5.7 to +8.2   |
| Force: force          | 388 to 217                                | 14.1 to 25.2                   | 5.1 to 0.8                                    | +6.9 to +8.1   |
| Force: column         | 690 to 346                                | 7.9 to 15.8                    | 4.7 to 0.9                                    | +6.3 to +11.9  |
| Force: collapse       | 301 to 180                                | 18.1 to 30.3                   | 1.6 to 0.8                                    | +10.6 to +12.8 |
| Force: fog and wall   | 1512 to 266                               | 3.6 to 20.6                    | 14.2 to 1.2                                   | -3.7 to +6.6   |
| Finale: flash         | 236 to 562                                | 23.1 to 9.7                    | 3.2 to 1.2                                    | +12.2 to +12.2 |
| Finale: beam          | 591 to 295                                | 9.2 to 18.5                    | 2.6 to 0.2                                    | +4.9 to +7.0   |
| Finale: dissolution   | 2155 to 1780                              | 2.5 to 3.1                     | 30.3 to 26.7                                  | -6.6 to -4.8   |

Each cell is round 4 to round 5. The dissolution stays light: the picture shows thin strands. The centre of
the flash rose because the crack that replaces its glassy ring has an edge of noise; its `weight` did not
change.

Deviations, open:

- The radius is 15 to 30 cm, not the metres of the picture. The measure takes every sharp part between 60 Hz
  and 12 kHz, and a crack has an edge. It compares rounds; it is no calibrated size.
- Round 5 gives back part of round 4. The median count of layers heard at once fell from 6 to 4 in the
  release and the ice, from 6 to 5 in the flash and the beam, from 5 to 4 in the flight, and from 4 to 3 in
  the column and the collapse and in the aftermath of the ice. Heavy sounds mask more.
- The beam's own period of 49 Hz reads 17.1 % in `mod_depth` (round 3: 15.3 %, round 4: 10.6 %).

## The fourth listening review (round 5)

The owner watched round 5 with the picture on 2026-11-10 and said three things about the last passage: the
charge is far from the charge of the picture and from the original sound, the firing is light, and the sound
while the spell lasts is too artificial.

The original sound was measured for the first time (`scripts/reference.py`; the whole passage is -4.0 LUFS
with a crest of 4 to 7 dB, with music and speech). Measured cause in round 5:

- Artificial. The beam of round 5 was a stack of the harmonics of 49 Hz with a steady hiss above: tones held
  10 to 22 % of its energy, and its deepest periodic line read up to 22 % at 49 Hz. The original beam is 88 to
  91 % noise with no steady line. Its third-octave levels are flat from 80 to 800 Hz and fall above 1 kHz.
- Light. Round 5 had two events: a flash on the first white frame (177.552 s) and a beam 0.25 s later that
  was 4 dB quieter. In the original one roar starts between 177.64 and 177.68 s, on the third white frame, at
  full level, and it does not fall. Round 5 let the beam die in the whiteout (-21.0 LUFS); in the original the
  whiteout is the loudest part and has the most bass, and the roar ends within a second when the picture
  returns at 183.77 s. The crest of round 5 was 13 to 14 dB in the beam: the peaks set the level, and the
  body was thin.
- The charge. Round 5 used a rising cluster that converges to a harmonic series, which is the sound of a
  synthesizer. The frames show small sparks at the tip of the staff from 176.2 s, a ball of light that forms
  there at 176.86 s and holds to the end of the shot at 177.46 s; the brightness around the tip rises slowly
  from 175.8 s and steps up at 176.80 to 176.89 s. The original has a swell at 176.84 to 177.0 s. Its effects
  cannot be told from its music there.

Changes in round 6:

- The beam is a torrent of turbulence (`turbulence`): one spectrum, the measured curve, cut into four bands.
  Each band has its own noise and its own level that wanders with no period, so the parts do not move
  together. Left and right share a part. A breath with a pitch (`howl`, narrow bands of noise) and sharp
  crackles lie inside it. The harmonic core, the voice on its harmonics, the comb filter and the steady hiss
  are gone, and so are their models.
- One eruption at 177.636 s (frame 4259, the third white frame): a pressure front, a long boom of noise under
  110 Hz, a wall of noise and a crack. The torrent starts with it at full level. The first two white frames
  are silent but for what the hall returns.
- The level of each band over time follows the original: the top falls during the four seconds, the bottom
  grows, the whiteout is the climax, and the torrent falls by 14 dB in the second after 183.6 s (the original: 17.5 dB).
- The charge has no tone: sparks at the tip from 176.2 s, a soft low ignition at 176.84 s, air that is drawn
  in (its band rises with its level), a rumble that grows, crackles that come faster. All of it is cut at
  177.46 s. The circle is a breath with a faint pitch, and it grows from 175.8 s.
- The master is denser in all three passages (the method, above).

| Measure in the finale                           | Original               | Round 5                    | Round 6                |
| ----------------------------------------------- | ---------------------- | -------------------------- | ---------------------- |
| Tones in the beam, share of the energy          | 6 to 9 %               | 10 to 22 %                 | 3 to 6 %               |
| Deepest periodic line in the beam, each second  | 6 to 8 %               | 8 to 22 %, at 49 Hz        | 7 to 9 %               |
| Crest of the beam, each second                  | 3.8 to 6.9 dB          | 13.3 to 13.8 dB            | 6.9 to 9.2 dB          |
| Loudness at the firing, 177.64 to 177.80 s      | -1.9 LUFS              | -14.2 LUFS                 | -6.0 LUFS              |
| Loudness of the beam, each second               | -1.2, -2.6, -4.0, -4.8 | -16.8, -18.5, -16.7, -18.1 | -6.8, -7.8, -7.5, -9.0 |
| Loudness of the whiteout                        | -2.6 LUFS              | -21.0 LUFS                 | -7.1 LUFS              |
| Level of 50 ms blocks varies by (low, mid, top) | 2.3, 1.1, 2.9 dB       | 3.3, 1.5, 1.2 dB           | 2.3, 1.5, 2.7 dB       |
| Correlation of left and right in the beam       | 0.52                   | 0.20                       | 0.44                   |
| The roar starts at                              | 177.64 to 177.68 s     | 177.552 s and 177.803 s    | 177.636 s              |

The third-octave levels of the torrent lie within 2.3 dB of the original from 39 Hz to 5 kHz. Above 5 kHz the
torrent is brighter by 3.5 to 5.9 dB; the reference is a compressed copy with little up there.

Deviations, open:

- The render is not as loud as the original: the beam is about 5 dB under it, and the crest is 2 to 4 dB higher.
  The original holds music as well. The master of round 6 clips softly; more drive costs more distortion.
- The charge has no measured reference for its effects. It follows the frames.
- The eruption comes two frames after the first white frame, as in the original. With no music to carry the
  83 ms between, it can feel late.
- In the force passage the original is silent for 0.1 s before the force (-74 dBFS and less from 145.02 to
  145.12 s), its first sound comes at 145.14 s, 45 ms before the frame of the response, and its large sound
  follows at 145.28 s.
  Round 6 does not change the force passage but for the master.
- In the red passage the original does not fall below -5.3 LUFS in any section: music runs through it.
  Round 6 does not change the red passage but for the master.

## The fifth listening review (round 6)

The owner watched round 6 with the picture on 2026-11-10 and named six things. Each is an event of the picture
that round 6 gave no sound, or the wrong one. The author had read the frames at 4 a second, with 12 to 24 a
second only around the anchors. For round 7 every span that the owner named was read at 24 frames a second.

| The owner said                                                  | The frames show                                                                                                                                             | Round 7 adds                                                                                                                                                 | Round 6 to round 7                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Heavy stones tangle in the condensation; the sound drops out    | 23.06 to 23.77 s: blocks fly in from all sides and pack around a glowing core. 23.81 to 24.4 s: plates of stone lock; red seams glow                        | Blocks that strike blocks at a rising rate on three paths to the core, the air of blocks that are pulled in, a grind; five heavy seatings and a grind, close | -17.9 to -14.7 LUFS (pulled in), -14.2 to -12.4 LUFS (lock)                   |
| The explosion sounds like one ray; there were many, and walls   | 25.78 to 26.26 s: a star of 8 to 10 rays reaches the walls and the vault and holds for half a second                                                        | Eight rays: each leaves with a tear and strikes stone where it lands; three sears in three bands while the rays hold; five falls of what they broke          | Median of layers heard at once 4 to 5; -9.7 to -6.0 LUFS                      |
| No smoke and no debris after it                                 | 28.53 to 30.21 s: a cloud of smoke fills the hall and rolls; debris flies out of it                                                                         | A billow of low noise, a hiss of dust, three streams of debris, three large pieces, three streaks that pass; stone that falls under the ice from 26.45 s     | -29.0 to -16.4 LUFS                                                           |
| The wall's debris is not heavy; there is no dust                | 146.03 s: a large plume of dust bursts from the column. 146.4 to 147.7 s: the wall comes down in blocks. 147.78 to 148.4 s: dust fills the frame            | A burst of dust, seven slabs with the deep answer of the floor, small stone that clatters, a hiss of dust for 3.9 s over a billow, a patter in the fog       | Collapse -10.9 to -8.7 LUFS; fog -21.2 to -12.4 LUFS                          |
| The charge is out of time and so loud that the clone would hear | A ball of light forms at the tip of the staff at 176.86 s, grows for 0.2 s and holds to 177.47 s. She stands one pace behind the clone                      | Nothing grows before 176.86 s. A soft ignition, then a thin breath that comes up with the ball and holds. No swell                                           | Charge -20.0 to -30.9 LUFS; circle -29.9 to -39.1 LUFS                        |
| The shot, the hit and the changes of view sound like one piece  | 177.51 s: a spark in a wide frame. 177.55 s: white. 177.68 s: the blast at the walls. 177.76 s: black. 177.80 s: the pillar. The view moves in until 178.12 | A shot, the hit, two breaks of the floor, three strikes on walls, a held breath, the strike on the vault with a low surge, a ring, four rips, three falls    | Frames: shot -13.5, hit -10.3, black -17.9, pillar -7.3 dBFS; flat in round 6 |

The dust of the force passage is measured against the original. In the collapse the level from 1 to 4 kHz lies
under the level from 60 to 250 Hz by 4.4 dB in the original, 9.9 dB in round 6 and 6.4 dB in round 7; from 4
to 12 kHz by 9.3, 17.6 and 12.8 dB; below 60 Hz by 7.6, 9.6 and 6.4 dB.

Deviations, open:

- Round 6 moved the roar to 177.636 s after the original. Round 7 puts the hit back on the first white frame
  (177.552 s) and the full torrent on the pillar (177.803 s), with a shot before them, because the owner
  described the picture as a shot, a hit and changes of view. The original has no separate shot.
- The collapse is as loud as the force (-8.0 LUFS over 0.4 s against -7.4 LUFS over 0.1 s). The owner asked
  for weight; whether the force still surprises is a matter for the ear.
- The charge is 22.7 dB under the hit and 8 dB over the hall. It may be too quiet to be noticed at all.
- The grind and the sear move fast: the deepest periodic line of the grind alone is 12 to 16 % near 14 Hz. It
  has no period, but a rattle is what a rotor was made of in round 1.
- With the ice the median of layers heard at once is 2: the falls of stone and the ice mask one another.

## The models

| Sound                           | Model                                                                                                                  | Parameters                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A crack through a thick solid   | A low knock of noise around `ka = 1` of its size, a dense damped fracture above, a dry edge                            | Sizes 0.3 to 2 m; loss factor 0.03, so nothing rings                |
| A small crack in stone          | A noise burst from `ka = 1` of the piece to 4.5 kHz that falls toward the top; a low knock                             | Pieces of 0.12 to 0.5 m                                             |
| A solid under stress            | Stick and slip: slips at 110 to 240 a second, each interval drawn; wide low resonances                                 | No period; the resonances lie at 140, 260 and 470 Hz                |
| Crushed ice                     | Dense noise from 0.7 to 6 kHz with a fast, irregular flutter and a decay                                               | It gives a crack its brightness with no pitch                       |
| Brittle fracture                | A broadband main crack and an avalanche of small cracks: rate `k / (t + c)`, power-law sizes                           | Each small crack draws its own modes, so the result is noise        |
| Strain before a failure         | Small cracks whose rate rises as `1 / (time to failure)`, and two groans                                               | 24.75 s to the fracture anchor                                      |
| Pressure with no visible body   | One Friedlander pulse, a low noise body, a mid slap                                                                    | Positive phase 3.5 ms; nothing in it has a pitch                    |
| Impacts of stone and of a body  | Noise bursts with an exponential decay                                                                                 | Band and decay follow the size and the softness of the contact      |
| A falling column                | Impacts at random times (a Poisson process whose rate falls), sizes drawn on a log scale                               | Three streams at three places; a low rumble and gravel under them   |
| Air of a moving body            | Aerodynamic noise: power follows the sixth power of the speed, the band follows the speed                              | Strouhal 0.2 gives no tone for a body of 0.4 m at 10 m/s            |
| A rock that passes the camera   | A steady noise source on a path of 50 m/s; the level and the Doppler shift come from the path                          | Nearest distance 1.1 to 2.6 m                                       |
| The red material                | A low rumble, a roar whose band narrows and rises with the tension, a crackling surface                                | Every modulation is band-limited noise between 10 and 120 Hz        |
| Surprise                        | A level step over the bed, a rise under 10 ms, and no sound in the 0.5 s before                                        | See the force passage below                                         |
| Dissolution                     | A breath of high noise whose lower edge rises, thin tones that fade one by one, dry ticks                              | Nothing short and pitched between 0.4 and 4 kHz                     |
| The hall                        | Image sources of a box of 18 by 24 by 14 m; late field with echo density `4 pi c^3 t^2 / V`                            | Decay 2.6 s; late level from the critical distance, lowered by 5 dB |
| A moving source                 | The change of the propagation delay                                                                                    | The Doppler shift follows from the path                             |
| A torrent of energy             | Turbulence: one measured spectrum in four bands, each with its own noise and wandering level                           | Level deviation 1 to 6.5 dB; left and right correlate by about 0.5  |
| A breath with a pitch           | Narrow bands of noise whose centres wander: a carrier with a random envelope and phase                                 | Width centre / 6 to centre / 10; no sine                            |
| The master                      | A drive into a look-ahead limiter (4 ms, release 60 ms) and a soft clip; levels set after it where a step must stay    | The limiter leaves 4 dB over the ceiling for the clip to round      |
| Blocks that are pulled together | Impacts at a rising rate: the clack and thud of a block of its size, and the crack of both                             | Blocks of 0.35 to 1 m; three paths that end at the core             |
| Stone that grinds on stone      | Stick and slip, 60 to 200 slips a second with a jitter of 60 %, through low resonances; a scrape of noise over it      | No period                                                           |
| A slab that lands               | A deep thud of noise under 100 Hz that lasts, the crack of the slab, small pieces that scatter                         | Slabs of 0.4 to 1.5 m                                               |
| Dust and smoke                  | A burst of wide noise with a soft rise; a hiss whose level wanders, with a fine grain; a low billow in slow surges     | The hiss lies from 0.7 to 6 kHz in the force passage                |
| A ray                           | A tear whose band falls fast as it leaves, a crack of thick stone where it lands, noise in its own band while it holds | Eight rays, three bands                                             |
| The discharge of a staff        | A dry crack, a short low pop and a tear that falls                                                                     | No ring                                                             |
| A tone that lasts               | A cluster of partials; the pitch and the level of each drift slowly and with no period                                 | No two partials closer than 100 Hz, so nothing beats                |
| A tone that moves               | The same cluster on a pitch path from one frequency to another                                                         | 0.7 s or longer, so it is no blip                                   |
| Sparks and crackles             | Separate noise pops of 4 to 5 ms between 0.5 and 7 kHz at random times, with bounded sizes                             | 16 to 30 a second; a rare large pop must not set the peak           |
| The answer of a far wall        | The same event, low-passed at 0.7 to 1.8 kHz, from a wall position, 0.15 to 0.31 s later                               | One or two walls for each large event                               |
| The broken staff                | Dry wood: a crack of noise and a short thock; the pieces land as damped clacks of noise                                | Irregular times; no train of bounces and no ring                    |

Two choices are style, not physics, and the study says so. A bare stone hall of this size has a decay of about
8 to 13 s by Sabine's formula. The study uses 2.6 s so that the events stay readable. The direct sound of the
far events is raised against the late field by 2 to 10 dB.

## Targets and measurements of round 7

`receipt.txt` is the whole output of `scripts/receipt.py`. The table holds the lines that carry the design.

| Passage | Target                                                 | Measured                                                                              |
| ------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Red     | The stones are heard while they are pulled in and lock | -13.8 LUFS and -12.0 LUFS over 0.4 s; a median of 5 layers at once                    |
| Red     | The burst is many rays that reach the walls            | 8 strikes on stone from 0.045 to 0.26 s after the burst; a median of 5 layers at once |
| Red     | The release and the ice are the loudest moments        | -5.6 LUFS and -6.6 LUFS over 0.1 s                                                    |
| Red     | Smoke and debris after the burst                       | -14.9 LUFS over 0.4 s, the level of the flight                                        |
| Red     | No periodic modulation                                 | Depth of the strongest line 6.5 % in the flight                                       |
| Red     | The events are on time                                 | 0.04 ms or less from each picture time; the smoke 0.7 ms                              |
| Force   | A level step of 20 dB or more over the bed             | 28.0 dB (-7.2 LUFS over -35.2 LUFS)                                                   |
| Force   | No cue in the 0.5 s before the force                   | 0.5 dB over the bed; the held tone of the stare is the one sound                      |
| Force   | The slabs are heavy                                    | Below 60 Hz the collapse lies 6.4 dB under its 60 to 250 Hz (original 7.6 dB)         |
| Force   | The dust is heard                                      | From 1 to 4 kHz the collapse lies 6.4 dB under its 60 to 250 Hz (original 4.4 dB)     |
| Force   | The collapse and its dust die away                     | -8.1, -8.4, -9.6, -11.9, -17.1 LUFS each half second                                  |
| Force   | The force and the column contact have no pitch         | Share of the energy in 3 lines 0.47 and 0.49                                          |
| Finale  | The spell is not heard before it is cast               | Circle -39.1 LUFS, charge -30.9 LUFS; the hit is 22.7 dB over the charge              |
| Finale  | The charge does what the light does                    | It starts at 176.86 s and then holds within 2.5 dB to 177.46 s                        |
| Finale  | The shot, the hit and the pillar are three events      | Frames: -13.5 (shot), -10.3 (hit), -17.9 (black), -7.3 dBFS (pillar)                  |
| Finale  | The sound moves in with the view                       | The energy above 1 kHz rises from -16.5 dB to -12.8 dB of the whole                   |
| Finale  | The torrent holds, and the whiteout is the climax      | -6.4, -7.1, -7.0, -8.4 LUFS for each second; whiteout -6.9 LUFS                       |
| Finale  | The torrent has no tone and no period                  | Tones 4 %, noise 89 %; deepest periodic line 4.5 %                                    |
| All     | Several layers are heard at once                       | Median 3 to 6 layers in 18 sections, 0 to 2 in the 4 others                           |
| All     | True peak                                              | -2.00 dBTP                                                                            |

Integrated loudness: red -13.1 LUFS, force -10.9 LUFS, finale -7.7 LUFS. The limiter goes 4.3, 2.2 and 10.2 dB
deep and works 7.4 %, 5.9 % and 31.6 % of the time.

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
ffmpeg -i <video> -vn -ac 2 -ar 48000 -c:a pcm_s16le <reference.wav>
python3 docs/studies/frieren-perceptual/scripts/reference.py <reference.wav> <output directory>
```

Python 3.13.18 and numpy 2.5.3 gave the files above on 2026-11-10; the preview clips the owner received for
round 7 hold those files as AAC at 256 kbit/s. `render.py` writes a 24-bit WAV, the samples and the layers of each passage. `spectro.py`
writes a spectrogram picture of each. `sheet.sh` and `mux.py` need `ffmpeg` and the reference video.

## What is not verified

- Nobody has listened to round 7. The receipt proves signal properties. It does not prove that the
  stone sounds like stone or that the surprise works. Round 1 met every target of its receipt and still
  sounded like a helicopter, a drum and water. Round 3 met every target of its receipt and still sounded flat.
  Round 4 met every target of its receipt and still sounded like glass marbles.
- Round 6 matches the original in what was measured: the spectrum, the motion of the level, the arc of the
  loudness, the time of the roar. That is no proof that it sounds like it. Shaped noise can be taken for plain
  noise, and a soft clip can be heard as distortion.
- Round 5 can be too dull: the ice can be taken for stone, and a low boom can be taken for a drum. A boom under
  100 Hz does not reach the ear from a small loudspeaker, so the weight then rests on the band from 150 to 600 Hz.
- Round 4 adds tones. A tone that lasts can be taken for a machine hum or for music, and the falling tone of the
  dissolution can bring the water back. No measure of the receipt decides that.
- The passages hold no speech, so the 8.5 s before the force and the places of the two other spoken lines stay
  sparse by design.
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
9. Analyzers of the mix as a whole, which the second listening review showed to be missing: how many layers
   are heard at once, how far the loudest layer leads, and what kinds of sound the energy is made of. Every
   layer of round 3 was audible alone against the rest, and the whole still sounded like one sound.
10. The size of a thing as a parameter of its kind, and an analyzer of the size that a sound speaks of. The
    third listening review heard bodies of 1 to 2 cm where the picture shows slabs of metres.
11. A reference track as an input, and analyzers that compare a render with it: the level of each section,
    third-octave levels, the motion of the level in bands, the time of an onset. Five rounds were designed with
    no reference, and the fourth listening review named the gap to it.
12. A master bus with dynamics. With a peak ceiling and no limiter the peaks set the level and every body is
    thin: the crest of the beam was 13 dB where the original has 4 to 7 dB.
13. An event list from the picture at the frame rate. The fifth listening review named six events that the
    plan had no sound for; each was plain in the frames at 24 a second and missing at 4 a second. A plan that
    is checked against such a list would have shown the gaps before a render.
14. Steps of level that survive the master. A limiter that makes the sound dense also makes a shot, a hit and
    a pillar one level. The plan needs a way to say which steps must stay.
