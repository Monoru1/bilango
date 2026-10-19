export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };
export const iso = (ms: number): string => new Date(ms).toISOString();

/** Horloge manipulable pour les tests. */
export class FakeClock implements Clock {
  constructor(private t: number) {}
  now(): number {
    return this.t;
  }
  set(t: number): void {
    this.t = t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}
