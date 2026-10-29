import type { Settings } from './settings';
export const pixelBudgets = { low: 921600, balanced: 2073600, high: 4194304 };
export const waterOutlooks = ['irish-lake', 'japanese-ocean'] as const;
export const dustOutlooks = ['arabian-desert', 'latin-badlands'] as const;
export function movingWater(s: Settings): boolean {
  return s.layers.outlook && s.water.movementEnabled && s.water.manualSpeedMultiplier > 0 && (waterOutlooks as readonly string[]).includes(s.appearance.outlookStyle);
}
export function movingDust(s: Settings): boolean {
  return s.layers.outlook && s.dust.movementEnabled && s.dust.manualSpeedMultiplier > 0 && (dustOutlooks as readonly string[]).includes(s.appearance.outlookStyle);
}
export function backingDensity(w: number, h: number, displayDensity: number, quality: Settings['rendering']['quality']) {
  const cap = { low: 1, balanced: 1.5, high: 2 }[quality];
  return Math.min(displayDensity, cap, Math.sqrt(pixelBudgets[quality] / Math.max(1, w * h)));
}
export function movingLayers(s: Settings, starsVisible = true): boolean {
  return (s.layers.clouds && s.clouds.coverage > 0 && s.clouds.movementEnabled && s.clouds.manualSpeedMultiplier > 0)
    || (s.layers.tree && s.tree.swayEnabled && s.tree.manualFrequencyMultiplier > 0 && s.tree.manualAmplitudeMultiplier > 0)
    || (s.layers.stars && starsVisible && s.appearance.starTwinkleEnabled && s.appearance.starTwinkleSpeedMultiplier > 0)
    || movingWater(s)
    || movingDust(s);
}
export function visibleTimeLayers(s: Settings): boolean { const l=s.layers;return l.sky||l.stars||l.sun||l.moon||(l.clouds&&s.clouds.coverage>0)||l.tree||l.outlook; }
export function framePeriod(s: Settings, blending: boolean, starsVisible=true): number | null {
  if (!visibleTimeLayers(s)) return null;
  if (movingLayers(s,starsVisible) || blending) return 1000 / s.rendering.frameRateLimit;
  return s.solar.automatic && visibleTimeLayers(s) ? 1000 : null;
}
