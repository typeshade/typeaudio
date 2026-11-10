# The sound-design loop

This note records the design of a loop in which a model writes a plan for the sound of a picture
and the engine renders the plan. The owner approved the design in the conversation on 2026-11-09.
Experiment 8 (`docs/experiments.md`, section 8) tests its first part. Built, at the pin `415b276a`:
the plan format and its validator and the analyzers (pull request #36), the kinds, the spatial
chain, the layered render and the master (pull request #38, record
`docs/records/08-sound-design-container.md`). Not built: the mix-profile matcher (item 4) and the speed
work (item 5) of the section "What the engine must gain, in order". The device runs are pending. The statements about what the engine will do are design,
not measurement. The section "One sound leads" is the owner's rule of 2026-11-10 for the one who
writes a plan; the owner said on that day to write it here.

## Why one generated track fails

Facts about the practice:

- Sound design is made in layers: dialogue, foley, effects, ambience and music.
- Each layer is timed to the frame. The layers are then mixed.

Observation: the owner tried an end-to-end generative model on a video clip. The sound design was
poor.

Inference: a single generated track fuses the layers. Its failures cannot be told apart. These
are a wrong sound, a late transient, a smeared timbre, a flat mix and an inconsistency between
cuts. The only fix is to generate again, and a new generation changes everything.

## The split

The model does the fuzzy part. It watches the picture and writes a cue sheet. The cue sheet is the
plan.

The engine does the exact part. It renders each event from a sound vocabulary. It places each
event in space. It mixes the layers under guards. The render is deterministic: the same plan gives
the same bits. An edit to one event changes that event only.

The model never makes a sample. The engine never reads a picture (see Limits).

## The plan

The plan is one JSON document. The model emits it. The engine validates it before anything runs.
This is the rule of `docs/feedback-loop.md`: only validated source reaches the compiler. A plan
cannot carry executable code. A plan names kinds from the vocabulary, and the engine owns what a
kind does.

### The layers

There are five layers. A layer name is one of these words.

| Layer      | What it holds                                                               |
| ---------- | --------------------------------------------------------------------------- |
| `dialogue` | Speech. It is an input stem of the picture. The engine places and ducks it. |
| `foley`    | Sound of movement and touch: steps, cloth, objects.                         |
| `effects`  | Sound of events: impacts, whooshes, magic, machines.                        |
| `ambience` | The bed of the place: wind, room tone, distant sound.                       |
| `music`    | Score and stingers.                                                         |

### The schema

All times are in seconds from the start of the clip. All positions are in the listener's frame.

Plan fields:

| Field      | Type   | Meaning                                                                                  |
| ---------- | ------ | ---------------------------------------------------------------------------------------- |
| `version`  | number | The plan format version. It is `1`.                                                      |
| `clip`     | object | `duration` in seconds and `fps`.                                                         |
| `scene`    | object | `room` and `listener`, as below.                                                         |
| `master`   | object | Optional. `lufs` (default -23) and `truePeak` in dBTP (default -1).                      |
| `picture`  | object | Optional. `cuts` and `motion`: the cuts and the peaks of motion, each a list of seconds. |
| `silences` | array  | Optional. The silences, each a `t` and a `duration` in seconds. See "A silence".         |
| `events`   | array  | The events, in any order. The engine sorts them by `t`, then by `id`.                    |
| `seed`     | number | The seed of every random choice. The default is `0`.                                     |

The plan has no sample rate. The sample rate is a fact of the renderer: it renders at 48 kHz and
returns the rate with the render. The analyzers take the rate as an argument.

The renderer snaps the onset of an event to a time of `picture` when the two are within 40 ms. The
checklist reads the same times for `sync`.

Scene fields:

| Field               | Type    | Meaning                                                       |
| ------------------- | ------- | ------------------------------------------------------------- |
| `room.size`         | [w,d,h] | The room's width, depth and height in metres.                 |
| `room.material`     | string  | One of `stone`, `wood`, `plaster`, `fabric`, `glass`, `open`. |
| `listener.position` | [x,y,z] | The camera's position in metres.                              |
| `listener.yaw`      | number  | The camera's heading in degrees.                              |

Event fields:

| Field       | Type   | Meaning                                                                                                              |
| ----------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `id`        | string | The event's name. It is unique in the plan.                                                                          |
| `t`         | number | The time of the event's anchor in seconds. The anchor is the onset, or for a `whoosh` the arrival, see `sync`.       |
| `kind`      | string | A kind from the vocabulary.                                                                                          |
| `layer`     | string | One of the five layers.                                                                                              |
| `intensity` | number | From 0 to 1. It maps to level and brightness through the kind's macros.                                              |
| `position`  | object | `x` and `y` are screen coordinates from -1 to 1 (left to right, bottom to top). `distance` is an estimate in metres. |
| `macros`    | object | Values the kind defines, each from 0 to 1. A name the kind does not define is a validation error.                    |
| `duration`  | number | Optional. The length in seconds, for kinds that sustain.                                                             |
| `sync`      | string | Optional. `onset` (default) or `arrive`. `arrive` places the end of the sound at `t`.                                |

The validator refuses a plan for each of these: an unknown kind, a layer that does not match the
kind, a macro the kind does not define, a value out of range, an event past `clip.duration`, a
repeated `id`, a silence that overlaps another or runs past the clip, an event that starts inside a
silence.

### A silence

A silence is a cut. From its `t`, for its `duration`, the mix is silent: the stems, the dry render
and the reverb's return. An event that sounds when the silence starts ends there and does not come
back after it. An event may start at the end of a silence, and it keeps its first frame. The mix
falls into the silence over 4 ms.

A silence before a hit is the held breath: a hint of what comes ("One sound leads"). The room's
answer to a sound runs on after the sound
stops, so a gap between two events is not a silence: the reverb fills it. The plan states the
silence, and the renderer makes it after the reverb and before the master measures the mix.

Experiment 9 added the field. A silence is 0.01 to 10 seconds long, and a plan holds at most 16.

### The kinds

A kind is a unit or a preset of the vocabulary. The plan's `duration` is the sounding length of
every kind that sustains, and the macros shape the sound within it. For a `whoosh`, `speed` sets how
late and how fast the sweep rises within the duration. For a `riser`, `length` sets the fraction of
the duration over which the swell rises, and the sound holds at its peak for the rest. Every kind
draws its take from the event's key within its macro ranges, so repeated events differ (the
`variation` guard). The first kinds are:

