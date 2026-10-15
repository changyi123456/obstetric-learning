import {afterEach,describe,expect,it,vi} from 'vitest';
import {SCENE_KEY,addSceneEvent,assessScene,freshScene,missingRanges,readScene,restartScene,sceneSample,sceneTrace,signalAt,submitScene,type SceneProgress} from './fhr-scene';
describe('床邊觀察情境',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('所有視圖可從相同病例與時間重現數值，人物收緊與宮縮對齊',()=>{
  const trace=sceneTrace('room-a'),peak=trace.contractions[0].bottom[0];
  expect(sceneSample('room-a',peak)).toEqual(sceneSample('room-a',peak));
  expect(sceneSample('room-a',peak).contraction).toBeCloseTo(1);
  expect(sceneSample('room-a',0).contraction).toBe(0);
 });
 it('接觸遺失留下真實時間空缺，修正探頭不改原始波形，也不回填空缺',()=>{
  let p=freshScene();const before=sceneSample(p.caseId,140);
  expect(signalAt(p,114)).toBe(true);expect(signalAt(p,115)).toBe(false);
  expect(signalAt(p,420)).toBe(false);expect(missingRanges(p).some(([a,b])=>420>=a&&420<b)).toBe(true);
  p=addSceneEvent(p,'probe',150);
  expect(signalAt(p,140)).toBe(false);expect(signalAt(p,150)).toBe(true);
  expect(missingRanges(p)).toEqual([[115,150]]);expect(sceneSample(p.caseId,140)).toEqual(before);
  expect(addSceneEvent(p,'probe',160)).toBe(p);
 });
 it('紀錄宮縮必須成對且依秒數判定，完整觀察後才串連各項技能',()=>{
  let p=freshScene();const c=sceneTrace(p.caseId).contractions[0];
  expect(addSceneEvent(p,'end-contraction',c.end)).toBe(p);
  p=addSceneEvent(p,'start-contraction',c.start+8);
  expect(addSceneEvent(p,'start-contraction',c.start+9)).toBe(p);
  p=addSceneEvent(p,'end-contraction',c.end-8);
  p=addSceneEvent(p,'ask',110);p=addSceneEvent(p,'pulse',112);p=addSceneEvent(p,'probe',150);
  p={...p,time:420,choice:'late'};
  expect(assessScene(p).correct).toBe(true);
  expect(assessScene({...p,time:40}).sufficient).toBe(false);
  expect(assessScene({...p,choice:'early'})).toMatchObject({typeCorrect:false,intervalCorrect:true,asked:true,pulseChecked:true});
 });
 it('首次判讀不能重複提交，重練保留歷次快照',()=>{
  const p=submitScene({...freshScene(),time:420,choice:'early'});
  expect(p.attempts).toHaveLength(1);expect(submitScene(p)).toBe(p);
  expect(addSceneEvent(p,'ask',420)).toBe(p);
  let retry=restartScene(p);expect(retry.events).toEqual([]);expect(retry.attempts).toHaveLength(1);
  retry=submitScene({...retry,time:420,choice:'late'});
  expect(retry.attempts.map(a=>a.choice)).toEqual(['early','late']);
  expect(retry.attempts[0].events).not.toBe(retry.events);
 });
 it('拒絕無效時間與損壞儲存，保留的草稿不能自動恢復播放',()=>{
  const p=freshScene();for(const t of [NaN,Infinity,-1,421])expect(addSceneEvent(p,'ask',t)).toBe(p);
  vi.stubGlobal('localStorage',{getItem:(key:string)=>key===SCENE_KEY?'invalid':null});expect(readScene().time).toBe(0);
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({...p,time:150,events:[{id:'ok',kind:'ask',time:100,text:'已詢問'},{id:'bad',kind:'pulse',time:151,text:'未發生'}]})});
  const restored=readScene();expect(restored.time).toBe(150);expect(restored.events.map(e=>e.id)).toEqual(['ok']);expect('running' in restored).toBe(false);
 });
});
