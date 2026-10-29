import { Scene } from './scene';
import { validateSettings, defaults, layerNames, validZone, forecastConsumers, type Settings } from '../core/settings';
import { presets, referenceForZone } from '../core/locations';
import { windAt, locationKey, contactValid } from '../core/weather';
import type { DisplayInfo, InitialState } from '../main/bridge';
import { SolarEngine } from '../core/solar';
import { MotionClock } from '../core/motion';
import { ViewerGestures } from '../core/gestures';
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let settings: Settings, scene: Scene | null = null, initial: InitialState, saveTimer: ReturnType<typeof setTimeout>;
let viewing = false, overlay = false, transition = 0, closing = false;
const solar = new SolarEngine();
const gestures = new ViewerGestures(() => toggleOverlay(), () => { if(viewing)void window.rain.window('toggle-viewer-mode').catch(reportError); });
const labels: Record<string, string> = { sky: 'Sky', stars: 'Stars', sun: 'Sun', moon: 'Moon', clouds: 'Clouds', tree: 'Nearby tree', outlook: 'Distant view', windowFrame: 'Window frame', lightRays: 'Light rays' };
const check = (path: string, label: string) => `<label class="check"><input type="checkbox" data-setting="${path}">${label}</label>`;
const range = (path: string, label: string, min: number, max: number, step: number) => `<label class="field"><span>${label}<output data-output="${path}"></output></span><input type="range" min="${min}" max="${max}" step="${step}" data-setting="${path}"></label>`;
const select = (path: string, label: string, values: [string, string][]) => `<label class="field"><span>${label}</span><select data-setting="${path}">${values.map(([v, text]) => `<option value="${v}">${text}</option>`).join('')}</select></label>`;
const section = (name: string, body: string, open = false) => `<details ${open ? 'open' : ''}><summary>${name}</summary><div>${body}</div></details>`;
function valueAt(path: string) { const [g,k]=path.split('.');return (settings as any)[g][k]; }
function assign(path: string,value: unknown) { const [g,k]=path.split('.');(settings as any)[g][k]=value; }
function buildControls() {
  element('controls').innerHTML =
    section('Viewer & resource use', select('ui.viewerMode','Start the viewer in', [['borderless','Windowed fullscreen (borderless)'],['fullscreen','Regular fullscreen']]) +
      `<label class="field"><span>Viewer monitor</span><select id="display-picker"></select></label>` +
      select('rendering.quality','Render detail', [['low','Efficient · up to 0.92 megapixels'],['balanced','Balanced · up to 2.07 megapixels'],['high','High · up to 4.19 megapixels']]) +
      select('rendering.frameRateLimit','Motion frame rate', [['15','15 fps · least animation work'],['30','30 fps'],['60','60 fps']]) +
      `<button id="efficient-defaults">Use efficient defaults</button><p class="hint">The scene is unloaded in settings and released on Stop. Still manual scenes stop drawing; automatic daylight can update once per second without moving layers. Regular fullscreen uses the operating system’s fullscreen mode.</p>`, true) +
    section('Daylight & region', check('solar.automatic','Follow real seasonal daylight') + `<div id="manual-moods" class="moods">${['morning','day','evening','night'].map(m=>`<button data-mood="${m}" aria-pressed="false">${m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div>` +
      `<label class="field"><span>Regional preset</span><select id="region-preset"><option value="custom">Selected coordinates</option>${presets.map((p,i)=>`<option value="${i}">${p.label}</option>`).join('')}</select></label>` +
      `<label class="field"><span>IANA timezone</span><input type="text" data-setting="solar.timeZone" list="timezones"><datalist id="timezones">${Intl.supportedValuesOf('timeZone').map(z=>`<option value="${z}">`).join('')}</datalist></label>` +
      `<div class="two-fields"><label class="field"><span>Latitude</span><input type="number" min="-90" max="90" step=".0001" data-setting="solar.latitude"></label><label class="field"><span>Longitude</span><input type="number" min="-180" max="180" step=".0001" data-setting="solar.longitude"></label></div>` +
      `<button id="zone-reference">Use timezone reference coordinates</button><p id="location-note" class="hint"></p><p class="hint">Timezone changes preserve coordinates. Approximate references can be overridden. No IP geolocation.</p><div id="solar-status" class="status-card"></div>`) +
    section('View & window', select('appearance.outlookStyle','Distant view',[['meadow','Meadow'],['field','Open fields'],['mountains','Mountain ridges'],['city','Elevated rooftops'],['american-mountains','American mountains'],['arabian-desert','Arabian desert'],['irish-lake','Irish lake'],['japanese-ocean','Japanese ocean'],['latin-badlands','Latin American badlands']]) +
      select('appearance.frameStyle','Frame material',[['warm-wood','Warm wood'],['white-wood','White painted wood'],['dark-metal','Thin dark metal'],['minimal','Minimal dark']]) +
      select('appearance.crossbars','Crossbars',[['none','None'],['single','Central vertical'],['classic','Classic four panes']]) + range('appearance.horizonFraction','Horizon',.45,.82,.01) +
      range('appearance.brightness','Brightness',.35,1.3,.05) + range('appearance.sunGlowIntensity','Sun glow',0,1,.05) + range('appearance.rayIntensity','Ray intensity',0,.5,.01) +
      select('tree.anchor','Tree position',[['upper-right','Right edge'],['upper-left','Left edge']])) +
    section('Scene layers',`<div class="layer-grid">${layerNames.map(l=>check(`layers.${l}`,labels[l])).join('')}</div><p class="hint">Every switch preserves its layer’s preferences. Rays need both sun and tree. Daylight runs independently.</p>`) +
    section('Cloud movement',check('clouds.movementEnabled','Cloud movement')+check('clouds.useForecastWind','Forecast-based cloud speed')+range('clouds.manualSpeedMultiplier','Cloud speed',0,3,.05)+range('clouds.coverage','Fair-weather coverage',0,.7,.05)+range('clouds.maximumMotionMultiplier','Comfort speed limit',.1,3,.1),true) +
    section('Leaf sway',check('tree.swayEnabled','Leaf sway')+check('tree.useForecastWind','Forecast-based sway')+range('tree.manualFrequencyMultiplier','Sway speed',0,3,.05)+range('tree.manualAmplitudeMultiplier','Sway amplitude',0,3,.05)+range('tree.maximumMotionMultiplier','Comfort sway limit',.1,3,.1),true) +
    section('Water movement',check('water.movementEnabled','Animate water waves')+range('water.manualSpeedMultiplier','Wave speed',0,3,.05)+`<p class="hint">Applies to Irish lake and Japanese ocean only. Turning it off leaves still water and saves frames when other motion is off.</p>`) +
    section('Stars',check('appearance.starTwinkleEnabled','Gentle star twinkling')+range('appearance.starTwinkleSpeedMultiplier','Twinkle speed',0,3,.05)+`<p class="hint">Sun and moon travel follow seasonal time; their size and right-to-left arch are deliberately artistic. Twinkling is optional.</p>`) +
    section('Optional forecast wind',`<p class="hint">Opt-in sends selected approximate coordinates and connection IP to MET Norway. Only wind influences this pleasant scene. One cached multi-day download is shared, usually refreshed after seven days while a moving layer needs it.</p>`+check('weather.networkOptIn','Allow forecast downloads')+`<label class="field"><span>Your real project/contact HTTPS URL</span><input type="url" data-setting="weather.projectContactUrl" placeholder="A genuine contact page you control"></label><button id="refresh-weather">Check cached forecast</button><div id="forecast-status" class="status-card"></div><p class="hint">MET Norway forecast data: CC BY 4.0. Cached prediction, not live measured weather. No downloads start in settings.</p>`);
  updateInputs();displayOptions(initial.displays);
  element('controls').addEventListener('input',onSetting);element('controls').addEventListener('change',onSetting);
  document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(b=>b.addEventListener('click',()=>{settings.solar.manualMood=b.dataset.mood as Settings['solar']['manualMood'];updateInputs();changed();}));
  element<HTMLSelectElement>('region-preset').addEventListener('change',e=>{const p=presets[+(e.target as HTMLSelectElement).value];if(p){Object.assign(settings.solar,{timeZone:p.zone,latitude:p.latitude,longitude:p.longitude,label:p.label,reference:p.reference,needsLocationSetup:false});updateInputs();changed();}});
  element('zone-reference').addEventListener('click',()=>{const p=referenceForZone(settings.solar.timeZone);if(p){Object.assign(settings.solar,{latitude:p.latitude,longitude:p.longitude,label:`${p.zone} representative location`,reference:'IANA public-domain zone1970.tab representative location',needsLocationSetup:false});updateInputs();changed();}else element('save-status').textContent='Enter coordinates for this zone; no representative is bundled.';});
  element<HTMLSelectElement>('display-picker').addEventListener('change',async e=>{settings.ui.displayId=+(e.target as HTMLSelectElement).value;await saveNow();if(viewing)await window.rain.window('move',settings.ui.displayId).catch(reportError);});
  element('efficient-defaults').addEventListener('click',()=>{settings.rendering.quality='low';settings.rendering.frameRateLimit=15;settings.layers.lightRays=false;settings.appearance.starTwinkleEnabled=false;updateInputs();changed();});
  element('refresh-weather').addEventListener('click',async()=>{try{initial.forecast=await window.rain.refreshForecast();if(scene)scene.forecast=initial.forecast.cache;updateStatus();}catch(e){reportError(e);}});
}
function displayOptions(displays: DisplayInfo[]) {
  const picker=element<HTMLSelectElement>('display-picker');picker.replaceChildren(...displays.map(d=>{const o=document.createElement('option');o.value=String(d.id);o.textContent=`${d.label}${d.primary?' · primary':''}`;return o;}));
  const id=displays.find(d=>d.id===settings.ui.displayId)?.id??displays.find(d=>!d.primary)?.id??displays[0]?.id;
  if(id!==undefined){picker.value=String(id);settings.ui.displayId=id;}
}
function onSetting(event: Event) {
  const input=event.target as HTMLInputElement|HTMLSelectElement,path=input.dataset.setting;if(!path)return;
  let value:unknown=input instanceof HTMLInputElement&&input.type==='checkbox'?input.checked:input.value;
  if(typeof valueAt(path)==='number'){value=Number(input.value);if(input.value===''||!Number.isFinite(value)||!input.checkValidity()){input.setAttribute('aria-invalid','true');element('save-status').textContent='Enter a valid number in the shown range.';return;}}
  if(path==='solar.timeZone'&&!validZone(String(value))){input.setAttribute('aria-invalid','true');element('save-status').textContent='Choose a valid IANA timezone.';return;}
  input.removeAttribute('aria-invalid');assign(path,value);
  if(path==='solar.latitude'||path==='solar.longitude'){settings.solar.label='Your approximate coordinates';settings.solar.reference='User coordinate override';settings.solar.needsLocationSetup=false;}
  updateInputs(false);changed(path);
}
function updateInputs(values=true) {
  document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]').forEach(input=>{const value=valueAt(input.dataset.setting!);if(values){if(input instanceof HTMLInputElement&&input.type==='checkbox')input.checked=value;else input.value=String(value);}const output=document.querySelector<HTMLOutputElement>(`[data-output="${input.dataset.setting}"]`);if(output)output.textContent=typeof value==='number'?value.toFixed(2):String(value);});
  element('manual-moods').hidden=settings.solar.automatic;
  document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mood===settings.solar.manualMood)));
  element('location-note').textContent=`${settings.solar.label} · ${settings.solar.latitude.toFixed(4)}, ${settings.solar.longitude.toFixed(4)}. ${settings.solar.reference==='User coordinate override'?'Coordinates entered by you.':'Approximate reference; confirm or adjust for your region.'}`;
}
function changed(path?:string) {
  settings=validateSettings(settings);scene?.update(settings);if(viewing&&scene)void scene.load().catch(reportError);updateStatus();clearTimeout(saveTimer);
  element('save-status').textContent='Saving locally…';
  saveTimer=setTimeout(()=>{void saveNow().then(()=>{if(path==='ui.viewerMode'&&viewing)return window.rain.window('start-viewer');}).catch(reportError);},180);
}
async function saveNow() {clearTimeout(saveTimer);await window.rain.save(settings);element('save-status').textContent='Saved on this device';}
function setViewing(value:boolean) {
  viewing=value;overlay=false;document.body.classList.toggle('viewing',value);element('settings').hidden=value;element('panel-close').hidden=!value;
  element('setup-toolbar').hidden=value;element('viewer-actions').hidden=true;element('settings-button').setAttribute('aria-expanded','false');document.title=value?'RainByePass · Viewer':'RainByePass';
  element<HTMLCanvasElement>('scene').hidden=!value;
}
function toggleOverlay(value = !overlay) {
  if(!viewing)return;overlay=value;element('settings').hidden=!value;element('viewer-actions').hidden=!value;element('settings-button').setAttribute('aria-expanded',String(value));
  if(value)element('panel-close').focus();else element<HTMLCanvasElement>('scene').focus({preventScroll:true});
}
async function startViewer() {
  if(viewing)return;const ticket=++transition;element<HTMLButtonElement>('boost-button').disabled=true;
  try{
    settings.solar.needsLocationSetup=false;await saveNow();if(ticket!==transition)return;
    setViewing(true);await window.rain.window('start-viewer');if(ticket!==transition)return;
    if(!scene)scene=new Scene(element<HTMLCanvasElement>('scene'),settings);else scene.update(settings);
    scene.forecast=initial.forecast.cache;await scene.load();if(ticket!==transition)return;
    scene.start();element<HTMLCanvasElement>('scene').focus({preventScroll:true});
  }catch(e){reportError(e);await stopViewer();}finally{element<HTMLButtonElement>('boost-button').disabled=false;}
}
async function stopViewer() {
  ++transition;gestures.cancel();clearTimeout(saveTimer);scene?.stop(true);setViewing(false);
  try{await window.rain.window('stop-viewer');await saveNow();element('boost-button').focus();}catch(e){reportError(e);}
}
function format(date:Date|null) {return date?new Intl.DateTimeFormat('en-GB',{timeZone:settings.solar.timeZone,hour:'2-digit',minute:'2-digit'}).format(date):'No event';}
function updateStatus() {
  const now=scene?.nowOverride??new Date(),events=solar.events(now,settings),state=solar.state(now,settings);
  element('phase-label').textContent=`${state.phase} · ${format(now)}`;
  element('solar-status').textContent=`Sunrise ${format(events.sunrise)} · solar noon ${format(events.solarNoon)} · sunset ${format(events.sunset)}. ${state.polar||(settings.solar.automatic?'Seasonal timing, computed offline.':'Held manual mood.')} The moon’s night arch is artistic.`;
  const f=initial.forecast,c=f.cache,wind=windAt(c,+now,locationKey(settings));
  let message=!viewing?'Viewer stopped: no automatic downloads. ':!settings.weather.networkOptIn?'Network off. ':!contactValid(settings.weather.projectContactUrl)?'Provider disabled: enter your genuine contact URL. ':!forecastConsumers(settings)?'No moving visible layer requests wind. ':f.message+' ';
  if(c){const d=(n:number|null)=>n===null?'not supplied':new Intl.DateTimeFormat('en-GB',{timeZone:settings.solar.timeZone,dateStyle:'short',timeStyle:'short'}).format(n);message+=`Generated ${d(c.generated)}. Downloaded ${d(c.downloaded)}. Coverage ends ${d(c.coverageEnd)}. `;if(c.location!==locationKey(settings))message+='Cache belongs to another location. ';}
  message+=wind===null?'Saved manual settings remain available.':`Covered cached prediction: ${wind.toFixed(1)} m/s.`;element('forecast-status').textContent=message;
}
function reportError(error:unknown) {element('error').hidden=false;element('error').textContent=`RainByePass: ${error instanceof Error?error.message:String(error)}. Stop returns to settings; Exit closes the app.`;}
async function closeApp() {gestures.cancel();scene?.stop(true);try{await saveNow();await window.rain.window('close');}catch(e){reportError(e);}}
async function init() {
  initial=await window.rain.load();settings=initial.settings;
  if(settings.solar.needsLocationSetup&&initial.systemZone!=='Europe/Berlin'){const ref=referenceForZone(initial.systemZone);if(ref)Object.assign(settings.solar,{timeZone:initial.systemZone,latitude:ref.latitude,longitude:ref.longitude,label:`${ref.zone} representative reference`,reference:'IANA zone1970.tab representative reference'});}
  buildControls();setViewing(false);updateStatus();setInterval(updateStatus,30000);
  element('boost-button').addEventListener('click',()=>void startViewer());element('stop-button').addEventListener('click',()=>void stopViewer());
  for(const id of ['close-button','viewer-exit'])element(id).addEventListener('click',()=>void closeApp());
  element('minimize-button').addEventListener('click',()=>window.rain.window('minimize'));
  element('settings-button').addEventListener('click',()=>toggleOverlay());element('panel-close').addEventListener('click',()=>toggleOverlay(false));
  element('fullscreen-button').addEventListener('click',()=>window.rain.window('toggle-viewer-mode'));
  element('reset-settings').addEventListener('click',()=>{settings=structuredClone(defaults);updateInputs();displayOptions(initial.displays);changed();});
  const manifest=initial.credits as {assets:{creator:string;sourceAssetId:string;license:string;sourcePage:string}[]};
  for(const a of new Map(manifest.assets.map(a=>[a.sourceAssetId,a])).values()){const row=document.createElement('p');row.className='credit';row.textContent=`${a.creator} · ${a.sourceAssetId} · ${a.license}. ${a.sourcePage}`;element('credits-content').append(row);}
  const own=document.createElement('p');own.textContent='Original sky, clouds, terrain, branches, lighting, frames and regional scenery: MIT, copyright 2026 Alin-Alexandru Ion. SunCalc 2.1.1: Volodymyr Agafonkin, BSD-2-Clause. Electron/Chromium: bundled notices. Optional MET Norway forecast data: CC BY 4.0.';element('credits-content').append(own);
  element('credits-button').addEventListener('click',()=>element<HTMLDialogElement>('credits').showModal());element('credits-close').addEventListener('click',()=>element<HTMLDialogElement>('credits').close());
  window.rain.onForecast(f=>{initial.forecast=f;if(scene)scene.forecast=f.cache;updateStatus();});
  window.rain.onWindow(state=>{scene?.setMinimized(state.minimized);settings.ui.viewerMode=state.viewerMode;element('mode-label').textContent=state.viewerMode==='borderless'?'Windowed fullscreen':'Regular fullscreen';const input=document.querySelector<HTMLSelectElement>('[data-setting="ui.viewerMode"]');if(input)input.value=state.viewerMode;displayOptions(state.displays);});
  const canvas=element<HTMLCanvasElement>('scene');let down:{id:number;x:number;y:number}|null=null;
  canvas.addEventListener('pointerdown',e=>{if(viewing&&e.isPrimary&&e.button===0)down={id:e.pointerId,x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointerup',e=>{if(viewing&&down&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<=12){e.preventDefault();gestures.tap(e.timeStamp,e.clientX,e.clientY,e.pointerType);}down=null;});
  canvas.addEventListener('pointercancel',()=>{down=null;gestures.cancel();});
  window.addEventListener('resize',()=>{if(viewing)scene?.invalidate();});
  window.addEventListener('beforeunload',e=>{if(closing||initial.smoke)return;e.preventDefault();e.returnValue='';gestures.cancel();scene?.stop(true);void saveNow().then(()=>{closing=true;return window.rain.window('close');}).catch(reportError);});
  document.addEventListener('keydown',e=>{if(element<HTMLDialogElement>('credits').open)return;const editing=e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement;if(e.key==='Escape'&&viewing){e.preventDefault();void stopViewer();}if(!editing&&e.key.toLowerCase()==='s'&&viewing&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();toggleOverlay();}});
  document.addEventListener('scene-error',((e:CustomEvent)=>reportError(e.detail))as EventListener);document.addEventListener('scene-recovered',()=>{element('error').hidden=true;});
  if(initial.recovery)element('save-status').textContent=initial.recovery;
  if(initial.smoke)installTests();document.body.dataset.ready='true';
}
function installTests() {
  const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  window.rainTest={
    snapshot:()=>({viewing,overlay,allocated:!!scene,...(scene?.snapshot()??{frames:0,backing:[1,1],bufferPixels:0,texturePixels:0})}),start:startViewer,stop:stopViewer,
    showSettings:()=>toggleOverlay(true),hideSettings:()=>toggleOverlay(false),setMode:async(mode:Settings['ui']['viewerMode'])=>{settings.ui.viewerMode=mode;await saveNow();if(viewing)await window.rain.window('start-viewer');},
    mood(m:Settings['solar']['manualMood']){settings.solar.automatic=false;settings.solar.manualMood=m;scene?.update(settings);updateInputs();updateStatus();},
    async outlook(s:Settings['appearance']['outlookStyle']){settings.appearance.outlookStyle=s;scene?.update(settings);await scene?.load();await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));updateInputs();},frame(s:Settings['appearance']['frameStyle']){settings.appearance.frameStyle=s;scene?.update(settings);},
    setTime(iso:string){settings.solar.automatic=true;if(scene){scene.nowOverride=new Date(iso);scene.update(settings);scene.start();}updateStatus();},
    performanceStart(fps:15|30|60,rays=false,quality:Settings['rendering']['quality']='low'){settings.rendering={frameRateLimit:fps,quality};settings.clouds.movementEnabled=true;settings.tree.swayEnabled=true;settings.layers.lightRays=rays;settings.solar.automatic=false;settings.solar.manualMood='day';if(scene)scene.nowOverride=null;scene?.update(settings);if(scene){scene.start();scene.recording=true;scene.drawTimes=[];scene.intervals=[];}},
    cycle(){const day=solar.events(new Date('2026-10-14T12:00Z'),settings),next=solar.events(new Date('2026-10-15T12:00Z'),settings);return {sunAbsentBeforeRise:new Date(+day.sunrise!-45*60000).toISOString(),sunRisingRight:new Date(+day.sunrise!+20*60000).toISOString(),sunLargestAtNoon:day.solarNoon.toISOString(),sunSettingLeft:new Date(+day.sunset!-20*60000).toISOString(),sunAbsentAfterSet:new Date(+day.sunset!+46*60000).toISOString(),moonRisingRight:new Date(+day.sunset!+90*60000).toISOString(),moonLargestAtMidnight:new Date((+day.sunset!+ +next.sunrise!)/2).toISOString(),moonSettingLeft:new Date(+next.sunrise!-30*60000).toISOString()};},
    performanceEnd(){if(!scene)return {};const mean=(x:number[])=>x.reduce((a,b)=>a+b,0)/Math.max(1,x.length);const intervals=[...scene.intervals].sort((a,b)=>a-b);return {quality:settings.rendering.quality,targetFps:settings.rendering.frameRateLimit,size:[scene.width,scene.height],density:scene.density,renderer:'Canvas2D bounded pixels / scheduled frames',samples:scene.drawTimes.length,meanDrawMs:mean(scene.drawTimes),observedFps:intervals.length?1000/mean(intervals):0,p95IntervalMs:intervals[Math.floor(intervals.length*.95)]??0,raysEnabled:settings.layers.lightRays};},
    staticScene(){settings.solar.automatic=false;settings.solar.manualMood='day';settings.clouds.movementEnabled=false;settings.tree.swayEnabled=false;settings.water.movementEnabled=false;settings.appearance.starTwinkleEnabled=false;scene?.update(settings);scene?.start();if(scene){scene.drawTimes=[];scene.intervals=[];}},
    async run(){
      const passed:string[]=[],failed:string[]=[];const assert=(ok:boolean,name:string)=>(ok?passed:failed).push(name);
      assert(!viewing&&!scene,'Starts in settings with no scene allocation');assert(!(await window.rain.load()).fullscreen,'Startup is never fullscreen');
      assert(typeof(window as any).require==='undefined'&&typeof(window as any).process==='undefined','Renderer isolated from Node');
      assert(document.querySelectorAll('[data-setting^="layers."]').length===9,'Nine independent layers');assert(document.querySelectorAll('[data-mood]').length===4,'Four held manual moods');
      assert(['clouds.movementEnabled','clouds.useForecastWind','tree.swayEnabled','tree.useForecastWind'].every(p=>document.querySelector(`[data-setting="${p}"]`)),'Four independent motion controls');
      assert(['water.movementEnabled','water.manualSpeedMultiplier'].every(p=>document.querySelector(`[data-setting="${p}"]`)),'Independent water controls');
      await startViewer();await pause(150);assert(viewing&&!!scene,'Mood Boost starts viewer');assert(element('settings').hidden&&element('viewer-actions').hidden,'Viewer starts with panel and buttons hidden');
      const active=scene as unknown as Scene;
      for(const l of layerNames)settings.layers[l]=false;active.update(settings);await pause(150);assert(active.errors.length===0,'Every layer can be hidden safely');toggleOverlay(true);assert(!element('settings').hidden&&!element('viewer-actions').hidden,'Panel and buttons accessible with every layer hidden');toggleOverlay(false);assert(element('settings').hidden&&element('viewer-actions').hidden,'Panel and buttons hide together');
      settings=structuredClone(defaults);settings.solar.automatic=false;active.update(settings);await active.load();
      for(const path of ['clouds.movementEnabled','clouds.useForecastWind','tree.swayEnabled','tree.useForecastWind']){updateInputs();const i=document.querySelector<HTMLInputElement>(`[data-setting="${path}"]`)!;const before=valueAt(path);i.checked=!before;i.dispatchEvent(new Event('change',{bubbles:true}));assert(valueAt(path)===!before,`Semantic control ${path}`);}
      for(let bits=0;bits<16;bits++){const s=structuredClone(defaults);s.clouds.movementEnabled=!!(bits&1);s.clouds.useForecastWind=!!(bits&2);s.tree.swayEnabled=!!(bits&4);s.tree.useForecastWind=!!(bits&8);const c=new MotionClock();c.step(.1,s,50);assert((c.cloud>0)===s.clouds.movementEnabled&&(c.tree>0)===s.tree.swayEnabled,`Independent combination ${bits}`);}
      settings.clouds.movementEnabled=false;settings.tree.swayEnabled=false;active.update(settings);const before=active.snapshot();await pause(250);const after=active.snapshot();assert(before.cloudClock===after.cloudClock&&before.treeClock===after.treeClock,'Stopped component clocks remain frozen');
      settings.appearance.outlookStyle='irish-lake';settings.water.movementEnabled=true;active.update(settings);await active.load();const lakeBefore=active.snapshot().waterPhase;await pause(250);assert(active.snapshot().waterPhase!==lakeBefore,'Lake waves advance independently');settings.water.movementEnabled=false;active.update(settings);await pause(100);const stillWater=active.snapshot().waterPhase;await pause(150);assert(active.snapshot().waterPhase===stillWater,'Disabled water motion freezes');
      await stopViewer();const stopped=active.snapshot();assert(!viewing&&!element('settings').hidden,'Stop returns to settings');assert(stopped.bufferPixels<=7&&stopped.texturePixels===0,'Stop releases render and texture buffers');const frames=active.frames;await pause(250);assert(active.frames===frames,'No frames rendered in settings after Stop');
      settings=structuredClone(defaults);settings.solar.automatic=false;updateInputs();await startViewer();
      await saveNow();assert(JSON.stringify((await window.rain.load()).settings)===JSON.stringify(settings),'Settings persist through bridge');
      assert(await fetch('https://example.com').then(()=>false,()=>true),'Renderer network blocked');return {passed,failed};
    }
  };
}
void init().catch(reportError);
