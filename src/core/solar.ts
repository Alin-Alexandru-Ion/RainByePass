import * as SunCalc from 'suncalc';
import type { Settings } from './settings';
export const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export type RGB = [number, number, number];
export const colorMix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => mix(v, b[i], t)) as RGB;
export const cssColor = (c: RGB, alpha = 1) => `rgba(${c.map(Math.round).join(',')},${alpha})`;
export function zoneOffset(date: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}
export function localDateKey(date: Date, zone: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const v = Object.fromEntries(p.map(x => [x.type, x.value])); return `${v.year}-${v.month}-${v.day}`;
}
export function schedule(date: Date, s: Settings['solar']) {
  return SunCalc.getTimes(date, s.latitude, s.longitude, 0, zoneOffset(date, s.timeZone));
}
export interface SolarState { top: RGB; horizon: RGB; cloud: RGB; daylight: number; stars: number; progress: number; sunVisible: boolean; moonProgress: number; moonVisible: boolean; altitude: number; phase: string; polar: string; }
const entryDuration = 45 * 60000;
/** -1 starts below the viewport; 0/1 are rise/set; .5 is transit; 2 finishes below the viewport. */
export function timedTravel(now: number, rise: number, transit: number, set: number) {
  if (now < rise) return -clamp((rise - now) / entryDuration);
  if (now > set) return 1 + clamp((now - set) / entryDuration);
  return now <= transit ? .5 * clamp((now - rise) / (transit - rise)) : .5 + .5 * clamp((now - transit) / (set - transit));
}
export function palette(altitude: number, ascending: boolean): Pick<SolarState, 'top' | 'horizon' | 'cloud' | 'daylight' | 'stars' | 'phase'> {
  const day = clamp((altitude + 8) / 24), warm = clamp(1 - Math.abs(altitude - 1) / 13);
  const top = colorMix([14, 28, 60], [101, 168, 205], day);
  const horizon = colorMix(colorMix([39, 51, 83], [220, 235, 220], day), ascending ? [242, 193, 150] : [245, 178, 127], warm * .8);
  const cloud = colorMix(colorMix([64, 78, 111], [250, 248, 233], day), [251, 215, 174], warm * .55);
  return { top, horizon, cloud, daylight: day, stars: clamp((-altitude - 3) / 12), phase: altitude < -12 ? 'Night' : altitude < -3 ? 'Twilight' : altitude < 10 ? ascending ? 'Morning' : 'Evening' : 'Day' };
}
export class SolarEngine {
  private key = ''; private times!: ReturnType<typeof schedule>; private intervals: ReturnType<typeof schedule>[] = [];
  state(now: Date, s: Settings): SolarState {
    if (!s.solar.automatic) {
      const states = { morning: [3, .11], day: [38, .5], evening: [3, .89], night: [-20, .5] };
      const [altitude, progress] = states[s.solar.manualMood];
      return { ...palette(altitude, s.solar.manualMood === 'morning'), progress, sunVisible: s.solar.manualMood !== 'night', moonProgress: .5, moonVisible: s.solar.manualMood === 'night', altitude, phase: s.solar.manualMood[0].toUpperCase() + s.solar.manualMood.slice(1), polar: '' };
    }
    const loc = s.solar, key = `${localDateKey(now, loc.timeZone)}:${loc.timeZone}:${loc.latitude}:${loc.longitude}:${zoneOffset(now, loc.timeZone)}`;
    if (key !== this.key) { this.times = schedule(now, loc); this.intervals = [this.times, schedule(new Date(now.getTime() - 86400000), loc), schedule(new Date(now.getTime() + 86400000), loc)]; this.key = key; }
    const altitude = SunCalc.getPosition(now, loc.latitude, loc.longitude).altitude;
    const ascending = SunCalc.getPosition(new Date(now.getTime() + 60000), loc.latitude, loc.longitude).altitude >= altitude;
    let progress = .5, sunVisible = altitude > -.833, moonProgress = .5, moonVisible = altitude < 0, polar = '';
    const { sunrise, sunset, solarNoon } = this.times;
    if (sunrise && sunset && solarNoon) {
      // Adjacent intervals are needed at date-line midnight and when midnight lies within a solar day.
      const relevant = this.intervals.find(t => t.sunrise && t.sunset && +now >= +t.sunrise - entryDuration && +now <= +t.sunset + entryDuration) ?? this.times;
      if (relevant.sunrise && relevant.sunset && relevant.solarNoon) {
        progress = timedTravel(+now, +relevant.sunrise, +relevant.solarNoon, +relevant.sunset);
        sunVisible = +now >= +relevant.sunrise - entryDuration && +now <= +relevant.sunset + entryDuration;
      }
      // Artistic moon uses the real sunset -> next sunrise interval, not a physical lunar projection.
      const sunsets = this.intervals.map(t => t.sunset).filter((d): d is Date => !!d).sort((a,b) => +a - +b);
      const sunrises = this.intervals.map(t => t.sunrise).filter((d): d is Date => !!d).sort((a,b) => +a - +b);
      moonVisible = false;
      for (const start of sunsets) {
        const end = sunrises.find(d => +d > +start);
        if (end && +now >= +start - entryDuration && +now <= +end + entryDuration) { moonProgress = timedTravel(+now, +start, (+start + +end) / 2, +end); moonVisible = true; break; }
      }
    } else { polar = this.times.alwaysUp ? 'Polar day' : this.times.alwaysDown ? 'Polar night' : 'No rise/set event'; progress = .5; }
    return { ...palette(altitude, ascending), progress, sunVisible, moonProgress, moonVisible, altitude, polar, phase: polar || palette(altitude, ascending).phase };
  }
  events(now: Date, s: Settings) { return schedule(now, s.solar); }
}
export function sunGeometry(w: number, h: number, horizon: number, progress: number, altitude = 30) {
  const unit = Math.min(w, h), p = clamp(progress), arc = Math.sin(Math.PI * p);
  const radius = unit * (.018 + .027 * arc), glow = radius * 4;
  const margin = unit * (.045 * 4 + .022);
  const x = mix(w - margin, margin, p); // The user's latest art direction: east/right to west/left.
  const peak = h * .24, endpoint = h + unit * .19;
  const y = endpoint - arc * (endpoint - peak);
  return { x, y, radius, glow };
}
/** Map real rise/noon/set to the horizon crossing of the viewport-scaled artistic arch. */
export function travelOnArch(w: number, h: number, horizon: number, travel: number): number {
  const u = Math.min(w,h), end = h + u * .19, peak = h * .24;
  const entry = Math.asin(clamp((end - (h * horizon + u * .031)) / (end - peak))) / Math.PI;
  if (travel < 0) return entry * clamp(1 + travel);
  if (travel > 1) return 1 - entry + entry * clamp(travel - 1);
  return travel <= .5 ? mix(entry, .5, travel * 2) : mix(.5, 1 - entry, (travel - .5) * 2);
}
