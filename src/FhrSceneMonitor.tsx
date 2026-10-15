import {useEffect,useMemo,useRef,useState} from 'react';
import {timeLabel,valuesAt,type TraceCase} from './fhr';
export default function FhrSceneMonitor({trace,time,gaps,pulse,pulseTime}:{trace:TraceCase;time:number;gaps:[number,number][];pulse:number|null;pulseTime:number|null}){
 const host=useRef<HTMLDivElement>(null),[width,setWidth]=useState(390);
 useEffect(()=>{const obs=new ResizeObserver(([e])=>setWidth(Math.max(260,e.contentRect.width)));if(host.current)obs.observe(host.current);return ()=>obs.disconnect();},[]);
 const left=36,right=width-12,start=Math.max(0,time-180),end=Math.max(180,time),x=(t:number)=>left+(t-start)/(end-start)*(right-left),yf=(v:number)=>30+(180-v)/100*105,yt=(v:number)=>228-v/100*58;
 const live=valuesAt(trace,time),signal=!gaps.some(([a,b])=>time>=a&&time<b);
 const paths=useMemo(()=>{
  const lines=['',''];let inFhr=false;
  for(let t=Math.ceil(start*2)/2;t<=time;t+=.5){const v=valuesAt(trace,t),xp=x(t).toFixed(1);const valid=!gaps.some(([a,b])=>t>=a&&t<b);if(valid){lines[0]+=`${inFhr?'L':'M'}${xp},${yf(v.fhr).toFixed(1)} `;inFhr=true;}else inFhr=false;lines[1]+=`${lines[1]?'L':'M'}${xp},${yt(v.toco).toFixed(1)} `;}return lines;
 },[trace,time,width,gaps]);
 const ticks=Array.from({length:15},(_,i)=>i*30).filter(t=>t>=start&&t<=end);
 return <div className="scene-monitor" ref={host}><div className="scene-monitor-title"><h2>同步監測</h2><span>{timeLabel(Math.floor(time))} · 縮時情境</span></div><div className="scene-readouts"><div><span>胎心率 FHR</span><strong>{signal?Math.round(live.fhr):'—'}<small>bpm</small></strong></div><div><span>母體脈搏</span><strong className="maternal-readout">{pulse??'—'}<small>bpm</small></strong><small>{pulseTime===null?'請在床邊核對':`${timeLabel(pulseTime)} 核對值`}</small></div></div>
 <svg viewBox={`0 0 ${width} 265`} className="scene-trace" role="img" aria-label={`同步記錄至 ${timeLabel(Math.floor(time))}，胎心率與宮縮使用同一時間軸；未來資料未顯示。`}>
 <defs><clipPath id="scene-monitor-clip"><rect x={left} y="28" width={right-left} height="203"/></clipPath></defs>
 <text x={left} y="15" className="monitor-track-label">胎心率 bpm</text><text x={left} y="157" className="monitor-track-label">宮縮 TOCO 相對讀值</text>
 {[80,100,120,140,160,180].map(v=><g key={v}><line x1={left} x2={right} y1={yf(v)} y2={yf(v)}/>{v%40===20&&<text x={left-7} y={yf(v)+4} textAnchor="end">{v}</text>}</g>)}{[0,50,100].map(v=><g key={v}><line x1={left} x2={right} y1={yt(v)} y2={yt(v)}/><text x={left-7} y={yt(v)+4} textAnchor="end">{v}</text></g>)}
 {ticks.map((t,i)=><g key={t}><line x1={x(t)} x2={x(t)} y1="28" y2="135"/><line x1={x(t)} x2={x(t)} y1="170" y2="228"/>{i%2===0&&<text x={x(t)} y="248" textAnchor={i===0?'start':'middle'}>{timeLabel(t)}</text>}</g>)}
 <g clipPath="url(#scene-monitor-clip)"><path d={paths[0]} className="fhr-monitor-line"/><path d={paths[1]} className="toco-monitor-line"/><line x1={x(time)} x2={x(time)} y1="28" y2="228" className="monitor-now"/>{signal&&<circle cx={x(time)} cy={yf(live.fhr)} r="3" className="monitor-endpoint"/>}</g>
 {time<1&&<text x={(left+right)/2} y="94" textAnchor="middle">開始後持續累積曲線</text>}<text x={right} y="264" textAnchor="end">時間 分：秒</text>
 </svg><div className={`scene-signal ${signal?'':'signal-lost'}`}><span/>{signal?'監測訊號持續記錄':'胎心訊號接觸不穩，請檢查探頭'}</div></div>;
}
