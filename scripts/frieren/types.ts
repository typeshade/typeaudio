export type Curve = [number, number][];
export type Position = [number, number, number];
export interface Layer {
  id: string;
  event: string;
  family: string;
  role: string;
  bus: string;
  start: number;
  duration: number;
  pitch: number;
  decay: number;
  character: number;
  seed: number;
  gainDb: number;
  gain: Curve;
  position: [number, ...Position][];
  spread: number;
  roomSend: number;
  timing: string;
}
export interface Study {
  id: string;
  title: string;
  range: [number, number];
  tailSeconds: number;
  variants: { id: string; label: string; changes: Record<string, Partial<Pick<Layer, 'character' | 'decay'>>> }[];
  layers: Layer[];
}
