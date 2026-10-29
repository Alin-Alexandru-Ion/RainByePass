import test from 'node:test';
import assert from 'node:assert/strict';
import { DUST_CYCLE_SECONDS, DUST_GAP_SECONDS, DUST_SEGMENT_FRACTION, DUST_SWEEP_SECONDS, dustPhaseDelta, dustWindow } from '../src/core/dust';

const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} differs from ${b}`);

test('dust curl shows only a 15 percent segment sweeping from start to end',()=>{
  assert.equal(dustWindow(0),null);
  assert.equal(dustWindow(DUST_GAP_SECONDS-.001),null);
  const first=dustWindow(DUST_GAP_SECONDS)!;near(first[0],0);near(first[1],DUST_SEGMENT_FRACTION);
  const middle=dustWindow(DUST_GAP_SECONDS+DUST_SWEEP_SECONDS/2)!;near(middle[0],.425);near(middle[1],.575);
  const last=dustWindow(DUST_CYCLE_SECONDS-.000001)!;near(last[0],.85);near(last[1],1);
  assert.equal(dustWindow(DUST_CYCLE_SECONDS),null);
});

test('speed midpoint sweeps in 1.5 seconds; min and max scale time',()=>{
  near(dustPhaseDelta(DUST_SWEEP_SECONDS,3),DUST_SWEEP_SECONDS);
  near(dustPhaseDelta(DUST_SWEEP_SECONDS*2,1.5),DUST_SWEEP_SECONDS);
  near(dustPhaseDelta(DUST_SWEEP_SECONDS/2,6),DUST_SWEEP_SECONDS);
  near(dustPhaseDelta(.1,0),0);
});
