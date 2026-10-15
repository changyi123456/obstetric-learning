export type DecelType = 'early' | 'late' | 'variable';
export type MarkKind = 'peak' | 'nadir';
export type Marks = Record<MarkKind, number | null>;
export const FHR_VERSION = 'fhr-1';
export const MARK_TOLERANCE = 5;
export const FHR_TYPES = [
  { id: 'early', name: '早期減速', english: 'Early deceleration', text: '減速逐漸下降，開始、最低點與恢復大致呼應宮縮，像宮縮的倒影。', tip: '把整段減速和宮縮一起看：開始、波峰／谷底、結束是否大致同步？' },
  { id: 'late', name: '晚期減速', english: 'Late deceleration', text: '減速逐漸下降，整段相對宮縮延後；最低點在宮縮高峰之後，宮縮結束後才恢復。', tip: '除了最低點延後，也要追到減速開始，以及回到設定基線的位置。' },
  { id: 'variable', name: '變異性減速', english: 'Variable deceleration', text: '心率突然下降，形狀、深度及與宮縮的時間關係可改變；某一次也可能剛好對齊高峰。', tip: '注意快速下降與恢復，並比較三次事件。時間剛好對齊，不足以判成早期減速。' },
] as const;
export interface CurveEvent { start: number; bottom: [number, number]; end: number; depth: number }
export interface TraceCase {
  id: string; type: DecelType; baseline: number; contractions: CurveEvent[]; decels: CurveEvent[];
  target: number; duration: number; phase: number; note: string;
}
const definitions: Array<[DecelType, number, number, number, number, string]> = [
  ['early',140,25,0,0,'比較三段宮縮與減速的起訖，兩條曲線大致互為倒影。'],
  ['early',135,22,0,4,'中間高峰與谷底有短平台；平台內的任何位置都可以標記。'],
  ['early',145,28,0,0,'深度不同，仍須根據整段與宮縮同步的關係判讀。'],
  ['late',140,25,38,0,'逐漸下降的整段向後移，宮縮結束後仍未回到設定基線。'],
  ['late',145,30,44,0,'最低點延後 44 秒，請同時核對延後開始與延後恢復。'],
  ['late',135,22,34,4,'谷底有短平台；宮縮結束後才恢復，仍屬延後的整段變化。'],
  ['variable',140,40,0,0,'三次突然下降發生在不同相對位置，不能只看中間一個最低點。'],
  ['variable',145,45,1,0,'中間最低點正好對齊宮縮高峰，但下降突然，前後兩次時序也不同。'],
  ['variable',135,35,2,0,'下降與恢復較尖，三次事件的深度、時序及寬度有所變化。'],
];
export const FHR_CASES: TraceCase[] = definitions.map(([type,baseline,depth,shift,plateau,note],index)=>{
  const centers=[60,180,300];
  const contractions=centers.map(c=>({start:c-40,bottom:[c-plateau/2,c+plateau/2] as [number,number],end:c+40,depth:65}));
  const offsets=shift===1?[24,0,-18]:shift===2?[-24,18,4]:[-18,9,26];
  const decels=centers.map((c,i)=>{
    if(type==='variable') { const n=c+offsets[i];return {start:n-(12+i*2),bottom:[n,n] as [number,number],end:n+18+i*2,depth:depth+(i-1)*4}; }
    return {start:c-40+shift,bottom:[c+shift-plateau/2,c+shift+plateau/2] as [number,number],end:c+40+shift,depth};
  });
  return {id:`trace-${String(index+1).padStart(2,'0')}`,type,baseline,contractions,decels,target:1,duration:420,phase:index*.73,note};
});
export function curveShape(t:number,e:CurveEvent) {
  if(t<=e.start||t>=e.end)return 0;
  if(t>=e.bottom[0]&&t<=e.bottom[1])return 1;
  const x=t<e.bottom[0]?(t-e.start)/(e.bottom[0]-e.start):(e.end-t)/(e.end-e.bottom[1]);
  return (1-Math.cos(Math.PI*x))/2;
}
export function valuesAt(c:TraceCase,t:number) {
  const strength=Math.max(0,...c.decels.map(e=>curveShape(t,e)));
  // Fixed, irregular, small oscillations taper at the extrema to keep the marked plateau unambiguous.
  const oscillation=(2.1*Math.sin(t*1.71+c.phase)+1.25*Math.sin(t*2.83+.7)+.6*Math.sin(t*.41))*(1-strength**4);
  return {fhr:c.baseline+oscillation-c.decels.reduce((v,e)=>v+e.depth*curveShape(t,e),0),toco:10+c.contractions.reduce((v,e)=>v+e.depth*curveShape(t,e),0)};
}
export function targetInterval(c:TraceCase,kind:MarkKind):[number,number] {return (kind==='peak'?c.contractions:c.decels)[c.target].bottom;}
export function withinMark(value:number|null,interval:[number,number],tolerance=MARK_TOLERANCE){return value!==null&&Number.isFinite(value)&&value>=interval[0]-tolerance&&value<=interval[1]+tolerance;}
export function assessTrace(c:TraceCase,marks:Marks,choice:DecelType|null){
  const valid=marks.peak!==null&&marks.nadir!==null&&Object.values(marks).every(v=>v!==null&&Number.isFinite(v)&&v>=0&&v<=c.duration)&&FHR_TYPES.some(t=>t.id===choice);
  const peak=withinMark(marks.peak,targetInterval(c,'peak')),nadir=withinMark(marks.nadir,targetInterval(c,'nadir')),type=choice===c.type;
  return {valid,peak,nadir,type,correct:valid&&peak&&nadir&&type};
}
export const clampTime=(t:number,duration=420)=>Math.max(0,Math.min(duration,Math.round(t)));
export function timeFromPoint(x:number,left:number,width:number,start:number,end:number){return clampTime(Math.max(start,Math.min(end,start+(x-left)/Math.max(1,width)*(end-start))));}
export function timeLabel(t:number){return `${Math.floor(t/60)}:${String(Math.round(t%60)).padStart(2,'0')}`;}
export function intervalLabel([a,b]:[number,number]){return a===b?timeLabel(a):`${timeLabel(a)}–${timeLabel(b)}`;}
export function quizOrder(random= Math.random){
  const ids=FHR_TYPES.flatMap(t=>FHR_CASES.filter(c=>c.type===t.id).slice(1).map(c=>c.id));
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;
}
