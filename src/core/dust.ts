export const DUST_SEGMENT_FRACTION = .15;
export const DUST_SWEEP_SECONDS = 1.5;
export const DUST_GAP_SECONDS = .35;
export const DUST_CYCLE_SECONDS = DUST_SWEEP_SECONDS + DUST_GAP_SECONDS;

/** Phase is measured in seconds at the midpoint speed (3). */
export function dustPhaseDelta(dt: number, speed: number): number {
  return dt * speed / 3;
}

/** The visible 15% of a curl, measured along its arc length. */
export function dustWindow(phase: number, offset = 0): [number, number] | null {
  const elapsed = ((phase + offset) % DUST_CYCLE_SECONDS + DUST_CYCLE_SECONDS) % DUST_CYCLE_SECONDS;
  if (elapsed < DUST_GAP_SECONDS) return null;
  const sweep = (elapsed - DUST_GAP_SECONDS) / DUST_SWEEP_SECONDS;
  const start = (1 - DUST_SEGMENT_FRACTION) * sweep;
  return [start, start + DUST_SEGMENT_FRACTION];
}
