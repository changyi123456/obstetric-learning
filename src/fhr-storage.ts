import { FHR_CASES, FHR_TYPES, FHR_VERSION, assessTrace, clampTime, quizOrder, type DecelType, type MarkKind, type Marks } from './fhr';
export const FHR_KEY='obstetric-learning.fhr.v1';
export interface FhrAttempt { id:string; caseId:string; mode:'practice'|'quiz'; round:string; choice:DecelType; marks:Marks; hinted:boolean; peak:boolean; nadir:boolean; type:boolean; correct:boolean; at:string; elapsedSeconds:number }
export interface FhrProgress {
 version:typeof FHR_VERSION; mode:'watch'|'practice'|'quiz'; caseId:string; marks:Marks; choice:DecelType|null;
 submitted:boolean; hinted:boolean; hints:number; cursor:number; reduced:boolean; active:MarkKind;
 attempts:FhrAttempt[]; quiz:string[]; quizIndex:number; round:string; complete:boolean; startedAt:string;
}
export function freshFhr():FhrProgress {return {version:FHR_VERSION,mode:'watch',caseId:FHR_CASES[0].id,marks:{peak:null,nadir:null},choice:null,submitted:false,hinted:false,hints:0,cursor:0,reduced:false,active:'peak',attempts:[],quiz:[],quizIndex:0,round:'',complete:false,startedAt:new Date().toISOString()};}
export function selectTrace(p:FhrProgress,id:string):FhrProgress {return {...p,complete:false,caseId:id,marks:{peak:null,nadir:null},choice:null,submitted:false,hinted:false,cursor:0,active:'peak',startedAt:new Date().toISOString()};}
export function beginFhrQuiz(p:FhrProgress):FhrProgress {const quiz=quizOrder();return {...selectTrace(p,quiz[0]),mode:'quiz',quiz,quizIndex:0,round:crypto.randomUUID(),complete:false};}
export function submitFhr(p:FhrProgress):FhrProgress {
 if(p.submitted||p.mode==='watch')return p;
 const c=FHR_CASES.find(c=>c.id===p.caseId)!;const r=assessTrace(c,p.marks,p.choice);if(!r.valid)return p;
 const attempt:FhrAttempt={id:crypto.randomUUID(),caseId:c.id,mode:p.mode,round:p.mode==='quiz'?p.round:'practice',choice:p.choice!,marks:{...p.marks},hinted:p.hinted,peak:r.peak,nadir:r.nadir,type:r.type,correct:r.correct,at:new Date().toISOString(),elapsedSeconds:Math.max(0,Math.round((Date.now()-Date.parse(p.startedAt))/1000))};
 return {...p,submitted:true,attempts:[...p.attempts,attempt]};
}
export function nextFhr(p:FhrProgress):FhrProgress {
 if(p.mode==='quiz'){if(!p.submitted)return p;if(p.quizIndex===p.quiz.length-1)return {...p,complete:true};return {...selectTrace(p,p.quiz[p.quizIndex+1]),quizIndex:p.quizIndex+1};}
 return selectTrace(p,FHR_CASES[(FHR_CASES.findIndex(c=>c.id===p.caseId)+1)%FHR_CASES.length].id);
}
const isChoice=(v:unknown):v is DecelType=>FHR_TYPES.some(t=>t.id===v);
const isMarks=(v:unknown):v is Marks=>!!v&&typeof v==='object'&&['peak','nadir'].every(k=>{const t=(v as Marks)[k as MarkKind];return t===null||(typeof t==='number'&&Number.isFinite(t)&&t>=0&&t<=420);});
export function readFhr():FhrProgress {
 const fresh=freshFhr();try {
  const v=JSON.parse(localStorage.getItem(FHR_KEY)||'null');
  if(!v||v.version!==FHR_VERSION||!FHR_CASES.some(c=>c.id===v.caseId)||!['watch','practice','quiz'].includes(v.mode)||!isMarks(v.marks)||v.choice!==null&&!isChoice(v.choice))return fresh;
  const quiz=Array.isArray(v.quiz)?v.quiz.filter((id:unknown)=>FHR_CASES.some(c=>c.id===id)):[];
  if(v.mode==='quiz'&&(quiz.length!==6||new Set(quiz).size!==6||!Number.isInteger(v.quizIndex)||v.quizIndex<0||v.quizIndex>=6||quiz[v.quizIndex]!==v.caseId))return fresh;
  const attempts=Array.isArray(v.attempts)?v.attempts.filter((a:Partial<FhrAttempt>)=>a&&FHR_CASES.some(c=>c.id===a.caseId)&&isChoice(a.choice)&&isMarks(a.marks)&&a.marks.peak!==null&&a.marks.nadir!==null&&['practice','quiz'].includes(a.mode??'')&&['peak','nadir','type','correct'].every(k=>typeof a[k as keyof FhrAttempt]==='boolean')&&typeof a.at==='string'&&typeof a.id==='string'&&typeof a.round==='string'):[];
  return {...fresh,mode:v.mode,caseId:v.caseId,marks:v.marks,choice:v.choice,submitted:v.submitted===true&&assessTrace(FHR_CASES.find(c=>c.id===v.caseId)!,v.marks,v.choice).valid,hinted:v.hinted===true,hints:Number.isInteger(v.hints)&&v.hints>=0?v.hints:0,cursor:typeof v.cursor==='number'&&Number.isFinite(v.cursor)?clampTime(v.cursor):0,reduced:v.reduced===true,active:v.active==='nadir'?'nadir':'peak',attempts,quiz,quizIndex:v.quizIndex??0,round:typeof v.round==='string'?v.round:'',complete:v.mode==='quiz'&&v.complete===true&&v.quizIndex===5,startedAt:typeof v.startedAt==='string'&&Number.isFinite(Date.parse(v.startedAt))?v.startedAt:fresh.startedAt};
 }catch{return fresh;}
}
