# A sound design of three passages from physical and perceptual models

Status: round 11 rendered and signal-checked on 2026-11-10. Rounds 2 to 11 each answer a listening review of
the owner; the sections below give each review, its measured cause and the change. Round 11 changes the force
passage alone. The owner found round 10 better and the force passage poor: it has no tension, and the wall
breaks strangely. The owner asked for a list of what each moment needs before the work; the list is in the
ninth listening review. The owner also reminded that the aim is to make this design with the engine; "What
the engine needs" gives the way there. Nobody has listened to round 11.

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
- Since round 6 the original sound of the reference video is a reference, not a target (the owner, after round
  7: the design is new, and the original is there to consult). It is measured: its level, its spectrum
  and the times of its events (`scripts/reference.py`). No sample of it enters a render. It holds music and
  speech with the effects, so a section with music or speech says little about the effects alone.
- The audio holds effects and the hall only. It holds no dialogue and no music. The picture has spoken lines
  at 137.25 to 142.25 s, 174.4 to 176.25 s and 186.5 to 188.25 s; the design leaves those places quiet.
- The media stay outside the repository. This directory holds the programs, the receipt and the hashes.

## The passages

| Passage | Picture seconds       | File   | SHA-256 of the 24-bit WAV that `scripts/render.py` writes (round 11) |
| ------- | --------------------- | ------ | -------------------------------------------------------------------- |
| Red     | 20.000 to 30.000      | 12.5 s | `1d22788c7f2b756aa0999410586bff1693b34ab4eb7c155fb3c5725a470bbc2e`   |
| Force   | 136.500 to 149.700    | 15.7 s | `18b3953d281b438d47a6d483c50d102e5e2d1297c686bded25c6f0ba7ad9086d`   |
| Finale  | 173.000 to 189.314625 | 18.8 s | `4e5c4a37ab3a1234d76d69e2cf85fecd44e1ecd2264e94a807c2d8b2249ab201`   |

Each file has a tail of 2.5 s after its picture range. The sample rate is 48,000 Hz. One picture frame is
2,002 samples (24000/1001 frames a second). The preview clips run to the end of each file, so the owner sees
the picture of the tail: after the force passage it is black frames and an eye that opens, and round 10 gives
that tail a sound. The red and the finale passage are those of round 10. Rounds 1 to 10 are the commits
`b9a6e52`, `1454215`, `c0a4b69`, `ee41d60`, `1a5b241`, `a3288f0`, `560bb94`, `8526e75`, `001a088` and `0ff4d33`.

## The method

1. Write the dramatic goal of each moment as a perceptual target with a unit.
2. Choose a model that connects the target to parameters.
3. Render, measure the rendered audio, and change the parameters until the measurement meets the target.
4. Look at the spectrogram of each passage for what the numbers do not show.
5. After a listening review, measure the cause of each remark and add that measure to the receipt.
6. Look at the picture: time-stamped contact sheets of every passage (`scripts/sheet.sh`), 4 frames a second
   for the whole passage and 12 to 24 for the moments that carry a sound. Put the sound on the picture
   (`scripts/mux.py`) and measure where the sounds fall.
7. Keep a ledger (`scripts/ledger.py`): the events that the frames show, and the event of each layer. A layer
   with no event fails the check, and so does an event with no layer. `ledger.txt` is its output.

Every layer is set by a loudness target (ITU-R BS.1770 K-weighting; windows of 0.1 s, 0.4 s or 3 s), not by a
gain. The four bands of the torrent share one gain, so that their spectrum holds. The master puts the highest
true peak at -2 dBTP. Since round 6 it then raises the sum by a drive (8 dB for red, 6 dB for force, 14 dB
for the finale); a look-ahead limiter and a soft clip hold the peaks at the same ceiling. A limiter that
works 10 dB deep flattens every step of level. Where a step carries the picture, round 7 sets it after the
limiter (`after_db`): the hit lies 2.5 dB under the pillar.

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

## The sixth listening review (round 7)

The owner watched round 7 with the picture on 2026-11-10 and said two things about the force passage: where
she flies into the wall there are sounds that are not needed, and where the debris comes out of the dust and
falls to the floor there is no sound. The owner also said that the original sound is a reference to consult,
not a golden target, and that a better method is welcome.

The two remarks are the two ways a plan can miss the picture: a sound with no event, and an event with no
sound. Most remarks of the earlier reviews are of these two kinds. Round 8 therefore adds a ledger. For each
passage it lists the events that the frames show, and it gives every layer its event. Four groups hold what
is not an event of the picture: the air of the hall, the echo of an event that is seen, a likely consequence
off the frame, and a tone with no source.

The frames of 145.72 to 149.66 s at 24 a second, and what round 8 does:

