import { KINDS } from './kinds.ts';
import { eventSpan, LAYERS, MATERIALS } from './types.ts';
import type { PlanEvent, PlanLayer, PlanMaterial, PlanSync, SoundPlan, Vec3 } from './types.ts';

/** The most events a plan holds. */
export const MAX_EVENTS = 256;
/** The longest clip, in seconds. */
export const MAX_DURATION = 600;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A finite number from `min` to `max`. Each message names the owner and the field. */
function number(owner: string, field: string, v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`${owner}: field "${field}" must be a number from ${min} to ${max}.`);
  return v;
}

function object(owner: string, field: string, v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new Error(`${owner}: field "${field}" must be an object.`);
  return v;
}

function vec3(owner: string, field: string, v: unknown, min: number, max: number): Vec3 {
  if (!Array.isArray(v) || v.length !== 3)
    throw new Error(`${owner}: field "${field}" must be a list of three numbers.`);
  return v.map((n) => number(owner, field, n, min, max)) as Vec3;
}

function times(owner: string, field: string, v: unknown, duration: number): number[] {
  if (!Array.isArray(v)) throw new Error(`${owner}: field "${field}" must be a list of seconds.`);
  return v.map((t) => number(owner, field, t, 0, duration)).sort((a, b) => a - b);
}

/**
 * Validates a plan and returns it normalized: the defaults filled, the events sorted by `t` and then
 * by `id`, every macro present. It throws an `Error` of one sentence that names the event and the
 * field. It refuses an unknown kind, a layer that does not match the kind, a macro the kind does
 * not define, a value out of range, an event outside the clip, a repeated `id` and more than
 * `MAX_EVENTS` events.
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

  const clipIn = object('Clip', 'clip', raw.clip);
  const duration = number('Clip', 'duration', clipIn.duration, 1, MAX_DURATION);
  const clip = { duration, fps: number('Clip', 'fps', clipIn.fps, 1, 240) };

  const sceneIn = object('Scene', 'scene', raw.scene);
  const roomIn = object('Scene', 'room', sceneIn.room);
  const material = roomIn.material;
  if (typeof material !== 'string' || !(MATERIALS as readonly string[]).includes(material))
    throw new Error(`Scene: field "room.material" must be one of ${MATERIALS.join(', ')}.`);
  const size = vec3('Scene', 'room.size', roomIn.size, 1, 500);
  const listenerIn = object('Scene', 'listener', sceneIn.listener);
  const scene = {
    room: { size, material: material as PlanMaterial },
    listener: {
      position: vec3('Scene', 'listener.position', listenerIn.position, -1000, 1000),
      yaw: number('Scene', 'listener.yaw', listenerIn.yaw, -360, 360),
    },
  };

  const masterIn = object('Master', 'master', raw.master ?? {});
  const master = {
    lufs: number('Master', 'lufs', masterIn.lufs ?? -23, -70, 0),
    truePeak: number('Master', 'truePeak', masterIn.truePeak ?? -1, -20, 0),
  };

  const seed = number('Plan', 'seed', raw.seed ?? 0, 0, 2 ** 32 - 1);
  if (!Number.isInteger(seed)) throw new Error('Plan: field "seed" must be a whole number.');

  const pictureIn = object('Picture', 'picture', raw.picture ?? {});
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
    if (e.layer !== kind.layer)
      throw new Error(`${owner}: field "layer" must be "${kind.layer}" for kind "${e.kind}".`);
    const sync = e.sync ?? 'onset';
    if (sync !== 'onset' && sync !== 'arrive')
      throw new Error(`${owner}: field "sync" must be "onset" or "arrive".`);
    const t = number(owner, 't', e.t, 0, duration);
    const length =
      e.duration === undefined ? undefined : number(owner, 'duration', e.duration, 0.001, duration);
    const positionIn = object(owner, 'position', e.position);
    const macrosIn = object(owner, 'macros', e.macros ?? {});
    for (const name of Object.keys(macrosIn))
      if (!Object.hasOwn(kind.macros, name))
        throw new Error(
          `${owner}: field "macros.${name}" is not a macro of kind "${e.kind}" (${Object.keys(kind.macros).join(', ') || 'none'}).`,
        );
    const macros: Record<string, number> = {};
    for (const [name, def] of Object.entries(kind.macros))
      macros[name] =
        macrosIn[name] === undefined
          ? def.default
          : number(owner, `macros.${name}`, macrosIn[name], def.min, def.max);
    const event: PlanEvent = {
      id,
      t,
      kind: e.kind,
      layer: e.layer as PlanLayer,
      intensity: number(owner, 'intensity', e.intensity, 0, 1),
      position: {
        x: number(owner, 'position.x', positionIn.x, -1, 1),
        y: number(owner, 'position.y', positionIn.y, -1, 1),
        distance: number(owner, 'position.distance', positionIn.distance, 0.1, 1000),
      },
      macros,
      sync: sync as PlanSync,
    };
    if (length !== undefined) event.duration = length;
    const span = eventSpan(event);
    if (span.start < -1e-9)
      throw new Error(`${owner}: field "duration" starts the sound before the clip starts.`);
    if (span.end > duration + 1e-9)
      throw new Error(
        `${owner}: field "t" or "duration" ends the sound after the clip ends at ${duration} s.`,
      );
    return event;
  });
  events.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const plan: SoundPlan = { version: 1, clip, scene, master, seed, picture, events };
  if (typeof raw.description === 'string') plan.description = raw.description;
  return plan;
}
