import type { Settings } from '../core/settings';
import { SolarEngine, sunGeometry, travelOnArch, mix, colorMix, cssColor, clamp, type SolarState, type RGB } from '../core/solar';
import { backingDensity, framePeriod, movingWater } from '../core/render-policy';
import { MotionClock, random, SelectionBag } from '../core/motion';
import { windAt, locationKey, type ForecastCache } from '../core/weather';
import { drawRegionalForeground, drawRegionalLandscape, drawRegionalWater, regionalOutlooks, type RegionalOutlook } from './regional-landscapes';
import { buildCanopy, branchPoint, trunkPoint, twigPoint, type CanopyBranch } from './canopy';
type Context = CanvasRenderingContext2D;
const surface = () => document.createElement('canvas');
const ctx = (canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) => { const c = canvas.getContext('2d', options); if (!c) throw new Error('Canvas renderer unavailable. Restart or try another graphics configuration.'); return c; };
interface Cloud { x: number; y: number; scale: number; depth: number; shape: number; }
/** Original scalable landscape, branch and cloud authoring lives here. No remote scene assets. */
export class Scene {
  clock = new MotionClock(); solar = new SolarEngine(); forecast: ForecastCache | null = null;
  state: SolarState; width = 0; height = 0; density = 1; frames = 0; rayPasses = 0; drawTimes: number[] = []; intervals: number[] = [];
  errors: string[] = []; nowOverride: Date | null = null; recording = false;
  private context: Context; private terrain = surface(); private tree = surface(); private cloudLayer = surface(); private frame = surface(); private rayLayer = surface(); private mask = surface();
  private terrainKey = ''; private treeRenderKey = ''; private cloudRenderKey = ''; private frameKey = ''; private cloudTintKey = ''; private coloredClouds: HTMLCanvasElement[] = [];
  private cloudMasks: (HTMLCanvasElement | undefined)[] = []; private clouds: Cloud[] = []; private canopy: CanopyBranch[] = []; private leafImages: HTMLImageElement[] = []; private tintedLeaves: HTMLCanvasElement[] = [];
  private grassImages: HTMLImageElement[] = []; private forestTrees: HTMLImageElement[] = []; private tintedGrass: HTMLCanvasElement[] = [];
  private leafTint = ''; private grassTint = ''; private wood: HTMLImageElement | null = null; private stars: { x: number; y: number; r: number; phase: number }[] = [];
  private rng: () => number; private bag: SelectionBag; private last = 0; private lastDraw = 0; private lastSolar = 0; private lastRay = 0; private lastDistance = 0; private poseAmplitude = 1;
  private suspended = false; private running = false; private windowMinimized = false; private treeSeed = -1; private cloudSeed = -1; private raf = 0; private nextDraw = 0;
  private waterPhase = 0;
  private timer: ReturnType<typeof setTimeout> | null = null; private resourceGeneration = 0;
  private targetState: SolarState;
  constructor(public canvas: HTMLCanvasElement, public settings: Settings) {
    this.context = ctx(canvas, { alpha: false, desynchronized: true }); this.state = this.solar.state(new Date(), settings); this.targetState = this.state;
    this.rng = random(settings.clouds.seed); this.bag = new SelectionBag(24, this.rng, 18); this.reseed();
    canvas.addEventListener('contextlost', event => { event.preventDefault(); this.suspended = true; this.errors.push('Graphics context lost; awaiting restoration.'); document.dispatchEvent(new CustomEvent('scene-error', { detail: 'Graphics context lost; waiting for restoration. Restart if it does not recover.' })); });
    canvas.addEventListener('contextrestored', () => { this.context = ctx(canvas, { alpha: false, desynchronized: true }); this.terrainKey = ''; this.last = 0; this.suspended = false; this.requestFrame(); document.dispatchEvent(new Event('scene-recovered')); });
    document.addEventListener('visibilitychange', () => { this.last = 0; this.lastDraw = 0; this.cancelFrame(); if (!document.hidden) this.requestFrame(); });
  }
  async load() {
    const generation = this.resourceGeneration;
    const load = async (file: string) => { const im = new Image(); im.src = `assets/${file}`; await im.decode(); return im; };
    const landscape = this.settings.layers.outlook && ['meadow','field','american-mountains','irish-lake'].includes(this.settings.appearance.outlookStyle);
    const leafyTree = !['american-mountains','arabian-desert','japanese-ocean','latin-badlands'].includes(this.settings.appearance.outlookStyle);
    const [leaves, wood, grasses, trees] = await Promise.all([
      this.settings.layers.tree && leafyTree && !this.leafImages.length ? Promise.all(['leaf-30.png','leaf-31.png','leaf-32.png','leaf-35.png','leaf-38.png','sprig-41.png','sprig-44.png'].map(load)) : Promise.resolve(null),
      this.settings.layers.windowFrame && this.settings.appearance.frameStyle === 'warm-wood' && !this.wood ? load('wood.jpg') : Promise.resolve(null),
      landscape && !this.grassImages.length ? Promise.all([1,3,5].map(i => load(`grass-${i}.png`))) : Promise.resolve(null),
      landscape && ['meadow','irish-lake'].includes(this.settings.appearance.outlookStyle) && !this.forestTrees.length ? Promise.all([4,6,7,9,11].map(i => load(`forest-tree-${i}.png`))) : Promise.resolve(null)
    ]);
    if (generation !== this.resourceGeneration) return;
    if (leaves && this.settings.layers.tree) { this.leafImages = leaves; this.leafTint = ''; this.treeRenderKey = ''; }
    if (wood && this.settings.layers.windowFrame) { this.wood = wood; this.frameKey = ''; }
    if (grasses && this.settings.layers.outlook) { this.grassImages = grasses; this.grassTint = ''; this.terrainKey = ''; }
    if (trees && this.settings.layers.outlook) { this.forestTrees = trees; this.terrainKey = ''; }
    this.requestFrame();
  }
  private reseed() {
    if (this.cloudSeed !== this.settings.clouds.seed) {
      this.cloudSeed = this.settings.clouds.seed; this.rng = random(this.cloudSeed); this.bag = new SelectionBag(24, this.rng, 18); this.cloudMasks = [];
      this.clouds = Array.from({ length: 9 }, (_, i) => ({ x: -.25 + i * .18, y: .13 + this.rng() * .26, scale: .75 + this.rng() * .7, depth: .65 + this.rng() * .45, shape: this.bag.next() })); this.cloudTintKey = '';
    }
    if (this.treeSeed !== this.settings.tree.seed) {
      this.treeSeed = this.settings.tree.seed; this.canopy = buildCanopy(this.treeSeed);
    }
    const r = random(48210); this.stars = Array.from({ length: 140 }, () => ({ x: r(), y: r() * .65, r: .45 + r(), phase: r() * 6.28 }));
  }
  private makeCloud(index: number) {
    const c = surface(); c.width = 360; c.height = 160; const g = ctx(c), r = random(this.cloudSeed + index * 881);
    // Distinct seeded contours and soft transparent edges, retained for the whole crossing.
    for (let j = 0; j < 16; j++) {
      const x = 60 + r() * 240, y = 65 + r() * 42, rx = 25 + r() * 43, ry = rx * (.4 + r() * .25);
      g.save(); g.translate(x, y); g.scale(1, ry / rx);
      const glow = g.createRadialGradient(0, 0, rx * .2, 0, 0, rx); glow.addColorStop(0, 'rgba(255,255,255,.72)'); glow.addColorStop(.65, 'rgba(255,255,255,.45)'); glow.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = glow; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
    }
    return c;
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    const density = backingDensity(w, h, devicePixelRatio, this.settings.rendering.quality);
    if (w !== this.width || h !== this.height || density !== this.density) {
      this.width = w; this.height = h; this.density = density; this.canvas.width = Math.max(1,Math.floor(w * density)); this.canvas.height = Math.max(1,Math.floor(h * density));
      this.terrainKey = ''; this.treeRenderKey = ''; this.cloudRenderKey = ''; this.frameKey = ''; this.lastRay = 0;
    }
    const l = this.settings.layers;
    for (const [c, enabled] of [[this.terrain,l.outlook],[this.tree,l.tree],[this.cloudLayer,l.clouds],[this.frame,l.windowFrame]] as const) {
      const bw = enabled ? this.canvas.width : 1, bh = enabled ? this.canvas.height : 1;
      if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; this.terrainKey = ''; this.treeRenderKey = ''; this.cloudRenderKey = ''; this.frameKey = ''; }
    }
    if (!l.lightRays || !l.tree || !l.sun) for (const c of [this.rayLayer,this.mask]) { c.width=1; c.height=1; }
  }
  update(s: Settings) { this.settings = s; this.reseed(); this.lastSolar = 0; this.lastRay=0; if (this.running) { this.resize(); this.requestFrame(true); } }
  start() { this.running = true; this.last = 0; this.lastDraw = 0; this.nextDraw = 0; this.lastSolar=0; this.state=this.solar.state(this.nowOverride??new Date(),this.settings); this.targetState=this.state; this.resize(); this.requestFrame(true); }
  stop(release = false) {
    this.running = false; this.cancelFrame();
    if (release) {
      this.resourceGeneration++;
      for (const c of [this.canvas,this.terrain,this.tree,this.cloudLayer,this.frame,this.rayLayer,this.mask,...this.cloudMasks.filter((c): c is HTMLCanvasElement=>!!c),...this.coloredClouds.filter(c=>!!c),...this.tintedLeaves,...this.tintedGrass]) { c.width=1; c.height=1; }
      this.cloudMasks=[];this.coloredClouds=[];this.tintedLeaves=[];this.tintedGrass=[];this.leafImages=[];this.grassImages=[];this.forestTrees=[];this.wood=null;
      this.width=0;this.height=0;this.terrainKey='';this.treeRenderKey='';this.cloudRenderKey='';this.frameKey='';this.cloudTintKey='';this.leafTint='';this.grassTint='';
      this.drawTimes=[];this.intervals=[];this.recording=false;
    }
  }
  setMinimized(value: boolean) { this.windowMinimized = value; this.last = 0; this.lastDraw = 0; this.nextDraw = 0; this.cancelFrame(); if (!value) this.requestFrame(); }
  private cancelFrame() { if (this.raf) cancelAnimationFrame(this.raf); this.raf=0; if(this.timer!==null)clearTimeout(this.timer);this.timer=null; }
  private requestFrame(immediate=false) {
    if (immediate) this.cancelFrame();
    if (!this.running || document.hidden || this.windowMinimized || this.suspended || this.raf || this.timer!==null) return;
    this.raf=requestAnimationFrame(this.tick);
  }
  private schedule(period: number | null, time: number) {
    if(period===null || !this.running || document.hidden || this.windowMinimized || this.suspended)return;
    this.nextDraw=Math.max(time-period,this.nextDraw||time)+period;
    this.timer=setTimeout(()=>{this.timer=null;this.requestFrame();},Math.max(0,this.nextDraw-performance.now()-2));
  }
  invalidate() { this.lastSolar=0;this.requestFrame(true); }
  private tick = (time: number) => {
    this.raf=0;
    if (!this.running || document.hidden || this.windowMinimized || this.suspended) { this.last = 0; this.lastDraw = 0; this.nextDraw = 0; return; }
    const elapsed = this.last ? Math.min(.1, (time - this.last) / 1000) : 0; this.last = time;
    const drawDt = this.lastDraw ? clamp((time - this.lastDraw) / 1000, 0, .1) : elapsed;
    const lightingDt=this.lastDraw ? clamp((time-this.lastDraw)/1000,0,.5) : elapsed;
    if (this.recording && this.lastDraw) this.intervals.push(time - this.lastDraw); this.lastDraw = time;
    this.resize(); const now = this.nowOverride ?? new Date();
    if (!this.lastSolar || time - this.lastSolar >= 1000) { this.targetState = this.solar.state(now, this.settings); this.lastSolar = time; }
    const target = this.targetState, a = 1 - Math.exp(-lightingDt / 1.5);
    this.state = { ...target, top: colorMix(this.state.top, target.top, a), horizon: colorMix(this.state.horizon, target.horizon, a), cloud: colorMix(this.state.cloud, target.cloud, a), daylight: mix(this.state.daylight, target.daylight, a), stars: mix(this.state.stars, target.stars, a), progress: this.state.sunVisible && target.sunVisible ? mix(this.state.progress, target.progress, a) : target.progress, moonProgress:this.state.moonVisible&&target.moonVisible?mix(this.state.moonProgress,target.moonProgress,a):target.moonProgress };
    this.clock.step(drawDt, this.settings, windAt(this.forecast, +now, locationKey(this.settings)));
    if (movingWater(this.settings)) this.waterPhase = (this.waterPhase + drawDt * this.settings.water.manualSpeedMultiplier * .7) % (Math.PI * 2);
    if (this.settings.layers.tree && this.settings.tree.swayEnabled && this.clock.effective.frequency > 0 && this.clock.effective.amplitude > 0) this.poseAmplitude = this.clock.effective.amplitude;
    const distance = this.clock.cloudDistance - this.lastDistance; this.lastDistance = this.clock.cloudDistance;
    if (distance > 0) for (const cloud of this.clouds) {
      cloud.x += distance * .0028 * cloud.depth;
      if (cloud.x > 1.3) { cloud.x = -.36 - this.rng() * .22; cloud.shape = this.bag.next(); cloud.y = .12 + this.rng() * .27; cloud.scale = .75 + this.rng() * .7; }
    }
    const begin = performance.now();
    try { this.draw(time); } catch (error) { this.errors.push((error as Error).message); this.suspended = true; document.dispatchEvent(new CustomEvent('scene-error', { detail: (error as Error).message })); }
    if(this.recording)this.drawTimes.push(performance.now() - begin); this.frames++;
    const blending=Math.max(...this.state.top.map((v,i)=>Math.abs(v-target.top[i])),...this.state.horizon.map((v,i)=>Math.abs(v-target.horizon[i])),Math.abs(this.state.progress-target.progress)*100,Math.abs(this.state.moonProgress-target.moonProgress)*100)> .4;
    this.schedule(framePeriod(this.settings,blending,this.state.stars>.005),time);
  };
  private logical(c: HTMLCanvasElement) { const g = ctx(c); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.setTransform(this.density, 0, 0, this.density, 0, 0); return g; }
  private draw(time: number) {
    const g = this.context, w = this.width, h = this.height, u = Math.min(w, h), s = this.settings, l = s.layers, state = this.state, horizon = h * s.appearance.horizonFraction;
    g.setTransform(this.density, 0, 0, this.density, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#172636'; g.fillRect(0, 0, w, h);
    if (l.sky) { const sky = g.createLinearGradient(0, 0, 0, horizon + .14 * h); sky.addColorStop(0, cssColor(state.top)); sky.addColorStop(1, cssColor(state.horizon)); g.fillStyle = sky; g.fillRect(0, 0, w, h); }
    g.save(); g.beginPath(); g.rect(0, 0, w, horizon); g.clip();
    if (l.stars && state.stars > .005) for (const star of this.stars) { g.fillStyle = `rgba(238,241,221,${state.stars * (s.appearance.starTwinkleEnabled ? .72 + .12 * Math.sin(time / 2600 * s.appearance.starTwinkleSpeedMultiplier + star.phase) : .85)})`; g.beginPath(); g.arc(star.x * w, star.y * h, star.r * u / 850, 0, Math.PI * 2); g.fill(); }
    const sun = sunGeometry(w,h,s.appearance.horizonFraction,travelOnArch(w,h,s.appearance.horizonFraction,state.progress),state.altitude);
    if (l.sun && state.sunVisible && sun.y-sun.radius<horizon) {
      const glow = g.createRadialGradient(sun.x, sun.y, sun.radius * .8, sun.x, sun.y, sun.glow); glow.addColorStop(0, `rgba(255,232,169,${s.appearance.sunGlowIntensity * .4})`); glow.addColorStop(1, 'rgba(255,232,169,0)'); g.fillStyle = glow; g.fillRect(sun.x - sun.glow, sun.y - sun.glow, sun.glow * 2, sun.glow * 2);
      const disk = g.createRadialGradient(sun.x - sun.radius * .3, sun.y - sun.radius * .3, 0, sun.x, sun.y, sun.radius); disk.addColorStop(0, '#fff0c5'); disk.addColorStop(1, state.altitude < 10 ? '#f4bf83' : '#f8e5b0'); g.fillStyle = disk; g.beginPath(); g.arc(sun.x, sun.y, sun.radius, 0, Math.PI * 2); g.fill();
    }
    if (l.moon && state.moonVisible && state.stars > .02) {
      const moon=sunGeometry(w,h,s.appearance.horizonFraction,travelOnArch(w,h,s.appearance.horizonFraction,state.moonProgress));
      const x = moon.x, y = moon.y, r = moon.radius * .86;
      const glow = g.createRadialGradient(x, y, r, x, y, r * 3); glow.addColorStop(0, `rgba(192,208,222,${state.stars * .14})`); glow.addColorStop(1, 'rgba(192,208,222,0)'); g.fillStyle = glow; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      g.fillStyle = `rgba(229,230,211,${state.stars})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      for (const p of [[-.25, -.2, .13], [.2, .35, .17], [.36, -.18, .09]]) { g.fillStyle = `rgba(130,147,159,${state.stars * .16})`; g.beginPath(); g.arc(x + p[0] * r, y + p[1] * r, p[2] * r, 0, Math.PI * 2); g.fill(); }
    }
    if (l.clouds) { this.drawClouds(); g.drawImage(this.cloudLayer, 0, 0, w, h); }
    g.restore();
    if (l.outlook) {
      this.drawTerrain(); g.drawImage(this.terrain, 0, 0, w, h);
      if (s.appearance.outlookStyle === 'irish-lake' || s.appearance.outlookStyle === 'japanese-ocean') drawRegionalWater(g,s.appearance.outlookStyle,w,h,horizon,state.daylight,state.horizon,this.waterPhase);
    }
    if (l.tree) this.drawTree();
    if (l.lightRays && l.tree && l.sun && state.sunVisible && s.appearance.rayIntensity > 0 && sun.y < horizon - sun.radius) {
      if (time - this.lastRay > ({low:250,balanced:200,high:120}[s.rendering.quality])) { this.drawRays(sun); this.lastRay = time; }
      g.drawImage(this.rayLayer, 0, 0, w, h);
    }
    if (l.tree) g.drawImage(this.tree, 0, 0, w, h);
    if (l.windowFrame) {
      const key = `${this.width}:${this.height}:${this.density}:${s.appearance.frameStyle}:${s.appearance.crossbars}`;
      if (key !== this.frameKey) { this.drawFrame(this.logical(this.frame)); this.frameKey = key; }
      g.drawImage(this.frame, 0, 0, w, h);
    }
    if (s.appearance.brightness < 1) { g.fillStyle = `rgba(0,0,0,${1 - s.appearance.brightness})`; g.fillRect(0, 0, w, h); }
    else if (s.appearance.brightness > 1) { g.fillStyle = `rgba(255,239,214,${(s.appearance.brightness - 1) * .35})`; g.fillRect(0, 0, w, h); }
  }
  private drawClouds() {
    const color = this.state.cloud.map(v => Math.round(v / 5) * 5) as RGB, key = color.join(',');
    const renderKey = `${this.width}:${this.height}:${this.density}:${key}:${this.clock.cloudDistance}:${this.cloudSeed}:${this.settings.clouds.coverage}`;
    if (renderKey === this.cloudRenderKey) return; this.cloudRenderKey = renderKey;
    const g = this.logical(this.cloudLayer);
    if (key !== this.cloudTintKey) { for(const c of this.coloredClouds)if(c){c.width=1;c.height=1;} this.coloredClouds=[];this.cloudTintKey=key; }
    const count = Math.round(this.settings.clouds.coverage * 13), u = Math.min(this.width, this.height);
    for (const cloud of this.clouds.slice(0, count)) {
      const mask=this.cloudMasks[cloud.shape]??(this.cloudMasks[cloud.shape]=this.makeCloud(cloud.shape));
      if(!this.coloredClouds[cloud.shape]){ const c=surface();c.width=mask.width;c.height=mask.height;const d=ctx(c);d.drawImage(mask,0,0);d.globalCompositeOperation='source-in';d.fillStyle=cssColor(color);d.fillRect(0,0,c.width,c.height);this.coloredClouds[cloud.shape]=c; }
      const width = u * .4 * cloud.scale; g.globalAlpha = .83; g.drawImage(this.coloredClouds[cloud.shape], cloud.x * this.width - width / 2, cloud.y * this.height, width, width * 160 / 360);
    }
    g.globalAlpha = 1;
  }
  private drawTerrain() {
    const s = this.settings, state = this.state, key = `${this.width}:${this.height}:${s.appearance.outlookStyle}:${s.appearance.horizonFraction}:${Math.round(state.daylight * 70)}:${state.horizon.map(v => Math.round(v / 5)).join()}`;
    if (key === this.terrainKey) return; this.terrainKey = key;
    const g = this.logical(this.terrain), w = this.width, h = this.height, base = h * s.appearance.horizonFraction, u = Math.min(w, h), r = random(66771);
    const tint = (day: RGB, depth = 0) => cssColor(colorMix(colorMix([25, 42, 63], day, state.daylight), state.horizon, depth));
    if (['meadow','field','american-mountains','irish-lake'].includes(s.appearance.outlookStyle)) this.tintGrass();
    if ((regionalOutlooks as readonly string[]).includes(s.appearance.outlookStyle)) {
      drawRegionalLandscape(g,s.appearance.outlookStyle as RegionalOutlook,{width:w,height:h,horizon:base,daylight:state.daylight,horizonColor:state.horizon,grass:this.tintedGrass,trees:this.forestTrees});
    } else if (s.appearance.outlookStyle === 'mountains') {
      for (let layer = 0; layer < 4; layer++) {
        g.beginPath(); g.moveTo(-u * .1, h); let x = -u * .1;
        while (x < w + u * .4) { g.lineTo(x, base + layer * u * .052 - r() * u * (.21 - layer * .026)); x += u * (.08 + r() * .11); }
        g.lineTo(w + u * .4, h); g.closePath(); g.fillStyle = tint([61 + layer * 5, 99 + layer * 9, 111 - layer * 6], .3 - layer * .07); g.fill();
      }
    } else if (s.appearance.outlookStyle === 'city') {
      const facades:RGB[]=[[178,162,145],[165,174,163],[189,170,151],[174,157,151],[180,176,158]];
      const roofs:RGB[]=[[119,96,91],[103,106,105],[139,105,90]];
      for (let layer = 0; layer < 3; layer++) {
        let x = -30,building=0; while (x < w + 100) {
          const width = u * (.04 + r() * .085), height = u * (.026 + r() * .105), roof = u * (.012 + r() * .018), y = base + layer * u * .038, top=y-height;
          const facade=facades[(building+layer*2)%facades.length],depth=.22-layer*.05;
          g.fillStyle=tint(facade,depth);g.fillRect(x,top,width,h-top);
          // A side strip and continuous floor bands break up the long foreground façades.
          g.fillStyle=tint([facade[0]-22,facade[1]-22,facade[2]-20],depth);g.fillRect(x+width*.91,top,width*.09,h-top);
          g.fillStyle=tint(roofs[(building+layer)%roofs.length],.2-layer*.05);g.beginPath();g.moveTo(x-3,top);g.lineTo(x+width*.5,top-roof);g.lineTo(x+width+3,top);g.closePath();g.fill();
          g.fillStyle=tint([facade[0]+19,facade[1]+15,facade[2]+12],depth);g.fillRect(x-1,top,width+2,Math.max(1,u*.002));
          const columns=Math.max(2,Math.min(5,Math.round(width/(u*.024)))),inset=width*.075,cell=(width-2*inset)/columns,paneWidth=cell*.63;
          const rowStep=u*(layer===0?.035:.038),paneHeight=rowStep*.56;
          for(let row=0,rowY=top+u*.018;rowY+paneHeight<h-u*.012;row++,rowY+=rowStep){
            if(row>0&&row%3===0){g.fillStyle=tint([facade[0]+12,facade[1]+10,facade[2]+7],depth);g.fillRect(x,rowY-u*.009,width,Math.max(1,u*.002));}
            for(let col=0;col<columns;col++){
              const px=x+inset+col*cell+(cell-paneWidth)/2,lit=state.daylight<.4&&r()>.73;
              g.fillStyle=tint([215,204,182],depth);g.fillRect(px-u*.0015,rowY-u*.0015,paneWidth+u*.003,paneHeight+u*.003);
              g.fillStyle=lit?'#cbb27b':tint([72,102,111],depth);g.fillRect(px,rowY,paneWidth,paneHeight);
              g.fillStyle=tint([facade[0]+23,facade[1]+19,facade[2]+15],depth);g.fillRect(px-u*.002,rowY+paneHeight+u*.001,paneWidth+u*.004,Math.max(1,u*.002));
            }
          }
          building++;
          x += width + u * .004;
        }
      }
    } else {
      const hillTop=(layer:number,x:number)=>base+layer*h*.067+u*(.018+layer*.006)*Math.sin(x/u*(3.7+layer)+layer*2)+u*.013*Math.sin(x/u*9+layer);
      const forestDepth=(depth:0|1)=>{
        const trees=random(19214+depth*157);
        g.save();g.globalAlpha=depth===0?.42:.86;g.filter=`saturate(.43) brightness(${(.28+state.daylight*(depth===0?.62:.59)).toFixed(2)})`;
        for(let x=-u*.03;x<w+u*.04;x+=u*(.014+trees()*.015)){
          if(trees()<.065)continue;
          const im=this.forestTrees[Math.floor(trees()*this.forestTrees.length)],treeHeight=u*(depth===0?.030:.047)+trees()*u*(depth===0?.025:.040),treeWidth=treeHeight*im.width/im.height;
          const root=hillTop(0,x)+u*.003;
          g.save();g.translate(x,root);if(trees()>.5)g.scale(-1,1);g.drawImage(im,-treeWidth/2,-treeHeight,treeWidth,treeHeight);g.restore();
        }
        g.restore();
      };
      for (let layer = 0; layer < 4; layer++) {
        // The far treeline is behind the hill, so the hill covers every root.
        if(layer===0&&s.appearance.outlookStyle==='meadow'&&this.forestTrees.length)forestDepth(0);
        const start = base + layer * h * .067; g.beginPath(); g.moveTo(0, h); g.lineTo(0, start);
        for (let x = 0; x <= w + 20; x += 20) g.lineTo(x,hillTop(layer,x));
        g.lineTo(w + 20, h); g.closePath(); g.fillStyle = tint(s.appearance.outlookStyle === 'field' ? [136 - layer * 13, 161 - layer * 10, 99 - layer * 7] : [112 - layer * 12, 154 - layer * 13, 109 - layer * 8], .22 - layer * .06); g.fill();
        // The near treeline touches this exact profile, a few pixels into the grass.
        if(layer===0&&s.appearance.outlookStyle==='meadow'&&this.forestTrees.length)forestDepth(1);
        if (this.tintedGrass.length) {
          const grass=random(9250+layer*143),count=Math.min(110,Math.ceil(w/u*(14+layer*9)));g.save();g.globalAlpha=.52+layer*.09;
          for(let n=0;n<count;n++){
            const x=(n+grass()*.8)*w/count,top=hillTop(layer,x);
            const image=this.tintedGrass[Math.floor(grass()*this.tintedGrass.length)],height=u*(.012+layer*.004)*(.68+grass()*.68),width=height*image.width/image.height;
            g.save();g.translate(x,top+u*.003);if(grass()>.5)g.scale(-1,1);g.drawImage(image,-width/2,-height,width,height);g.restore();
          }
          g.restore();
        }
      }
      if (s.appearance.outlookStyle === 'field') {
        for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(w * .52 + (i - 4) * u * .013, base + h * .065); g.lineTo((i / 7) * w, h); g.lineWidth = u * .003; g.strokeStyle = tint([179, 175, 109]); g.stroke(); }
        g.strokeStyle = tint([65, 111, 82]); g.lineWidth = u * .008; g.beginPath(); g.moveTo(0, base + h * .19); g.bezierCurveTo(w * .3, base + h * .12, w * .6, base + h * .25, w, base + h * .2); g.stroke();
      } else {
        for (let i = 0; i < Math.ceil(w / u * 65); i++) { const x = r() * w, y = base + h * (.10 + r() * .28); g.fillStyle = tint(r() > .75 ? [231, 212, 162] : [88, 137, 87]); g.beginPath(); g.ellipse(x, y, u * (.0015 + r() * .002), u * .0014, 0, 0, Math.PI * 2); g.fill(); }
      }
      // Retain a simple hedgerow for fields and while meadow tree ingredients are loading.
      if (s.appearance.outlookStyle === 'field' || !this.forestTrees.length) for (let i = 0; i < Math.ceil(w / u * 19); i++) { const x = i * u / 19 + r() * u * .035, y = base + Math.sin(x / u * 4) * u * .018, size = u * (.012 + r() * .02); g.fillStyle = tint([73, 111, 89], .22); for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + (k - 1) * size * .6, y - size * .35 + r() * size * .28, size * (.75 + r() * .3), size * (.55 + r() * .2), 0, 0, Math.PI * 2); g.fill(); } }
    }
  }
  private tintGrass() {
    if (!this.grassImages.length) return;
    const style=this.settings.appearance.outlookStyle, key=`${Math.round(this.state.daylight*12)}:${style}`;
    if (key===this.grassTint) return;
    const grassColor=colorMix([35,57,64],style==='field'?[102,133,75]:[87,137,82],this.state.daylight);
    for(const old of this.tintedGrass){old.width=1;old.height=1;}
    this.tintedGrass=this.grassImages.map((im,i)=>{const c=surface();c.width=im.width;c.height=im.height;const d=ctx(c);d.drawImage(im,0,0);d.globalCompositeOperation='source-in';d.fillStyle=cssColor(grassColor.map((v,j)=>Math.max(0,v+(i-1)*(j===1?10:4))) as RGB);d.fillRect(0,0,c.width,c.height);return c;});
    this.grassTint=key;
  }
  private drawTree() {
    const w = this.width, h = this.height, u = Math.min(w, h), state = this.state;
    const tint = colorMix([22, 43, 54], [70, 116, 62], state.daylight), key = tint.map(v => Math.round(v / 4) * 4).join(',');
    const renderKey = `${w}:${h}:${this.density}:${key}:${Math.round(state.daylight * 70)}:${this.clock.tree}:${this.poseAmplitude}:${this.treeSeed}:${this.settings.tree.anchor}:${this.settings.appearance.outlookStyle}`;
    if (renderKey === this.treeRenderKey) return; this.treeRenderKey = renderKey;
    const g = this.logical(this.tree);
    const style=this.settings.appearance.outlookStyle;
    if((regionalOutlooks as readonly string[]).includes(style)&&style!=='irish-lake'){
      drawRegionalForeground(g,style as Exclude<RegionalOutlook,'irish-lake'>,w,h,state.daylight,this.settings.tree.anchor,this.clock.tree,this.poseAmplitude);
      return;
    }
    if (key !== this.leafTint && this.leafImages.length) {
      this.tintedLeaves = this.leafImages.map((im, i) => { const c = surface(); c.width = im.width; c.height = im.height; const d = ctx(c); d.drawImage(im, 0, 0); d.globalCompositeOperation = 'source-in'; d.fillStyle = cssColor(tint.map((v, j) => v + (i % 3 - 1) * (j === 1 ? 9 : 3)) as RGB); d.fillRect(0, 0, c.width, c.height); return c; }); this.leafTint = key;
    }
    g.save(); const left = this.settings.tree.anchor === 'upper-left'; g.translate(left ? 0 : w, 0); g.scale(left ? 1 : -1, 1);
    const phase = this.clock.tree, amplitude = this.poseAmplitude;
    g.strokeStyle = cssColor(colorMix([28, 38, 45], [88, 79, 49], state.daylight)); g.lineCap = 'round';
    const strokeStem=(point:(t:number)=>{x:number;y:number},width:number)=>{
      for(let part=0;part<4;part++){
        g.lineWidth=width*(1-part*.22);g.beginPath();
        for(let step=0;step<=5;step++){const p=point((part+step/5)/4);if(step===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}g.stroke();
      }
    };
    strokeStem(t=>trunkPoint(u,h,t),u*.053);
    for(const branch of this.canopy){
      const root=trunkPoint(u,h,branch.trunkT);
      g.save();g.translate(root.x,root.y);g.rotate(Math.sin(phase*.38+branch.phase)*.004*amplitude);
      strokeStem(t=>branchPoint(branch,u,t),u*.017);
      for(const twig of branch.twigs){
        const joint=branchPoint(branch,u,twig.t);
        g.save();g.translate(joint.x,joint.y);g.rotate(Math.sin(phase*.59+twig.phase)*.010*amplitude);
        const twigMid=twigPoint(twig,u,.5),twigEnd=twigPoint(twig,u,1);
        g.lineWidth=u*.0032;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(twigMid.x*2-twigEnd.x*.5,twigMid.y*2-twigEnd.y*.5,twigEnd.x,twigEnd.y);g.stroke();
        for(const leaf of twig.leaves){
          const node=twigPoint(twig,u,leaf.t),before=twigPoint(twig,u,Math.max(0,leaf.t-.02));
          const dx=node.x-before.x,dy=node.y-before.y,mag=Math.hypot(dx,dy)||1;
          const tx=dx/mag,ty=dy/mag,side=leaf.side;
          const vx=side===0?tx:tx*.22+ty*side*.95,vy=side===0?ty:ty*.22-tx*side*.95;
          const vm=Math.hypot(vx,vy)||1,stem=side===0?u*.003:u*.011;
          const endX=node.x+vx/vm*stem,endY=node.y+vy/vm*stem,size=leaf.size*u,image=this.tintedLeaves[leaf.kind];
          g.lineWidth=u*.0011;g.beginPath();g.moveTo(node.x,node.y);g.lineTo(endX,endY);g.stroke();
          g.save();g.translate(endX,endY);g.rotate(Math.atan2(vx,-vy)+Math.sin(phase*.84+leaf.phase)*.018*amplitude);
          if(image){const aspect=image.width/image.height;g.drawImage(image,leaf.kind>=5?-size*aspect*.16:-size*aspect/2,-size,size*aspect,size);}
          else{g.fillStyle=cssColor(tint);g.beginPath();g.ellipse(0,-size/2,size*.25,size/2,0,0,Math.PI*2);g.fill();}
          g.restore();
        }
        g.restore();
      }
      const tip=branchPoint(branch,u,1),before=branchPoint(branch,u,.98),tipImage=this.tintedLeaves[5+this.canopy.indexOf(branch)%2];
      if(tipImage){const size=u*.034,aspect=tipImage.width/tipImage.height;g.save();g.translate(tip.x,tip.y);g.rotate(Math.atan2(tip.x-before.x,-(tip.y-before.y)));g.drawImage(tipImage,-size*aspect*.16,-size,size*aspect,size);g.restore();}
      g.restore();
    }
    g.restore();
  }
  private drawRays(sun: ReturnType<typeof sunGeometry>) {
    const w = this.width, h = this.height, cap = { low: 120, balanced: 180, high: 260 }[this.settings.rendering.quality];
    const mw = cap, mh = Math.max(40, Math.round(cap * h / w));
    this.mask.width = mw; this.mask.height = mh; this.rayLayer.width = mw; this.rayLayer.height = mh;
    const m = ctx(this.mask,{willReadFrequently:true}); m.clearRect(0, 0, mw, mh);
    if (this.settings.layers.clouds) m.drawImage(this.cloudLayer, 0, 0, mw, mh);
    if (this.settings.layers.outlook) m.drawImage(this.terrain, 0, 0, mw, mh); m.drawImage(this.tree, 0, 0, mw, mh);
    const mask = m.getImageData(0, 0, mw, mh).data, out = ctx(this.rayLayer).createImageData(mw, mh), sx = sun.x / w * mw, sy = sun.y / h * mh;
    const alpha = (x: number, y: number) => x < 0 || x >= mw || y < 0 || y >= mh ? 0 : mask[(Math.floor(y) * mw + Math.floor(x)) * 4 + 3] / 255;
    const source = 1 - alpha(sx, sy), strength = this.settings.appearance.rayIntensity;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      if (y / mh >= this.settings.appearance.horizonFraction || alpha(x, y) > .5) continue;
      let transmission = source;
      for (let k = 1; k <= 12 && transmission > .015; k++) { const t = k / 13; transmission *= 1 - alpha(mix(sx, x, t), mix(sy, y, t)) * .95; }
      const distance = Math.hypot((x - sx) / mw, (y - sy) / mh), index = (y * mw + x) * 4;
      out.data[index] = 255; out.data[index + 1] = 233; out.data[index + 2] = 179; out.data[index + 3] = Math.round(255 * strength * transmission * clamp(1 - distance / .8) * .42);
    }
    ctx(this.rayLayer).putImageData(out, 0, 0); this.rayPasses++;
  }
  private drawFrame(g: Context) {
    const { width: w, height: h } = this, u = Math.min(w, h), s = this.settings.appearance;
    const thickness = u * (s.frameStyle === 'minimal' ? .012 : s.frameStyle === 'dark-metal' ? .019 : .047), bars: { x: number; y: number; w: number; h: number; vertical: boolean }[] = [
      { x: 0, y: 0, w: w, h: thickness, vertical: false }, { x: 0, y: h - thickness, w: w, h: thickness, vertical: false },
      { x: 0, y: 0, w: thickness, h: h, vertical: true }, { x: w - thickness, y: 0, w: thickness, h: h, vertical: true }];
    const cross = thickness * .55;
    if (s.crossbars !== 'none') bars.push({ x: w * .5 - cross / 2, y: thickness, w: cross, h: h - thickness * 2, vertical: true });
    if (s.crossbars === 'classic') bars.push({ x: thickness, y: h * .46 - cross / 2, w: w - thickness * 2, h: cross, vertical: false });
    for (const bar of bars) {
      g.save(); g.shadowColor = '#0c192950'; g.shadowBlur = u * .016; g.shadowOffsetX = u * .007; g.shadowOffsetY = u * .012;
      g.fillStyle = s.frameStyle === 'white-wood' ? '#cfcdbd' : s.frameStyle === 'warm-wood' ? '#9a704d' : '#29343b'; g.fillRect(bar.x, bar.y, bar.w, bar.h); g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
      g.beginPath(); g.rect(bar.x, bar.y, bar.w, bar.h); g.clip();
      if (s.frameStyle === 'warm-wood' && this.wood) {
        g.save(); g.globalAlpha = .32; g.translate(bar.x, bar.y); if (bar.vertical) g.rotate(Math.PI / 2);
        const pattern = g.createPattern(this.wood, 'repeat'); if (pattern) { const size = u * .7; pattern.setTransform(new DOMMatrix().scale(size / this.wood.width)); g.fillStyle = pattern; g.fillRect(bar.vertical ? 0 : -2, bar.vertical ? -bar.w : 0, bar.vertical ? bar.h : bar.w + 4, bar.vertical ? bar.w : bar.h); } g.restore();
      }
      const bevel = bar.vertical ? g.createLinearGradient(bar.x, 0, bar.x + bar.w, 0) : g.createLinearGradient(0, bar.y, 0, bar.y + bar.h);
      bevel.addColorStop(0, 'rgba(255,238,204,.28)'); bevel.addColorStop(.12, 'rgba(255,238,204,.1)'); bevel.addColorStop(.8, 'rgba(0,0,0,.06)'); bevel.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = bevel; g.fillRect(bar.x, bar.y, bar.w, bar.h); g.restore();
    }
    if (s.frameStyle === 'warm-wood' || s.frameStyle === 'white-wood') { const sill = g.createLinearGradient(0, h - thickness * .6, 0, h); sill.addColorStop(0, s.frameStyle === 'warm-wood' ? '#b48c63' : '#dedbcc'); sill.addColorStop(1, s.frameStyle === 'warm-wood' ? '#775741' : '#a9aea9'); g.fillStyle = sill; g.fillRect(0, h - thickness * .45, w, thickness * .45); }
  }
  snapshot() { return { running:this.running,frames: this.frames, width: this.width, height: this.height, backing: [this.canvas.width, this.canvas.height], density: this.density, outlookStyle:this.settings.appearance.outlookStyle,terrainStyle:this.terrainKey.split(':')[2]??null,bufferPixels:[this.canvas,this.terrain,this.tree,this.cloudLayer,this.frame,this.rayLayer,this.mask].reduce((n,c)=>n+c.width*c.height,0),texturePixels:[...this.cloudMasks,...this.coloredClouds,...this.tintedLeaves,...this.tintedGrass].reduce((n,c)=>n+(c?c.width*c.height:0),0)+(this.wood?this.wood.width*this.wood.height:0)+[...this.leafImages,...this.grassImages,...this.forestTrees].reduce((n,c)=>n+c.width*c.height,0),cloudClock: this.clock.cloud, treeClock: this.clock.tree, waterPhase:this.waterPhase, clouds: this.clouds.map(c => ({ ...c })), errors: this.errors, rayPasses: this.rayPasses }; }
}