| Picture seconds  | The frames show                                                 | Round 7                                                                         | Round 8                                                      |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 145.937          | Her body strikes the wall; a first puff of dust                 | A thud, a crack, the snap of her staff, the answer of the far wall              | One thud and one crack                                       |
| 145.98 to 146.4  | A jet of dust shoots out to the left and grows                  | The dust, and over it six cracks, tumbling blocks, small stone, slabs that land | The dust alone                                               |
| 146.26, 146.47   | The wall splits along a vertical line; large blocks leave it    | Lost among the other sounds                                                     | One crack for the split, one for the blocks                  |
| 146.5 to 147.72  | The blocks turn in the air and sink out of the frame            | Seven slabs that land, while the blocks are still in the air                    | Four knocks of block on block; a rumble that dies            |
| 147.76 to 148.9  | Dust fills the frame; in it the blocks reach the floor          | Two dull knocks and a patter                                                    | Five landings at 147.84, 148.05, 148.34, 148.62 and 148.93 s |
| 148.49 to 149.66 | She hangs in a round crater of cracked wall; dust drifts across | Small stone, ticks and a groan of the wall, splinters of wood                   | The same without the splinters                               |

The two large landings lie where the original has its two impacts in the dust (a rise of 6 dB near 148.05 s
and 148.34 s; between the wall hit and those the original has no separate impact). That is the reference
consulted, not copied: the three other landings and all sizes are the design's own.

The force passage has 46 layers (round 7: 57). The ledger of round 8:

| Passage | Layers | Of an event that is seen | The hall | Echoes | Off the frame | Tones with no source |
| ------- | ------ | ------------------------ | -------- | ------ | ------------- | -------------------- |
| Red     | 129    | 116                      | 3        | 6      | 4             | 0                    |
| Force   | 46     | 34                       | 3        | 2      | 6             | 1                    |
| Finale  | 56     | 48                       | 3        | 0      | 4             | 1                    |

Deviations, open:

- The ledger checks that a layer has an event. It does not check that the sound suits the event, that it is on
  time, or that two layers of one event are both needed. The red and finale passages pass it unchanged; the
  owner has named no sound there as not needed.
- The 14 layers off the frame and the 2 tones with no source are the author's guesses: stones that settle far
  away, pieces that fall from the vault, the low tone of the stare, the chord of the last shot.
- The third and fourth landing do not rise over what sounds before them (+2.0 dB and -0.9 dB in the 80 ms
  after against the 80 ms before): the tails of the two large ones cover them in level. Each is audible beside
  the other layers in 34 of 34 bands.
- For a second after the blocks leave the wall there are only four knocks and the dust. It can seem empty.

## The seventh listening review (rounds 7 and 8)

The owner answered the questions of the listening page on 2026-11-10. The answers, what the reference shows
(`scripts/reference.py`), and what round 9 does:

| The owner said                                                                      | Measured                                                                                                                                                                               | Round 9                                                                                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The falling blocks and the wall hit have no deep, long sound; they sound like noise | After the wall hit the reference holds 60 to 150 Hz within 3 dB for 0.8 s, and one line near 122 Hz holds 39 % of the energy under 150 Hz. Round 8: a burst under 90 Hz, gone in 0.2 s | `boom`: a band of noise near 100 Hz with two damped modes in it, a decay of 0.3 to 1 s. In the wall hit, the landings and the blocks that strike |
| The top of the wall hit is harsh                                                    | The dry edge of each crack and the jet of dust lay above 2 kHz                                                                                                                         | Edges at a third of their level; the jet of dust from 120 Hz to 2.5 kHz; 2 to 8 kHz is 8 dB under round 8                                        |
| The dust is not noise, but it is light                                              | The hiss of dust lay from 0.7 to 6 kHz                                                                                                                                                 | The hiss from 0.4 to 3.5 kHz; the billow under it is 2 dB louder                                                                                 |
| The stones that tangle have a little weight                                         | No body near 100 Hz in a block that strikes a block                                                                                                                                    | `block_hit` has the body of its size: 30 to 250 Hz over 2 to 10 kHz rises from 8.1 to 10.0 dB while the blocks are pulled in                     |
| The smoke and the debris are a little out of time                                   | The frames show one slow roll, drawn anew every fourth frame; nothing lands. Round 7 had three slabs that land and three streaks at times of its own                                   | The slabs and the streaks are gone. One roll that swells near 29.0 s (the reference has a low swell there), a hiss, a far patter                 |
| The charge is not heard                                                             | -30.9 LUFS, 22.7 dB under the hit                                                                                                                                                      | -26.0 LUFS, 17.8 dB under the hit (round 6: -20.0 LUFS)                                                                                          |
| The gap on the black frame is strange                                               | Round 7 set that frame 11 dB down after the limiter                                                                                                                                    | No gap: -10.0 dBFS on the black frame between -10.3 (hit) and -7.4 (pillar)                                                                      |
| The end of the beam needs the reference: time has passed by then                    | In the reference 2 to 8 kHz falls by 15.0 dB in the half second after 183.5 s; round 8 fell by 4.5 dB, and its tail ran into the next scene                                            | The top falls first and fast (13.0 dB), the bottom half a second later; little of the torrent goes to the hall; the dissolve is quieter          |

