import type {Action,PalpationState,Probe,XY} from './palpation';

export interface BedsideState {
 revision:1; active:boolean; capOpen:boolean; gelAmount:number;
 under:[boolean,boolean]; fastened:[boolean,boolean]; tension:[number,number];
 onBody:[boolean,boolean]; returned:[boolean,boolean]; detached:[boolean,boolean];
 wiped:number[]; probeClean:boolean; tissueUsed:boolean; tissueDisposed:boolean;
 cover:number; volume:number;
}
export type BedsideEvent=
 |{kind:'activate'}|{kind:'cap'}|{kind:'connect';plug:string;socket:string}
 |{kind:'under';index:0|1}|{kind:'gel';target:Probe}
 |{kind:'place';probe:Probe;position:XY;finish:boolean}
 |{kind:'strap';index:0|1;tension:number;finish:boolean}
 |{kind:'detach';index:0|1}|{kind:'return';probe:Probe}
 |{kind:'wipe';cells:number[]}|{kind:'wipeProbe'}|{kind:'dispose'}
 |{kind:'cover';progress:number;finish:boolean}|{kind:'volume';value:number;finish:boolean}
 |{kind:'control';control:'power'|'zero'|'record'|'stop'|'pulse'|'wash';relaxed?:boolean};

export const freshBedside=():BedsideState=>({revision:1,active:false,capOpen:false,gelAmount:0,under:[false,false],fastened:[false,false],tension:[.15,.15],onBody:[false,false],returned:[false,false],detached:[false,false],wiped:[],probeClean:false,tissueUsed:false,tissueDisposed:false,cover:0,volume:.5});
export const probeIndex=(p:Probe):0|1=>p==='US'?0:1;
export const tensionName=(v:number)=>v<.38?'loose':v>.72?'tight':'comfortable';
export const GEL_DOTS:XY[]=Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return [Math.cos(a)*.17,Math.sin(a)*.13];});
export function wipeCells(center:XY,point:XY){return GEL_DOTS.flatMap((d,i)=>Math.hypot(point[0]-center[0]-d[0],point[1]-center[1]-d[1])<.16?[i]:[]);}
export function monitorSignal(s:PalpationState,quality:(id:PalpationState['caseId'],p:XY)=>number){const m=s.monitor,b=m.objects;if(!m.power||!m.gel||b.active&&!b.onBody[0])return 0;const stability=b.active&&b.fastened[0]&&tensionName(b.tension[0])!=='comfortable'?.55:1;return Math.round(quality(s.caseId,m.us)*stability);}

