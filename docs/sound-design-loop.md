# The sound-design loop

This note records the design of a loop in which a model writes a plan for the sound of a picture
and the engine renders the plan. The owner approved the design in the conversation on 2026-11-09.
Experiment 8 (`docs/experiments.md`, section 8) tests its first part. Built, at the pin `415b276a`:
the plan format and its validator and the analyzers (pull request #36), the kinds, the spatial
chain, the layered render and the master (pull request #38, record
`docs/records/08-sound-design-container.md`). Not built: the mix-profile matcher (item 4) and the speed
work (item 5) of the section "What the engine must gain, in order". The device runs are pending. The statements about what the engine will do are design,
not measurement.

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

| Field     | Type   | Meaning                                                                                  |
| --------- | ------ | ---------------------------------------------------------------------------------------- |
| `version` | number | The plan format version. It is `1`.                                                      |
| `clip`    | object | `duration` in seconds and `fps`.                                                         |
| `scene`   | object | `room` and `listener`, as below.                                                         |
| `master`  | object | Optional. `lufs` (default -23) and `truePeak` in dBTP (default -1).                      |
| `picture` | object | Optional. `cuts` and `motion`: the cuts and the peaks of motion, each a list of seconds. |
| `events`  | array  | The events, in any order. The engine sorts them by `t`, then by `id`.                    |
| `seed`    | number | The seed of every random choice. The default is `0`.                                     |

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
repeated `id`.

### The kinds

A kind is a unit or a preset of the vocabulary. The plan's `duration` is the sounding length of
every kind that sustains, and the macros shape the sound within it. For a `whoosh`, `speed` sets how
late and how fast the sweep rises within the duration. For a `riser`, `length` sets the fraction of
the duration over which the swell rises, and the sound holds at its peak for the rest. Every kind
draws its take from the event's key within its macro ranges, so repeated events differ (the
`variation` guard). The first kinds are:

| Kind       | Sort       | Layer    | Macros                      |
| ---------- | ---------- | -------- | --------------------------- |
| `whoosh`   | procedural | effects  | `speed`, `brightness`       |
| `impact`   | procedural | effects  | `weight`, `decay`, `crack`  |
| `shimmer`  | procedural | effects  | `density`, `height`         |
| `riser`    | procedural | effects  | `length`, `pitch`           |
| `wind`     | procedural | ambience | `gust`, `howl`              |
| `drone`    | procedural | music    | `pitch`, `darkness`         |
| `footstep` | grain      | foley    | `surface`, `weight`, `pace` |
| `cloth`    | grain      | foley    | `fabric`, `speed`           |
| `voice`    | stem       | dialogue | none                        |

The grains of one event do not clump. In `footstep` and `cloth`, `drawGrains` lets no more than two
grains of one cloud sound at the same time (N = 2). It skips a drawn start that would be a third.
The draw stays deterministic from the event's key. Two grains still make a thud with a crunch, or a
cloth burst. A third at the same moment only adds a spike of the sum of their peaks.

The list is a starting set. Each experiment and each later change may add kinds.

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