| Kind       | Sort       | Layer    | Macros                                   |
| ---------- | ---------- | -------- | ---------------------------------------- |
| `whoosh`   | procedural | effects  | `speed`, `brightness`                    |
| `impact`   | procedural | effects  | `weight`, `decay`, `crack`               |
| `shimmer`  | procedural | effects  | `density`, `height`                      |
| `riser`    | procedural | effects  | `length`, `pitch`                        |
| `wind`     | procedural | ambience | `gust`, `howl`                           |
| `drone`    | procedural | music    | `pitch`, `darkness`                      |
| `footstep` | grain      | foley    | `surface`, `weight`, `pace`              |
| `cloth`    | grain      | foley    | `fabric`, `speed`                        |
| `voice`    | stem       | dialogue | none                                     |
| `crack`    | procedural | effects  | `size`, `brightness`, `crumble`          |
| `boom`     | procedural | effects  | `size`, `decay`, `tone`                  |
| `rubble`   | procedural | effects  | `size`, `density`, `brightness`, `swell` |
| `roar`     | procedural | effects  | `brightness`, `motion`, `swell`          |

The grains of one event do not clump. In `footstep` and `cloth`, `drawGrains` lets no more than two
grains of one cloud sound at the same time (N = 2). It skips a drawn start that would be a third.
The draw stays deterministic from the event's key. Two grains still make a thud with a crunch, or a
cloth burst. A third at the same moment only adds a spike of the sum of their peaks.