The body of the wall hit, 60 to 150 Hz, each 0.1 s from 145.95 s: the reference -11.4, -9.5, -10.0, -11.6,
-10.1, -9.7, -11.3 dBFS; round 8 -14.9, -18.2, -20.5, -18.8, -21.0, -19.0, -18.5; round 9 -10.9, -13.4, -12.3,
-13.0, -11.8, -10.4, -11.7.

The limiter works 10 dB deep on the torrent, so the first 10 dB of a fall do not show after it. The end of
each band is therefore written steeper than it is heard (`ends` in `scripts/passages.py`).

Deviations, open:

- The body has modes, and round 1 was heard as a drum because of modes. The share of the wall hit's energy
  in 3 lines is 0.65 (round 8: 0.51, round 1: 0.93; the reference holds 39 % of its low energy in one line).
  A long body near 100 Hz is meant to be a boom; whether it is one is for the ear.
- The wall hit of round 9 has 20 dB less from 2 to 8 kHz than the reference. The owner found the top harsh;
  the render may now be dull.
- From 184.25 to 184.75 s the render has 4 to 7 dB more from 2 to 8 kHz than the reference: the dissolve has
  a breath of high noise of its own.
- The landings rise by 3.4, 3.5, 2.0, 0.4 and 1.2 dB over what sounds before them. Longer bodies cover more.

## The eighth listening review (round 9)

The owner watched the preview clips of round 9 on 2026-11-10 and made three remarks. The remarks, what was
measured on the render and read from the frames, and what round 10 does:

| The owner said                                                                         | Measured                                                                                                                                                                                                                                                                                           | Round 10                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Force: after the heavy stones land the sound ends at once; it does not feel continuous | From 148.5 to 150.0 s the level fell by 24.0 dB, to the level of the bed. The picture runs on to 152.2 s: the crater, black frames, an eye that opens                                                                                                                                              | Two more landings, each smaller and later. `rubble0` and `rubble1`: the heap rolls and knocks while it settles. `heap-roll`: the floor keeps a low roll. All of it dies away through the black frames. The level falls by 12.9 dB in the same 1.5 s                                                             |
| Force: the noise is loud                                                               | The hiss of the dust lay near -32 dBFS from 1.5 to 9 kHz                                                                                                                                                                                                                                           | The hiss from 250 Hz to 2.2 kHz and 7 dB lower; the jets of dust 4 dB lower and darker. 1.5 to 9 kHz is 4.4 to 9.2 dB lower from 146.0 to 148.5 s. The roll under 450 Hz carries the dust                                                                                                                       |
| Red: nothing says that the ice comes up and blocks the rays; the rays only stop        | The ice was one frame early: frame 630 (26.276 s) still shows the star of rays, and the ice is in frame 631 (26.318 s). The rays ended where the ice began, and nothing struck the ice. The frames show the rays on the ice from 26.36 s, a white frame at 26.527 s and scattered rays at 26.568 s | The ice at 26.318 s, short. The rays lose their top when the ice stands: they sound dull behind it. `block-press`: their pressure on the ice grows. `block-break` at the white frame: the rays break on the ice, with the long body of the passage. Then the ice works: cracks that get rarer, frost in the air |
| Finale: a jingle when the staff comes out of the dust                                  | `staff-cloth`: a rustle of cloth from 1.2 to 6.5 kHz                                                                                                                                                                                                                                               | Gone. The staff moves air, low: 1.2 to 6.5 kHz peaks 4.4 dB lower                                                                                                                                                                                                                                               |
| Finale: the mana gathers from 2 s of the clip, and there is no sound                   | Rounds 7 to 9 kept the circle at the edge of hearing by design: -41 dBFS from 174.5 to 176.75 s, under the bed                                                                                                                                                                                     | A gathering from 174.46 s: air that is drawn in, a low breath of the circle, a breath whose pitch climbs, sparks at the tip from 175.9 s. It grows from -36.2 to -27.1 dBFS. The charge is its top: -22.5 LUFS (round 9: -26.0; round 6, which the owner found too loud: -20.0)                                 |
| Finale: a falling whistle near 10 s of the clip, with no cause                         | `dissolve-threads` (five thin tones that fade one by one) and `dissolve-tone` (a tone that falls from 1760 to 1175 Hz). From 183.8 to 185.4 s the strongest line stood 25.9 dB out of its third octave. The reference has only the chord of its music there                                        | Both are gone. The dissolve is a dry breath and dry ticks. The strongest line stands 15.1 dB out (white noise: 12.3 dB)                                                                                                                                                                                         |

The level after the landings, each 0.25 s from 148.5 s: round 9 -12.3, -14.8, -19.3, -23.2, -26.8, -32.6,
-36.3 dBFS; round 10 -10.9, -11.8, -14.5, -15.4, -18.4, -21.7, -23.8, and then -28.9, -29.4, -30.4, -32.4,
-35.4, -36.5, -37.7 to 152.0 s.

