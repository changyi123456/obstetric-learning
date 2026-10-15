import {useEffect,useRef} from 'react';
export function useFhrRoomAudio(enabled:boolean,running:boolean,fhr:number|null){
 const state=useRef({enabled,running,fhr});state.current={enabled,running,fhr};const audio=useRef<AudioContext|null>(null),next=useRef(0);
 function unlock(){if(!audio.current){try{audio.current=new AudioContext();}catch{return;}}void audio.current.resume().catch(()=>{});next.current=0;}
 function speak(text:string){if(!state.current.enabled||!('speechSynthesis' in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='zh-TW';u.rate=.95;u.volume=.65;const voice=speechSynthesis.getVoices().find(v=>v.lang==='zh-TW');if(voice)u.voice=voice;speechSynthesis.speak(u);}catch{/* Subtitles remain the primary patient response. */}}
 useEffect(()=>{const timer=setInterval(()=>{const s=state.current,ctx=audio.current;if(!ctx||ctx.state!=='running'||!s.enabled||!s.running||s.fhr===null){next.current=0;return;}if(ctx.currentTime<next.current)return;const at=ctx.currentTime;next.current=at+60/Math.max(70,s.fhr);for(const offset of [0,.065]){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(145,at+offset);osc.frequency.exponentialRampToValueAtTime(85,at+offset+.075);gain.gain.setValueAtTime(0,at+offset);gain.gain.linearRampToValueAtTime(.035,at+offset+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+offset+.09);osc.connect(gain);gain.connect(ctx.destination);osc.start(at+offset);osc.stop(at+offset+.1);}},35);return ()=>{clearInterval(timer);void audio.current?.close().catch(()=>{});};},[]);
 useEffect(()=>{if(!enabled||!running){next.current=0;if('speechSynthesis' in window)speechSynthesis.cancel();}},[enabled,running]);
 return {unlock,speak};
}
