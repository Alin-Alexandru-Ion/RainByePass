/** Delay a single tap so a double tap has exactly one outcome, rather than briefly toggling the overlay. */
export class ViewerGestures {
  private pending: ReturnType<typeof setTimeout> | null = null;
  private previous: { time: number; x: number; y: number; kind: string } | null = null;
  constructor(private single: () => void, private double: () => void, private delay = 400,
    private schedule = (fn: () => void, ms: number) => setTimeout(fn, ms), private unschedule = (id: ReturnType<typeof setTimeout>) => clearTimeout(id)) {}
  tap(time: number, x: number, y: number, kind = 'mouse') {
    const p = this.previous;
    if (p && time >= p.time && time - p.time <= this.delay && Math.hypot(x - p.x, y - p.y) <= 24 && p.kind === kind) { this.cancel(); this.double(); return; }
    // A second tap elsewhere commits the previous single, then starts a new gesture.
    if (this.pending !== null) { this.cancel(); this.single(); }
    this.previous = { time, x, y, kind };
    this.pending = this.schedule(() => { this.pending = null; this.previous = null; this.single(); }, this.delay);
  }
  cancel() { if (this.pending !== null) this.unschedule(this.pending); this.pending = null; this.previous = null; }
}
