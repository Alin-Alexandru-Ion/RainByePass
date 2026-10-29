import { clamp, mix } from './solar';
import type { Settings } from './settings';
export function random(seed: number) { let v = seed >>> 0; return () => { v += 0x6D2B79F5; let t = Math.imul(v ^ v >>> 15, 1 | v); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export interface Motion { cloudSpeed: number; frequency: number; amplitude: number; cloudSource: string; treeSource: string; }
export function motionTargets(s: Settings, wind: number | null): Motion {
  const valid = wind !== null && Number.isFinite(wind) && wind >= 0;
  const c = s.clouds, t = s.tree;
  const useC = c.useForecastWind && valid, useT = t.useForecastWind && valid;
  return { cloudSpeed: c.manualSpeedMultiplier === 0 ? 0 : useC ? clamp((.35 + wind! / 8) * 3, 0, c.maximumMotionMultiplier) : c.manualSpeedMultiplier,
    frequency: t.manualFrequencyMultiplier === 0 ? 0 : useT ? clamp((.5 + wind! / 15) * 3, 0, t.maximumMotionMultiplier) : t.manualFrequencyMultiplier,
    amplitude: t.manualAmplitudeMultiplier === 0 ? 0 : useT ? clamp(.4 + wind! / 10, 0, t.maximumMotionMultiplier) : t.manualAmplitudeMultiplier,
    cloudSource: useC ? 'Cached forecast' : 'Manual', treeSource: useT ? 'Cached forecast' : 'Manual' };
}
export class MotionClock {
  cloud = 0; tree = 0; cloudDistance = 0;
  effective: Motion = { cloudSpeed: 1, frequency: 1, amplitude: 1, cloudSource: 'Manual', treeSource: 'Manual' };
  step(dt: number, s: Settings, wind: number | null) {
    dt = clamp(dt, 0, .1); const target = motionTargets(s, wind), a = 1 - Math.exp(-dt / 3);
    const cloudActive = s.layers.clouds && s.clouds.coverage > 0 && s.clouds.movementEnabled && target.cloudSpeed > 0;
    const treeActive = s.layers.tree && s.tree.swayEnabled && target.frequency > 0 && target.amplitude > 0;
    // Freeze smoothed pose parameters too: forecast changes while stopped must not cause a pose jump on thaw.
    if (cloudActive) this.effective.cloudSpeed = target.cloudSource === 'Cached forecast' ? Math.min(s.clouds.maximumMotionMultiplier, mix(this.effective.cloudSpeed, target.cloudSpeed, a)) : mix(this.effective.cloudSpeed, target.cloudSpeed, a);
    if (treeActive) {
      this.effective.frequency = target.treeSource === 'Cached forecast' ? Math.min(s.tree.maximumMotionMultiplier, mix(this.effective.frequency, target.frequency, a)) : mix(this.effective.frequency, target.frequency, a);
      this.effective.amplitude = target.treeSource === 'Cached forecast' ? Math.min(s.tree.maximumMotionMultiplier, mix(this.effective.amplitude, target.amplitude, a)) : mix(this.effective.amplitude, target.amplitude, a);
    }
    this.effective.cloudSource = target.cloudSource; this.effective.treeSource = target.treeSource;
    if (cloudActive) { this.cloud += dt; this.cloudDistance += dt * this.effective.cloudSpeed; }
    if (treeActive) this.tree += dt * this.effective.frequency;
  }
}
export class SelectionBag {
  private bag: number[] = []; private recent: number[] = [];
  constructor(private size: number, private rng: () => number, private exclusion = Math.min(5, size - 1)) {}
  next() {
    if (!this.bag.length) { this.bag = Array.from({ length: this.size }, (_, i) => i); for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; } }
    let index = this.bag.findIndex(v => !this.recent.includes(v));
    if (index < 0) { const all = Array.from({ length: this.size }, (_, i) => i).filter(v => !this.recent.includes(v)); const v = all[Math.floor(this.rng() * all.length)]; this.bag = this.bag.filter(x => x !== v); this.recent.push(v); this.recent = this.recent.slice(-this.exclusion); return v; }
    const [v] = this.bag.splice(index, 1); this.recent.push(v); this.recent = this.recent.slice(-this.exclusion); return v;
  }
}