// Physical events feed the existing clinical sequence reducer. Both pointer and
// keyboard routes share these guards; transient drag positions never count as a drop.
export function reduceBedside(state:PalpationState,event:BedsideEvent,base:(s:PalpationState,a:Action)=>PalpationState):PalpationState {
 const s=structuredClone(state),m=s.monitor,b=m.objects;
 const fail=(text:string)=>{s.feedback=text;s.level='error';s.errors.push({phase:s.phase,text});s.errors=s.errors.slice(-60);return s;};
 const ok=(text:string)=>{s.feedback=text;s.level='success';return s;};
 const apply=(a:Action)=>base(s,a);
 const invalidates=()=>{m.zero=false;m.comfort=false;if(m.recorded||s.complete){m.recorded=false;m.observed=false;s.complete=false;s.care=[];b.wiped=[];b.probeClean=false;b.cover=0;b.tissueDisposed=false;}};
 const addCare=(id:string)=>{if(!s.care.includes(id))s.care.push(id);};
 if(s.phase!==5&&s.phase!==6)return state;
 if(event.kind==='activate'){b.active=true;m.inventory=[0,1,2,3,4,5,6];return s;}
 if(event.kind==='cap'){b.capOpen=!b.capOpen;return ok(b.capOpen?'凝膠瓶蓋已打開，將瓶口移到 FHR 探頭。':'凝膠瓶蓋已蓋回。');}
 if(event.kind==='connect'){if(event.plug!==event.socket)return fail('接頭與插孔不相符，請依 FHR、TOCO 或電源標示重新連接。');return apply({type:'connect',value:event.plug});}
 if(event.kind==='control'){
  if(event.control==='wash'){if(s.phase!==6||!s.care.includes('clean'))return fail('先完成器材整理清潔，再進行接觸後手部衛生。');return apply({type:'care',value:'wash'});}
  if(s.phase!==5)return state;
  if(event.control==='zero')return apply({type:'zero',relaxed:!!event.relaxed});
  return apply({type:event.control} as Action);
 }
 if(event.kind==='volume'){if(!Number.isFinite(event.value))return state;b.volume=Math.max(0,Math.min(1,event.value));if(!event.finish)return s;m.volume=b.volume>=.15&&b.volume<=.75;s.patient=b.volume>.75?'聲音有點大，可以調小一點嗎？':b.volume<.15?'聲音太小，我聽不清楚。':'這個音量可以。';return m.volume?ok('音量已調整，產婦表示合適。'):fail('請依產婦回應再調整音量。');}
 if(s.phase===5){
  if(event.kind==='under'){if(!m.power)return fail('先完成接線與開機。');if(!m.cooperation)return fail('先向產婦說明，取得配合後再放入固定帶。');if(!b.under[event.index]){if(b.probeClean){m.gel=false;b.gelAmount=0;}invalidates();b.tissueUsed=false;}b.detached[event.index]=false;b.under[event.index]=true;m.beltsUnder=b.under.every(Boolean);return ok(m.beltsUnder?'兩條獨立固定帶均已放入。':'這條固定帶已放入，另一條仍待放入。');}
  if(event.kind==='gel'){if(!b.capOpen)return fail('凝膠瓶蓋尚未打開。');if(event.target!=='US')return fail('這是 TOCO 探頭，不使用超音波耦合凝膠；請選擇 FHR 超音波探頭。');b.gelAmount=1;m.gel=true;return ok('FHR 探頭接觸面已加凝膠，可以開始搜尋。');}
  if(event.kind==='place'){const i=probeIndex(event.probe);if(!m.power||!m.beltsUnder)return event.finish?fail(!m.power?'先完成接線與開機。':'先放入兩條固定帶。'):state;if(m.recording)return event.finish?fail('請先停止記錄，再移動探頭。'):state;if(b.fastened[i])return event.finish?fail('先解開這個探頭的帶扣，再重新定位。'):state;b.onBody[i]=true;b.returned[i]=false;b.detached[i]=false;return apply({type:'probe',probe:event.probe,position:event.position,finish:event.finish});}
  if(event.kind==='strap'){if(!Number.isFinite(event.tension))return state;if(m.recording)return event.finish?fail('請先停止記錄，再調整固定帶。'):state;const i=event.index;if(!(i===0?m.usPlaced:m.tocoPlaced))return event.finish?fail('先找到這個探頭的合適位置，再固定。'):state;const value=Math.max(0,Math.min(1,event.tension));if(b.tension[i]!==value)invalidates();b.tension[i]=value;if(!event.finish)return s;b.fastened[i]=true;return apply({type:'belt',index:i,value:tensionName(value)});}
  if(event.kind==='detach'){if(m.recording)return fail('請先停止記錄，再解開固定帶。');const i=event.index;b.fastened[i]=false;m.belts[i]='none';invalidates();return ok('帶扣已解開，可重新移動探頭。');}
  return state;
 }
 if(event.kind==='detach'){const i=event.index;b.fastened[i]=false;b.detached[i]=true;b.under[i]=false;return ok('這條固定帶已解開，將探頭移回器材盤。');}
 if(event.kind==='return'){const i=probeIndex(event.probe);if(!b.detached[i])return fail('先解開這條固定帶，再取下探頭。');b.onBody[i]=false;b.returned[i]=true;if(b.returned.every(Boolean)&&b.detached.every(Boolean)){m.beltsUnder=false;addCare('remove');}return ok(b.returned.every(Boolean)?'兩個探頭與兩條固定帶均已移除。':'這個探頭已放回器材盤。');}
 if(event.kind==='wipe'){if(!s.care.includes('remove'))return fail('先移除兩個探頭與固定帶，再擦拭腹部。');if(b.tissueDisposed)return fail('紙巾已丟棄，請取新的紙巾。');b.tissueUsed=true;b.wiped=[...new Set([...b.wiped,...event.cells.filter(x=>Number.isInteger(x)&&x>=0&&x<12)])];if(b.wiped.length>=8){b.wiped=Array.from({length:12},(_,i)=>i);addCare('wipePatient');return ok('腹部可見凝膠已擦淨。');}return s;}
 if(event.kind==='wipeProbe'){if(!s.care.includes('remove'))return fail('先取下並放回探頭。');if(b.tissueDisposed)return fail('請先取新的紙巾。');b.probeClean=true;b.tissueUsed=true;addCare('wipeProbe');return ok('探頭表面凝膠已擦淨；設備清潔仍依規範執行。');}
 if(event.kind==='dispose'){if(!b.probeClean||!s.care.includes('wipePatient'))return fail('先擦淨腹部與探頭，再處理使用過的紙巾。');b.tissueDisposed=true;return ok('使用過的紙巾已放入回收處，接著依設備規範完成清潔。');}
 if(event.kind==='cover'){if(!Number.isFinite(event.progress))return state;if(!s.care.includes('wipePatient'))return event.finish?fail('先擦淨腹部凝膠，再協助衣物與被單復位。'):state;b.cover=Math.max(0,Math.min(1,event.progress));if(event.finish&&b.cover>=.85){b.cover=1;addCare('cover');s.patient='謝謝，這樣很舒服。';return ok('腹部已重新覆蓋，胸部與骨盆遮蓋持續保留。');}return s;}
 return state;
}

