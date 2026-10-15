import { describe, it, expect } from 'vitest';
import { POSITIONS, shuffledRound, validateAnswer, getPosition, explainAnswer } from './positions';
import { newProgress, beginRound, submitAttempt, nextQuestion, readProgress, STORAGE_KEY } from './storage';
describe('maternal coordinate system', () => {
  it('keeps left and right mirrored around the maternal anterior axis', () => {
    for (const [l,r] of [['LOA','ROA'],['LOT','ROT'],['LOP','ROP']] as const) expect(getPosition(l).angle).toBe(-getPosition(r).angle);
    for (const p of POSITIONS) { const x=Math.sin(p.angle*Math.PI/180),z=Math.cos(p.angle*Math.PI/180); expect(x>0).toBe(p.side==='左'); if(p.direction==='前')expect(z).toBeGreaterThan(0);if(p.direction==='後')expect(z).toBeLessThan(0); }
  });
  it('has all six codes exactly once per round', () => { const r=shuffledRound(()=>.37);expect(new Set(r).size).toBe(6);expect([...r].sort()).toEqual(POSITIONS.map(x=>x.code).sort()); });
  it('normalizes typing but does not accept supplementary or malformed codes',()=>{expect(validateAnswer(' loa ')).toBe('LOA');for(const s of ['OA','OP','L0A','L O A','','xyz'])expect(validateAnswer(s)).toBeNull();});
  it('explains actual maternal-side errors',()=>{expect(explainAnswer('LOA','ROA')).toContain('母體左側');expect(explainAnswer('LOP','LOA')).toContain('朝後方');});
});
describe('practice records',()=>{
  it('does not double submit and retains a wrong attempt on retry',()=>{const p=beginRound(newProgress());const wrong=p.round[0]==='LOA'?'ROA':'LOA';const a=submitAttempt(p,wrong);expect(submitAttempt(a,wrong)).toBe(a);const b=submitAttempt({...a,submitted:null},p.round[0]);expect(b.attempts).toHaveLength(2);expect(b.attempts.map(a=>a.correct)).toEqual([false,true]);});
  it('only completes after the final submitted question',()=>{let p=beginRound(newProgress());expect(nextQuestion(p)).toBe(p);for(let i=0;i<6;i++)p=nextQuestion(submitAttempt(p,p.round[i]));expect(p.complete).toBe(true);expect(p.attempts).toHaveLength(6);});
  it('recovers valid progress and safely resets corrupt or incompatible records',()=>{const p=beginRound(newProgress());expect(readProgress({getItem:k=>k===STORAGE_KEY?JSON.stringify(p):null})).toEqual(p);for(const raw of ['{','null',JSON.stringify({...p,version:8}),JSON.stringify({...p,round:['BAD']})])expect(readProgress({getItem:()=>raw})).toEqual(newProgress());});
});
