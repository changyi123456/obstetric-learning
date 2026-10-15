import {CASES,type PalpationState,type Action} from './palpation';
export default function DirectMonitorTask({state:s,send,relaxed}:{state:PalpationState;send:(a:Action)=>void;relaxed:boolean}){const m=s.monitor;switch(m.step){
 case 0:return <p>器材已放在推車上。將電源、FHR 與 TOCO 接頭拖到對應插孔，再直接按監視器電源。</p>;
 case 1:return <><p>先與產婦說明，再抓住兩條固定帶的帶尾，分別拉到腹部另一側。</p>{!m.cooperation&&<button className="pal-choice" onClick={()=>send({type:'cooperate'})}>「接下來要放入固定帶，請依能力配合，我會協助您。」</button>}</>;
 case 2:return <><p>拿起 TOCO 探頭，移到子宮底附近較平坦處，放開確認位置。</p><p className="pal-note">TOCO 不使用超音波凝膠；外測訊號呈相對變化。</p></>;
 case 3:return <><p>{m.gel?'FHR 探頭已加凝膠，拿起探頭移到腹部搜尋，慢慢調整位置。':'拿起凝膠瓶並打開瓶蓋，將凝膠加到 FHR 探頭接觸面，再把探頭移到腹部搜尋。'}</p><div className="pal-clue"><p>第二段辨識的胎背位於母體{CASES[s.caseId].back==='L'?'左':'右'}側。慢慢移動，留意心音與訊號是否清晰。</p></div></>;
 case 4:return <><p>按住手腕量取母體脈搏，並拉動兩條帶尾。太鬆或太緊時，依畫面和產婦回應修正。</p>{m.pulse&&<div className="pal-options"><button className="pal-choice" aria-pressed={m.differentiated} onClick={()=>send({type:'compare',value:true})}>母體 82，胎心約 140，來源不同</button><button className="pal-choice" onClick={()=>send({type:'compare',value:false})}>有數字就當作胎心</button></div>}{m.belts.every(v=>v==='comfortable')&&!m.comfort&&<button className="pal-choice" onClick={()=>send({type:'comfort'})}>「兩條固定帶會不會太緊，或有其他不舒服？」</button>}</>;
 case 5:return <><p>觀察腹部與 TOCO 狀態，在放鬆時按設備上的歸零，再開始記錄並轉動音量旋鈕。</p><div className={`bedside-contraction ${relaxed?'rest':'contract'}`}><span/>{relaxed?'目前子宮放鬆':'目前子宮收縮示意'}<small>狀態會自然交替</small></div>{!m.explained&&<button className="pal-choice" onClick={()=>send({type:'explainMonitor'})}>向產婦說明監測目的、依課程 SOP 安排的時長與何時移除</button>}</>;
 default:return <><p>觀察胎心與宮縮曲線，完成後按下方按鈕，即可停止監測並進入收尾。</p><div className="pal-clue"><p><strong>觀察重點：</strong>胎心的波動，以及宮縮曲線的相對變化。</p></div><p className="pal-note">這是合成教學片段；短片段不能判定完整基線，外測 TOCO 高度不代表絕對宮縮壓力。</p><button className="primary full" onClick={()=>send({type:'finishMonitoring'})}>完成觀察並停止監測</button><p className="pal-note">按下後直接進入收尾照護。</p></>;
}}
