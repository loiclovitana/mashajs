import type { AnimationId } from './sprites.js';

export type Personality = 'chaser' | 'wanderer';

export interface CatConfig {
  name?: string;
  /** A built-in sprite name, a URL string, or a URL relative to your own module. */
  sprite?: string | URL;
  personality?: Personality;
  /** Movement speed in CSS pixels per second. */
  speed?: number;
}

export interface CatsOptions {
  parent?: HTMLElement;
  cats?: readonly CatConfig[];
  size?: number;
  minWidth?: number;
  zIndex?: number;
  onError?: (error: Error) => void;
}

export interface CatState {
  name: string;
  personality: Personality;
  x: number;
  y: number;
  animation: AnimationId;
  frame: number;
}

export interface CatsState {
  active: boolean;
  loaded: boolean;
  error: string | null;
  cats: CatState[];
}

export interface CatsController {
  /** Resolves after every sprite has decoded; rejects on loading failure. */
  readonly ready: Promise<void>;
  pause(): void;
  resume(): void;
  /** Idempotent; releases DOM, event listeners, and the animation loop. */
  destroy(): void;
  getState(): CatsState;
}
