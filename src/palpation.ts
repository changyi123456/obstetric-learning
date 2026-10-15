import {freshBedside,migrateBedside,reduceBedside,type BedsideState,type BedsideEvent} from './bedside';
// M1 uses scripted teaching cues. Pointer movement never measures physical force.
export type Phase=0|1|2|3|4|5|6|7;
export type Side='L'|'R';
export type Probe='US'|'TOCO';
export type XY=[number,number];
export const PALPATION_KEY='obstetric-learning.palpation.v1';
export const PHASES=['床邊準備','第一段','第二段','第三段','第四段','胎心監測','收尾照護','練習摘要'];
export const CASES={left:{name:'案例 A',back:'L' as Side,nameTag:'林安安',dob:'1994-06-18'},right:{name:'案例 B',back:'R' as Side,nameTag:'陳欣怡',dob:'1992-09-25'}};
export type CaseId=keyof typeof CASES;
export function identityErrors(caseId:CaseId,name:string,dob:string){
 const cleanedName=name.normalize('NFKC').replace(/\s+/g,''),date=dob.normalize('NFKC').replace(/\s+/g,'');
 const parts=date.match(/^(\d{4})(\d{2})(\d{2})$/)??date.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
 const normalized=parts?`${parts[1]}-${parts[2].padStart(2,'0')}-${parts[3].padStart(2,'0')}`:null;
 return {name:!cleanedName?'請輸入手環上的姓名。':cleanedName!==CASES[caseId].nameTag?'姓名與手環不一致，請重新核對。':null,dob:!date?'請輸入手環上的出生日期。':!normalized?'請輸入西元年月日，可用斜線、短橫線或八位數字。':normalized!==CASES[caseId].dob?'出生日期與手環不一致，請重新核對年月日。':null};
}
export const PREP=[
 {id:'wash',title:'接觸前手部衛生',prompt:'進入床邊，先完成哪個動作？',choices:['完成手部衛生','直接開始觸診'],reply:'你先洗手，我比較放心。'},
 {id:'identity',title:'核對兩項身分資料',prompt:'請核對手環的姓名與出生日期。',choices:[],reply:'姓名和生日都正確。'},
 {id:'explain',title:'說明並取得配合',prompt:'怎麼向產婦說明接下來的操作？',choices:['說明觸診目的，詢問是否願意配合','只說躺好就可以'],reply:'好，請告訴我接下來要做什麼。'},
 {id:'void',title:'確認已排空膀胱',prompt:'觸診前先確認哪件事？',choices:['詢問是否已排空膀胱','先按壓腹部再詢問'],reply:'我已經上過廁所。'},
 {id:'privacy',title:'維護隱私',prompt:'開始協助擺位前，先處理周圍環境。',choices:['拉妥床簾，保留胸部與會陰遮蓋','直接掀開所有被單'],reply:'謝謝你幫我把簾子拉好。'},
 {id:'position',title:'協助合適臥位',prompt:'依本教材協助枕頭支托、仰臥並屈膝，持續留意不適。',choices:['協助擺位並詢問是否舒適','要求全程忍住不適'],reply:'這樣有支托，比較舒服。若頭暈我會告訴你。'},
 {id:'expose',title:'僅露出檢查所需腹部',prompt:'調整衣物與被單，露出腹部，維持其他部位遮蓋。',choices:['露出所需腹部並維持遮蓋','連胸部與會陰一起露出'],reply:'只露出腹部，這樣可以。'},
 {id:'warm',title:'暖手與告知',prompt:'雙手碰觸前再做一次確認。',choices:['暖手並詢問是否會冷','用冰冷的手直接觸碰'],reply:'不會冷，可以開始。'}
] as const;
export const INVENTORY=['胎心監視器','FHR 超音波探頭','TOCO 探頭','固定帶 × 2','超音波凝膠','擦拭紙巾','記錄紙／記錄功能'];
export const MONITOR_STEPS=['設備準備','兩條固定帶','TOCO 定位','FHR 尋訊','核對與舒適','歸零與記錄','觀察與停止'];
export const STAGES=[
 {title:'第一段｜觸摸子宮底',instruction:'站在母體右側、面向頭端。雙手呈杯狀，從下腹兩側向上移至子宮底。',motion:'拖動雙手，沿兩側向子宮底移動。',clue:'子宮底處較柔軟、形狀不規則，不像硬圓的胎頭。',question:'子宮底最可能是哪一部位？',answers:['臀部','頭部'],correct:0,reason:'本案例子宮底為臀部。這是預設教學觸感，實際檢查需整合四段結果。'},
 {title:'第二段｜辨識背部與小肢體',instruction:'保持面向頭端。一手固定，另一手輕柔觸摸子宮側面，再交換雙手。',motion:'先選觸診手，完成一側路徑，再交換雙手。',clue:'一側是連續、平滑的較大面；另一側有不規則的小突起。',question:'依兩側觸診提示，胎背在哪一側？',answers:['母體左側','母體右側'],correct:0,reason:'胎背是連續平滑的一面，可作為胎心探頭的初始搜尋區；仍須實際確認訊號。'},
 {title:'第三段｜確認先露部與可動性',instruction:'左手穩定子宮底，右手拇指與四指呈 C 形，在恥骨聯合上方輕柔確認先露部。',motion:'拖動右手 C 形握位，完成小幅左右確認。',clue:'下腹摸到較硬、圓的部位，仍有輕微可動性。',question:'此案例的先露部與可動性提示是？',answers:['頭部，仍有輕微可動性','臀部，已完全固定'],correct:0,reason:'本案例為頭先露、仍可輕微移動。可動性提示不能直接換算 station 或確認銜接。'},
 {title:'第四段｜評估胎頭屈曲線索',instruction:'仍在母體右側，改為面向腳端。雙手沿下腹兩側向骨盆入口移動，指尖朝向腳端。',motion:'先改為面向腳端，再拖動雙手向骨盆入口。',clue:'本案例額部隆起位於小肢體同側；須與前三段一起判斷。',question:'這項提示較支持哪種胎頭姿勢？',answers:['屈曲','明顯伸展'],correct:0,reason:'額部隆起與小肢體同側較支持胎頭屈曲。腹部檢查不能直接替代陰道檢查的 station 判定。'}
] as const;
export interface StageState {paths:[number,number];done:boolean;attempts:number;answer:number|null;}
export interface MonitorState {objects:BedsideState;step:number;furthest:number;inventory:number[];connections:string[];power:boolean;cooperation:boolean;beltsUnder:boolean;toco:XY;us:XY;tocoPlaced:boolean;usPlaced:boolean;gel:boolean;pulse:boolean;differentiated:boolean;comfort:boolean;belts:[string,string];zero:boolean;recording:boolean;recorded:boolean;volume:boolean;explained:boolean;observed:boolean;}
export interface PalpationState {version:1;caseId:CaseId;phase:Phase;prep:string[];stages:StageState[];orientation:'head'|'feet';side:Side;gentle:boolean;monitor:MonitorState;care:string[];complete:boolean;feedback:string;level:'info'|'success'|'error';patient:string;errors:{phase:number;text:string}[];}
export function initialPalpation(caseId:CaseId='left'):PalpationState{return {version:1,caseId,phase:0,prep:[],stages:Array.from({length:4},()=>({paths:[0,0],done:false,attempts:0,answer:null})),orientation:'head',side:'L',gentle:true,monitor:{objects:freshBedside(),step:0,furthest:0,inventory:[],connections:[],power:false,cooperation:false,beltsUnder:false,toco:[.8,.4],us:[-.8,-.3],tocoPlaced:false,usPlaced:false,gel:false,pulse:false,differentiated:false,comfort:false,belts:['none','none'],zero:false,recording:false,recorded:false,volume:false,explained:false,observed:false},care:[],complete:false,feedback:'從床邊準備開始。每次操作都可以重做。',level:'info',patient:'你好，請告訴我接下來要做什麼。',errors:[]};}
const cap=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const fhrTarget=(id:CaseId):XY=>[CASES[id].back==='L'?.56:-.56,.28];
export function signalAt(id:CaseId,position:XY){const t=fhrTarget(id);const d=Math.hypot((position[0]-t[0])/.8,(position[1]-t[1])/1.1);return Math.round(cap(1-d,0,1)*100);}
export const tocoQuality=(p:XY)=>Math.hypot(p[0]/.62,(p[1]+.64)/.5)<1;
export const maternalZone=(p:XY)=>Math.abs(p[0])<.35&&p[1]>.6;
export const motionReady=(s:PalpationState,stage:number)=>s.stages[stage].paths.every(x=>x>=.94);
export function stageClue(s:PalpationState){if(s.phase===2){const back=CASES[s.caseId].back,contactSide=s.side==='L'?'R':'L';return `母體${contactSide==='L'?'左':'右'}側：${contactSide===back?'連續、平滑的較大面。':'不規則、較小的小肢體突起。'}`;}return STAGES[Math.max(0,Math.min(3,s.phase-1))].clue;}
export function monitorMissing(s:PalpationState,step=s.monitor.step):string|null{const m=s.monitor;switch(step){case 0:return m.inventory.length<INVENTORY.length?'用物尚未齊備。':m.connections.length<3?'請連接電源、FHR 與 TOCO 導線。':!m.power?'請開機並完成教學功能檢查。':null;case 1:return !m.cooperation?'先說明並請產婦配合稍抬臀部。':!m.beltsUnder?'尚未放入兩條獨立固定帶。':null;case 2:return !m.tocoPlaced||m.objects.active&&!m.objects.onBody[1]?'選對 TOCO 探頭，移到子宮底附近較平坦處並確認。':null;case 3:return !m.gel?'胎心超音波探頭需先使用凝膠。':!m.usPlaced||m.objects.active&&!m.objects.onBody[0]?'請搜尋清晰穩定的胎心訊號後確認位置。':null;case 4:return !m.pulse?'請從手腕核對母體脈搏。':!m.differentiated?'請比較母體脈搏與目前胎心訊號。':m.belts.some(x=>x!=='comfortable')||m.objects.active&&!m.objects.fastened.every(Boolean)?'兩條固定帶都要各自調整到舒適且穩定。':!m.comfort?'調整後再次詢問產婦舒適度。':null;case 5:return !m.zero?'先在子宮放鬆時完成 TOCO 基線歸零。':!m.recorded?'尚未啟動記錄。':!m.volume?'請調整音量並詢問是否合適。':!m.explained?'請說明實際監測時間依機型與課程 SOP，並確認後續安排。':null;case 6:return m.recording?'請先停止記錄，再進入收尾。':!m.observed?'請完成教學片段的觀察紀錄。':null;default:return null;}}
export type Action=
 |{type:'prep';id:string;correct:boolean}|{type:'identity';name:string;dob:string}|{type:'orient';value:'head'|'feet'}|{type:'side';value:Side}|{type:'gentle';value:boolean}
 |{type:'motion';progress:number;finish:boolean}|{type:'answer';value:number}|{type:'retry'}|{type:'next'}|{type:'phase';value:Phase}
 |{type:'item';value:number}|{type:'connect';value:string}|{type:'power'}|{type:'cooperate'}|{type:'beltsUnder'}|{type:'gel'}
 |{type:'probe';probe:Probe;position:XY;finish:boolean}|{type:'pulse'}|{type:'compare';value:boolean}|{type:'belt';index:0|1;value:string}|{type:'comfort'}
 |{type:'zero';relaxed:boolean}|{type:'record'}|{type:'stop'}|{type:'finishMonitoring'}|{type:'volume'}|{type:'explainMonitor'}|{type:'observe';value:boolean}|{type:'monitorStep';value:number}|{type:'monitorNext'}
 |{type:'bedside';event:BedsideEvent}|{type:'care';value:string}|{type:'message';text:string}|{type:'reset';caseId:CaseId};
