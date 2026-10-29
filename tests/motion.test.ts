import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, forecastConsumers } from '../src/core/settings';
import { MotionClock, motionTargets, SelectionBag, random } from '../src/core/motion';
for (let bits=0;bits<16;bits++) for (const wind of [null, -1, Number.NaN, 12]) test(`independent motion combination ${bits.toString(2).padStart(4,'0')}, wind ${wind}`, () => {
  const s=structuredClone(defaults); s.clouds.movementEnabled=!!(bits&1); s.clouds.useForecastWind=!!(bits&2); s.tree.swayEnabled=!!(bits&4); s.tree.useForecastWind=!!(bits&8);
  s.clouds.manualSpeedMultiplier=2.4; s.tree.manualFrequencyMultiplier=2.7; s.tree.manualAmplitudeMultiplier=.8;
  const c=new MotionClock(), before=structuredClone(s); for(let i=0;i<100;i++)c.step(.1,s,wind);
  assert.equal(c.cloud>0,s.clouds.movementEnabled); assert.equal(c.tree>0,s.tree.swayEnabled); assert.deepEqual(s,before);
  const target=motionTargets(s,wind), valid=wind===12;
  assert.equal(target.cloudSource,valid&&s.clouds.useForecastWind?'Cached forecast':'Manual'); assert.equal(target.treeSource,valid&&s.tree.useForecastWind?'Cached forecast':'Manual');
  if (!s.clouds.useForecastWind||!valid) assert.equal(target.cloudSpeed,2.4);
  if (!s.tree.useForecastWind||!valid) { assert.equal(target.frequency,2.7); assert.equal(target.amplitude,.8); }
  for(const hidden of ['clouds','tree'] as const) { const local=structuredClone(s); local.layers[hidden]=false; const clock=new MotionClock(); clock.step(.1,local,wind); assert.equal(hidden==='clouds'?clock.cloud:clock.tree,0); }
});
test('pause and hidden clocks never accumulate motion; resume delta bounded', () => {
  const s=structuredClone(defaults), c=new MotionClock(); c.step(.1,s,null); const first=[c.cloud,c.tree]; s.clouds.movementEnabled=false; s.tree.swayEnabled=false; c.step(86400,s,30); assert.deepEqual([c.cloud,c.tree],first);
  s.clouds.movementEnabled=true; s.tree.swayEnabled=true; c.step(86400,s,30); assert.ok(c.cloud-first[0]<=.101); assert.ok(c.tree-first[1]<=.201);
});
test('zero manual speed/frequency/amplitude creates a still component with forecast enabled', () => {
  const s=structuredClone(defaults); s.clouds.manualSpeedMultiplier=0; s.clouds.useForecastWind=true; s.tree.manualAmplitudeMultiplier=0; s.tree.useForecastWind=true;
  const c=new MotionClock(); c.step(.1,s,100); assert.equal(c.cloud,0); assert.equal(c.tree,0);
});
test('extreme wind respects forecast clamps and source changes are smooth', () => {
  const s=structuredClone(defaults); s.clouds.useForecastWind=true;s.tree.useForecastWind=true; const c=new MotionClock();c.step(.1,s,150);
  assert.ok(c.effective.cloudSpeed>1.1&&c.effective.cloudSpeed<1.2); for(let i=0;i<500;i++)c.step(.1,s,150); assert.ok(c.effective.cloudSpeed<=6&&c.effective.amplitude<=6); s.clouds.useForecastWind=false; s.clouds.manualSpeedMultiplier=4.5;c.step(.1,s,150);assert.ok(c.effective.cloudSpeed>4.5);
});
test('manual midpoint and maximum reach their targets independently of forecast limits', () => {
  const s=structuredClone(defaults);s.clouds.maximumMotionMultiplier=.25;s.tree.maximumMotionMultiplier=.25;
  assert.equal(motionTargets(s,null).cloudSpeed,3);assert.equal(motionTargets(s,null).frequency,3);
  s.clouds.manualSpeedMultiplier=6;s.tree.manualFrequencyMultiplier=6;
  const target=motionTargets(s,null);assert.equal(target.cloudSpeed,6);assert.equal(target.frequency,6);
  const clock=new MotionClock();for(let i=0;i<300;i++)clock.step(.1,s,null);
  assert.ok(clock.effective.cloudSpeed>5.99);assert.ok(clock.effective.frequency>5.99);
  s.clouds.movementEnabled=false;s.tree.swayEnabled=false;const frozen=[clock.cloudDistance,clock.tree];clock.step(.1,s,null);assert.deepEqual([clock.cloudDistance,clock.tree],frozen);
});
test('ordinary forecast wind uses the faster motion scale without changing sway amplitude', () => {
  const s=structuredClone(defaults);s.clouds.useForecastWind=true;s.tree.useForecastWind=true;
  const target=motionTargets(s,4);assert.ok(Math.abs(target.cloudSpeed-2.55)<1e-10);assert.ok(Math.abs(target.frequency-2.3)<1e-10);assert.equal(target.amplitude,.8);
});
test('selection bag deterministic, recent exclusion spans at least two traversal cohorts', () => {
  const a=new SelectionBag(24,random(42),18),b=new SelectionBag(24,random(42),18),history:number[]=[];
  for(let i=0;i<1000;i++){const v=a.next();assert.equal(v,b.next());assert.ok(!history.slice(-18).includes(v));history.push(v);} assert.equal(new Set(history).size,24);
});
test('network consumers respect independent visibility/movement/source settings', () => {
  const s=structuredClone(defaults);assert.equal(forecastConsumers(s),false);s.clouds.useForecastWind=true;assert.equal(forecastConsumers(s),true);s.layers.clouds=false;assert.equal(forecastConsumers(s),false);s.tree.useForecastWind=true;assert.equal(forecastConsumers(s),true);s.tree.swayEnabled=false;assert.equal(forecastConsumers(s),false);s.layers.clouds=true;s.clouds.coverage=0;assert.equal(forecastConsumers(s),false);
});
test('forecast parameter smoothing freezes with a stopped pose and thaws gently', () => {
  const s=structuredClone(defaults),clock=new MotionClock();s.clouds.useForecastWind=true;s.tree.useForecastWind=true;clock.step(.1,s,4);
  const before=structuredClone(clock.effective);s.clouds.movementEnabled=false;s.tree.swayEnabled=false;for(let i=0;i<1000;i++)clock.step(.1,s,150);
  assert.equal(clock.effective.cloudSpeed,before.cloudSpeed);assert.equal(clock.effective.frequency,before.frequency);assert.equal(clock.effective.amplitude,before.amplitude);
  s.clouds.movementEnabled=true;s.tree.swayEnabled=true;clock.step(.1,s,150);assert.ok(clock.effective.amplitude-before.amplitude<.2);assert.ok(clock.effective.cloudSpeed-before.cloudSpeed<.2);
});
test('lowered comfort limits bound effective motion immediately on active components', () => {
  const s=structuredClone(defaults),clock=new MotionClock();s.clouds.maximumMotionMultiplier=.25;s.tree.maximumMotionMultiplier=.25;s.clouds.useForecastWind=true;s.tree.useForecastWind=true;clock.step(.1,s,150);
  assert.ok(clock.effective.cloudSpeed<=.25);assert.ok(clock.effective.frequency<=.25);assert.ok(clock.effective.amplitude<=.25);
});
