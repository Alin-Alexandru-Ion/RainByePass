import { colorMix, cssColor, type RGB } from '../core/solar';
import { random } from '../core/motion';
import type { OutlookStyle } from '../core/settings';

export const regionalOutlooks = ['american-mountains', 'arabian-desert', 'irish-lake', 'japanese-ocean', 'latin-badlands'] as const;
export type RegionalOutlook = Extract<OutlookStyle, typeof regionalOutlooks[number]>;

interface Landscape {
  width: number;
  height: number;
  horizon: number;
  daylight: number;
  horizonColor: RGB;
  grass: HTMLCanvasElement[];
  trees: HTMLImageElement[];
}

/** Original, cached Canvas2D compositions. Coordinates scale with the viewport and its horizon. */
export function drawRegionalLandscape(g: CanvasRenderingContext2D, style: RegionalOutlook, scene: Landscape): void {
  const { width: w, height: h, horizon: base, daylight, horizonColor, grass, trees } = scene;
  const u = Math.min(w, h), rng = random(74019 + regionalOutlooks.indexOf(style) * 1731);
  const tone = (day: RGB, distance = 0) => cssColor(colorMix(colorMix([18, 32, 50], day, daylight), horizonColor, distance));
  const polygon = (points: [number, number][], color: string) => {
    g.beginPath();g.moveTo(points[0][0] * w, base + points[0][1] * u);
    for (const [x, y] of points.slice(1)) g.lineTo(x * w, base + y * u);
    g.closePath();g.fillStyle = color;g.fill();
  };
  const ridge = (points: [number, number][], color: string) => polygon([[0, 1], ...points, [1, 1]], color);
  const tuft = (x: number, y: number, size: number, color: string) => {
    g.strokeStyle = color;g.lineWidth = Math.max(.6, u * .0011);g.lineCap = 'round';
    for (const lean of [-.75, -.2, .35, .85]) {g.beginPath();g.moveTo(x, y);g.quadraticCurveTo(x + lean * size * .35, y - size * .75, x + lean * size, y - size);g.stroke();}
  };
  const scatteredGrass = (count: number, yAt: (x: number) => number, size: number, color: string) => {
    for (let i = 0; i < count; i++) {
      const x = rng() * w, y = yAt(x), scale = size * (.55 + rng() * .9);
      if (grass.length && i % 3 !== 0) {
        const image = grass[Math.floor(rng() * grass.length)], tall = scale, wide = tall * image.width / image.height;
        g.save();g.translate(x,y);if(rng()>.5)g.scale(-1,1);g.globalAlpha=.55;g.drawImage(image,-wide/2,-tall,wide,tall);g.restore();
      } else tuft(x,y,scale,color);
    }
  };
  const water = (y: number, near: RGB, far: RGB) => {
    const gradient = g.createLinearGradient(0, y, 0, h);
    gradient.addColorStop(0,tone(far,.26));gradient.addColorStop(1,tone(near));
    g.fillStyle=gradient;g.fillRect(0,y,w,h-y);
  };
  g.save();
  if (style === 'american-mountains') {
    ridge([[0,.03],[.08,-.12],[.15,-.04],[.27,-.31],[.37,-.10],[.48,-.24],[.61,-.03],[.75,-.27],[.88,-.05],[1,.04]],tone([94,119,133],.34));
    for (const [x,y,span] of [[.27,-.31,.05],[.48,-.24,.045],[.75,-.27,.046]] as const) {
      polygon([[x-span*.55,y+.045],[x,y],[x+span*.6,y+.045],[x+span*.22,y+.034],[x,y+.039],[x-span*.18,y+.033]],tone([218,225,218],.2));
    }
    ridge([[0,.11],[.09,-.02],[.17,.10],[.32,-.13],[.43,.12],[.58,-.10],[.72,.10],[.85,-.14],[1,.08]],tone([76,111,114],.20));
    ridge([[0,.21],[.13,.12],[.29,.18],[.45,.075],[.59,.16],[.76,.07],[.9,.18],[1,.12]],tone([69,107,83],.07));
    // Three layered triangles give varied evergreen silhouettes without decoded image assets.
    for(let x=-u*.02;x<w+u*.03;x+=u*(.014+rng()*.014)){
      const y=base+u*(.13+.025*Math.sin(x/u*4)),size=u*(.026+rng()*.035);
      g.fillStyle=tone([48,82,68],.08);g.fillRect(x-size*.05,y-size*.2,size*.1,size*.22);
      for(let tier=0;tier<3;tier++){const top=y-size*(1-tier*.27),half=size*(.23+tier*.06);g.beginPath();g.moveTo(x,top);g.lineTo(x-half,y-size*(.22+tier*.03));g.lineTo(x+half,y-size*(.22+tier*.03));g.closePath();g.fill();}
    }
    ridge([[0,.36],[.15,.29],[.3,.33],[.47,.23],[.65,.31],[.83,.22],[1,.30]],tone([71,105,75]));
    scatteredGrass(Math.ceil(w/u*75),x=>base+u*(.30+.035*Math.sin(x/u*3.8)),u*.015,tone([45,83,58]));
  } else if (style === 'arabian-desert') {
    const dune=(start:number,amp:number,freq:number,phase:number,color:string)=>{
      g.beginPath();g.moveTo(0,h);g.lineTo(0,start+Math.sin(phase)*amp);
      for(let x=20;x<=w+20;x+=20)g.lineTo(x,start+Math.sin(x/u*freq+phase)*amp+Math.sin(x/u*freq*.43+phase)*amp*.27);
      g.lineTo(w+20,h);g.closePath();g.fillStyle=color;g.fill();
    };
    dune(base-u*.07,u*.07,2.1,.4,tone([205,167,115],.3));
    dune(base+u*.04,u*.11,1.8,2.7,tone([190,139,90],.17));
    dune(base+u*.18,u*.10,2.4,4.4,tone([225,174,111],.08));
    dune(base+u*.38,u*.08,2.7,1.1,tone([166,113,72]));
    g.save();g.strokeStyle=tone([244,209,150],.13);g.globalAlpha=.4;g.lineWidth=Math.max(1,u*.0016);
    for(let row=0;row<6;row++){const y=base+u*(.13+row*.075);g.beginPath();for(let x=0;x<=w;x+=u*.04){const yy=y+u*.032*Math.sin(x/u*2.3+row*.8);if(x===0)g.moveTo(x,yy);else g.lineTo(x,yy);}g.stroke();}g.restore();
    for(let i=0;i<Math.ceil(w/u*36);i++){const x=rng()*w,y=base+u*(.25+rng()*.5),size=u*(.002+rng()*.007);g.fillStyle=tone([115,80,58]);g.beginPath();g.ellipse(x,y,size*1.6,size*.4,0,0,Math.PI*2);g.fill();if(i%4===0)tuft(x,y,size*2,tone([103,101,63]));}
  } else if (style === 'irish-lake') {
    ridge([[0,-.02],[.13,-.12],[.27,-.04],[.43,-.18],[.57,-.085],[.73,-.15],[.88,-.045],[1,-.12]],tone([98,132,123],.32));
    ridge([[0,.07],[.17,-.015],[.34,.045],[.52,-.045],[.71,.035],[.85,-.03],[1,.06]],tone([70,112,91],.2));
    water(base+u*.07,[38,83,91],[105,145,149]);
    polygon([[.22,.075],[.42,.025],[.58,.055],[.66,.082],[.66,.11],[.22,.11]],tone([72,112,78],.14));
    if(trees.length){g.save();g.filter=`saturate(.55) brightness(${(.37+daylight*.55).toFixed(2)})`;g.globalAlpha=.75;
      for(let i=0;i<21;i++){const x=w*(.225+i*.0205),im=trees[i%trees.length],tall=u*(.026+(i%4)*.006),wide=tall*im.width/im.height;g.drawImage(im,x-wide/2,base+u*.069-tall,wide,tall);}g.restore();}
    polygon([[0,.27],[.09,.19],[.17,.24],[.23,.36],[.17,1],[0,1]],tone([76,118,73]));
    polygon([[.75,.34],[.87,.20],[1,.25],[1,1],[.84,1]],tone([65,109,69]));
    scatteredGrass(Math.ceil(w/u*50),x=>base+u*(x<w*.21?.25+.12*x/w:x>w*.79?.26+.11*(1-x/w):1.2),u*.02,tone([42,88,63]));
    for(let i=0;i<18;i++){const side=i%2===0?0:1,x=side? w-u*(.03+rng()*.12):u*(.03+rng()*.12),y=base+u*(.21+rng()*.25);tuft(x,y,u*(.015+rng()*.02),tone([58,94,66]));}
  } else if (style === 'japanese-ocean') {
    ridge([[0,.015],[.12,-.09],[.24,.015],[.36,-.065],[.48,.01],[.6,-.08],[.7,.02],[.81,-.03],[1,.025]],tone([105,132,144],.4));
    water(base+u*.015,[28,72,93],[99,149,164]);
    polygon([[0,.16],[.10,.14],[.18,.19],[.21,.235],[.16,.26],[0,.25]],tone([48,94,99],.25));
    polygon([[.74,.15],[.82,.035],[.89,-.035],[1,-.07],[1,.37],[.92,.32],[.85,.24]],tone([55,91,85],.13));
    polygon([[.86,.26],[.91,.23],[.95,.27],[1,.25],[1,.48],[.89,.38]],tone([67,83,80],.08));
    polygon([[0,.75],[.07,.65],[.13,.72],[.16,1],[0,1]],tone([47,69,76]));
    polygon([[.91,.84],[1,.70],[1,1],[.88,1]],tone([46,65,72]));
  } else {
    ridge([[0,.04],[.09,-.06],[.17,-.04],[.22,-.14],[.31,-.14],[.35,.015],[.51,-.03],[.56,-.12],[.65,-.12],[.72,.02],[.81,-.05],[.91,-.035],[1,.05]],tone([167,113,93],.35));
    polygon([[.06,.13],[.10,-.07],[.15,-.075],[.19,.13]],tone([175,104,76],.21));
    polygon([[.49,.14],[.55,-.12],[.65,-.12],[.71,.14]],tone([177,100,71],.20));
    polygon([[.78,.18],[.82,-.05],[.90,-.05],[.95,.18]],tone([163,91,72],.21));
    g.save();g.strokeStyle=tone([220,150,113],.17);g.lineWidth=u*.004;
    for(const [left,right,y] of [[.09,.17,.018],[.54,.67,.012],[.8,.93,.045]] as const){g.beginPath();g.moveTo(left*w,base+y*u);g.lineTo(right*w,base+y*u);g.stroke();}g.restore();
    ridge([[0,.23],[.17,.17],[.29,.28],[.44,.14],[.59,.24],[.73,.11],[.89,.23],[1,.16]],tone([137,82,68],.09));
    ridge([[0,.43],[.15,.34],[.31,.40],[.48,.32],[.65,.41],[.78,.28],[1,.37]],tone([161,96,71]));
    polygon([[.30,1],[.42,.66],[.53,.44],[.58,.39],[.62,.42],[.52,.60],[.66,1]],tone([199,133,92],.04));
    for(let i=0;i<Math.ceil(w/u*70);i++){const x=rng()*w,y=base+u*(.39+rng()*.59),size=u*(.004+rng()*.011);if(i%5===0)tuft(x,y,size,tone([84,92,63]));else{g.fillStyle=tone([106,68,59]);g.beginPath();g.ellipse(x,y,size*(.7+rng()),size*.3,0,0,Math.PI*2);g.fill();}}
  }
  g.restore();
}