The level of an event follows its intensity, not its draw. `footstep` and `cloth` are drawn from a
cloud, so the peak of the drawn grains differs from key to key. `makeLane` scales the grains it
drew so that the event's peak before the spatial chain is its intensity times 0.5 (`KIND_PEAK`),
whatever the key. The macros and the draw still shape the sound: the thud against the crunch, the
pitches, the lengths and the starts.

The list is a starting set. Each experiment and each later change may add kinds.

Experiment 9 added four kinds, for a scene of stone and force. Three of them carry a size, because
the weight of a sound is the size of the thing that makes it: a block of radius `a` metres sounds
near `54.6 / a` hertz, where its circumference is one wavelength.

- `crack` is one crack of a solid. `size` runs from a block of 0.05 m to one of 2 m. `brightness` is
  its dry edge. `crumble` is the smaller cracks that follow it, over the `duration`.
- `boom` is the body of a heavy hit: a band of noise and two damped modes that sink a little.
  `size` sets the pitch, from 140 Hz to 56 Hz. `decay` runs from 0.12 s to 1.2 s. `tone` is the
  share of the modes. The weight of a hit is a body near 100 Hz that lasts.
- `rubble` is stone that falls in a mass: impacts at random times, each the knock and the crack
  of a block of its size. `size` is the middle size, from 0.05 m to 1.5 m. `density` runs from 2 to
  80 impacts a second. `swell` at 0.5 holds the rate; under it the mass thins out over the
  `duration`, over it the mass grows and its blocks grow with it. No impact comes after the
  `duration`: the mass rings out. Small stone at a high `density` is the crunch of a wall that
  crumbles.
- `roar` is a blast that rolls through a hall: four bands of noise whose levels wander by
  themselves. `brightness` is the level of the top bands, `motion` how far the levels wander,
  `swell` how far under its full level it starts.

`crack` and `rubble` share one unit, `Stones`. It holds no state for an impact: each impact raises
the envelopes of five bands of noise, and the envelopes decay, the low ones slowly. So any number
of impacts costs the same.

The level of a `rubble` follows its `density` as well as its `intensity`: a denser mass has more
impacts on one another. The peak of one take of the four kinds differs from the median of the
kind, since they are noise under envelopes.

### An event

A fast whoosh crosses the screen from left to right and ends in an impact at 12.40 s:

```json
{
  "id": "gate-whoosh",
  "t": 12.4,
  "sync": "arrive",
  "kind": "whoosh",
  "layer": "effects",
  "intensity": 0.7,
  "position": { "x": 0.3, "y": 0.1, "distance": 6 },
  "macros": { "speed": 0.8, "brightness": 0.6 },
  "duration": 0.45
}
```

### A correction

A correction is a second small document. It changes events and does not replace the plan. Its scope
is one event (`id`) or every event of a kind (`kind`).

The user says the whoosh is too thin. The system turns the top hypothesis into this correction:

```json
{
  "scope": { "kind": "whoosh" },
  "set": { "macros": { "brightness": 0.4 }, "intensity": 0.85 }
}
```

The engine applies it to every `whoosh` and keeps the plan's other events as they are. The
render of every other kind is the same bits as before.

## One sound leads

This is a rule for the one who writes a plan. The owner gave it on 2026-11-10, in three listening
reviews of experiment 9 (`docs/records/09-force-passage-container-2.md`,
`docs/records/09-force-passage-container-3.md`). It comes from one passage and one listener. It is
design, not measurement.

A plan follows the picture. The first question for each moment is which sound the viewer attends
to. That sound leads. The rule has one part for each time.

- **The present.** One sound leads in each moment: the one the picture shows. The other sounds
  explain it, as the room and the dust do, or they are out. Two things that the picture shows as
  two are two sounds. A body that hits a wall is not the wall that breaks.
