# Procedural sound-design brief derived from picture

Status: proposed direction for candidate creation and listening review.
The visual observations and mixed-track measurements are in [analysis.md](analysis.md).
These source recipes describe musical and perceptual intentions; they do not claim a physical simulation of magic.

## Material families

| Family | Intended identity | Procedural candidate | Parameters that should follow the action | Main review risk |
| --- | --- | --- | --- | --- |
| Red core | Dense, contained and turbulent | Seeded filtered noise, a few beating modes and controlled nonlinear edge | Formation, confinement, speed, distance and release | A continuous generic bass rumble hides motion and contacts. |
| Violet arc | Unstable and branching | Irregular band-limited excitation bursts with a changing noisy body | Pulse density, branch activity and contact intensity | Excess continuous high-frequency energy causes fatigue. |
| Geometric shield | A resisting material with stress and failure | Inharmonic damped modes excited at contact, followed by sparse fragments | Stress, contact position, fracture and recovery | The shield becomes indistinguishable from the attacking source. |
| Precise beam | Coherent, deliberate and sustained as needed | Short launch edge, stable harmonic/noise body and controlled release | Start, hold, width, speed and stop | Repeated cuts retrigger attacks or collapse a held beam into short blasts. |
| Dark wedges | Rough mass and shearing pressure | Modulated rough body with separated scraping edges and shield excitation | Pressure, contact count and fracture progression | Another bright laser timbre fails to express their different shape and resistance. |
| Multicolour assembly | Complex but intelligible interaction | Two or three coordinated motifs with bounded variation | Assembly stages, density and release | One note per visible particle creates an arbitrary musical sequence. |
| Stone | Weight, brittle structure and irregular secondary contacts | Noise excitation into several damped modes; distinct large and small contact envelopes | Effective mass, fracture, surface contact and settling | Every collision shares the same pitch drop and random debris pattern. |
| Cloth and bodily movement | Close, small and tangible | Filtered stochastic rubbing and short contact candidates | Actual body movement and cloth speed | Continuous synthetic Foley sounds detached from visible motion. |
| Unseen force | Abrupt pressure without a visible mechanism | Compact band-limited attack and short body; travel and collision remain separate events | Attack, body response and travel interval | A long rising warning removes the intended surprise. |
| Dissolution | An entity losing coherence | Thinning resonant modes, shrinking body and sparse particulate decay | Loss of coherence, strand thinning and particle density | Treating disappearance as cloth, liquid or rubble without auditioning the material choice. |
| Hall | Stable spatial continuity around changing events | Low-level bed, causal early reflections and a separately controlled late field | Source/listener position, exposure and chosen perspective | Restarted tails, constant loud low-frequency wash or invented room measurements. |

Keep the primary material recognizable across repetitions.
Variation should change microscopic detail and intensity, not arbitrarily replace the source's identity.
Use deterministic seeds attached to event IDs and source revisions.
Natural bodily and stone details remain demanding synthesis targets. Numerical checks alone cannot select the convincing candidate.

## Represent source behaviour before rendering a WAV

Model a source as a stateful process with preparation, active output, contact and release where those phases exist.
Store the source process separately from the event time, trajectory, listening perspective and bus automation.
An edited shot can change perspective while the same source continues.
Store contact events as linked children when they excite another material, such as a shield or stone.

For example, a beam needs an explicit held state and a stop event.
Its release must preserve the accumulated room tail.
A shield needs its own state, because repeated contacts change the perceived stress before fracture.
An unseen-force event has no required audible preparation state.
These are proposed authoring contracts, not new public TypeAudio APIs delivered by this analysis.

One useful synthetic contact model is a bank of damped modes driven by a short excitation.
Choose mode frequencies, amplitudes and decay rates per material, then vary excitation with contact strength.
Keep modal state continuous across blocks. Resizing or resetting it on a parameter edit would introduce an unrelated audible event.
Reserve seeded microvariation for texture; picture-locked major contacts remain deterministic.

## Mix hierarchy and spatial routing

Use separate buses for foreground magic, defence/contact, body/Foley, structure/debris, ambience and room returns.
A dialogue guide or licensed dialogue stem requires its own route when available.
The current original mix does not provide that isolation.

For each editorial region, identify one primary attention target and the supporting layers it needs.
The 41 spotting entries include `hero`, `support`, `bed` and `protected-gap` priorities.
These are production labels. They are not tested runtime voice-budget values.
Keep the main attack, body contact and important stop events above decorative fragments when simplifying a dense passage.