The rays and the ice, 4 to 12 kHz, each frame from 26.193 s (the ice is the fourth frame, the white frame
the ninth): round 9 -23.9, -27.5, -26.1, -28.5, -29.3, -30.2, -29.1, -30.8, -30.1, -32.1 dBFS, one fall;
round 10 -22.4, -23.7, -23.3, -24.7, -28.2, -27.1, -25.1, -29.5, -22.4, -23.0. The top dips by 2 to 7 dB
while the ice holds the rays, and the white frame is 7.1 dB over the frame before it.

The cause of the wrong frame, an inference: round 7 read the ice from a contact sheet, and the time stamp
on a sheet does not name a frame. Round 10 read the frames by their index and their presentation time.

Deviations, open:

- The level of the mix stays within 2.6 dB from 26.19 to 26.86 s: the rays, the ice and the break lie at the
  limiter. The ice and the break are set apart by their spectrum, not by their level. Whether the ear
  takes them for two events is not measured.
- `block-fissure` is audible in 1 of 34 bands against the other layers, `block-hiss` and `ray-scatter0` in 2.
  The cracks on the ice and the scattered rays are covered by the ice and by the break.
- The gathering has no model of its own: no physics says how mana sounds. It is built from a breath of
  narrow noise whose centre climbs. 27 % of its energy reads as tone. Round 5 was heard as artificial
  because of tones.
- The charge is 3.5 dB louder than in round 9 and 2.5 dB under round 6, which the owner found loud enough
  to warn the clone. The right level lies between two remarks of the owner and is for the ear.
- The tail of the force passage now has sound under the black frames and the eye. The original has speech
  and music there. Whether stone that still settles fits that picture is for the ear.
- `staff-swing` has no hard start: its first sound is 70 ms after the frame where the staff enters.
- The top of the wall hit fell again, by 1 to 9 dB, with the darker jets of dust: 2 to 8 kHz lies from -36.5
  to -44.6 dBFS. The deviation of round 9 (the wall hit may be dull) is wider now.

## The ninth listening review (round 10)

The owner watched the preview clips of round 10 on 2026-11-10: the whole is better, and the force passage is
not good. It has no tension. The wall breaks strangely. The owner asked that the work start from a list of
what must be considered when she flies to the wall, when she strikes it, and when the wall fails.

Measured on round 10 and on the reference (the band filter of `scripts/receipt.py` on both):

- Before the strike the reference holds a low tone near -22 dBFS, and from 145.00 to 145.12 s it is silent.
  Round 10 had the bed alone at -37 dBFS, and no silence.
- While she flies (145.27 to 145.85 s) the reference lies at -4.0 dBFS, its highest level of the passage. Round
  10 fell from -10.7 to -21.9 dBFS in those 0.6 s: the force was one hit and its tail.
- The frames show about 35 blocks that leave the wall within two frames at 146.480 s and fall together for
  1.2 s. Round 10 had one crack at -19 LUFS there, 10 dB under the body of the hit, and four knocks.
- From 500 Hz to 2 kHz round 10 lay 10 to 14 dB under the reference from the hit to the cut. The cracks of
  stone live in that band.

The list. Each row is a moment of the picture, what the frames show, and what the sound must do. The letters
are the sections of `force()` in `scripts/passages.py`.

| Moment                                | The frames show                                                                                                        | The sound                                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. The stare, 142.5 to 145.0 s        | The face of the clone; then her eyes widen                                                                             | A dark, low breath that grows. Nothing that announces the strike                                                                                                      |
| A. The silence, 145.02 to 145.19 s    | Her wide eyes                                                                                                          | Everything stops, the hall's tail too: the held breath                                                                                                                |
| A. The strike, 145.187 s              | Her hair snaps; two frames, very close                                                                                 | One dry crack with no low end, short                                                                                                                                  |
| B. She is thrown, 145.270 s           | She flies back, in a medium shot                                                                                       | A pressure front, a low body, a boom                                                                                                                                  |
| B. The flight, 145.31 to 145.78 s     | A ring runs out through the air; dust rises at both sides and grows; she gets as small as a dot                        | The roar of the blast holds in the hall. The ring passes. Low dust at both sides. Her own rush sinks as she gets small                                                |
| B. The whip, 145.81 to 145.90 s       | The camera whips to the wall                                                                                           | A short swish. The roar thins on the last frame, so that the hit lands                                                                                                |
| C. The hit, 145.937 s                 | Her body strikes a tall wall, high up, seen from its side; a first puff of dust                                        | A dull thud of a body on stone, the crack of the stone where it gives, the body of the wall near 100 Hz that lasts, the first dust. Nothing else                      |
| D. The wall fails, 145.99 to 146.46 s | The jet of dust grows to the left. From 146.19 s pieces come loose at the top, and a band of rubble runs down the wall | A run of cracks that come faster and get larger. The strain of the masonry, low. Loose stone that rattles down. Soft, low dust                                        |
| E. The breakout, 146.480 s            | About 35 blocks leave the wall within two frames                                                                       | A volley of heavy cracks at irregular times. The low surge of a wall that loses its face                                                                              |
| E. The fall, 146.5 to 147.73 s        | The blocks, one to two metres each, fall together slowly and turn; the wall has a hole                                 | Blocks that strike one another and the wall, less and less often. Grit that rains with them. Three late cracks at the edge of the hole. Nothing reaches the floor yet |
| F. The landings, from 147.77 s        | Dust fills the frame; in it the blocks reach the floor                                                                 | A cascade of landings in which three heavy ones stand out; they get smaller and rarer, and the heap settles                                                           |

