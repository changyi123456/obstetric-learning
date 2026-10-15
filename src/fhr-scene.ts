import { FHR_CASES, FHR_TYPES, curveShape, timeLabel, valuesAt, type DecelType, type TraceCase } from './fhr';
export const SCENE_VERSION='fhr-room-1';
export const SCENE_KEY='obstetric-learning.fhr-room.v1';
export const SCENE_SPEED=3;
export const SCENE_CASES=[
 {id:'room-a',name:'床邊監測 A',traceId:'trace-04',intro:'39 週單胎頭位，正在持續監測。請接手床邊觀察，確認訊號並留下自己的宮縮紀錄。',slipAt:115},
 {id:'room-b',name:'床邊監測 B',traceId:'trace-01',intro:'同樣從床邊開始，觀察產婦每一陣反應，再比較完整減速與宮縮。',slipAt:null},
 {id:'room-c',name:'床邊監測 C',traceId:'trace-08',intro:'觀察多次變化。某一次時間對齊時，也要回看前後事件與下降速度。',slipAt:null},
] as const;
export type SceneCaseId=typeof SCENE_CASES[number]['id'];
export type SceneAction='ask'|'pulse'|'start-contraction'|'end-contraction'|'probe';
export interface SceneEvent { id:string;kind:SceneAction;time:number;text:string;value?:number }
export interface SceneAttempt {id:string;caseId:SceneCaseId;at:string;choice:DecelType;events:SceneEvent[];observedUntil:number;typeCorrect:boolean;intervalCorrect:boolean;asked:boolean;pulseChecked:boolean;signalChecked:boolean;correct:boolean}
export interface SceneProgress {version:typeof SCENE_VERSION;caseId:SceneCaseId;time:number;events:SceneEvent[];openContraction:number|null;probeOffset:number;choice:DecelType|null;submitted:boolean;attempts:SceneAttempt[];reduced:boolean;sound:boolean;}
export function freshScene():SceneProgress{return {version:SCENE_VERSION,caseId:'room-a',time:0,events:[],openContraction:null,probeOffset:.035,choice:null,submitted:false,attempts:[],reduced:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,sound:false};}
export function sceneCase(id:SceneCaseId){return SCENE_CASES.find(c=>c.id===id)!;}
export function sceneTrace(id:SceneCaseId):TraceCase{return FHR_CASES.find(c=>c.id===sceneCase(id).traceId)!;}
export function sceneSample(id:SceneCaseId,time:number){const trace=sceneTrace(id),strength=Math.max(...trace.contractions.map(e=>curveShape(time,e)));return {...valuesAt(trace,time),contraction:strength,maternal:Math.round(88+strength*7+Math.sin(time*.11)*1.4),patient:strength>.5?'這一陣比較緊，讓我慢慢呼吸。':strength>.12?'肚子又一陣一陣收緊了。':'這會兒比較放鬆，你可以告訴我監測的情況嗎？'};}
export function signalAt(p:Pick<SceneProgress,'caseId'|'events'|'probeOffset'>,time:number){const at=sceneCase(p.caseId).slipAt;if(at===null||time<at)return true;return p.events.some(e=>e.kind==='probe'&&e.time<=time);}
export function missingRanges(p:Pick<SceneProgress,'caseId'|'events'|'probeOffset'>):[number,number][]{const at=sceneCase(p.caseId).slipAt;if(at===null)return [];const fix=p.events.find(e=>e.kind==='probe');return [[at,fix?.time??421]];}
export function addSceneEvent(p:SceneProgress,kind:SceneAction,time:number):SceneProgress {
 if(p.submitted||!Number.isFinite(time)||time<0||time>420)return p;
 const t=Math.round(time),sample=sceneSample(p.caseId,t);
 let text='',value:number|undefined,open=p.openContraction;
 if(kind==='ask')text=`產婦回應：${sample.patient}`;
 else if(kind==='pulse'){text=`已核對母體脈搏 ${sample.maternal} bpm，對照當時胎心率。`;value=sample.maternal;}
 else if(kind==='probe'){if(signalAt(p,t))return p;text='調整探頭接觸，訊號恢復；未改動原始心率。';}
 else if(kind==='start-contraction'){if(open!==null)return p;open=t;text='記下宮縮開始。';}
 else {if(open===null||t<=open)return p;text=`記下宮縮結束，觀察持續 ${t-open} 秒。`;value=open;open=null;}
 return {...p,time:t,openContraction:open,probeOffset:kind==='probe'?0:p.probeOffset,events:[...p.events,{id:crypto.randomUUID(),kind,time:t,text,value}]};
}
export function assessScene(p:SceneProgress){
 const trace=sceneTrace(p.caseId),pairs=p.events.filter(e=>e.kind==='end-contraction');
 const intervalCorrect=pairs.some(e=>trace.contractions.some(c=>typeof e.value==='number'&&Math.abs(e.value-c.start)<=12&&Math.abs(e.time-c.end)<=12));
 const typeCorrect=p.choice===trace.type,asked=p.events.some(e=>e.kind==='ask'),pulseChecked=p.events.some(e=>e.kind==='pulse'),signalChecked=signalAt(p,p.time);
 const sufficient=trace.decels.filter(e=>e.end<=p.time).length>=2;
 return {intervalCorrect,typeCorrect,asked,pulseChecked,signalChecked,sufficient,correct:intervalCorrect&&typeCorrect&&asked&&pulseChecked&&signalChecked&&sufficient};
}
export function submitScene(p:SceneProgress):SceneProgress {
 if(p.submitted||!FHR_TYPES.some(t=>t.id===p.choice))return p;
 const r=assessScene(p);return {...p,submitted:true,attempts:[...p.attempts,{id:crypto.randomUUID(),caseId:p.caseId,at:new Date().toISOString(),choice:p.choice!,events:p.events.map(e=>({...e})),observedUntil:p.time,typeCorrect:r.typeCorrect,intervalCorrect:r.intervalCorrect,asked:r.asked,pulseChecked:r.pulseChecked,signalChecked:r.signalChecked,correct:r.correct}]};
}
export function restartScene(p:SceneProgress,id=p.caseId){return {...freshScene(),caseId:id,attempts:p.attempts,reduced:p.reduced,sound:p.sound};}
export function readScene():SceneProgress {
 const fresh=freshScene();try{const p=JSON.parse(localStorage.getItem(SCENE_KEY)||'null');if(!p||p.version!==SCENE_VERSION||!SCENE_CASES.some(c=>c.id===p.caseId)||typeof p.time!=='number'||!Number.isFinite(p.time)||p.time<0||p.time>420||!Array.isArray(p.events))return fresh;
 const events=p.events.filter((e:SceneEvent)=>e&&['ask','pulse','start-contraction','end-contraction','probe'].includes(e.kind)&&typeof e.time==='number'&&Number.isFinite(e.time)&&e.time>=0&&e.time<=p.time&&typeof e.text==='string'&&typeof e.id==='string');
 const attempts=Array.isArray(p.attempts)?p.attempts.filter((a:SceneAttempt)=>a&&SCENE_CASES.some(c=>c.id===a.caseId)&&Array.isArray(a.events)&&typeof a.at==='string'&&typeof a.correct==='boolean'&&FHR_TYPES.some(t=>t.id===a.choice)):[];
 return {...fresh,caseId:p.caseId,time:p.time,events,attempts,openContraction:typeof p.openContraction==='number'&&p.openContraction>=0&&p.openContraction<=p.time?p.openContraction:null,probeOffset:typeof p.probeOffset==='number'&&Number.isFinite(p.probeOffset)?Math.max(-.06,Math.min(.06,p.probeOffset)):0,choice:FHR_TYPES.some(t=>t.id===p.choice)?p.choice:null,submitted:p.submitted===true&&FHR_TYPES.some(t=>t.id===p.choice),reduced:p.reduced===true,sound:p.sound===true};
 }catch{return fresh;}
}
export function eventLabel(e:SceneEvent){return `${timeLabel(e.time)} ${e.text}`;}
