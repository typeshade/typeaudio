# Sound design against picture production workflow

Status: production plan and v2 sound-study data, not a shipped editor feature. The website is
`audio.typeshade.dev`; no separate website is required. The reference is the YouTube video
`YHCqcyX9N3s`. R2 hosts authored sound assets and project data, not a copy of the reference video.

## Creative brief and picture reference

Use the supplied local reference for analysis and the YouTube player for public viewing.
Record the reference hash, frame rate, duration, edit boundaries and authored sound range.
The current sound range is 0–188 seconds; the uploader end card is outside the scene.
Verify the local reference's offset against YouTube before claiming online synchronization.
Use video time as the playback clock. Buffering, seeks, playback-rate changes and tab suspension
must pause or reschedule external sound. The iframe is an approximate synchronization source;
it does not expose a frame-accurate professional video clock. Give reviewers an offset control
and report measured error. Never call unmeasured YouTube synchronization sample accurate.

The deliverable is a replacement effects and ambience study. The original YouTube soundtrack
contains dialogue, music and effects together. Muting it also removes the dialogue and music.
A comparison mode must identify this; turning its volume down does not isolate dialogue.

## Production stages

1. **Brief.** Describe the scene's dramatic purpose, listener perspective, sonic materials,
   priority hierarchy and playback target. Establish the quiet moments as deliberately as the
   loud ones. A target loudness is a delivery choice, not a claim of aesthetic quality.
2. **Spotting.** Mark visible actions with start, contact and end times, event IDs, confidence
   and supporting frames. Camera cuts are not automatically sound events. Separate observed
   timing from an imagined material or off-screen source.
3. **Source design.** Audition several candidates for the important materials. Keep provenance,
   synthesis graphs, parameters and seeds. Procedural generation is useful for magic and
   variation; recorded Foley or licensed library sources can be more appropriate for natural
   movement. This study currently uses synthesis only and should be labelled accordingly.
4. **Sound editing.** Build selected events from preparation, attack, body, motion, contact and
   decay as needed. Keep handles and source offsets. Group layers by event, so a timing revision
   moves the intended sound together. Avoid repeating an arbitrary debris pattern at every hit.
5. **Spatial editing.** Store a source's trajectory and the listener/camera perspective separately
   from its waveform. Author distance, spread, occlusion, direct sound and early/late reflections.
   A pan automation curve alone cannot establish convincing height or behind-the-head position.
6. **Premix.** Route ambience, Foley, magic, impacts and debris to separate buses. Place the
   foreground event above the supporting texture. Leave room for dialogue and music when stems
   are available. Evaluate effects in context, not just solo.
7. **Review and revisions.** Play the same short picture passage for each candidate at matched
   loudness. Record a timecoded observation, an actionable change and the new version. Recheck
   the result in picture. Objective measurements and visual inspection do not replace listening.
8. **Delivery.** Export the selected mix, aligned stems, cue sheet, source recipes, reference
   metadata and validation receipts. Confirm the playback target, start time and tail policy.
   Keep review renders distinct from an approved mix. Publication can expose a labelled study;
   it must not silently mark it creatively approved.

## Spatial intent and output renderers

A sound object should reference an event, source version and deterministic seed, with its
trajectory, gain envelope, spectral/distance changes, spread, priority and room send. Store
spatial units and coordinate conventions explicitly. If a position is invented from a 2D shot,
mark it as authored intent rather than measured geometry. Listener orientation is independent.

For the Frieren study:

- Red orbs: turbulent low-mid material, an audible approach and departure, restrained room send.
- Violet arcs: irregular short attacks, changing contact points, a distinct shield resonance.
- Blue beams: a precise launch transient followed by sustained energy for the visible duration.
- Shields: inharmonic contact and small decaying fragments rather than another generic explosion.
- Unseen force: remove preparatory energy, use a compact pressure attack, then separate the body
  hitting the column from the initial attack. Do not add a warning whoosh that weakens the reveal.
- Stone hall: stable low-level ambience, causal early reflections and frequency-damped tails.
  Moving the camera does not require restarting the room tone.

Use one scene description with several explicit rendering targets:

| Target | Implementation and validation |
| --- | --- |
| Stereo speakers / phone | Equal-power pan, controlled depth cues, mono compatibility and intelligibility at modest volume |
| Headphones | Binaural renderer with an HRTF, distance/occlusion filters and room reflections; test front/back and height perception by listening |
| Head-tracked headphones | The binaural path plus a real orientation source, coordinate calibration and measured update latency |

The owner explicitly excludes Dolby products and certification from the custom-engine requirement.
The current v2 artifact is a stereo render with pan trajectories and separate reverb tails.
It is **not** an HRTF render or a Dolby Atmos master. Browser WebGPU processing by itself does
not create spatial audio, head tracking or Atmos metadata. A phone speaker cannot reproduce the
same cues as headphones or a calibrated multichannel room. Do not label every output Atmos.

## Agent feedback contract

The agent proposes a brief, spots picture events, produces candidates, renders them and runs
technical checks. It records which evidence supports each decision and which checks it cannot
perform. The user or a listening-capable reviewer chooses a candidate in context. An audio model
can assist with anomalies and descriptions, but its confidence is not a substitute for a named
review and reproducible evidence.

A review record contains event ID, picture time, candidate version, playback target, listening
level or loudness-matching procedure, observation, requested change, reviewer and disposition.
Keep statuses such as `rendered`, `signal-checked`, `listening-reviewed` and `selected` separate.
An unreviewed render cannot automatically acquire `selected` or `final` status from peak tests.

Use three representative passages before expanding or revising the entire scene: red-orb
rupture, unseen force, and the final discharge. These cover material identity, negative space,
spatial motion, impact timing and maximum density. Limit each creative iteration to a small
number of changes so that the next A/B test can identify their effect.

Technical checks include finite samples, clipping/true peak, integrated loudness and range,
mono fold-down, missing assets, render determinism and alignment. Playback tests include seeks,
buffering, changing speed, interruption, duplicate audio and mobile gesture unlock. Listening
checks include material plausibility, perspective, masking, fatigue, spatial coherence and the
intended dramatic focus. Record these as observations, not a fabricated numerical quality score.

## Integration into the existing TypeAudio editor

Use the existing Project, Picture, Timeline, Inspector, graph and code components. Add a template
catalog, event markers, linked event layers, spatial controls, buses and timecoded review notes
as distinct components/hooks. Keep the public source template immutable and fork user edits.
Store each project's assets separately; the current global 24-file/120-second library cannot
hold the entire study. Load scene assets on demand and retain independent versioned edits.

Use YouTube references in manifests. Keep manifests, audio, source recipes and receipts in R2
under versioned template keys. Serve published assets through the existing site's Worker with
Range/HEAD support and explicit content types. Do not expose the bucket indiscriminately.

The current editor also limits a scene to 60 seconds/24 cues and prefers stored PCM over a graph
when both are present. These are implementation constraints, not reasons to present a flattened
movie as an editable template. The future loader must link a cached render to its source revision,
invalidate it after a graph edit, and preserve the frame/time mapping across scene changes.
Stereo spatial/reverb processing currently runs in the offline host; editor/mix parity requires
an explicit shared rendering path. These features are planned, not verified shipped behavior.

## Recovery provenance

This plan preserves the formerly untracked Web workflow at `/workspace/web/docs/typeaudio-sound-design-workflow.md`.
The source archive retains the original text. This version incorporates the subsequent owner decision to exclude Dolby dependencies.
See [asset inventory](assets.md) for source recipes and [roadmap](roadmap.md) for implementation order.
