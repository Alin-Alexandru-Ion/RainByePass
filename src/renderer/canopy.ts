import { random } from '../core/motion';

export interface Point { x: number; y: number }
export interface CanopyLeaf { t: number; side: -1 | 0 | 1; size: number; kind: number; phase: number }
export interface CanopyTwig { t: number; side: -1 | 1; length: number; phase: number; leaves: CanopyLeaf[] }
export interface CanopyBranch { trunkT: number; length: number; rise: number; phase: number; twigs: CanopyTwig[] }

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const q=1-t;return q*q*q*a+3*q*q*t*b+3*q*t*t*c+t*t*t*d;
};
export function trunkPoint(u: number, h: number, t: number): Point {
  return {x:cubic(-u*.025,u*.018,u*.035,-u*.03,t),y:cubic(h*.80,h*.49,h*.08,-h*.08,t)};
}
export function branchPoint(branch: CanopyBranch, u: number, t: number): Point {
  const length=branch.length*u;
  return {x:cubic(0,length*.20,length*.62,length,t),y:cubic(0,length*.045,-length*.12,-length*branch.rise,t)};
}
export function twigPoint(twig: CanopyTwig, u: number, t: number): Point {
  const length=twig.length*u,endX=length*.78,endY=length*(twig.side*.68-.15),q=1-t;
  return {x:2*q*t*endX*.50+t*t*endX,y:2*q*t*endY*.22+t*t*endY};
}
/** Repeatable, node-based canopy: lateral twigs leave main shoots and leaves leave twig nodes. */
export function buildCanopy(seed: number): CanopyBranch[] {
  const r=random(seed),trunkT=[.37,.51,.64,.76],length=[.55,.49,.43,.36],rise=[.24,.22,.20,.18];
  return trunkT.map((t,branch)=>({trunkT:t,length:length[branch],rise:rise[branch],phase:r()*Math.PI*2,
    twigs:Array.from({length:8},(_,node)=>{
      const side: -1|1=node%2===0?-1:1;
      const twig:CanopyTwig={t:.16+node*.105+(r()-.5)*.018,side,length:(.075+r()*.036)*(1-node*.025),phase:r()*Math.PI*2,leaves:[]};
      for(let leaf=0;leaf<2;leaf++)twig.leaves.push({t:.34+leaf*.31+(r()-.5)*.05,side:(node+leaf)%2===0?-1:1,size:.022+r()*.010,kind:Math.floor(r()*5),phase:r()*Math.PI*2});
      twig.leaves.push({t:1,side:0,size:node%4===1?.039:.025+r()*.008,kind:node%4===1?5+Math.floor(r()*2):Math.floor(r()*5),phase:r()*Math.PI*2});
      return twig;
    })}));
}