Author source trajectories and listener perspective independently.
Use a stable room bed and continuous return state across cuts.
Use short, intentional transitions when the listening perspective changes; avoid switching every source instantaneously to a new pan law.
An object can be broad without randomizing its centre position every frame.

For the first stereo study, communicate depth through direct/room balance, spectral treatment and motion continuity.
Reserve verified front/back and elevation claims for the planned binaural path and actual listening tests.
A single high-frequency shelf or stereo-pan curve does not establish height.
For phone playback, retain attack definition and low-mid harmonics so the event still reads without deep bass.
Check mono fold-down before selecting wide or decorrelated layers.

## Three candidate-review passages

| Passage | Candidate comparison | Keep fixed | Review questions |
| --- | --- | --- | --- |
| 20–30 s | Two red-material bodies and two defensive decays | Anchor times, source route and matched passage level | Is the object recognizable through travel and rupture? Does the defence sound like a response? |
| 136.5–149.7 s | Two compact force onsets and two collision bodies | No long warning, 18-frame contact separation, picture edit | Does surprise survive? Does the body have weight? Is the column contact a distinct second event? |
| 173–189.315 s | Two sustained-beam bodies and two dissolution textures | Flash/beam anchors, complete closing fade and passage-level matching | Does scale persist without fatigue? Does dissolution register? Does the scene recover after the peak? |

Review a small number of combinations. Change one major dimension per revision.
Record a timecoded observation, a requested change, the source revision, the playback target and the reviewer.
Keep `rendered`, `signal-checked`, `listening-reviewed` and `selected` separate.
This analysis marks no candidate selected.

Check finite output, true peak, missing events, deterministic seeds, mono compatibility and tail continuity before listening review.
Technical success does not establish convincing stone, bodily weight, emotional impact or spatial perception.
Use headphones and a phone-speaker check for the first review; hardware-specific acoustic claims require their own evidence.

## Requirements exposed for Web, TypeAudio and TypeShade

| Owner | Requirement from this scene | Concrete reason | Roadmap relationship |
| --- | --- | --- | --- |
| Web | Event groups with child contacts, phase markers and editable source handles | The force and column hit are separated by 0.75075 seconds but belong to one causal sequence. | R7/R8 authoring integration. |
| Web | Shot perspective distinct from source lifetime | The final beam and Fern's salvo continue across cuts. | R7 shared document state. |
| Web | Explicit scene end, tail policy and YouTube offset | The old 188-second range truncates the closing fade. | R8 picture/template playback. |
| Web | Source-versioned cached renders and timecoded review records | Replacing a material must preserve timings and invalidate only the relevant cache. | R7/R9 state and agent loop. |
| TypeAudio | Absolute audio-frame event time, bounded processing and generation checks | Short attacks, paired starts/stops and rapid revisions must not be delayed or applied to reused voices. | R1/R1a. |
| TypeAudio | State continuity during held output and parameter changes | Beams, shield stress and room tails span several seconds and multiple edits. | R1 contracts and existing graph regression corpus. |
| TypeAudio | Priority and graceful simplification | Decorative branches and debris must not displace the foreground onset or body contact. | R1b. |
| TypeAudio | Renderer-independent source paths and separate direct/early/late routes | Height, room scale and perspective need more than pan automation. | R2/R3/R4. |
| TypeShade | Bounded batches of propagation and material queries, with actual tier identity | A dense field can update scene acoustics asynchronously while direct output continues. | R5 and compiler feedback. |
| TypeShade | A supported synchronous CPU artifact when approved and implemented | Immediate DSP cannot await an asynchronous compiler entry from the worklet callback. | R6; proposal 0122 remains a draft. |

The supplied scene has constant frame spacing throughout the analysed range at 24000/1001 fps.
At a chosen 48,000 Hz engine rate, each source frame corresponds to exactly 2,002 samples.
Use absolute presentation time or rational frame conversion, not a rounded 24 fps clock.
At 44,100 Hz, calculate each absolute sample index from time; repeatedly adding a rounded samples-per-frame value would accumulate drift.
This mapping supports local timeline scheduling. It does not make the YouTube iframe a frame-accurate playback clock.

Keep direct onset and essential source DSP independent of delayed propagation results.
Use current validated room information until a bounded, version-matched replacement arrives.
No software-WebGPU timing from this study can establish a game deadline or hardware GPU performance.
The engine's next implementation task remains R1, as recorded in [the program roadmap](../../continuity/roadmap.md).
