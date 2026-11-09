import { KINDS } from './kinds.ts';
import { LAYERS, MATERIALS } from './types.ts';
import type { PlanEvent, PlanLayer, PlanMaterial, SoundPlan } from './types.ts';

/** The most events a plan holds. */
export const MAX_EVENTS = 256;
/** The longest scene, in seconds. */
export const MAX_DURATION = 600;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A finite number from `min` to `max`. Each message names the owner and the field. */
function number(owner: string, field: string, v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`${owner}: field "${field}" must be a number from ${min} to ${max}.`);
  return v;
}

function record(owner: string, field: string, v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new Error(`${owner}: field "${field}" must be an object.`);
  return v;
}

function times(owner: string, field: string, v: unknown, duration: number): number[] {
  if (!Array.isArray(v)) throw new Error(`${owner}: field "${field}" must be a list of seconds.`);
  return v.map((t) => number(owner, field, t, 0, duration)).sort((a, b) => a - b);
}

/**
 * Validates a plan and returns it normalized: the events sorted by time, every macro present. It
 * throws an `Error` of one sentence that names the event and the field. It refuses an event outside
 * the scene, an unknown kind, an unknown layer, a value outside its range and more than `MAX_EVENTS`
 * events.
 */
export function validatePlan(raw: unknown): SoundPlan {
  if (!isRecord(raw) || raw.version !== 1) throw new Error('Plan: field "version" must be 1.');
  if (
    raw.description !== undefined &&
    (typeof raw.description !== 'string' || raw.description.length > 2000)
  )
    throw new Error('Plan: field "description" must be a string of at most 2000 characters.');
  if (!Array.isArray(raw.events) || raw.events.length < 1)
    throw new Error('Plan: field "events" must be a list of at least one event.');
  if (raw.events.length > MAX_EVENTS)
    throw new Error(`Plan: field "events" holds at most ${MAX_EVENTS} events.`);

  const sceneIn = record('Scene', 'scene', raw.scene);
  const duration = number('Scene', 'duration', sceneIn.duration, 1, MAX_DURATION);
  const sampleRate = number('Scene', 'sampleRate', sceneIn.sampleRate, 8000, 192000);
  const roomIn = record('Scene', 'room', sceneIn.room);
  const sizeIn = record('Scene', 'room.size', roomIn.size);
  const material = roomIn.material;
  if (typeof material !== 'string' || !(MATERIALS as readonly string[]).includes(material))
    throw new Error(`Scene: field "room.material" must be one of ${MATERIALS.join(', ')}.`);
  const listenerIn = record('Scene', 'listener', sceneIn.listener);
  const scene = {
    duration,
    sampleRate,
    room: {
      size: {
        width: number('Scene', 'room.size.width', sizeIn.width, 1, 500),
        depth: number('Scene', 'room.size.depth', sizeIn.depth, 1, 500),
        height: number('Scene', 'room.size.height', sizeIn.height, 1, 200),
      },
      material: material as PlanMaterial,
    },
    listener: {
      height: number('Scene', 'listener.height', listenerIn.height, 0, 100),
      fov: number('Scene', 'listener.fov', listenerIn.fov, 10, 180),
    },
  };

  const pictureIn =
    raw.picture === undefined
      ? { cuts: [], motion: [] }
      : record('Picture', 'picture', raw.picture);
  const picture = {
    cuts: times('Picture', 'cuts', pictureIn.cuts ?? [], duration),
    motion: times('Picture', 'motion', pictureIn.motion ?? [], duration),
  };

  const ids = new Set<string>();
  const events: PlanEvent[] = raw.events.map((e: unknown, index: number) => {
    if (!isRecord(e)) throw new Error(`Event ${index}: must be an object.`);
    const id = e.id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id))
      throw new Error(`Event ${index}: field "id" must be 1 to 64 letters, digits, "_" or "-".`);
    if (ids.has(id)) throw new Error(`Event "${id}": field "id" is used by an earlier event.`);
    ids.add(id);
    const owner = `Event "${id}"`;
    if (typeof e.kind !== 'string' || !Object.hasOwn(KINDS, e.kind))
      throw new Error(`${owner}: field "kind" must be one of ${Object.keys(KINDS).join(', ')}.`);
    const kind = KINDS[e.kind]!;
    if (typeof e.layer !== 'string' || !(LAYERS as readonly string[]).includes(e.layer))
      throw new Error(`${owner}: field "layer" must be one of ${LAYERS.join(', ')}.`);
    const time = number(owner, 'time', e.time, 0, duration);
    const length = number(owner, 'duration', e.duration, 0.001, duration);
    if (time + length > duration + 1e-9)
      throw new Error(`${owner}: field "duration" ends after the scene ends at ${duration} s.`);
    const positionIn = record(owner, 'position', e.position);
    const macrosIn = record(owner, 'macros', e.macros ?? {});
    const macros: Record<string, number> = {};
    for (const name of Object.keys(macrosIn))
      if (!Object.hasOwn(kind.macros, name))
        throw new Error(
          `${owner}: field "macros.${name}" is not a macro of kind "${e.kind}" (${Object.keys(kind.macros).join(', ')}).`,
        );
    for (const [name, def] of Object.entries(kind.macros))
      macros[name] =
        macrosIn[name] === undefined
          ? def.default
          : number(owner, `macros.${name}`, macrosIn[name], def.min, def.max);
    return {
      id,
      time,
      duration: length,
      kind: e.kind,
      layer: e.layer as PlanLayer,
      intensity: number(owner, 'intensity', e.intensity, 0, 1),
      position: {
        x: number(owner, 'position.x', positionIn.x, 0, 1),
        y: number(owner, 'position.y', positionIn.y, 0, 1),
        distance: number(owner, 'position.distance', positionIn.distance, 0.1, 1000),
      },
      macros,
    };
  });
  events.sort((a, b) => a.time - b.time);

  const plan: SoundPlan = { version: 1, scene, picture, events };
  if (typeof raw.description === 'string') plan.description = raw.description;
  return plan;
}
