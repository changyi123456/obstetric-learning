import motion from './birth-poses.json';

export const BIRTH_VERSION='birth-1';
export const BIRTH_KEY='obstetric-learning.birth.v1';
export const DURATION=motion.secondsPerStage*7;
export const BIRTH_STAGES=[
  {name:'下降',english:'Descent',observation:'觀察胎頭從骨盆入口上方向下移動。',text:'下降會持續發生，與其他機轉彼此重疊；本教材先把移動方向獨立觀察。',task:'沿母體的頭尾方向，讓胎兒朝骨盆方向下降。',control:'胎兒移動',negative:'向上移動',positive:'向下移動',tip:'下降是位置改變，還沒有要求胎頭內轉。'},
  {name:'固定',english:'Engagement',observation:'辨識雙頂徑通過骨盆入口的關係。',text:'固定的重點是雙頂徑通過骨盆入口。station 0 則以坐骨棘為參考，兩者不作同義判定。',task:'繼續調整胎頭進入骨盆的位置，觀察入口與胎頭的關係。',control:'進入骨盆',negative:'退出入口',positive:'通過入口',tip:'入口線是方位示意，不提供公分或 station 的臨床量測。'},
  {name:'屈曲',english:'Flexion',observation:'觀察下巴逐漸貼近胸前。',text:'胎頭屈曲改變通過的徑線；請同時觀察頭、頸與胸部，而非只看胎頭是否向下移動。',task:'調整頭頸姿態，使胎兒下巴更靠近胸前。',control:'胎頭姿態',negative:'離開胸前',positive:'靠近胸前',tip:'切換側面，更容易看見下巴與胸部的關係。'},
  {name:'內轉',english:'Internal rotation',observation:'觀察枕部由左前方轉向恥骨聯合。',text:'本例從 LOA 示範至 OA，枕部轉向母體前方。這時頭部與肩部的轉向仍有差別。',task:'調整胎頭轉向，使枕部朝向母體前方。',control:'胎頭轉向',negative:'遠離前方',positive:'轉向前方',tip:'俯視能比較頭部與肩部的方向；攝影機轉動不會完成練習。'},
  {name:'伸展',english:'Extension',observation:'觀察胎頭在恥骨聯合下方伸展。',text:'隨胎頭通過出口，枕部、額與臉逐漸娩出。動畫省略軟組織，需配合側面觀察頭頸連續性。',task:'沿教學路徑伸展胎頭，觀察頭部逐漸通過出口。',control:'胎頭伸展',negative:'維持屈曲',positive:'伸展通過',tip:'使用骨盆剖視觀察通過關係；本模型不模擬會陰組織。'},
  {name:'復位／外轉',english:'Restitution & external rotation',observation:'先看胎頭復位，再看肩部內轉帶動頭部外轉。',text:'先解除頭與肩的相對扭轉，再觀察肩部轉至出口前後方向，以及已娩出胎頭的外轉。',task:'先完成胎頭復位，再調整肩部轉向，觀察頭部外轉。',control:'胎頭復位',negative:'離開自然方向',positive:'回復自然方向',second:'肩部轉向與外轉',tip:'兩段動作分開控制；第一段到位後，才能開始第二段。'},
  {name:'娩出',english:'Expulsion',observation:'依序觀察前肩、後肩與軀幹娩出。',text:'先辨識恥骨聯合下的前肩，再看後肩及軀幹通過；本段呈現胎兒動作，不加入接生拉力操作。',task:'先讓前肩通過，再沿路徑觀察後肩與軀幹娩出。',control:'前肩通過',negative:'退回骨盆',positive:'前肩娩出',second:'後肩與軀幹',tip:'注意前肩與後肩的先後；動畫時間不代表真實產程長度。'}
] as const;
export type BirthMode='watch'|'practice'|'order';
export type StageAttempt={id:string;stage:number;primary:number;secondary:number;correct:boolean;hinted:boolean;at:string};
export type OrderAttempt={id:string;order:number[];correct:boolean;matches:number;hinted:boolean;at:string};
export type BirthProgress={version:typeof BIRTH_VERSION;mode:BirthMode;cursor:number;stage:number;primary:number;secondary:number;completed:number[];attempts:StageAttempt[];submitted:boolean;hinted:boolean;order:number[];orderSubmitted:boolean;orderHistory:OrderAttempt[];orderHinted:boolean;reduced:boolean};
export const ORDER_BANK=[4,1,6,2,0,5,3];
export const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
export function stageAt(cursor:number){return Math.min(6,Math.floor(clamp(cursor,0,7)));}
export function practiceTime(stage:number,primary:number,secondary:number){
  const p=clamp(primary/100),s=clamp(secondary/100);
  if(stage===5)return 5+(p<.85?p/.85*.5:.5+Math.min(1,s/.85)*.5);
  if(stage===6)return 6+(p<.85?p/.85*.35:.35+Math.min(1,s/.85)*.65);
  return stage+p;
}
export function checkStage(stage:number,primary:number,secondary:number){
  if(primary<0)return {correct:false,message:`方向相反。這一段要「${BIRTH_STAGES[stage].positive}」，請先回到起點再調整。`};
  if(primary<85)return {correct:false,message:`動作尚未完成。請繼續「${BIRTH_STAGES[stage].positive}」，並觀察${stage===3?'枕部與母體前方':'模型與目標位置'}的關係。`};
  if(stage>=5&&secondary<85)return {correct:false,message:stage===5?'胎頭已復位，還要完成肩部轉向與頭部外轉。':'前肩已通過，還要觀察後肩與軀幹娩出。'};
  return {correct:true,message:`已完成「${BIRTH_STAGES[stage].name}」。${BIRTH_STAGES[stage].observation}`};
}
export function newBirthProgress():BirthProgress{return {version:BIRTH_VERSION,mode:'watch',cursor:0,stage:0,primary:0,secondary:0,completed:[],attempts:[],submitted:false,hinted:false,order:[],orderSubmitted:false,orderHistory:[],orderHinted:false,reduced:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches};}
export function submitStage(p:BirthProgress,at=new Date().toISOString()):BirthProgress{
  if(p.submitted)return p;
  const result=checkStage(p.stage,p.primary,p.secondary);
  return {...p,submitted:true,completed:result.correct?[...new Set([...p.completed,p.stage])]:p.completed,attempts:[...p.attempts,{id:crypto.randomUUID(),stage:p.stage,primary:p.primary,secondary:p.secondary,correct:result.correct,hinted:p.hinted,at}]};
}
export function checkOrder(order:number[]){const valid=order.length===7&&new Set(order).size===7&&order.every(isStage);const matches=order.filter((id,i)=>id===i).length;return {valid,correct:valid&&matches===7,matches};}
export function submitOrder(p:BirthProgress,at=new Date().toISOString()):BirthProgress{
  const result=checkOrder(p.order);if(p.orderSubmitted||!result.valid)return p;
  return {...p,orderSubmitted:true,orderHistory:[...p.orderHistory,{id:crypto.randomUUID(),order:[...p.order],correct:result.correct,matches:result.matches,hinted:p.orderHinted,at}]};
}
function isStage(n:unknown):n is number{return Number.isInteger(n)&&Number(n)>=0&&Number(n)<7;}
export function readBirth(storage?:Pick<Storage,'getItem'>):BirthProgress{
  try{const raw=(storage??localStorage).getItem(BIRTH_KEY);if(!raw)return newBirthProgress();const p=JSON.parse(raw) as BirthProgress;
    if(p.version!==BIRTH_VERSION||!['watch','practice','order'].includes(p.mode)||!isStage(p.stage)||!Number.isFinite(p.cursor)||p.cursor<0||p.cursor>7||!Number.isFinite(p.primary)||p.primary< -100||p.primary>100||!Number.isFinite(p.secondary)||p.secondary<0||p.secondary>100||!Array.isArray(p.completed)||!p.completed.every(isStage)||new Set(p.completed).size!==p.completed.length||!Array.isArray(p.order)||p.order.length>7||!p.order.every(isStage)||new Set(p.order).size!==p.order.length||!Array.isArray(p.attempts)||!p.attempts.every(a=>a&&isStage(a.stage)&&typeof a.id==='string'&&typeof a.correct==='boolean')||!Array.isArray(p.orderHistory)||!p.orderHistory.every(a=>a&&Array.isArray(a.order)&&checkOrder(a.order).valid&&typeof a.correct==='boolean')||['submitted','hinted','orderSubmitted','orderHinted','reduced'].some(k=>typeof p[k as keyof BirthProgress]!=='boolean')||(p.orderSubmitted&&!checkOrder(p.order).valid))return newBirthProgress();
    return p;
  }catch{return newBirthProgress();}
}
export function sampleBirth(time:number){
  const t=clamp(time,0,7),keys=motion.keyframes;
  const index=keys.findIndex((k,i)=>i>0&&k.time>=t),a=keys[(index<0?keys.length-1:index)-1],b=keys[index<0?keys.length-1:index];
  const linear=clamp((t-a.time)/(b.time-a.time)),u=linear*linear*(3-2*linear);
  return {position:a.position.map((v,i)=>v+(b.position[i]-v)*u),bodyYaw:a.bodyYaw+(b.bodyYaw-a.bodyYaw)*u,headYaw:a.headYaw+(b.headYaw-a.headYaw)*u,headPitch:a.headPitch+(b.headPitch-a.headPitch)*u};
}
