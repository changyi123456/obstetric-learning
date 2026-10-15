import {describe,it,expect} from 'vitest';
import {angleStep,changeModel} from './birth-manipulation';
import {newBirthProgress,practiceTime} from './birth';

describe('直接操作模型的輸入邊界',()=>{
  it('手指繞過角度接縫仍為小幅連續轉動',()=>{
    expect(angleStep(179*Math.PI/180,-179*Math.PI/180)).toBeCloseTo(2*Math.PI/180);
    expect(angleStep(-179*Math.PI/180,179*Math.PI/180)).toBeCloseTo(-2*Math.PI/180);
  });
  it('任何輸入都不能略過第一部分，回退會清除第二部分',()=>{
    const p={...newBirthProgress(),mode:'practice' as const,stage:6};
    expect(changeModel(p,1,100)).toBe(p);
    const first=changeModel(p,0,100),both=changeModel(first,1,100);
    expect(practiceTime(both.stage,both.primary,both.secondary)).toBe(7);
    expect(changeModel(both,0,50).secondary).toBe(0);
  });
  it('送出後鎖住模型，錯方向保留回饋且不超出已驗證路徑',()=>{
    const p={...newBirthProgress(),mode:'practice' as const,stage:3};
    const wrong=changeModel(p,0,-500);
    expect(wrong.primary).toBe(-100);expect(practiceTime(3,wrong.primary,0)).toBe(3);
    const submitted={...p,submitted:true};expect(changeModel(submitted,0,100)).toBe(submitted);
    expect(changeModel(p,0,NaN)).toBe(p);expect(changeModel(p,0,500).primary).toBe(100);
  });
});