function clinicalReducer(state:PalpationState,a:Action):PalpationState {
 if(a.type==='reset')return initialPalpation(a.caseId);
 const s=structuredClone(state),m=s.monitor;
 const ok=(text:string,patient?:string)=>{s.feedback=text;s.level='success';if(patient)s.patient=patient;return s;};
 const fail=(text:string,patient?:string)=>{s.feedback=text;s.level='error';s.errors.push({phase:s.phase,text});s.errors=s.errors.slice(-60);if(patient)s.patient=patient;return s;};
 const add=(arr:string[],v:string)=>{if(!arr.includes(v))arr.push(v);};
 if(a.type==='message'){s.feedback=a.text;s.level='info';return s;}
 if(a.type==='phase'){const furthest=s.complete?7:s.stages.every(x=>x.done)?(s.monitor.observed&&!s.monitor.recording?6:5):s.prep.length===PREP.length?s.stages.findIndex(x=>!x.done)+1:0;if(a.value<=Math.max(furthest,state.phase)){s.phase=a.value as Phase;if(a.value>=1&&a.value<=4&&s.stages[a.value-1].done)s.orientation=a.value===4?'feet':'head';s.feedback='已切換練習階段，其他已完成項目保留。';s.level='info';}return s;}
 if(a.type==='identity'){if(s.phase!==0)return state;const errors=identityErrors(s.caseId,a.name,a.dob);if(errors.name||errors.dob)return fail([errors.name,errors.dob].filter(Boolean).join(' '));add(s.prep,'identity');return ok('已完成：核對兩項身分資料。','姓名和生日都正確。');}
 if(a.type==='prep'){if(s.phase!==0)return state;const p=PREP.find(x=>x.id===a.id);if(!p)return state;if(!a.correct)return fail('這個做法未完成目前的照護需求，請依目的再選一次。',a.id==='privacy'?'請先幫我維護隱私。':undefined);if(a.id==='expose'&&(!s.prep.includes('privacy')||!s.prep.includes('position')))return fail('先完成隱私與擺位，再露出檢查所需腹部。');add(s.prep,p.id);return ok(`已完成：${p.title}。`,p.reply);}
 if(a.type==='orient'){s.orientation=a.value;return ok(a.value==='head'?'目前面向頭端。':'目前面向腳端。');}
 if(a.type==='side'){s.side=a.value;return ok(`目前${a.value==='L'?'左':'右'}手觸診，另一手固定。`);}
 if(a.type==='gentle'){s.gentle=a.value;return a.value?ok('採輕柔觸診；螢幕不會測量真實力道。','這樣可以。'):fail('產婦反映不適，請停止過度用力，改為輕柔觸診。','有點痛，請輕一點。');}
 if(a.type==='motion'){if(s.phase<1||s.phase>4)return state;const i=s.phase-1,r=s.stages[i];if(r.done)return state;if(s.orientation!==(s.phase===4?'feet':'head'))return a.finish?fail(s.phase===4?'第四段需先改為面向腳端。':'這一段應面向頭端。'):state;if(!s.gentle)return a.finish?fail('先改為輕柔觸診，再重做動作。'):state;if(!Number.isFinite(a.progress))return state;const p=cap(a.progress,0,1);if(i===1){const side=s.side==='L'?1:0;r.paths[side]=p;}else r.paths=[p,p];if(a.finish){if(p<.94)return fail('路徑還沒完成，請沿指示方向移到終點。');return ok(i===1?'這一側已完成，交換雙手確認另一側。':'動作已完成，請整合感覺提示作判斷。');}return s;}
 if(a.type==='answer'){if(s.phase<1||s.phase>4)return state;const i=s.phase-1,r=s.stages[i];if(r.done)return state;if(!motionReady(s,i))return fail('先完成本段雙手操作，再判斷結果。');r.attempts++;r.answer=a.value;const expected=i===1?(CASES[s.caseId].back==='L'?0:1):0;if(a.value!==expected)return fail('判斷與這個案例的觸感提示不一致，請回看提示再試一次。');r.done=true;return ok(STAGES[i].reason);}
 if(a.type==='retry'){if(s.phase>=1&&s.phase<=4){const r=s.stages[s.phase-1];r.paths=[0,0];r.done=false;r.answer=null;}s.complete=false;return ok('本段已重設，其他階段與操作紀錄保留。');}
 if(a.type==='next'){if(s.phase===0&&s.prep.length!==PREP.length)return fail('請先完成所有床邊準備。');if(s.phase>=1&&s.phase<=4&&!s.stages[s.phase-1].done)return fail('先完成動作與判斷，再進入下一段。');if(s.phase===5&&(!m.observed||m.recording))return fail('先完成監測觀察並停止記錄。');if(s.phase===6){const required=['remove','wipePatient','wipeProbe','cover','clean','wash','chart','explain'];if(!required.every(x=>s.care.includes(x)))return fail('收尾照護與紀錄尚未完成。');s.complete=true;}s.phase=cap(s.phase+1,0,7) as Phase;s.feedback='進入下一階段。';s.level='info';return s;}
 if(a.type==='care'){if(!['remove','wipePatient','wipeProbe','cover','clean','wash','chart','explain'].includes(a.value))return state;if(s.phase!==6)return state;if(a.value==='remove'&&m.recording)return fail('先停止記錄，再移除探頭與固定帶。');if(['wipePatient','wipeProbe'].includes(a.value)&&!s.care.includes('remove'))return fail('先移除探頭，再清潔腹部與探頭。');if(a.value==='cover'&&!s.care.includes('wipePatient'))return fail('先擦淨腹部凝膠，再協助衣物與被單復位。');if(a.value==='clean'&&m.objects.active&&!m.objects.tissueDisposed)return fail('先擦淨腹部與探頭，並處理使用過的紙巾，再依設備規範完成清潔。');if(a.value==='clean'&&!s.care.includes('wipeProbe'))return fail('先擦淨探頭，再依設備規範整理清潔。');if(a.value==='chart'&&(!s.care.includes('remove')||!m.observed))return fail('先完成監測與移除，再完成紀錄。');add(s.care,a.value);return ok('已完成這項收尾照護。',a.value==='cover'?'謝謝，這樣很舒服。':undefined);}
 if(s.phase!==5)return state;
 if(a.type==='item'){if(a.value<0||a.value>=INVENTORY.length)return state;if(!m.inventory.includes(a.value))m.inventory.push(a.value);return ok(`已準備：${INVENTORY[a.value]}。`);}
 if(a.type==='connect'){if(!['power','US','TOCO'].includes(a.value))return state;if(m.power)return fail('連接前先關機；本版請先完成接線再開機。');add(m.connections,a.value);return ok('接線已確認。');}
 if(a.type==='power'){if(m.connections.length!==3)return fail('請先完成電源與兩種探頭接線。');if(m.recording)return fail('請先停止記錄，再關閉電源。');m.power=!m.power;return ok(m.power?'教學功能檢查完成。':'監視器已關機。');}
 if(a.type==='cooperate'){m.cooperation=true;return ok('已說明，請產婦依能力配合稍抬臀部。','好，請協助我。');}
 if(a.type==='beltsUnder'){if(!m.cooperation)return fail('先說明並取得配合。');m.beltsUnder=true;return ok('已放入兩條獨立固定帶。');}
 if(a.type==='gel'){m.gel=true;return ok('已在胎心探頭搜尋區使用凝膠。');}
 if(a.type==='probe'){if(!a.position.every(Number.isFinite))return state;if(m.recording)return fail('請先停止記錄，再重新定位探頭。');if(m.recorded||s.complete){m.recorded=false;m.observed=false;m.zero=false;s.complete=false;s.care=[];}const p:XY=[cap(a.position[0],-.92,.92),cap(a.position[1],-.92,.92)];if(a.probe==='US'){m.us=p;m.usPlaced=false;m.differentiated=false;}else{m.toco=p;m.tocoPlaced=false;m.zero=false;}if(!a.finish)return s;if(!m.power)return fail('請先完成設備準備與開機。');if(!m.beltsUnder)return fail('先放入兩條固定帶，再定位探頭。');if(m.step===2&&a.probe!=='TOCO')return fail('目前需定位 TOCO 子宮收縮探頭。');if(m.step===3&&a.probe!=='US')return fail('目前需使用 FHR 超音波探頭搜尋胎心。');if(a.probe==='TOCO'){if(!tocoQuality(p))return fail('TOCO 仍偏離子宮底附近較平坦區，請重新定位。');m.tocoPlaced=true;return ok('TOCO 已定位；訊號呈相對變化，不能用來判定絕對宮縮壓力。');}if(!m.gel)return fail('使用胎心超音波探頭前先加凝膠。');if(maternalZone(p))return fail('目前訊號接近母體脈搏，不能當作胎心確認。');if(signalAt(s.caseId,p)<70)return fail('胎心訊號尚不清晰穩定，請依胎背方向再搜尋。');m.usPlaced=true;return ok('已找到清晰穩定的教學胎心訊號，仍需核對母體脈搏。');}
 if(a.type==='pulse'){m.pulse=true;return ok('手腕脈搏：82 次／分。請與胎心訊號比較。');}
 if(a.type==='compare'){if(!m.pulse||!m.usPlaced)return fail('先確認胎心探頭位置，並量取母體脈搏。');if(!a.value)return fail('母體脈搏與目前胎心訊號不同，請分別核對，不能只憑位置認定。');m.differentiated=true;return ok('已核對母體 82 次／分與胎心約 140 次／分，來源不同。');}
 if(a.type==='belt'){if(!m.beltsUnder)return fail('先放入兩條固定帶。');if(m.belts[a.index]!==a.value&&(m.recorded||s.complete)){m.recorded=false;m.observed=false;m.zero=false;s.complete=false;s.care=[];}m.belts[a.index]=a.value;m.comfort=false;if(a.value!=='comfortable')return fail(a.value==='tight'?'產婦表示過緊，請調整。':'固定帶過鬆，探頭容易移位。',a.value==='tight'?'有點勒，請鬆一些。':'這條帶子有點鬆。');return ok('這條固定帶已調整，仍需確認另一條並詢問舒適度。');}
 if(a.type==='comfort'){if(m.belts.some(x=>x!=='comfortable'))return fail('請先分別調整兩條固定帶。');m.comfort=true;return ok('產婦表示舒適，兩個探頭保持定位。','兩條都不會太緊，這樣可以。');}
 if(a.type==='zero'){for(let i=0;i<=4;i++){const missing=monitorMissing(s,i);if(missing)return fail(missing);}if(!a.relaxed)return fail('目前是收縮示意，請在子宮放鬆狀態完成基線歸零。');if(m.recording)return fail('請先停止記錄，再歸零。');m.zero=true;return ok('TOCO 基線已歸零；這是通用面板流程，不代表特定機型設定。');}
 if(a.type==='record'){for(let i=0;i<=4;i++){const missing=monitorMissing(s,i);if(missing)return fail(missing);}if(!m.zero)return fail('請先在子宮放鬆時完成 TOCO 基線歸零。');m.recording=true;m.recorded=true;return ok('正在顯示教學記錄。此片段不等於完成臨床所需監測時長。');}
 if(a.type==='stop'){if(!m.recorded)return fail('尚未開始記錄。');m.recording=false;return ok('記錄已停止。');}
 if(a.type==='finishMonitoring'){for(let i=0;i<=5;i++){const missing=monitorMissing(s,i);if(missing)return fail(missing);}m.observed=true;m.recording=false;s.phase=6;return ok('已確認教學片段的觀察並停止監測，接著進行收尾照護。');}
 if(a.type==='volume'){m.volume=true;return ok('音量已確認合適。','聽得到，不會太大聲。');}
 if(a.type==='explainMonitor'){m.explained=true;return ok('已說明監測目的、依機型與課程 SOP 確認實際時長及何時移除。','好，若不舒服我會告訴你。');}
 if(a.type==='observe'){if(!m.recorded)return fail('請先開始教學記錄。');if(!a.value)return fail('本片段顯示胎心波動與宮縮相對訊號；外測 TOCO 不能量得絕對宮縮強度。');m.observed=true;return ok('已記錄教學片段的胎心波動與相對宮縮變化。短片段不判定完整基線或臨床正常。');}
 if(a.type==='monitorStep'){if(a.value>=0&&a.value<=m.furthest)m.step=a.value;return s;}
 if(a.type==='monitorNext'){const missing=monitorMissing(s);if(missing)return fail(missing);m.step=Math.min(6,m.step+1);m.furthest=Math.max(m.furthest,m.step);return ok('進入下一項監測操作。');}
 return s;
}
export function palpationReducer(state:PalpationState,a:Action):PalpationState {
 const s=a.type==='bedside'?reduceBedside(state,a.event,clinicalReducer):clinicalReducer(state,a);
 if(s.phase===5&&s.monitor.objects.active&&a.type!=='monitorStep'){
  let first=0;while(first<6&&!monitorMissing(s,first))first++;
  s.monitor.step=first;s.monitor.furthest=Math.max(s.monitor.furthest,first);
 }
 return s;
}
export function restorePalpation(raw:string|null):PalpationState|null {try {if(!raw)return null;const x=JSON.parse(raw);if(x.version!==1||!Object.hasOwn(CASES,x.caseId)||!Number.isInteger(x.phase)||x.phase<0||x.phase>7)return null;const s=initialPalpation(x.caseId),finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);if(!Array.isArray(x.prep)||!x.prep.every((v:unknown)=>PREP.some(p=>p.id===v))||new Set(x.prep).size!==x.prep.length)return null;if(!Array.isArray(x.stages)||x.stages.length!==4||!x.stages.every((r:StageState)=>Array.isArray(r.paths)&&r.paths.length===2&&r.paths.every(v=>finite(v)&&v>=0&&v<=1)&&typeof r.done==='boolean'&&Number.isInteger(r.attempts)&&r.attempts>=0&&(r.answer===null||r.answer===0||r.answer===1)))return null;const m=x.monitor;if(!m||!Number.isInteger(m.step)||m.step<0||m.step>6||!Number.isInteger(m.furthest)||m.furthest<m.step||m.furthest>6)return null;for(const key of ['power','cooperation','beltsUnder','tocoPlaced','usPlaced','gel','pulse','differentiated','comfort','zero','recording','recorded','volume','explained','observed'])if(typeof m[key]!=='boolean')return null;for(const key of ['us','toco'])if(!Array.isArray(m[key])||m[key].length!==2||!m[key].every((v:unknown)=>finite(v)&&Math.abs(v as number)<=.92))return null;if(!Array.isArray(m.inventory)||!m.inventory.every((v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<INVENTORY.length)||new Set(m.inventory).size!==m.inventory.length)return null;if(!Array.isArray(m.connections)||!m.connections.every((v:unknown)=>['power','US','TOCO'].includes(String(v)))||new Set(m.connections).size!==m.connections.length)return null;if(!Array.isArray(m.belts)||m.belts.length!==2||!m.belts.every((v:unknown)=>['none','loose','comfortable','tight'].includes(String(v))))return null;if(!['head','feet'].includes(x.orientation)||!['L','R'].includes(x.side)||typeof x.gentle!=='boolean'||!Array.isArray(x.care)||!x.care.every((v:unknown)=>['remove','wipePatient','wipeProbe','cover','clean','wash','chart','explain'].includes(String(v)))||typeof x.complete!=='boolean')return null;if(x.phase>=1&&x.prep.length!==PREP.length)return null;if(x.phase>=5&&!x.stages.every((r:StageState)=>r.done))return null;if(x.complete&&(!x.stages.every((r:StageState)=>r.done)||!m.observed||x.care.length!==8))return null;Object.assign(s,x);const objects=migrateBedside(s,m.objects);if(!objects)return null;s.monitor.objects=objects;s.errors=Array.isArray(x.errors)?x.errors.filter((e:unknown)=>e&&typeof e==='object'&&typeof (e as {text?:unknown}).text==='string').slice(-60):[];s.monitor.recording=false;s.feedback='已恢復本機練習進度；記錄維持停止，請重新確認後續操作。';s.level='info';return s;}catch{return null;}}