Two rules hold over the whole list. Stone is heard as impacts and cracks, each with the knock of its size;
air is heard as noise. And a sound sits where the frames show its cause: the remark on round 7 (sounds that
are not needed at the wall) came from landings that sounded while the blocks were still in the wall.

What round 11 measures:

|                                                         | Round 10                        | Round 11                        | Reference                       |
| ------------------------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| The stare, 143.0 to 144.9 s                             | -37.2 dBFS                      | -28.6 dBFS                      | -22.2 dBFS                      |
| The silence before the strike                           | none                            | -119 dBFS for 0.17 s            | silent for 0.12 s               |
| The flight, 145.27 to 145.85 s                          | -14.5 dBFS, falling by 11 dB    | -8.3 dBFS, within 1.9 dB        | -4.0 dBFS                       |
| 500 Hz to 2 kHz: hit, cracks, breakout, fall to 147.2 s | -23.6, -27.0, -30.0, -31.2 dBFS | -20.8, -19.5, -21.2, -22.4 dBFS | -13.4, -13.4, -16.2, -18.8 dBFS |
| 2 to 6 kHz at the hit (round 8, found harsh: -27.6)     | -37.7 dBFS                      | -32.8 dBFS                      | -12.8 dBFS                      |
| The fall, to 147.2 s and then to 147.75 s               | -11.7, then -15.8 dBFS          | -8.7, then -10.6 dBFS           | -9.4, then -10.8 dBFS           |

The top band of the collapse is made of impacts, not of a steady hiss. From 1.5 to 9 kHz the level of 5 ms
blocks varies by 3.8 dB while the cracks spread (round 9, where the owner heard noise: 1.8 dB; steady noise:
0.6 dB), and its peaks stand 6.8 dB over the median (round 9: 3.0 dB).

Deviations, open:

- The silence before the strike is a cue. Rounds 1 to 10 held the rule that nothing announces the force. The
  reference breaks that rule in the same way. Whether the silence is tension or a warning is for the ear.
- The dark breath under the stare is a tone with no source in the picture, as music is. 12 % of its span reads
  as tone.
- The big blast lies on the frame where she is thrown (145.270 s), two frames after her hair snaps. The
  reference does the same. Rounds 1 to 10 had the whole force on the first frame.
- From 145.27 to 147.19 s the level stays within 2.2 dB: the flight, the hit, the cracks and the breakout lie
  at the limiter (6.3 dB deep). They are set apart by their kind of sound, not by their level.
- The top is 3 to 9 dB over round 10 from 500 Hz to 2 kHz and 5 to 13 dB over it from 2 to 6 kHz. The owner
  found the top of round 8 harsh; at the hit round 11 is 5.2 dB under round 8 there, and in the cracks it is
  level with round 8.
- `dust-jet` is audible in 0 of 34 bands against the other layers; `dust-surge0`, `travel-air` and
  `loose-stone` in 4. They are covered by the roar and by the cracks.
- The first landing (147.84 s) does not rise over the fall before it (-0.6 dB); the second rises by 4.4 dB.
- The reference has no heavy landings in the dust; its level only sinks there. The landings are the owner's
  remark on round 7.

## The models

