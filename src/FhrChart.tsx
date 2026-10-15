import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FHR_CASES, intervalLabel, targetInterval, timeFromPoint, timeLabel, valuesAt, type MarkKind, type Marks, type TraceCase } from './fhr';
export type TimeWindow = [number,number];
interface Props { trace:TraceCase; marks:Marks; cursor:number; window:TimeWindow; reveal:boolean; locked:boolean; onMark:(kind:MarkKind,t:number|null)=>void; onSeek:(t:number)=>void }
export default function FhrChart({trace,marks,cursor,window:range,reveal,locked,onMark,onSeek}:Props){
 const ref=useRef<SVGSVGElement>(null),[width,setWidth]=useState(800),id=useId().replace(/:/g,'');
 const drag=useRef<{pointer:number;kind:MarkKind;before:number|null}|null>(null);
 useEffect(()=>{const svg=ref.current!;const obs=new ResizeObserver(([e])=>setWidth(Math.max(300,e.contentRect.width)));obs.observe(svg);return ()=>obs.disconnect();},[]);
 const left=45,right=width-15,top=42,fhrBottom=232,tocoTop=281,tocoBottom=370;
 const x=(t:number)=>left+(t-range[0])/(range[1]-range[0])*(right-left);
 const yFhr=(v:number)=>top+(180-v)/100*(fhrBottom-top),yToco=(v:number)=>tocoBottom-v/100*(tocoBottom-tocoTop);
 const paths=useMemo(()=>{
  const samples=Array.from({length:Math.ceil((range[1]-range[0])*2)+1},(_,i)=>Math.min(range[1],range[0]+i*.5));
  return ['fhr','toco'].map(key=>samples.map((t,i)=>`${i?'L':'M'}${(left+(t-range[0])/(range[1]-range[0])*(right-left)).toFixed(2)},${(key==='fhr'?yFhr(valuesAt(trace,t).fhr):yToco(valuesAt(trace,t).toco)).toFixed(2)}`).join(' '));
 },[trace,range[0],range[1],width]);
 const step=range[1]-range[0]>180?60:30;
 const ticks=Array.from({length:Math.floor(trace.duration/step)+1},(_,i)=>i*step).filter(t=>t>=range[0]&&t<=range[1]);
 const vertical=Array.from({length:43},(_,i)=>i*10).filter(t=>t>=range[0]&&t<=range[1]);
 function time(clientX:number){const r=ref.current!.getBoundingClientRect();return timeFromPoint(clientX,r.left+left/width*r.width,(right-left)/width*r.width,...range);}
 function cancel(){const d=drag.current;if(d){drag.current=null;onMark(d.kind,d.before);}}
 useEffect(()=>{globalThis.addEventListener('blur',cancel);const hidden=()=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',hidden);return ()=>{globalThis.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);};},[onMark]);
 return <svg ref={ref} className={`fhr-chart ${locked?'locked':''}`} viewBox={`0 0 ${width} 420`} role="group" aria-label="同步胎心率與宮縮曲線"
 onPointerDown={e=>{if(locked||e.button!==0)return;const r=e.currentTarget.getBoundingClientRect();const sy=(e.clientY-r.top)/r.height*420,sx=(e.clientX-r.left)/r.width*width;if(sx<left||sx>right)return;if(sy>385){onSeek(time(e.clientX));return;}const kind=sy>=top&&sy<=fhrBottom?'nadir':sy>=tocoTop&&sy<=tocoBottom?'peak':null;if(!kind)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={pointer:e.pointerId,kind,before:marks[kind]};onMark(kind,time(e.clientX));}}
 onPointerMove={e=>{if(drag.current?.pointer===e.pointerId)onMark(drag.current.kind,time(e.clientX));}}
 onPointerUp={e=>{if(drag.current?.pointer===e.pointerId){drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}}
 onPointerCancel={cancel} onLostPointerCapture={cancel}>
 <defs><clipPath id={id}><rect x={left} y={top} width={right-left} height={tocoBottom-top}/></clipPath></defs>
 <rect x={left} y={top} width={right-left} height={fhrBottom-top} fill="#fcfefe"/><rect x={left} y={tocoTop} width={right-left} height={tocoBottom-tocoTop} fill="#fffdf8"/>
 <g className="trace-grid">{vertical.map(t=><g key={t} stroke={t%60===0?'#c4d6dc':'#e8eff1'}><line x1={x(t)} x2={x(t)} y1={top} y2={fhrBottom}/><line x1={x(t)} x2={x(t)} y1={tocoTop} y2={tocoBottom}/></g>)}{[80,100,120,140,160,180].map(v=><g key={v}><line x1={left} x2={right} y1={yFhr(v)} y2={yFhr(v)} stroke="#dce7eb"/><text x={left-9} y={yFhr(v)+4} textAnchor="end">{v}</text></g>)}{[0,50,100].map(v=><g key={v}><line x1={left} x2={right} y1={yToco(v)} y2={yToco(v)} stroke="#e9e4d8"/><text x={left-9} y={yToco(v)+4} textAnchor="end">{v}</text></g>)}</g>
 <text x={left} y={22} className="trace-name">胎心率 <tspan className="trace-unit">bpm</tspan></text><text x={left} y={264} className="trace-name">宮縮 <tspan className="trace-unit">TOCO 相對讀值</tspan></text>
 <g clipPath={`url(#${id})`}>
 <rect x={x(120)} y={top} width={x(280)-x(120)} height={tocoBottom-top} fill="#168896" opacity=".035"/>
 <line x1={left} x2={right} y1={yFhr(trace.baseline)} y2={yFhr(trace.baseline)} stroke="#9daeb8" strokeDasharray="4 5"/>
 {reveal&&(['peak','nadir'] as MarkKind[]).map(kind=>{const interval=targetInterval(trace,kind);const e=(kind==='peak'?trace.contractions:trace.decels)[trace.target];const yy=kind==='peak'?tocoTop:top,hh=kind==='peak'?tocoBottom-tocoTop:fhrBottom-top;return <g key={kind} className="reference-event"><rect x={x(e.start)} width={x(e.end)-x(e.start)} y={yy} height={hh} fill={kind==='peak'?'#c08a29':'#138a96'} opacity=".09"/>{[e.start,e.end].map(t=><line key={t} x1={x(t)} x2={x(t)} y1={yy} y2={yy+hh} stroke="#8196a1" strokeDasharray="3 5"/>)}<line x1={x(interval[0])} x2={x(interval[1])} y1={yy+hh-8} y2={yy+hh-8} stroke="#142f46" strokeWidth="6"/><line x1={x((interval[0]+interval[1])/2)} x2={x((interval[0]+interval[1])/2)} y1={top} y2={tocoBottom} stroke="#142f46" strokeDasharray="5 5"/><path d={`M${x((interval[0]+interval[1])/2)-5},${yy+hh-12} l5,-5 l5,5 l-5,5 z`} fill="#142f46"/></g>;})}
 <path d={paths[0]} fill="none" stroke="#138a96" strokeWidth="2" strokeLinejoin="round"/><path d={paths[1]} fill="none" stroke="#b47b27" strokeWidth="2"/>
 <line x1={x(cursor)} x2={x(cursor)} y1={top} y2={tocoBottom} stroke="#7b8fa1" strokeWidth="1.5"/>
 {(['peak','nadir'] as MarkKind[]).map(kind=>{const t=marks[kind];if(t===null)return null;const yy=kind==='peak'?yToco(valuesAt(trace,t).toco):yFhr(valuesAt(trace,t).fhr);return <g key={kind}><line x1={x(t)} x2={x(t)} y1={top} y2={tocoBottom} stroke={kind==='peak'?'#b47b27':'#138a96'} opacity=".5"/><circle cx={x(t)} cy={yy} r={8} fill="white" stroke={kind==='peak'?'#b47b27':'#138a96'} strokeWidth="3"/><text x={x(t)} y={yy-15} textAnchor="middle" className="my-mark-label">{kind==='peak'?'①':'②'}</text></g>;})}
 </g>
 {ticks.map(t=><text key={t} x={x(t)} y={394} textAnchor="middle" className="trace-tick">{timeLabel(t)}</text>)}<text x={right} y={414} textAnchor="end" className="trace-tick">時間 分：秒</text>
 </svg>;
}
export function ReferenceTimes({trace}:{trace:TraceCase}) {const c=trace.contractions[trace.target],d=trace.decels[trace.target];return <dl className="fhr-reference-times"><div><dt>宮縮</dt><dd>{timeLabel(c.start)} 開始 · {intervalLabel(c.bottom)} 高峰 · {timeLabel(c.end)} 結束</dd></div><div><dt>減速</dt><dd>{timeLabel(d.start)} 開始 · {intervalLabel(d.bottom)} 最低 · {timeLabel(d.end)} 恢復</dd></div></dl>;}
