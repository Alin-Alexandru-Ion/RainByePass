import test from 'node:test';
import assert from 'node:assert/strict';
import * as SunCalc from 'suncalc';
import { defaults } from '../src/core/settings';
import { SolarEngine, schedule, zoneOffset, localDateKey, sunGeometry, palette, travelOnArch } from '../src/core/solar';
import { referenceForZone } from '../src/core/locations';
const s = () => structuredClone(defaults);
test('Hamburg seasonal daylight uses actual SunCalc intervals', () => {
  const winter = schedule(new Date('2026-12-21T12:00Z'), defaults.solar), summer = schedule(new Date('2026-06-21T12:00Z'), defaults.solar);
  assert.ok(winter.sunrise && winter.sunset && summer.sunrise && summer.sunset);
  const wh = (+winter.sunset - +winter.sunrise) / 3600000, sh = (+summer.sunset - +summer.sunrise) / 3600000;
  assert.ok(wh > 7 && wh < 9); assert.ok(sh > 16 && sh < 18); assert.ok(sh - wh > 8);
});
test('installed SunCalc API uses degrees and explicitly null polar events', () => {
  const altitude = SunCalc.getPosition(new Date('2026-06-21T11:20Z'), 53.55, 10).altitude;
  assert.ok(altitude > 50 && altitude < 65);
  const polar = SunCalc.getTimes(new Date('2026-06-21T12:00Z'), 80, 15, 0, 120);
  assert.equal(polar.sunrise, null); assert.equal(polar.sunset, null); assert.equal(polar.alwaysUp, true);
});
test('Berlin DST, fractional offset and date-line timezone from runtime Intl', () => {
  assert.equal(zoneOffset(new Date('2026-03-29T00:30Z'), 'Europe/Berlin'), 60);
  assert.equal(zoneOffset(new Date('2026-03-29T01:30Z'), 'Europe/Berlin'), 120);
  assert.equal(zoneOffset(new Date('2026-10-25T00:30Z'), 'Europe/Berlin'), 120);
  assert.equal(zoneOffset(new Date('2026-10-25T01:30Z'), 'Europe/Berlin'), 60);
  assert.equal(zoneOffset(new Date('2026-10-14T12:00Z'), 'Asia/Kolkata'), 330);
  assert.equal(zoneOffset(new Date('2026-10-14T12:00Z'), 'Pacific/Kiritimati'), 840);
  assert.equal(localDateKey(new Date('2026-10-14T12:00Z'), 'Pacific/Kiritimati'), '2026-10-15');
  assert.equal(localDateKey(new Date('2026-10-14T01:00Z'), 'America/Los_Angeles'), '2026-10-13');
});
test('selected-zone solar schedule independent of machine timezone', () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles'; const a = schedule(new Date('2026-06-21T00:10Z'), defaults.solar);
    process.env.TZ = 'Asia/Tokyo'; const b = schedule(new Date('2026-06-21T00:10Z'), defaults.solar);
    assert.equal(+a.sunrise!, +b.sunrise!); assert.equal(+a.sunset!, +b.sunset!);
    assert.equal(localDateKey(a.sunrise!, 'Europe/Berlin'), '2026-06-21');
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
test('sun travels east/right to west/left and finishes fully below screen', () => {
  const engine = new SolarEngine(), settings = s(), time = engine.events(new Date('2026-06-21T12:00Z'), settings);
  const a = engine.state(new Date(+time.sunrise! + 60000), settings), n = engine.state(time.solarNoon, settings), b = engine.state(new Date(+time.sunset! - 60000), settings);
  assert.ok(a.progress < n.progress && n.progress < b.progress); assert.equal(n.progress, .5);
  const start=sunGeometry(1280,720,.68,travelOnArch(1280,720,.68,a.progress)),end=sunGeometry(1280,720,.68,travelOnArch(1280,720,.68,b.progress));assert.ok(start.x>end.x);
  settings.layers.outlook = false; assert.equal(engine.state(new Date(+time.sunset! + 46*60000), settings).sunVisible, false);
  assert.ok(sunGeometry(1280, 720, .68, 0).y-sunGeometry(1280,720,.68,0).glow > 720);
});
for (const [w, h] of [[1280,720],[2560,1440],[3840,2160],[3440,1440],[720,1280],[480,360]]) test(`entire disk and glow safe horizontally ${w}x${h}`, () => {
  for (let i=0; i<=100; i++) { const g=sunGeometry(w,h,.68,i/100); assert.ok(g.x-g.glow>=0); assert.ok(g.x+g.glow<=w); assert.ok(Number.isFinite(g.y)); }
});
for (const date of ['2026-06-21T00:00Z','2026-12-21T12:00Z']) test(`polar state remains finite ${date}`, () => {
  const settings=s(); settings.solar.latitude=80; settings.solar.longitude=15; settings.solar.timeZone='Europe/Oslo';
  const state=new SolarEngine().state(new Date(date),settings); assert.ok(Number.isFinite(state.altitude)); assert.ok(Number.isFinite(state.progress)); assert.ok(state.polar); assert.equal(state.sunVisible,date.includes('06-21'));
});
test('manual moods held while real time changes; automatic resumes current instant', () => {
  const settings=s(), engine=new SolarEngine(); settings.solar.automatic=false;
  for(const mood of ['morning','day','evening','night'] as const) { settings.solar.manualMood=mood; assert.deepEqual(engine.state(new Date('2026-01-01T00:00Z'),settings),engine.state(new Date('2026-07-01T12:00Z'),settings)); }
  settings.solar.automatic=true; assert.notDeepEqual(engine.state(new Date('2026-06-21T00:00Z'),settings),engine.state(new Date('2026-06-21T11:20Z'),settings));
});
test('continuous palettes through dawn/day/dusk without hour thresholds', () => {
  for (let altitude=-20;altitude<60;altitude+=.25) { const a=palette(altitude,true), b=palette(altitude+.001,true); assert.ok(Math.max(...a.horizon.map((v,i)=>Math.abs(v-b.horizon[i])))<.03); }
});
test('zone aliases resolve reference without replacing manual geography', () => {
  const ref=referenceForZone('US/Eastern'); assert.ok(ref); assert.equal(ref.zone,'America/New_York');
  assert.ok(referenceForZone('Asia/Kolkata')); assert.equal(referenceForZone('Bad/Zone'),null);
});
test('artistic arch starts/ends completely offscreen, peaks centrally and scales largest there',()=>{for(const [w,h]of[[1280,720],[2560,1440],[720,1280]]){const a=sunGeometry(w,h,.68,0),n=sunGeometry(w,h,.68,.5),b=sunGeometry(w,h,.68,1);assert.ok(a.y-a.glow>h);assert.ok(b.y-b.glow>h);assert.equal(n.x,w/2);assert.ok(n.y<a.y&&n.y<b.y);assert.ok(n.radius>a.radius&&n.radius>b.radius);assert.ok(a.x>b.x);}});
test('moon night travel is time synced from sunset through midpoint to next sunrise',()=>{const e=new SolarEngine(),settings=s(),today=e.events(new Date('2026-10-14T12:00Z'),settings),next=e.events(new Date('2026-10-15T12:00Z'),settings);const sunset=+today.sunset!,rise=+next.sunrise!,a=e.state(new Date(sunset+60000),settings),n=e.state(new Date((sunset+rise)/2),settings),b=e.state(new Date(rise-60000),settings);assert.ok(a.moonVisible&&n.moonVisible&&b.moonVisible);assert.ok(a.moonProgress<n.moonProgress&&n.moonProgress<b.moonProgress);assert.equal(n.moonProgress,.5);assert.equal(e.state(new Date(sunset-46*60000),settings).moonVisible,false);});
