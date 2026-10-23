export const layerNames = ['sky', 'stars', 'sun', 'moon', 'clouds', 'tree', 'outlook', 'windowFrame', 'lightRays'] as const;
export type Layer = typeof layerNames[number];
export type Mood = 'morning' | 'day' | 'evening' | 'night';
export const outlookStyles = ['city', 'field', 'meadow', 'mountains', 'american-mountains', 'arabian-desert', 'irish-lake', 'japanese-ocean', 'latin-badlands'] as const;
export type OutlookStyle = typeof outlookStyles[number];
export interface Settings {
  schemaVersion: 2;
  solar: { automatic: boolean; manualMood: Mood; timeZone: string; latitude: number; longitude: number; label: string; reference: string; needsLocationSetup: boolean };
  layers: Record<Layer, boolean>;
  clouds: { movementEnabled: boolean; useForecastWind: boolean; manualSpeedMultiplier: number; coverage: number; maximumMotionMultiplier: number; seed: number };
  tree: { swayEnabled: boolean; useForecastWind: boolean; manualFrequencyMultiplier: number; manualAmplitudeMultiplier: number; maximumMotionMultiplier: number; anchor: 'upper-right' | 'upper-left'; seed: number };
  appearance: { frameStyle: 'warm-wood' | 'white-wood' | 'dark-metal' | 'minimal'; crossbars: 'none' | 'single' | 'classic'; outlookStyle: OutlookStyle; horizonFraction: number; brightness: number; sunGlowIntensity: number; rayIntensity: number; starTwinkleEnabled: boolean; starTwinkleSpeedMultiplier: number };
  weather: { networkOptIn: boolean; projectContactUrl: string; preferredRefreshDays: number };
  rendering: { quality: 'low' | 'balanced' | 'high'; frameRateLimit: 15 | 30 | 60 };
  ui: { viewerMode: 'borderless' | 'fullscreen'; displayId: number | null };
}
export const defaults: Settings = {
  schemaVersion: 2,
  solar: { automatic: true, manualMood: 'day', timeZone: 'Europe/Berlin', latitude: 53.55, longitude: 10, label: 'Hamburg area (approximate)', reference: 'Bundled Hamburg regional preset; confirm or override coordinates.', needsLocationSetup: true },
  layers: Object.fromEntries(layerNames.map(x => [x, x !== 'lightRays'])) as Record<Layer, boolean>,
  clouds: { movementEnabled: true, useForecastWind: false, manualSpeedMultiplier: 1, coverage: .3, maximumMotionMultiplier: 2, seed: 1401 },
  tree: { swayEnabled: true, useForecastWind: false, manualFrequencyMultiplier: 1, manualAmplitudeMultiplier: 1, maximumMotionMultiplier: 2, anchor: 'upper-right', seed: 1402 },
  appearance: { frameStyle: 'warm-wood', crossbars: 'classic', outlookStyle: 'meadow', horizonFraction: .68, brightness: 1, sunGlowIntensity: .5, rayIntensity: .15, starTwinkleEnabled: false, starTwinkleSpeedMultiplier: 1 },
  weather: { networkOptIn: false, projectContactUrl: '', preferredRefreshDays: 7 },
  rendering: { quality: 'low', frameRateLimit: 15 },
  ui: { viewerMode: 'borderless', displayId: null }
};
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function validZone(zone: string): boolean { try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; } catch { return false; } }
/** Whitelist fields, preserve valid values; never spread an untrusted stored object. */
export function validateSettings(input: unknown): Settings {
  const raw = object(input), result = structuredClone(defaults);
  // v0 used latitude/longitude at the root. Migrate only those known fields.
  if (raw.schemaVersion === 0 && !raw.solar) raw.solar = { latitude: raw.latitude, longitude: raw.longitude };
  // The new resource policy replaces v1's 60-fps/high-pixel-budget defaults, without changing scene preferences.
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion < 2) {
    raw.rendering = { ...object(raw.rendering), quality: 'low', frameRateLimit: 15 };
    raw.ui = { ...object(raw.ui), viewerMode: object(raw.ui).fullScreenOnLaunch === true ? 'fullscreen' : object(raw.ui).viewerMode ?? 'borderless' };
  }
  for (const group of Object.keys(result) as (keyof Settings)[]) {
    if (group === 'schemaVersion') continue;
    const values = object(raw[group]), target = result[group] as unknown as Record<string, unknown>;
    for (const key of Object.keys(target)) {
      if (typeof target[key] === 'boolean' && typeof values[key] === 'boolean') target[key] = values[key];
      if (typeof target[key] === 'number' && typeof values[key] === 'number' && Number.isFinite(values[key])) target[key] = values[key];
      if (typeof target[key] === 'string' && typeof values[key] === 'string' && (values[key] as string).length <= 300) target[key] = values[key];
    }
  }
  const pick = <T extends string>(v: T, values: readonly T[], fallback: T): T => values.includes(v) ? v : fallback;
  result.solar.manualMood = pick(result.solar.manualMood, ['morning', 'day', 'evening', 'night'], 'day');
  if (!validZone(result.solar.timeZone)) result.solar.timeZone = defaults.solar.timeZone;
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  result.solar.latitude = clamp(result.solar.latitude, -90, 90); result.solar.longitude = clamp(result.solar.longitude, -180, 180);
  result.clouds.manualSpeedMultiplier = clamp(result.clouds.manualSpeedMultiplier, 0, 3);
  result.clouds.coverage = clamp(result.clouds.coverage, 0, .7);
  result.clouds.maximumMotionMultiplier = clamp(result.clouds.maximumMotionMultiplier, .1, 3);
  result.tree.manualFrequencyMultiplier = clamp(result.tree.manualFrequencyMultiplier, 0, 3);
  result.tree.manualAmplitudeMultiplier = clamp(result.tree.manualAmplitudeMultiplier, 0, 3);
  result.tree.maximumMotionMultiplier = clamp(result.tree.maximumMotionMultiplier, .1, 3);
  result.tree.anchor = pick(result.tree.anchor, ['upper-right', 'upper-left'], 'upper-right');
  for (const g of [result.clouds, result.tree]) g.seed = Math.abs(Math.trunc(g.seed)) % 2147483647;
  result.appearance.frameStyle = pick(result.appearance.frameStyle, ['warm-wood', 'white-wood', 'dark-metal', 'minimal'], 'warm-wood');
  result.appearance.crossbars = pick(result.appearance.crossbars, ['none', 'single', 'classic'], 'classic');
  result.appearance.outlookStyle = pick(result.appearance.outlookStyle, outlookStyles, 'meadow');
  result.appearance.horizonFraction = clamp(result.appearance.horizonFraction, .45, .82);
  result.appearance.brightness = clamp(result.appearance.brightness, .35, 1.3);
  result.appearance.sunGlowIntensity = clamp(result.appearance.sunGlowIntensity, 0, 1);
  result.appearance.rayIntensity = clamp(result.appearance.rayIntensity, 0, .5);
  result.appearance.starTwinkleSpeedMultiplier = clamp(result.appearance.starTwinkleSpeedMultiplier, 0, 3);
  result.weather.preferredRefreshDays = clamp(result.weather.preferredRefreshDays, 7, 30);
  result.rendering.quality = pick(result.rendering.quality, ['low', 'balanced', 'high'], 'low');
  result.rendering.frameRateLimit = [15, 30, 60].includes(result.rendering.frameRateLimit) ? result.rendering.frameRateLimit : 15;
  result.ui.viewerMode = pick(result.ui.viewerMode, ['borderless', 'fullscreen'], 'borderless');
  const id = object(raw.ui).displayId;
  result.ui.displayId = typeof id === 'number' && Number.isSafeInteger(id) ? id : null;
  return result;
}
export function forecastConsumers(s: Settings): boolean {
  return (s.layers.clouds && s.clouds.coverage > 0 && s.clouds.movementEnabled && s.clouds.useForecastWind && s.clouds.manualSpeedMultiplier !== 0)
    || (s.layers.tree && s.tree.swayEnabled && s.tree.useForecastWind && s.tree.manualFrequencyMultiplier !== 0 && s.tree.manualAmplitudeMultiplier !== 0);
}