/** Small deterministic strokes over cached terrain; no animated terrain canvas or image allocation. */
export function drawRegionalWater(g: CanvasRenderingContext2D, style: RegionalOutlook, width: number, height: number, horizon: number, daylight: number, horizonColor: RGB, phase: number): void {
  if (style !== 'irish-lake' && style !== 'japanese-ocean') return;
  const w=width,h=height,u=Math.min(w,h),lake=style==='irish-lake',rng=random(lake?83219:98417);
  const from=horizon+u*(lake?.13:.09),to=h-u*.035;
  const color=cssColor(colorMix(colorMix([79,115,129],lake?[214,225,210]:[221,237,229],daylight),horizonColor,.10));
  const cut=(points:[number,number][])=>{g.moveTo(points[0][0]*w,horizon+points[0][1]*u);for(const [x,y] of points.slice(1))g.lineTo(x*w,horizon+y*u);g.closePath();};
  g.save();g.beginPath();g.rect(0,from,w,h-from);
  if(lake){
    cut([[0,.27],[.09,.19],[.17,.24],[.23,.36],[.17,1],[0,1]]);
    cut([[.75,.34],[.87,.20],[1,.25],[1,1],[.84,1]]);
  }else{
    cut([[0,.16],[.10,.14],[.18,.19],[.21,.235],[.16,.26],[0,.25]]);
    cut([[.74,.15],[.82,.035],[.89,-.035],[1,-.07],[1,.37],[.92,.32],[.85,.24]]);
    cut([[.86,.26],[.91,.23],[.95,.27],[1,.25],[1,.48],[.89,.38]]);
    cut([[0,.75],[.07,.65],[.13,.72],[.16,1],[0,1]]);
    cut([[.91,.84],[1,.70],[1,1],[.88,1]]);
  }
  g.clip('evenodd');g.strokeStyle=color;g.lineCap='round';
  const count=Math.min(85,Math.ceil(w/u*(lake?48:65)));
  for(let i=0;i<count;i++){
    const depth=rng(),y=from+(to-from)*depth,x=rng()*w,length=u*(.016+rng()*(lake?.065:.085))*(.55+depth*.8);
    const drift=u*.009*Math.sin(phase*.8+i*1.31),lift=u*.0025*Math.sin(phase+i*.79);
    g.globalAlpha=(lake?.12:.10)+rng()*.20;g.lineWidth=Math.max(.7,u*(.0007+rng()*.0007));
    g.beginPath();g.moveTo(x-length/2+drift,y+lift);g.quadraticCurveTo(x+drift,y+lift-u*.002,x+length/2+drift,y+lift);g.stroke();
  }
  if(!lake){
    g.globalAlpha=.32;g.lineWidth=Math.max(1,u*.0018);
    for(let i=0;i<7;i++){const y=horizon+u*(.19+i*.073)+u*.003*Math.sin(phase+i*.8),x=u*(i%2?-.05:.14)+u*.01*Math.sin(phase*.6+i);g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(w*.43,y-u*.022,w*.72,y+u*.008);g.stroke();}
  }
  g.restore();
}