- **The past.** The sound that led goes on when another sound takes the lead. It becomes a part of
  the room, under the new sound, and it ends by itself. A sound stops on a cut only when the
  picture goes to another scene.
- **The future.** The sound gives a hint of what comes. A sound that will lead starts small under
  the sound that leads now, and it grows. A rush arrives on a hit. A silence stands before the
  largest hit.

What a plan has for each part:

| Part        | In the plan                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The present | The `intensity` of the events of one moment: the sound that leads has the highest. A kind, a size and a place of its own for each thing that the picture tells apart.                        |
| The past    | A `duration` that runs past the onset of the next sound that leads. A `rubble` whose `swell` is under 0.5, so that the mass thins out. An end after a cut, not on it.                        |
| The future  | A `rubble` or a `roar` that starts under the sound that leads now, with a `swell` over 0.5. `sync: 'arrive'` for a rush that ends on the hit. A silence (`silences`). A hero impact (below). |

Observed in experiment 9:

- The first plan held 59 events, one or more for each row of a list of what the passage needs. The
  owner heard a clatter. The third plan held 37 events and asked for each moment which sound
  leads. The owner said that it holds together far better.
- In the first plan the limiter went 9.3 dB deep, and the hit on the wall stood 1.8 dB over the
  80 ms before it. A master that limits every loud moment brings them to one level, and then no
  sound leads.
- The second plan made the stone heavy with a long, low ring. The owner heard a roll of dull
  thumps: a low band of noise with a long fall is a drum.
- The fourth plan let four blocks knock, and small stone fall, while the picture held the blocks in
  the air in slow motion. The owner heard stones that had fallen already.
- The fifth plan made a landing from an `impact`, a crack of a block under 1 m that crumbles, and
  blocks of 0.2 m that settle. The owner heard a plastic container that falls, not stone with
  weight. Of the energy of that landing from 60 to 400 Hz, 66 % lay in one band of 15 Hz, and 1 % of
  the whole lay over 2 kHz.
- The fourth to the sixth plan made the hit on the wall from an `impact` whose pitch starts at
  171 Hz, with little click, and a dull crack of 0.3 m. The owner heard a hit on a plastic
  container: thin, with no density. Of the energy of that hit from 60 to 400 Hz, 53 % lay in one
  band of 15 Hz, and 1 % of the whole lay over 2 kHz.
- The owner heard the frame of silence before the hit on the wall as the hint of the hit.
- The seventh plan made that hit from a hard edge, a wide burst and a deep body with no tone, and
  the owner was satisfied with it. Its break held cracks that crumble and shards: blocks of 0.05 to
  0.65 m that knock, 80 a second. The owner heard plastic, or a steel bin that is kicked.

- The eighth plan held no block of a middle size. The owner heard plastic still: the sound must be
  denser, and the reference shows how. The reference holds one dense roar from the blast to the fog,
  in every band from 40 Hz to 10 kHz. The eighth plan's mix was empty between its events, and
  nearly empty over 500 Hz.
- The owner asked what rings under the wind at the start. It was two `cloth` events: the grains of
  a `cloth` are heard as small bells.

- The ninth plan made a landing from a `boom` at 60 Hz, one at 115 Hz with a fall of 0.2 s, and
  the edge of a block, and the break held three such booms at 125 Hz. The owner heard a plastic bin
  that is kicked. A band of noise from 100 to 140 Hz with a short fall is a hollow thing.

- The tenth plan made the break and the landings from large blocks at full brightness, hard edges
  and fine grit. The owner heard no wall of tons that falls on a floor of stone: a steel bin that
  is kicked and rolls. The stone kinds were heard as plastic when dull and as steel when bright;
  both have five fixed bands. The eleventh plan uses neither after the hit on the wall.

- The eleventh to the thirteenth plan made a landing with no stone kind: bursts, bodies with no
  tone, and bright roars for the tear and the crush. The owner heard a high hiss that grates, and
  asked for the hit of a block of stone on the floor in its place. The fifteenth plan makes a
  landing from the parts of the hit on the wall, which the owner accepted.

