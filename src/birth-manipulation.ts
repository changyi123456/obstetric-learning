import {clamp,type BirthProgress} from './birth';

export type MotionPart=0|1;
export function manipulation(stage:number,part:MotionPart){
  const turn=stage>=2&&stage<=5;
  const head=stage>=1&&stage<=4||stage===5&&part===0;
  const instructions=[
    '抓住胎兒，沿青綠箭頭向下拖動。',
    '抓住胎頭，沿青綠箭頭拖入骨盆入口。',
    '抓住胎頭，沿青綠弧線轉動，使下巴靠近胸前。',
    '抓住胎頭，沿青綠弧線轉向母體前方。',
    '抓住胎頭，沿青綠弧線伸展，觀察頭部通過出口。',
    part===0?'抓住胎頭轉動，先解除頭與肩的相對扭轉。':'抓住肩部轉動，觀察已娩出的胎頭跟著外轉。',
    part===0?'抓住肩部，沿青綠箭頭拖動，先讓前肩通過。':'抓住軀幹繼續拖動，觀察後肩與軀幹通過。'
  ];
  return {kind:turn?'turn' as const:'move' as const,target:head?'head' as const:'body' as const,instruction:instructions[stage],degrees:stage===2?25:stage===4?90:45,view:stage===2||stage===4?'side' as const:stage===3||stage===5?'top' as const:'oblique' as const};
}

/** Short signed angle avoids a jump when a finger crosses the -π/π seam. */
export function angleStep(previous:number,next:number){return Math.atan2(Math.sin(next-previous),Math.cos(next-previous));}

/** Guard every input path, including pointers, keyboard and phase changes. */
export function changeModel(p:BirthProgress,part:MotionPart,value:number):BirthProgress{
  if(p.mode!=='practice'||p.submitted||!Number.isFinite(value))return p;
  if(part===1){if(p.stage<5||p.primary<85)return p;return {...p,secondary:Math.round(clamp(value,0,100))};}
  const primary=Math.round(clamp(value,-100,100));return {...p,primary,secondary:primary<85?0:p.secondary};
}
