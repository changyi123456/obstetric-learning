import {useEffect,useRef,useState} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
import {monitorSignal} from './bedside';
import {signalAt,maternalZone,type PalpationState} from './palpation';
// Original synthesised teaching rhythm, not a recording from a fetal Doppler.
export default function PalpationSound({state:s}:{state:PalpationState}){
 const [enabled,setEnabled]=useState(false),[level,setLevel]=useState(2),[error,setError]=useState(false),context=useRef<AudioContext|null>(null),live=useRef({s,level});live.current={s,level};
 async function toggle(){if(enabled){setEnabled(false);return;}try{context.current??=new AudioContext();await context.current.resume();setEnabled(true);setError(false);}catch{setError(true);}}
 useEffect(()=>{if(!enabled)return;let timer:number|undefined,dead=false;function beat(){if(dead)return;const {s,level}=live.current,m=s.monitor,ctx=context.current;let interval=430;if(!document.hidden&&ctx&&ctx.state==='running'&&m.power&&m.gel){const q=monitorSignal(s,signalAt),maternal=q>0&&maternalZone(m.us),volume=m.objects.active?m.objects.volume*4:level;interval=60000/(maternal?82:140);if(q>25||maternal){const at=ctx.currentTime,gain=ctx.createGain();gain.connect(ctx.destination);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume*.025*(maternal?1:q/100),at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.16);const osc=ctx.createOscillator();osc.type='sine';osc.frequency.setValueAtTime(180,at);osc.frequency.exponentialRampToValueAtTime(70,at+.14);osc.connect(gain);osc.start(at);osc.stop(at+.17);osc.onended=()=>{osc.disconnect();gain.disconnect();};}}timer=window.setTimeout(beat,interval);}beat();return()=>{dead=true;clearTimeout(timer);};},[enabled]);
 useEffect(()=>{const hide=()=>{if(document.hidden)setEnabled(false);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 useEffect(()=>()=>{void context.current?.close();},[]);
 return <div className="pal-audio"><button onClick={toggle} aria-pressed={enabled}>{enabled?<Volume2 size={15}/>:<VolumeX size={15}/>} {enabled?'關閉':'開啟'}合成教學心音</button>{!s.monitor.objects.active&&<><button aria-label="降低教學心音音量" disabled={level===0} onClick={()=>setLevel(v=>Math.max(0,v-1))}>降低</button><span>音量 {level} / 4</span><button aria-label="提高教學心音音量" disabled={level===4} onClick={()=>setLevel(v=>Math.min(4,v+1))}>提高</button></>}{s.monitor.objects.active&&<span>音量由場景中的監視器旋鈕控制</span>}{error&&<span>目前無法播放，請依文字訊號繼續。</span>}</div>;
}
