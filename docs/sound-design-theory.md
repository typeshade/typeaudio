# Sound design for picture: the theory this engine works from

This note collects what the practice of sound for film and animation says about a sound that fits
a picture, and what experiment 9 learned against it. The owner asked for it on 2026-11-10, after
sixteen plans of one passage (`docs/experiments.md`, section 9).

Its sources are published books, articles and talks: Michel Chion, "Audio-Vision"; Walter Murch,
"Dense Clarity, Clear Density" and "In the Blink of an Eye"; Randy Thom, "Designing a Movie for
Sound"; and the literature on how a listener hears the size and the material of a thing that is
struck. It was written by an agent that cannot hear. Nothing in it was checked by ear by its
writer. Each claim about this engine names the review or the measure it rests on. A claim without
one is an inference, and the text says so.

`docs/sound-design-loop.md`, "One sound leads", is the rule for the one who writes a plan. This
note is the reason behind that rule.

## 1. A sound and a picture make one event

These terms are Chion's.

- **Synchresis.** A sound and a thing in the picture that happen in the same moment are heard as
  one event, whether or not the thing made the sound. So the frame comes first: a sound on the
  wrong frame belongs to nothing.
- **Added value.** A sound gives the picture what the picture does not show: weight, speed,
  material. The viewer remembers it as something seen.
- **Rendering.** A sound does not copy what a thing sounds like. It carries what the thing feels
  like. A stone of tens of tons is right when it feels like tens of tons.
- **Three ways to listen.** A listener hears the cause of a sound, the meaning of a sound, and the
  sound as itself. "It sounds like a plastic bin" is a statement about the cause. A spectrum is a
  part of the third way only.
- **The point of audition.** A sound is heard from somewhere: from the camera, or from inside a
  person in the picture.

## 2. What a listener can follow

These terms are Murch's.

- **Two and a half.** A listener follows two sounds of one sort as two. From three on, the listener
  hears a mass. Two sets of steps are two people; three are a crowd.
- **Two sorts of sound.** Speech is heard for its meaning. Music is heard by the body. An effect
  lies between them. Sounds of different sorts can lie on one another; sounds of one sort cannot.
- **Density against clarity.** Each layer adds density and takes clarity. A mix chooses a place
  between the two for each moment.

## 3. A thing that is struck

- **Three parts.** The front of a hit, a few milliseconds long, says which material was struck and
  how hard it is. The body says how large and how heavy the thing is. The tail says where it is.
- **Size.** A listener reads size from three things at once: a low pitch, a long sound, and a slow
  change. They belong together. A sound made lower by a slower speed changes all three by one
  ratio.
- **Material.** A listener reads material from how the partials of a sound die. Metal holds its
  high partials. Wood loses them fast. Stone loses them faster, and its partials are many and lie
  at no regular places. A hollow thing has one low partial that stands out.
- **Sweeteners.** A thin layer of another character gives a hit its own nature. The listener does
  not hear it as a layer.
- **Recordings.** The practice starts from recordings of real things, lowered, stretched and laid
  on one another. It does not start from synthesis.

## 4. Time

- **Expectation.** Tension is a thing that is told and then held back. A rise, a rush and a silence
  are its tools.
- **Contrast.** A sound is as large as its difference from the sound before it. The cheapest way to
  make a hit larger is to make the moment before it smaller.
- **Bridges.** A sound may start before its picture (a J cut) or go on after its picture (an L
  cut). A sound that stops on every cut tears a scene apart.
- **Slow motion.** A slow picture has fewer sounds, or its sounds are slowed. It does not have the
  sounds of the same picture at full speed.

## 5. Frequency and level

- **Masking.** A loud sound hides a quieter sound near it in frequency. So each layer has its place
  in the spectrum.
- **Equal loudness.** The ear is weak at the bottom and at the top. Weight that lies under 100 Hz
  only is not heard on a small speaker. Partials above it make the ear hear it.
- **Saturation.** A sound that is driven into a soft limit gains partials and average level. It is
  heard as dense.
- **Range.** A film for a theatre has a wide range of level. A programme for broadcast or for a
  stream has a narrow one.

## 6. Animation

Animation has no sound from a set: every sound is made. The motion is drawn larger than life, and
the sound follows it. In Japanese television animation one sound director leads speech, effects
and music together, and a silence before a hit is a common form. This paragraph rests on
interviews only.

## 7. What experiment 9 found against this

Each row is a review by the owner on 2026-11-10 and the part of the theory that it meets. The
plans, the measures and the records are in `docs/experiments.md`, section 9, and in pull request
#68.

| What the owner heard                                                            | What the plan had done                                                           | The theory                                             |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A clatter: things of a house that are thrown                                    | A sound for each row of a list: 59 events                                        | Two and a half; density against clarity                |
| A roll of dull thumps, apart from the picture                                   | Weight as a long, low ring; landings where the picture shows fog                 | Material is in the decay; synchresis                   |
| The hit on the wall and the break are one sound, and must be told apart         | One recipe for both                                                              | Two events need two gestures                           |
| Stones that have fallen while the picture holds them in the air                 | Strikes in a slow picture                                                        | Synchresis; slow motion                                |
| Plastic; a plastic bin; a steel bin that is kicked                              | Stone from five fixed bands of noise, dull or bright; a body from one band       | Material: the partials of stone are many and irregular |
| Hollow inside; it must be denser                                                | Events with silence between them; a limiter with no saturation                   | Density; saturation                                    |
| A high hiss that grates                                                         | A bright roar for the tear and the crush of a landing                            | Masking and the place of each layer                    |
| Plausible: the hit on the wall, lowered by two octaves, as the block that lands | A prototype outside the engine: the engine's own hit, read at a quarter of speed | Size is pitch, length and rate together                |
| Fitting, though alike: the hit on the wall and the break                        | The same parts for both, in another gesture                                      | One material has one timbre; events differ by gesture  |

Three findings follow. Each is an inference from these reviews, by one listener, on one passage.

1. **One material in one scene has one timbre.** The events of that material differ by pitch, by
   level, by count and by timing. A new recipe for each event is heard as a new material.
2. **Weight is the whole sound lowered, not a low layer added.** Sixteen plans added low layers and
   were heard as drums and as hollow bins. One prototype lowered a sound that the owner had
   accepted, and it was heard as plausible.
3. **A number did not tell stone from a bin.** The measures of the session were band levels, the
   share of one tone, and the flatness of the spectrum. The owner's ear separated sounds that these
   measures held equal. A plan was changed sixteen times on such numbers. A sound that the owner
   accepts is a better start than a measure.

## 8. What the engine lacks for this

- **A pitch for an event.** The engine cannot lower a whole sound. Finding 2 needs it: every
  frequency and every length of an event by one ratio.
- **Material.** The stone kinds have five fixed bands. The theory asks for many partials at
  irregular places that die fast, and for thousands of fine breaks a second.
- **Density in the master.** The master is a loudness target and a clean limiter. The theory, and
  the reference of experiment 9, ask for saturation before the ceiling.
- **Recordings.** The practice starts from them. `docs/sound-design-loop.md`, "The vocabulary",
  says that a realistic sound needs recorded samples.
- **An ear.** No analyzer of the engine hears a cause. Until one does, a person decides.

None of these is built or decided. Each is a change to the design, and the owner decides which
comes first.
