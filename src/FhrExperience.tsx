import {lazy,Suspense,useState} from 'react';
const Room=lazy(()=>import('./FhrRoomModule'));
const Curves=lazy(()=>import('./FhrModule'));
export default function FhrExperience(){const [mode,setMode]=useState<'room'|'curves'>(()=>new URLSearchParams(location.search).get('view')==='curves'?'curves':'room');function choose(next:typeof mode){setMode(next);const url=new URL(location.href);if(next==='curves')url.searchParams.set('view','curves');else url.searchParams.delete('view');history.replaceState(null,'',url);}
const navigation=<div className="mode-tabs room-mode-tabs" role="tablist" aria-label="胎心率體驗方式"><button role="tab" aria-selected={mode==='room'} onClick={()=>choose('room')}>床邊情境</button><button role="tab" aria-selected={mode==='curves'} onClick={()=>choose('curves')}>曲線練習</button></div>;
return <Suspense fallback={<main className="learning-app">正在準備胎心率教學…</main>}>{mode==='room'?<Room navigation={navigation}/>:<Curves navigation={navigation}/>}</Suspense>;}