What follows for the one who writes a plan:

1. Ask for each moment which sound leads, before any event is written.
2. Set the loudness target so low that the limiter leaves the largest hit its front.
3. Take the weight of a hit on stone from an `impact` under it. Keep the short fall of the stone.
4. Write a strike on the frame on which the thing strikes. While the picture holds a thing in the
   air, write no strike.
5. Make stone from a hard edge, a deep body with no tone and fine grit; a large hit has a short,
   wide burst too. Leave out a tone that the ear follows, a dull top, and blocks of 0.1 to 0.7 m
   that knock: a `crack` that crumbles, and a `rubble` of that size.

6. When the picture holds one event from start to end, hold a mass under the sounds that lead: a
   wide `roar` that goes on from the first of them and falls step by step. Sounds with silence
   between them are heard as thin.

7. Make a mass of tons that lands from the owner's four layers: the ground, a sub that is felt,
   first or with the hit; the hit, a burst that tears as thunder does; the crush, stone that is
   ground to pieces under the weight; and the ring of the place, a heavy tail of seconds.

The rule and the checklist: `layers` counts the sounds that make one hero event, and to the viewer
they are one sound. The rule says which event leads; it does not lower that count. `dynamics` asks
for a silence before an impact and for build-ups: they are the hints of the future. No analyzer
measures the rule. The plan tests of experiment 9 (`test/plan.test.ts`) hold it for one plan.

## The vocabulary

The vocabulary is units and presets made by experts. It is versioned as code. `explain` explains
each unit.

- A stylised sound is procedural. A whoosh, an impact, a shimmer and wind are procedural, and this
  engine does them well.
- A realistic foley sound (footsteps, cloth) needs recorded samples. The vocabulary may hold them
  as grains, rendered by the granular scheduler of experiment 6.

Inference: the quality ceiling of the loop is the vocabulary's. A better model writes a better
plan. It cannot raise the sound of a kind above what the kind can make.

## The guards

An expert's ear does five things by hand. The engine does them by rule:

1. A loudness target and a true-peak limit (`master`).
2. Ducking of the other layers under `dialogue`.
3. A frequency slot for each layer, so that the layers do not pile up in one band.
4. Onsets snapped to the picture's cuts and motion peaks, within a small window.
5. Variation between repeated events of one kind, and no clipping.

The guards also include one that acts before an impact:

- **Ducking before a hero impact.** Before each hero impact, the layers other than the impact's
  are attenuated by 6 dB. A hero impact is an `impact` event whose `intensity` is at or above the
  checklist's hero threshold (`R.heroIntensity` of `src/analyze/checklist.ts`, capped at the
  highest `intensity` of the plan, as `checklist` caps it). The attenuation falls over 0.4 s and
  ends 0.05 s before the onset. The fall is fast first: an exponential approach in dB with a time
  constant of one fifth of the fall. It holds through the onset, then recovers over 0.3 s after it. The
  impact's own layer is not ducked. `dialogue` is not ducked: dialogue ducks the other layers and
  never the reverse. When two impacts overlap, the deeper attenuation holds. These numbers are the
  defaults of the renderer, and they are named constants in `src/spatial/duck.ts`.

A guard acts on the render, not on the plan. The plan states the intent. The guard states the
craft.

## Spatial sound

The sound is object based. Each event has a position. Each scene has a room. The camera is the
listener.

The renderer applies, in this order:

1. Distance attenuation.
2. Air absorption.
3. Early reflections from the room model.
4. A reverb send, which is the convolution of experiment 5.
5. For headphones, an HRTF convolution with short impulse responses.

This is where a three-dimensional sound comes from. An ordinary user gets it by default, because
the plan carries the positions and the room.

## The checklist

The checklist has eight dimensions. Each has an amateur symptom, an expert property and an
automatic measure. The analyzers compute the measures. Each dimension has a short name, which the
analyzers use as its field name.