export function migrateBedside(s:PalpationState,raw?:unknown):BedsideState|null {
 const b=freshBedside(),m=s.monitor;
 if(raw===undefined){b.under=[m.beltsUnder,m.beltsUnder];b.onBody=[m.usPlaced,m.tocoPlaced];b.fastened=[m.belts[0]!=='none',m.belts[1]!=='none'];b.tension=m.belts.map(v=>v==='comfortable'?.55:v==='tight'?.9:.15) as [number,number];b.gelAmount=m.gel?1:0;b.capOpen=m.gel;b.returned=[s.care.includes('remove'),s.care.includes('remove')];b.detached=[...b.returned];if(s.care.includes('remove')){b.onBody=[false,false];b.under=[false,false];b.fastened=[false,false];}b.wiped=s.care.includes('wipePatient')?Array.from({length:12},(_,i)=>i):[];b.probeClean=s.care.includes('wipeProbe');b.cover=s.care.includes('cover')?1:0;b.tissueDisposed=s.care.includes('clean');return b;}
 if(!raw||typeof raw!=='object')return null;const v=raw as BedsideState;if(v.revision!==1)return null;
 for(const key of ['active','capOpen','probeClean','tissueUsed','tissueDisposed'] as const)if(typeof v[key]!=='boolean')return null;
 for(const key of ['gelAmount','cover','volume'] as const)if(!Number.isFinite(v[key])||v[key]<0||v[key]>1)return null;
 for(const key of ['under','fastened','onBody','returned','detached'] as const)if(!Array.isArray(v[key])||v[key].length!==2||!v[key].every(x=>typeof x==='boolean'))return null;
 if(!Array.isArray(v.tension)||v.tension.length!==2||!v.tension.every(x=>Number.isFinite(x)&&x>=0&&x<=1)||!Array.isArray(v.wiped)||!v.wiped.every(x=>Number.isInteger(x)&&x>=0&&x<12)||new Set(v.wiped).size!==v.wiped.length)return null;
 return structuredClone(v);
}