| Sound                           | Model                                                                                                                                                                                                                           | Parameters                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A crack through a thick solid   | A low knock of noise around `ka = 1` of its size, a dense damped fracture above, a dry edge                                                                                                                                     | Sizes 0.3 to 2 m; loss factor 0.03, so nothing rings                                                        |
| A small crack in stone          | A noise burst from `ka = 1` of the piece to 4.5 kHz that falls toward the top; a low knock                                                                                                                                      | Pieces of 0.12 to 0.5 m                                                                                     |
| A solid under stress            | Stick and slip: slips at 110 to 240 a second, each interval drawn; wide low resonances                                                                                                                                          | No period; the resonances lie at 140, 260 and 470 Hz                                                        |
| Crushed ice                     | Dense noise from 0.7 to 6 kHz with a fast, irregular flutter and a decay                                                                                                                                                        | It gives a crack its brightness with no pitch                                                               |
| Brittle fracture                | A broadband main crack and an avalanche of small cracks: rate `k / (t + c)`, power-law sizes                                                                                                                                    | Each small crack draws its own modes, so the result is noise                                                |
| Strain before a failure         | Small cracks whose rate rises as `1 / (time to failure)`, and two groans                                                                                                                                                        | 24.75 s to the fracture anchor                                                                              |
| Pressure with no visible body   | One Friedlander pulse, a low noise body, a mid slap                                                                                                                                                                             | Positive phase 3.5 ms; nothing in it has a pitch                                                            |
| Impacts of stone and of a body  | Noise bursts with an exponential decay                                                                                                                                                                                          | Band and decay follow the size and the softness of the contact                                              |
| Debris that falls               | Impacts at random times (a Poisson process whose rate falls), sizes drawn on a log scale                                                                                                                                        | The debris of the red passage and the blocks around the pillar; the landings at the wall are set one by one |
| Air of a moving body            | Aerodynamic noise: power follows the sixth power of the speed, the band follows the speed                                                                                                                                       | Strouhal 0.2 gives no tone for a body of 0.4 m at 10 m/s                                                    |
| A rock that passes the camera   | A steady noise source on a path of 50 m/s; the level and the Doppler shift come from the path                                                                                                                                   | Nearest distance 1.1 to 2.6 m                                                                               |
| The red material                | A low rumble, a roar whose band narrows and rises with the tension, a crackling surface                                                                                                                                         | Every modulation is band-limited noise between 10 and 120 Hz                                                |
| Surprise                        | A level step over the bed, a rise under 10 ms, and no sound in the 0.5 s before                                                                                                                                                 | See the force passage below                                                                                 |
| Dissolution                     | A breath of high noise whose lower edge rises, and dry ticks. The thin tones of rounds 4 to 9 are gone                                                                                                                          | No line stands more than 15.1 dB out of its third octave                                                    |
| The hall                        | Image sources of a box of 18 by 24 by 14 m; late field with echo density `4 pi c^3 t^2 / V`                                                                                                                                     | Decay 2.6 s; late level from the critical distance, lowered by 5 dB                                         |
| A moving source                 | The change of the propagation delay                                                                                                                                                                                             | The Doppler shift follows from the path                                                                     |
| A torrent of energy             | Turbulence: one measured spectrum in four bands, each with its own noise and wandering level                                                                                                                                    | Level deviation 1 to 6.5 dB; left and right correlate by about 0.5                                          |
| A breath with a pitch           | Narrow bands of noise whose centres wander: a carrier with a random envelope and phase                                                                                                                                          | Width centre / 6 to centre / 10; no sine                                                                    |
| The master                      | A drive into a look-ahead limiter (4 ms, release 60 ms) and a soft clip; levels set after it where a step must stay                                                                                                             | The limiter leaves 4 dB over the ceiling for the clip to round                                              |
| Blocks that are pulled together | Impacts at a rising rate: the clack and thud of a block of its size, and the crack of both                                                                                                                                      | Blocks of 0.35 to 1 m; three paths that end at the core                                                     |
| Stone that grinds on stone      | Stick and slip, 60 to 200 slips a second with a jitter of 60 %, through low resonances; a scrape of noise over it                                                                                                               | No period                                                                                                   |
| A slab that lands               | The body of its size (`boom`: noise near 100 Hz with two damped modes, lower and longer for a larger slab), a crack, small pieces that scatter                                                                                  | Slabs of 0.4 to 1.5 m; bodies of 0.3 to 1 s                                                                 |
| Dust and smoke                  | A burst of wide noise with a soft rise; a hiss whose level wanders, with a fine grain; a low billow in slow surges                                                                                                              | In the force passage the hiss lies from 250 Hz to 2.2 kHz and the billow from 60 to 450 Hz                  |
| A ray                           | A tear whose band falls fast as it leaves, a crack of thick stone where it lands, noise in its own band while it holds                                                                                                          | Eight rays, three bands                                                                                     |
| The discharge of a staff        | A dry crack, a short low pop and a tear that falls                                                                                                                                                                              | No ring                                                                                                     |
| Mana that gathers               | No physical model. Air that is drawn in: noise whose band climbs from 260 Hz to 1.1 kHz. A breath: three narrow bands of noise whose centres climb by about 40 %. Sparks: pops with no pitch                                    | It grows with the picture from 174.46 s; the charge is its top                                              |
| Rays that a wall of ice stops   | The held rays lose their top at once; a low pressure of noise grows behind the ice; a crack, a bright burst and a long body where the rays break                                                                                | The long body lies on the white frame, not on the frame where the ice comes up                              |
| A heap of stone that settles    | Impacts at random times whose rate falls from 11 to 0.7 a second, landings that get smaller and rarer, a low roll of noise from 38 to 150 Hz                                                                                    | The level falls by about 8 dB a second                                                                      |
| A wall that fails               | `rubble`: impacts at random times, each the knock and the crack of a block of its size, the larger the louder; a block over 0.6 m has a short boom. A run of cracks whose rate grows from 12 to 57 a second before the breakout | Blocks of 0.4 to 1.3 m in the fall; grit of 5 to 20 cm; no steady noise                                     |
| The roar of a blast in the hall | The turbulence of the torrent, with 10 dB less in its top band, for as long as she flies                                                                                                                                        | It thins by 6 dB on the last frame before the hit                                                           |
| A strike that is not seen       | A burst of noise from 350 Hz to 2.6 kHz that is gone in 16 ms, with a dry edge and no low end                                                                                                                                   | A silence of 0.17 s lies before it                                                                          |
| A tone that lasts               | A cluster of partials; the pitch and the level of each drift slowly and with no period                                                                                                                                          | No two partials closer than 100 Hz, so nothing beats                                                        |
| A tone that moves               | The same cluster on a pitch path from one frequency to another                                                                                                                                                                  | 0.7 s or longer, so it is no blip                                                                           |
| Sparks and crackles             | Separate noise pops of 4 to 5 ms between 0.5 and 7 kHz at random times, with bounded sizes                                                                                                                                      | 16 to 30 a second; a rare large pop must not set the peak                                                   |
| The answer of a far wall        | The same event, low-passed at 0.7 to 1.8 kHz, from a wall position, 0.15 to 0.31 s later                                                                                                                                        | One or two walls for each large event                                                                       |