| Name        | Amateur symptom                   | Expert property                                                  | Automatic measure                                                                                                                         |
| ----------- | --------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `layers`    | One sound per hero event.         | Three to seven sounds per hero event.                            | The count of events that sound within 100 ms of a hero event. The count of distinct layers among them is reported beside it.              |
| `dynamics`  | A flat loudness curve.            | Silence before an impact, build-ups, ducking under dialogue.     | The loudness curve: the depth of the dip before each impact, on the layers other than the impact's. Ducking in dB, measured on the stems. |
| `balance`   | Mud, and no top.                  | No pile-up at 200 to 400 Hz. Air above 10 kHz.                   | The spectral tilt, and the overlap of the layers' bands, measured on the stems.                                                           |
| `space`     | Dry, or one reverb on everything. | Reverb ratio and channel correlation matched to the room.        | The reverb-to-direct ratio, measured on the mix against the dry render, and the inter-channel correlation.                                |
| `position`  | Everything in the centre.         | The sound follows the object on the screen.                      | The pan trajectory against the event's screen coordinates, measured on the event's layer stem.                                            |
| `sync`      | The sound is late.                | A whoosh starts before its impact. An impact lands on the frame. | The onset against the cut and the motion peak, in ms.                                                                                     |
| `variation` | The same sample on every step.    | Repeated events differ.                                          | The similarity between the events of one kind, measured on their layer stem.                                                              |
| `master`    | Loud and clipped, or quiet.       | The loudness target, a true peak under the limit, and glue.      | LUFS, true peak, the crest factor and the count of clipped samples. The last two are the measure of glue.                                 |

The renderer returns each layer as a stem, and the mix without the reverb as the dry render. The
analyzers measure ducking, the overlap of bands, the reverb-to-direct ratio, `position` and
`variation` on these. A measure on the mix alone would blur events that overlap in time. The
analyzers read the mix only where no stem is given.

Every threshold of the rules is a starting value. The runs of experiment 8 record which thresholds
the one-layer render fails and the layered render meets. A threshold changes only through a record
of a run.

The analyzers need no model and no listener. The numbers are facts about a render. Whether they
match what a person likes is an inference, and only a study on listeners can test it.

## The loop for a lay user

The user does two things only:

1. Pick the better of two renders.
2. Point at a moment and complain in plain words.

The system then runs the procedure below. It runs again after each pick or complaint.

1. Score the current render against the checklist.
2. Ask at most one question: "the whole clip, or this moment?"
3. Render two variants of 15 seconds. They differ in the top hypothesis only (A/B).
4. Apply the user's pick to every event of that kind.
5. Go to the next item of the list.

Inference: three to five rounds converge. This is a design target, not a result.

Each pick is recorded as a taste profile. The next scene starts from it.

A user may have a reference clip. The system then reads a mix profile from it: the loudness curve,
the spectral balance and the reverb amount. The render matches the profile. This generalises the
sound match of experiment 7 from one unit to a mix.

## Limits

- A vague complaint takes rounds, not one shot.
- A user who neither picks nor points gets the default expert template only. The template must
  already be "not wrong".
- Stylised content (animation, games) reaches the expert level sooner than realistic film foley.
- Copyrighted footage is for private experiments only. A public demo needs other material.
- Picture analysis is outside this engine: the detection of cuts and motion peaks and the
  estimate of screen positions. The harness of experiment 8 takes a hand-written plan.

## What the engine must gain, in order

1. The plan format and its validator.
2. The analyzers that compute the checklist.
3. The spatialization units.
4. A mix-profile matcher.
5. Speed, so that two variants of 15 seconds render in under a second.

The fifth item is the reason a GPU engine matters for a lay user. The gain is the speed of
iteration. It is not fidelity.

Items 1 and 2 are the work of experiment 8's plan format and analyzers. Experiment 8 tests the
first spatialization units and the speed.

The design note for item 5, spreading an event over several lanes, is `docs/lanes.md`.
