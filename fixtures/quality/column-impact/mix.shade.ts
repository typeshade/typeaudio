"use typeshade";

export function sumSix(
  a: f32,
  b: f32,
  c: f32,
  d: f32,
  e: f32,
  f: f32,
  level: f32,
): f32 {
  return (a + b + c + d + e + f) * level;
}

export function sumEight(
  a: f32,
  b: f32,
  c: f32,
  d: f32,
  e: f32,
  f: f32,
  g: f32,
  h: f32,
  level: f32,
): f32 {
  return (a + b + c + d + e + f + g + h) * level;
}

export function mix(contact: f32, body: f32, fracture: f32): f32 {
  return contact + body + fracture;
}
