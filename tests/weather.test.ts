import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import { defaults } from '../src/core/settings';
import { parseForecast, windAt, locationKey, refreshDue, validateCache, apply304, contactValid, type ForecastCache } from '../src/core/weather';
import { ForecastService, type fetchMet } from '../src/main/forecast';
const day=86400000, base=Date.parse('2026-10-14T12:00Z');
function fixture(){return {properties:{meta:{updated_at:new Date(base-3600000).toISOString()},timeseries:Array.from({length:217},(_,i)=>({time:new Date(base+i*3600000).toISOString(),data:{instant:{details:{wind_speed:4+i%3,precipitation_amount:20,cloud_area_fraction:100}}}}))}};}
function settings(){const s=structuredClone(defaults);s.weather.networkOptIn=true;s.clouds.useForecastWind=true;
  // Test-only identification for the injected fake transport. Never used to query MET.
  s.weather.projectContactUrl='https://docs.api.met.no/';return s;}
function cache():ForecastCache{const f=parseForecast(fixture());return {...f,location:locationKey(settings()),downloaded:base,validated:base,expires:base+3600000,lastModified:new Date(base-3600000).toUTCString(),coverageEnd:f.samples.at(-1)!.time};}
test('forecast parser only uses wind, validates malformed/excessive timelines',()=>{const f=parseForecast(fixture());assert.equal(f.samples.length,217);assert.deepEqual(f.samples[0],{time:base,speed:4});assert.throws(()=>parseForecast({}));const b=fixture();b.properties.timeseries[0].data.instant.details.wind_speed=NaN;assert.equal(parseForecast(b).samples.length,216);b.properties.timeseries=Array(3001).fill(b.properties.timeseries[1]);assert.throws(()=>parseForecast(b));});
test('interpolation refuses invalid, exhausted, wrong-location and gapped data',()=>{const c=cache(),key=c.location;assert.equal(windAt(c,base+1800000,key),4.5);assert.equal(windAt(c,base-day,key),null);assert.equal(windAt(c,base+10*day,key),null);assert.equal(windAt(c,base,'0,0'),null);assert.equal(windAt(null,base,key),null);const broken={...c,samples:[{time:base,speed:1},{time:base+8*3600000,speed:3}]};assert.equal(windAt(broken,base+3600000,key),null);});
test('cache schema rejects corrupt time ordering and fabricated coverage end',()=>{assert.ok(validateCache(cache()));assert.equal(validateCache({...cache(),coverageEnd:base}),null);const b=cache();b.samples[2].time=b.samples[1].time;assert.equal(validateCache(b),null);});
test('weekly refresh gated by opt-in, identification, consumers, cache freshness and backoff',()=>{const s=settings(),c=cache();assert.equal(refreshDue(s,c,base+day),false);assert.equal(refreshDue(s,c,base+7*day),true);assert.equal(refreshDue(s,c,base+7*day,base+8*day),false);c.expires=base+9*day;assert.equal(refreshDue(s,c,base+7*day),false);s.weather.networkOptIn=false;assert.equal(refreshDue(s,null,base),false);s.weather.networkOptIn=true;s.weather.projectContactUrl='https://example.com';assert.equal(refreshDue(s,null,base),false);s.weather.projectContactUrl='https://docs.api.met.no/';s.layers.clouds=false;assert.equal(refreshDue(s,null,base),false);});
test('contact identity rejects examples, unsafe protocols, credentials',()=>{for(const value of ['','http://contact.org','https://example.org','https://user:pass@contact.org','https://localhost'])assert.equal(contactValid(value),false);assert.equal(contactValid('https://docs.api.met.no/'),true);});
test('304 keeps generation, download timestamp, original samples and coverage',()=>{const c=cache(),b=apply304(c,base+7*day,base+7*day+3600000);assert.equal(b.samples,c.samples);assert.equal(b.generated,c.generated);assert.equal(b.downloaded,c.downloaded);assert.equal(b.coverageEnd,c.coverageEnd);assert.equal(b.validated,base+7*day);});
test('fake transport: single shared fetch, restart cache, seven-day 304, exhausted fallback',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rain-test-'));try{
    let now=base,calls=0;const fake:typeof fetchMet=async()=>{calls++;return {status:calls===1?200:304,body:JSON.stringify(fixture()),expires:now+3600000,lastModified:new Date(base-3600000).toUTCString(),retryAfter:0,noStore:false};};
    const file=path.join(dir,'cache.json'),s=settings();s.tree.useForecastWind=true;const service=new ForecastService(file,()=>{},fake,()=>now);
    await Promise.all([service.update(s),service.update(s)]);assert.equal(calls,1);assert.ok(service.state.cache);assert.equal(service.state.cache!.generated,base-3600000);
    const restart=new ForecastService(file,()=>{},fake,()=>now);await restart.load();now=base+day;await restart.update(s);assert.equal(calls,1);
    now=base+7*day;await restart.update(s);assert.equal(calls,2);assert.equal(restart.state.cache!.downloaded,base);assert.equal(restart.state.cache!.coverageEnd,base+9*day);
    now=base+10*day;assert.equal(windAt(restart.state.cache,now,locationKey(s)),null);assert.ok(JSON.parse(await readFile(file,'utf8')).samples.length);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('fake transport: outage and throttling preserve covered data and retry-after',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rain-test-'));try{
    let now=base+7*day,calls=0;const fake:typeof fetchMet=async()=>{calls++;return {status:429,body:'',expires:now+3600000,lastModified:null,retryAfter:now+2*day,noStore:false};};
    const service=new ForecastService(path.join(dir,'cache.json'),()=>{},fake,()=>now);service.state.cache=cache();await service.update(settings());assert.equal(calls,1);assert.equal(service.state.cache!.downloaded,base);assert.equal(service.state.retryAt,now+2*day);assert.ok(windAt(service.state.cache,now,locationKey(settings()))!==null);await service.update(settings());assert.equal(calls,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('fake transport: turning off final effective consumer cancels in-flight download',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rain-test-'));try{
    let aborted=false;const fake:typeof fetchMet=async(_s,_c,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));}));
    const service=new ForecastService(path.join(dir,'cache.json'),()=>{},fake,()=>base),s=settings();const pending=service.update(s);s.layers.clouds=false;await service.update(s);await pending;assert.equal(aborted,true);assert.equal(service.state.retryAt,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('fake transport: throttling backoff survives restart',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rain-test-'));try{
    let calls=0;const fake:typeof fetchMet=async()=>{calls++;return {status:429,body:'',expires:base+3600000,lastModified:null,retryAfter:base+2*day,noStore:false};};
    const file=path.join(dir,'cache.json');const a=new ForecastService(file,()=>{},fake,()=>base);await a.update(settings());assert.equal(calls,1);
    const b=new ForecastService(file,()=>{},fake,()=>base+day);await b.load();await b.update(settings());assert.equal(calls,1);assert.equal(b.state.retryAt,base+2*day);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('fake transport: Cache-Control no-store avoids a persisted forecast',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'rain-test-'));try{
    const fake:typeof fetchMet=async()=>({status:200,body:JSON.stringify(fixture()),expires:base+3600000,lastModified:null,retryAfter:0,noStore:true});
    const file=path.join(dir,'cache.json');const a=new ForecastService(file,()=>{},fake,()=>base);await a.update(settings());assert.ok(a.state.cache);await assert.rejects(readFile(file));
  }finally{await rm(dir,{recursive:true,force:true});}
});