Two choices are style, not physics, and the study says so. A bare stone hall of this size has a decay of about
8 to 13 s by Sabine's formula. The study uses 2.6 s so that the events stay readable. The direct sound of the
far events is raised against the late field by 2 to 10 dB.

## Targets and measurements of round 11

`receipt.txt` is the whole output of `scripts/receipt.py`. The table holds the lines that carry the design.

| Passage | Target                                                                 | Measured                                                                                                                       |
| ------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Red     | The stones are heard while they are pulled in and lock                 | -13.2 LUFS and -11.5 LUFS over 0.4 s; 30 to 250 Hz lies 10.0 dB over 2 to 10 kHz                                               |
| Red     | The burst is many rays that reach the walls                            | 8 strikes on stone from 0.045 to 0.26 s after the burst; a median of 5 layers at once                                          |
| Red     | The release, the ice and the break of the rays are the loudest moments | -5.5, -6.7 and -6.4 LUFS over 0.1 s                                                                                            |
| Red     | The rays lose their top when the ice stands, and the break is bright   | 4 to 12 kHz: -23 dBFS in the rays, -25 to -30 behind the ice, -22.4 in the white frame                                         |
| Red     | The smoke is one slow roll                                             | -15.7 LUFS over 0.4 s; no slab and no streak                                                                                   |
| Red     | No periodic modulation                                                 | Depth of the strongest line 6.5 % in the flight                                                                                |
| Red     | The events are on time                                                 | 0.04 ms or less from each picture time; the ice and the break 0.00 ms; the smoke 1.9 ms                                        |
| Force   | The stare grows                                                        | Each 0.5 s from 142.5 s: -36.6, -32.1, -29.5, -27.4, -27.0 dBFS                                                                |
| Force   | A silence before the strike                                            | -119 dBFS from 145.04 to 145.18 s                                                                                              |
| Force   | The strike is a dry crack, and the blast follows it                    | The strike -9.1 dBFS over 20 ms; -24.5 dBFS between them; the blast -6.0 LUFS over 0.1 s, 22.6 dB over the stare               |
| Force   | The level holds while she flies                                        | Each two frames from 145.270 s: -7.2, -7.9, -8.2, -8.2, -8.8, -9.1, -9.0, -9.1 dBFS                                            |
| Force   | The wall hit has a body that lasts                                     | 60 to 150 Hz each 0.1 s: -10.2, -11.7, -12.3, -13.9, -15.2 dBFS (reference -11.4 to -9.5)                                      |
| Force   | The cracks of stone are heard                                          | 500 Hz to 2 kHz: -20.8 (hit), -19.5 (cracks), -21.2 (breakout), -22.6 dBFS (fall)                                              |
| Force   | The wall fails in one line, and it dies away                           | Each two frames from the breakout: -7.8, -8.1, -8.2, -8.1, -8.4, -8.8, -9.1, -9.4, -10.5, -10.3, -11.1 dBFS                    |
| Force   | Each landing in the dust is heard, and it is heavy                     | 7 landings, each audible in 13 to 34 of 34 bands; 30 to 250 Hz lies 22.9 dB over 2 to 10 kHz                                   |
| Force   | The sound dies away after the landings                                 | Each 0.5 s from 148.5 s: -9.5, -13.0, -16.8, -22.3, -28.3, -30.3, -35.8 dBFS                                                   |
| Force   | The events are on time                                                 | The strike 0.06 ms, the blast 0.00 ms, the hit 0.17 ms, the breakout 0.02 ms                                                   |
| Force   | The blast has no pitch; the wall hit is a boom, not a drum             | Share of the energy in 3 lines 0.58 and 0.67                                                                                   |
| Finale  | The gathering is heard and grows with the picture                      | Each 0.5 s from 174.5 s: -36.2, -33.8, -32.3, -30.7, -29.5 dBFS; -28.7 LUFS in all                                             |
| Finale  | The charge is the top of the gathering, under the level of round 6     | -22.5 LUFS; the hit is 14.2 dB over it                                                                                         |
| Finale  | The charge does what the light does                                    | It starts at 176.86 s and then holds within 1.7 dB to 177.46 s                                                                 |
| Finale  | The shot, the hit and the pillar are three events with no gap          | Frames: -13.4 (shot), -10.3 (hit), -10.0 (black), -7.4 dBFS (pillar)                                                           |
| Finale  | The sound moves in with the view                                       | The energy above 1 kHz rises from -17.0 dB to -12.9 dB of the whole                                                            |
| Finale  | The torrent holds, the whiteout is the climax, and the end is quick    | -6.4, -7.1, -7.1, -8.4 LUFS; whiteout -6.9 LUFS; 2 to 8 kHz falls by 15.9 dB in the half second after 183.5 s (reference 15.0) |
| Finale  | The torrent has no tone and no period                                  | Tones 4 %, noise 88 %; deepest periodic line 5.4 %                                                                             |
| Finale  | The dissolve has no pitch                                              | The strongest line stands 15.1 dB out of its third octave at most (white noise 12.3 dB)                                        |
| All     | Several layers are heard at once                                       | Median 3 to 6 layers in 23 sections, 2 in the 4 others                                                                         |
| All     | True peak                                                              | -2.00 dBTP                                                                                                                     |