/** The nearby-tree switch keeps its meaning, but arid/coastal/mountain views get fitting branches. */
export function drawRegionalForeground(g: CanvasRenderingContext2D, style: Exclude<RegionalOutlook, 'irish-lake'>, width: number, height: number, daylight: number, anchor: 'upper-left' | 'upper-right', phase: number, amplitude: number): void {
  const u=Math.min(width,height),pine=style==='american-mountains'||style==='japanese-ocean',desert=style==='arabian-desert';
  const shade=(day:RGB)=>cssColor(colorMix([23,35,46],day,daylight));
  const wood=shade(desert?[111,88,61]:style==='latin-badlands'?[92,63,54]:[69,67,55]);
  const foliage=shade(desert?[105,111,72]:style==='latin-badlands'?[103,91,68]:style==='american-mountains'?[49,91,71]:[44,88,77]);
  g.save();g.translate(anchor==='upper-left'?0:width,0);g.scale(anchor==='upper-left'?1:-1,1);
  const main=(t:number)=>{const q=1-t;return {x:q*q*q*(-u*.03)+3*q*q*t*u*.06+3*q*t*t*u*.12+t*t*t*u*.39,y:q*q*q*height*.12+3*q*q*t*height*.14+3*q*t*t*height*.25+t*t*t*height*.29};};
  g.lineCap='round';g.strokeStyle=wood;
  for(let part=0;part<4;part++){g.lineWidth=u*(pine?.023:.016)*(1-part*.20);g.beginPath();for(let step=0;step<=5;step++){const p=main((part+step/5)/4);if(step===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}g.stroke();}
  for(let branch=0;branch<6;branch++){
    const {x,y}=main(.17+branch*.13),length=u*(.12+(branch%3)*.027)*(1-branch*.045),up=branch%2===0?-1:1;
    g.save();g.translate(x,y);g.rotate(Math.sin(phase*.46+branch*1.7)*.012*amplitude);
    g.strokeStyle=wood;g.lineWidth=u*(pine?.008:.0045);g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(length*.42,up*length*.23,length,up*length*.28);g.stroke();
    const count=pine?9:desert?5:3;
    for(let i=1;i<=count;i++){
      const t=i/(count+1),px=t*length,py=up*length*(.46*t-.18*t*t),size=u*(pine?.025:desert?.012:.008)*(1-.35*t);
      g.save();g.translate(px,py);g.rotate(Math.sin(phase*.7+branch+i*.83)*.03*amplitude);
      if(pine){g.strokeStyle=foliage;g.lineWidth=Math.max(.7,u*.0014);for(let needle=-3;needle<=3;needle++){g.beginPath();g.moveTo(0,0);g.lineTo(size*(.25+needle*.11),size*(needle*.22-.46));g.stroke();}}
      else if(desert||i%2===0){g.strokeStyle=wood;g.lineWidth=Math.max(.5,u*.0008);g.beginPath();g.moveTo(0,0);g.lineTo(size*.16,-size*.20);g.stroke();g.fillStyle=foliage;g.beginPath();g.ellipse(size*.34,-size*.28,size*.38,size*.14,-.6,0,Math.PI*2);g.fill();}
      g.restore();
    }
    g.restore();
  }
  g.restore();
}
