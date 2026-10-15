import { describe,it,expect } from 'vitest';
import { FHR_CASES, assessTrace, curveShape, targetInterval, timeFromPoint, valuesAt, withinMark } from './fhr';
import { freshFhr, selectTrace, submitFhr, beginFhrQuiz, nextFhr, readFhr, FHR_KEY } from './fhr-storage';
describe('versioned synthetic FHR teaching traces',()=>{
 it('has three reproducible, fully bounded events in each of nine traces',()=>{
  expect(new Set(FHR_CASES.map(c=>c.id)).size).toBe(9);
  for(const c of FHR_CASES){expect(c.contractions).toHaveLength(3);expect(c.decels).toHaveLength(3);for(const e of [...c.contractions,...c.decels]){expect(e.start).toBeGreaterThanOrEqual(0);expect(e.end).toBeLessThan(c.duration);expect(e.start).toBeLessThan(e.bottom[0]);expect(e.bottom[1]).toBeLessThan(e.end);}for(let t=0;t<=c.duration;t+=.5){const v=valuesAt(c,t);expect(v).toEqual(valuesAt(c,t));expect(v.fhr).toBeGreaterThan(80);expect(v.fhr).toBeLessThan(180);expect(v.toco).toBeGreaterThanOrEqual(0);expect(v.toco).toBeLessThanOrEqual(100);}}
 });
 it('ties early to contraction timing, late to delayed onset and recovery, and variable to rapid drops',()=>{
  for(const c of FHR_CASES)for(let i=0;i<3;i++){const a=c.contractions[i],b=c.decels[i];if(c.type==='early'){expect(b.start).toBe(a.start);expect(b.bottom).toEqual(a.bottom);expect(b.end).toBe(a.end);}else if(c.type==='late'){expect(b.start-a.start).toBeGreaterThan(20);expect(b.bottom[0]-a.bottom[1]).toBeGreaterThan(20);expect(b.end).toBeGreaterThan(a.end);expect(b.bottom[0]-b.start).toBeGreaterThanOrEqual(30);}else{expect(b.bottom[0]-b.start).toBeLessThan(30);expect(b.end-b.start).toBeGreaterThanOrEqual(15);expect(b.depth).toBeGreaterThan(15);}}
  const aligned=FHR_CASES[7];expect(aligned.decels[1].bottom).toEqual(aligned.contractions[1].bottom);expect(aligned.type).toBe('variable');
 });
 it('keeps the displayed extrema aligned to answer metadata, including plateaus',()=>{
  for(const c of FHR_CASES)for(let i=0;i<3;i++){const e=c.decels[i];for(let t=e.start;t<=e.end;t+=.25)expect(valuesAt(c,t).fhr).toBeGreaterThanOrEqual(c.baseline-e.depth-1e-6);expect(curveShape(e.bottom[0],e)).toBe(1);expect(valuesAt(c,e.bottom[0]).fhr).toBe(c.baseline-e.depth);expect(valuesAt(c,e.bottom[1]).fhr).toBe(c.baseline-e.depth);}
 });
 it('uses seconds and inclusive plateau tolerance independently from screen size',()=>{
  expect(withinMark(173,[178,182])).toBe(true);expect(withinMark(187,[178,182])).toBe(true);expect(withinMark(172,[178,182])).toBe(false);expect(withinMark(null,[178,182])).toBe(false);expect(withinMark(NaN,[178,182])).toBe(false);
  expect(timeFromPoint(190,10,420,0,420)).toBe(180);expect(timeFromPoint(370,10,840,0,420)).toBe(180);expect(timeFromPoint(-200,10,420,0,420)).toBe(0);expect(timeFromPoint(-200,10,420,120,280)).toBe(120);expect(timeFromPoint(900,10,420,120,280)).toBe(280);
 });
 it('separates marker feedback and type feedback, refusing incomplete submissions',()=>{
  const c=FHR_CASES[0],marks={peak:180,nadir:180};expect(assessTrace(c,marks,'early').correct).toBe(true);expect(assessTrace(c,marks,'late')).toMatchObject({peak:true,nadir:true,type:false,correct:false});expect(assessTrace(c,{peak:0,nadir:0},'early')).toMatchObject({peak:false,nadir:false,type:true,correct:false});expect(assessTrace(c,{peak:180,nadir:null},'early').valid).toBe(false);expect(assessTrace(c,{peak:180,nadir:Infinity},'early').valid).toBe(false);
 });
});
describe('local FHR progress',()=>{
 it('retains first attempt, hints and retries and makes submission idempotent',()=>{
  let p={...freshFhr(),mode:'practice' as const,marks:{peak:180,nadir:180},choice:'late' as const,hinted:true};let first=submitFhr(p);expect(first.attempts).toHaveLength(1);expect(submitFhr(first)).toBe(first);let retry=submitFhr({...first,submitted:false,choice:'early'});expect(retry.attempts).toHaveLength(2);expect(retry.attempts[0].type).toBe(false);expect(retry.attempts[0].hinted).toBe(true);expect(retry.attempts[1].correct).toBe(true);expect(submitFhr({...p,marks:{peak:null,nadir:180}}).attempts).toHaveLength(0);
 });
 it('builds a unique six-case quiz, two per type, and completes only after confirmed last question',()=>{
  let p=beginFhrQuiz(freshFhr());expect(new Set(p.quiz).size).toBe(6);for(const type of ['early','late','variable'])expect(p.quiz.filter(id=>FHR_CASES.find(c=>c.id===id)!.type===type)).toHaveLength(2);expect(nextFhr(p)).toBe(p);
  for(let i=0;i<6;i++){const c=FHR_CASES.find(c=>c.id===p.caseId)!;p=submitFhr({...p,marks:{peak:targetInterval(c,'peak')[0],nadir:targetInterval(c,'nadir')[0]},choice:c.type});p=nextFhr(p);}expect(p.complete).toBe(true);expect(p.attempts).toHaveLength(6);expect(selectTrace(p,FHR_CASES[0].id).complete).toBe(false);
 });
 it('restores valid drafts and safely rejects damaged or incompatible local data',()=>{
  const draft={...freshFhr(),mode:'practice',marks:{peak:180,nadir:190},choice:'late'};const g=globalThis as unknown as {localStorage:Pick<Storage,'getItem'>};g.localStorage={getItem:()=>JSON.stringify(draft)};expect(readFhr().marks).toEqual(draft.marks);g.localStorage={getItem:()=>'{bad'};expect(readFhr().attempts).toHaveLength(0);g.localStorage={getItem:()=>JSON.stringify({...draft,version:'wrong'})};expect(readFhr().mode).toBe('watch');g.localStorage={getItem:()=>JSON.stringify({...draft,marks:{peak:-1,nadir:180}})};expect(readFhr().marks.peak).toBe(null);expect(FHR_KEY).not.toContain('birth');
 });
});