Integrated loudness: red -12.6 LUFS, force -8.8 LUFS, finale -7.6 LUFS. The limiter goes 5.1, 6.3 and 10.2 dB
deep and works 10.0 %, 14.7 % and 31.1 % of the time. Every event and every layer of the ledger has its partner.

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
python3 docs/studies/frieren-perceptual/scripts/ledger.py <output directory>
```

Python 3.13.18 and numpy 2.5.3 gave the files above on 2026-11-10; the preview clips the owner received for
rounds 10 and 11 hold those files as AAC at 256 kbit/s. `render.py` writes a 24-bit WAV, the samples and the layers of each passage. `spectro.py`
writes a spectrogram picture of each. `sheet.sh` and `mux.py` need `ffmpeg` and the reference video.

## What is not verified

- Nobody has listened to round 11. The receipt proves signal properties. It does not prove that the
  stone sounds like stone or that the surprise works. Round 1 met every target of its receipt and still
  sounded like a helicopter, a drum and water. Round 3 met every target of its receipt and still sounded flat.
  Round 4 met every target of its receipt and still sounded like glass marbles.
- Round 11 takes the shape of its tension from the reference: a tone that grows, a silence, a strike in two
  beats, a level that holds while she flies. The numbers say that the shape is there. They do not say that it
  is felt as tension, or that many impacts are heard as a wall that fails and not as clutter.
- Round 10 changes the ice, the end of the collapse and the gathering by measure alone. A top that dips and
  comes back is a number; that the ear hears ice that blocks rays is not shown. The gathering is the one sound
  of the study with no model behind it.
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

The owner reminded on 2026-11-10 that the aim is a design made with the engine. This study is not that: its
renderer is Python, and the engine's plan knows nine kinds (`src/plan/kinds.ts`: `whoosh`, `impact`,
`shimmer`, `riser`, `wind`, `drone`, `footstep`, `cloth`, `voice`), each with two or three macros. None of them
is a crack with a size, a body that lasts, a mass of blocks, or a torrent. The study is the specification of
what the engine must gain to make this scene, written from nine listening reviews. A proposal, for the owner
to decide: when the force passage passes the owner's ear, it is the first passage to move. Its kinds become
unit classes of the engine, its events become a plan, and `renderPlan` gives the sound. The numbered needs
below are the work list of that move.

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
13. An event list from the picture at the frame rate, and a ledger that ties every sound to an event (round 8
    has one, by hand). The fifth listening review named six events that the
    plan had no sound for; each was plain in the frames at 24 a second and missing at 4 a second. A plan that
    is checked against such a list would have shown the gaps before a render.
14. Steps of level that survive the master. A limiter that makes the sound dense also makes a shot, a hit and
    a pillar one level. The plan needs a way to say which steps must stay.
15. The end of the clip, not the end of the last event. The picture ran on for 3.3 s after the last landing
    of round 9, and the sound stopped. A plan needs to say what goes on, and how it dies away, until the cut.
16. An analyzer of lines that stand out of noise. Round 9 had six thin tones 26 dB over their third octave
    in a quiet scene, and no check of the receipt named them. The owner heard them at once.
17. Anchors that are read from the frames by index. The ice was one frame early from round 7 to round 9,
    because a time stamp on a contact sheet was rounded. A check of each anchor against the frame that shows
    its event would have found it.
18. A sound for a thing with no physics. The owner asked for the sound of mana that gathers. The kinds of
    this study come from stone, ice, air and pressure, and none of them is that sound.
19. A silence that is whole. The hall's answer to a tone runs on after the tone stops, so a silence before a
    strike must be set after the reverb and after the master.
20. A list of what a moment needs, written from the frames before any sound is made. Round 11 is the first
    round that started from such a list, at the owner's request. The earlier rounds added and removed sounds
    one remark at a time.
