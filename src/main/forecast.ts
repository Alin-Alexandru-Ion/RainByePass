import { request } from 'node:https';
import { unlink } from 'node:fs/promises';
import { type ForecastCache, parseForecast, locationKey, refreshDue, validateCache, apply304 } from '../core/weather';
import { forecastConsumers, type Settings } from '../core/settings';
import { atomicJson, readJson } from './storage';
export interface ForecastStatus { cache: ForecastCache | null; message: string; retryAt: number; }
export function fetchMet(s: Settings, cache: ForecastCache | null, signal: AbortSignal): Promise<{ status: number; body: string; expires: number; lastModified: string | null; retryAfter: number; noStore: boolean }> {
  const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact');
  url.searchParams.set('lat', s.solar.latitude.toFixed(4)); url.searchParams.set('lon', s.solar.longitude.toFixed(4));
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { 'User-Agent': `RainByePass/0.1.0 (${s.weather.projectContactUrl})`, Accept: 'application/json' };
    if (cache?.location === locationKey(s) && cache.lastModified) headers['If-Modified-Since'] = cache.lastModified;
    const req = request(url, { headers, signal }, response => {
      let bytes = 0; const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 2_000_000) req.destroy(new Error('Forecast exceeds 2 MB limit')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => {
        const now = Date.now(), expire = Date.parse(String(response.headers.expires ?? ''));
        const retry = response.headers['retry-after'];
        const maxAge = /max-age=(\d+)/i.exec(String(response.headers['cache-control'] ?? ''));
        const expires = Math.max(now, Number.isFinite(expire) ? expire : now + (maxAge ? +maxAge[1] : 3600) * 1000);
        resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), expires, lastModified: typeof response.headers['last-modified'] === 'string' ? response.headers['last-modified'] : null,
          retryAfter: retry ? (/^\d+$/.test(retry) ? now + +retry * 1000 : Date.parse(retry)) : 0, noStore: /no-store/i.test(String(response.headers['cache-control'] ?? '')) });
      });
    });
    // Absolute wall-clock timeout, even if a slow server keeps trickling bytes.
    const timeout = setTimeout(() => req.destroy(new Error('Forecast timed out after 15 seconds')), 15000);
    req.on('close', () => clearTimeout(timeout)); req.on('error', reject); req.end();
  });
}
export class ForecastService {
  state: ForecastStatus = { cache: null, message: 'Offline motion. Forecast access is optional.', retryAt: 0 };
  private controller: AbortController | null = null; private failures = 0; private requestKey = '';
  constructor(private file: string, private notify: (s: ForecastStatus) => void, private fetcher = fetchMet, private clock = () => Date.now()) {}
  async load() {
    try { this.state.cache = validateCache(await readJson(this.file)); } catch { /* Cache is optional. */ }
    try { const meta = await readJson(`${this.file}.backoff`, 4096) as { retryAt?: number }; if (typeof meta.retryAt === 'number' && Number.isFinite(meta.retryAt)) this.state.retryAt = meta.retryAt; } catch { /* Backoff file is optional. */ }
  }
  async update(s: Settings) {
    const key = locationKey(s);
    if (!s.weather.networkOptIn || !forecastConsumers(s) || (this.controller && key !== this.requestKey)) { this.controller?.abort(); }
    if (!refreshDue(s, this.state.cache, this.clock(), this.state.retryAt)) { this.notify(this.state); return; }
    if (this.controller) return;
    this.controller = new AbortController(); this.requestKey = key;
    const controller = this.controller; this.state.message = 'Downloading one shared wind timeline…'; this.notify(this.state);
    try {
      const result = await this.fetcher(s, this.state.cache, controller.signal); if (controller.signal.aborted) return;
      const now = this.clock();
      if (result.status === 304 && this.state.cache?.location === key) this.state.cache = apply304(this.state.cache, now, result.expires);
      else if (result.status === 200) {
        const parsed = parseForecast(JSON.parse(result.body));
        this.state.cache = { ...parsed, location: key, downloaded: now, validated: now, expires: result.expires, lastModified: result.lastModified, coverageEnd: parsed.samples.at(-1)!.time };
      } else {
        this.state.retryAt = Math.max(this.state.retryAt, Number.isFinite(result.retryAfter) ? result.retryAfter : 0, result.expires);
        throw new Error(`Forecast HTTP ${result.status}`);
      }
      this.failures = 0; this.state.retryAt = 0; this.state.message = 'Cached forecast; only wind influences gentle motion.';
      if (!result.noStore) await atomicJson(this.file, this.state.cache);
      else await unlink(this.file).catch(() => {});
      await atomicJson(`${this.file}.backoff`, { retryAt: 0 });
    } catch (error) {
      if (!controller.signal.aborted) { this.failures++; this.state.retryAt = Math.max(this.state.retryAt, this.clock() + Math.min(86400000, 900000 * 2 ** Math.min(this.failures - 1, 7))); this.state.message = `${(error as Error).message}. Covered cache or manual settings remain available.`; await atomicJson(`${this.file}.backoff`, { retryAt: this.state.retryAt }).catch(() => {}); }
    } finally { if (this.controller === controller) this.controller = null; this.notify(this.state); }
  }
  stop() { this.controller?.abort(); }
}
