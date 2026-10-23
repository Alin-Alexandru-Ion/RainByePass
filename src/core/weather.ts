import type { Settings } from './settings';
import { forecastConsumers } from './settings';
export interface WindSample { time: number; speed: number; }
export interface ForecastCache { location: string; generated: number | null; downloaded: number; validated: number; expires: number; lastModified: string | null; samples: WindSample[]; coverageEnd: number; }
export const locationKey = (s: Settings) => `${s.solar.latitude.toFixed(4)},${s.solar.longitude.toFixed(4)}`;
export function parseForecast(body: unknown): { samples: WindSample[]; generated: number | null } {
  const b = body as { properties?: { meta?: { updated_at?: string }; timeseries?: { time?: string; data?: { instant?: { details?: { wind_speed?: number } } } }[] } };
  if (!b?.properties || !Array.isArray(b.properties.timeseries) || b.properties.timeseries.length > 3000) throw new Error('Invalid forecast timeline');
  const samples = b.properties.timeseries.map(x => ({ time: Date.parse(x.time ?? ''), speed: x.data?.instant?.details?.wind_speed })).filter((x): x is WindSample => Number.isFinite(x.time) && typeof x.speed === 'number' && Number.isFinite(x.speed) && x.speed >= 0 && x.speed <= 150).sort((a, b) => a.time - b.time);
  if (samples.length < 2 || samples.some((x, i) => i > 0 && x.time <= samples[i - 1].time)) throw new Error('Missing or duplicated wind samples');
  const generated = Date.parse(b.properties.meta?.updated_at ?? '');
  return { samples, generated: Number.isFinite(generated) ? generated : null };
}
export function validateCache(c: unknown): ForecastCache | null {
  const b = c as ForecastCache;
  if (!b || typeof b.location !== 'string' || !Array.isArray(b.samples) || b.samples.length < 2 || b.samples.length > 3000) return null;
  if (![b.downloaded, b.validated, b.expires, b.coverageEnd].every(Number.isFinite)) return null;
  if (b.generated !== null && !Number.isFinite(b.generated)) return null;
  if (b.lastModified !== null && typeof b.lastModified !== 'string') return null;
  if (b.samples.some((x, i) => !Number.isFinite(x.time) || !Number.isFinite(x.speed) || x.speed < 0 || x.speed > 150 || (i > 0 && x.time <= b.samples[i - 1].time))) return null;
  if (b.coverageEnd !== b.samples.at(-1)!.time) return null; return b;
}
export function windAt(cache: ForecastCache | null, now: number, key: string): number | null {
  if (!cache || cache.location !== key || now < cache.samples[0].time || now > cache.coverageEnd) return null;
  const i = cache.samples.findIndex(x => x.time >= now); if (i < 0) return null; if (i === 0) return cache.samples[0].speed;
  const a = cache.samples[i - 1], b = cache.samples[i]; if (b.time - a.time > 6 * 3600000) return null;
  return a.speed + (b.speed - a.speed) * (now - a.time) / (b.time - a.time);
}
export function contactValid(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && !/(^|\.)(example\.(com|org|net)|localhost|invalid|test)$/.test(u.hostname); } catch { return false; }
}
export function refreshDue(s: Settings, cache: ForecastCache | null, now: number, retryAt = 0): boolean {
  if (!s.weather.networkOptIn || !contactValid(s.weather.projectContactUrl) || !forecastConsumers(s) || now < retryAt) return false;
  if (!cache || cache.location !== locationKey(s)) return true;
  return now >= cache.expires && now >= cache.validated + s.weather.preferredRefreshDays * 86400000;
}
export function apply304(cache: ForecastCache, now: number, expires: number): ForecastCache { return { ...cache, validated: now, expires }; }
