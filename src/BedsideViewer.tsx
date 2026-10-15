import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GEL_DOTS,monitorSignal,probeIndex,tensionName,wipeCells,type BedsideEvent} from './bedside';
import {maternalZone,signalAt,type Action,type PalpationState,type Probe,type XY} from './palpation';

export type ProbePreview={probe:Probe;position:XY}|null;
interface Props{state:PalpationState;time:number;relaxed:boolean;reduced:boolean;onAction:(a:Action)=>void;onPreview:(p:ProbePreview)=>void;onReady:(v:boolean)=>void;}
type View='wide'|'bed'|'tray'|'monitor';
type Tool='US'|'TOCO'|'gel'|'tissue'|'plug_US'|'plug_TOCO'|'plug_power'|'strap0'|'strap1'|'cover'|'volume';
const CAMERAS:Record<View,{position:[number,number,number];target:[number,number,number]}>= {
 wide:{position:[1.58,2.10,1.10],target:[.43,1.02,-.06]},
 bed:{position:[.28,1.96,.55],target:[0,1.02,-.04]},
 tray:{position:[1.48,2.35,1.10],target:[1.08,1.07,.20]},
 monitor:{position:[1.05,1.47,.47],target:[1.05,1.29,-.45]}
};
const NAMES:Record<string,string>={US:'FHR_transducer',TOCO:'TOCO_transducer',gel:'Gel_bottle',cap:'Gel_cap',tissue:'Clean_tissue',plug_US:'Cable_plug_US',plug_TOCO:'Cable_plug_TOCO',plug_power:'Cable_plug_power',socket_US:'Socket_US',socket_TOCO:'Socket_TOCO',socket_power:'Socket_power',power:'Control_power',zero:'Control_zero',record:'Control_record',volume:'Control_volume',strap0:'Buckle_FHR',strap1:'Buckle_TOCO',bin:'Recovery_bin',tray:'Tray_return',wash:'Hand_sanitizer',pulse:'Anchor_pulse',cover:'Privacy_cover',anatomyFundus:'Anchor_fundus',anatomyFeet:'Anchor_suprapubic',anatomyLeft:'Anchor_maternal_left',anatomyRight:'Anchor_maternal_right'};
const surface=(u:number,v:number)=>new THREE.Vector3(.245*u,.835+.3*Math.sqrt(Math.max(.001,1-u*u-v*v))-.009*Math.exp(-((.245*u/.022)**2+((-.02+.345*v-.025)/.025)**2)),-.02+.345*v);
const normal=(u:number,v:number)=>{const e=.0005;return new THREE.Vector3(-(surface(u+e,v).y-surface(u-e,v).y)/(.49*e),1,-(surface(u,v+e).y-surface(u,v-e).y)/(.69*e)).normalize();};
function beltGeometry(v:number,tightness:number,closed:boolean){const vertices:number[]=[],indices:number[]=[];const end=closed?Math.PI*2:Math.PI*1.55;for(let i=0;i<=72;i++){const a=-Math.PI/2+i/72*end;for(const edge of [-.018,.018]){const vv=Math.max(-.97,Math.min(.97,v+edge/.345)),r=Math.sqrt(Math.max(.02,1-vv*vv)),u=r*Math.sin(a);const point=Math.cos(a)>=0?surface(u,vv).addScaledVector(normal(u,vv),.009+(1-tightness)*.015):new THREE.Vector3(.245*u,Math.max(.792,.835+.3*r*Math.cos(a))+.004,-.02+.345*vv);vertices.push(point.x,point.y,point.z);}if(i<72){const n=i*2;indices.push(n,n+2,n+3,n,n+3,n+1);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function dispose(root:THREE.Object3D){const materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const m of materials){for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);m.dispose();}textures.forEach(t=>t.dispose());}

export default function BedsideViewer(props:Props){
 const host=useRef<HTMLDivElement>(null),hot=useRef(new Map<string,HTMLElement>()),live=useRef(props);live.current=props;
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[view,setView]=useState<View>('wide'),[held,setHeld]=useState<Tool|null>(null),[retry,setRetry]=useState(0),[alternatives,setAlternatives]=useState(false);
 const current=useRef({view,held});current.current={view,held};
 const api=useRef<{begin:(id:string,e:PointerEvent)=>void;choose:(id:string)=>void}|null>(null);
 const s=props.state,m=s.monitor,b=m.objects,care=s.phase===6;
 useEffect(()=>{setView(care?(s.care.includes('clean')?'tray':'wide'):m.step===0||m.step===3&&!m.gel?'tray':m.step===2||m.step===3?'wide':m.step<5?'bed':'monitor');setHeld(null);current.current.held=null;},[care,m.step,m.gel,s.care.includes('clean')]);
 const hint=held==='gel'?'瓶蓋打開後，將瓶口拖到 FHR 探頭；也可點探頭完成放置。':held?.startsWith('plug_')?'將接頭拖到同名插孔，或點選對應插孔。':held==='tissue'?'按住紙巾，在凝膠上來回擦拭；探頭放回後也要擦淨。':held==='US'||held==='TOCO'?care?'將探頭移回器材盤。':'將探頭移到腹部，放開後確認位置；心音與訊號會隨搜尋改變。':held?.startsWith('strap')?'拖動帶尾調整：向右拉緊、向左放鬆；收尾時向外拉開帶扣。':held==='cover'?'抓住被單邊緣，從腳端往子宮底方向拉回。':held==='volume'?'拖動旋鈕調整音量，留意產婦回應。':'可直接拖動物件，也可點選拿起、再點目的地。空白處拖動可轉視角。';
 const descriptors:{id:string;label:string;show:boolean;target?:boolean}[]=[
  ...(['US','TOCO','power'] as const).flatMap(p=>[{id:'plug_'+p,label:p==='power'?'電源接頭':(p==='US'?'FHR':p)+' 接頭',show:!care&&!m.connections.includes(p)&&m.step===0},{id:'socket_'+p,label:p==='power'?'電源插孔':(p==='US'?'FHR':p)+' 插孔',show:held?.startsWith('plug_')??false,target:true}]),
  {id:'power',label:m.power?'電源已開':'開啟電源',show:!care&&m.step===0},
  {id:'US',label:held==='gel'?'FHR 接觸面':held==='tissue'?'擦拭 FHR':'FHR 探頭',show:!care&&(m.step===3||held==='gel'||held==='US')||care&&!b.returned[0]||care&&held==='tissue'&&!b.probeClean,target:held==='gel'||held==='tissue'},
  {id:'TOCO',label:'TOCO 探頭',show:!care&&(m.step===2||held==='TOCO')||care&&!b.returned[1]},
  {id:'gel',label:'拿凝膠',show:!care&&m.step===3&&!m.gel&&held!=='gel'},
  {id:'cap',label:b.capOpen?'瓶蓋已開':'打開瓶蓋',show:held==='gel'},
  ...([0,1] as const).map(i=>({id:'strap'+i,label:care?`解開 ${i===0?'FHR':'TOCO'} 帶扣`:!b.under[i]?`放入 ${i===0?'FHR':'TOCO'} 固定帶`:`${i===0?'FHR':'TOCO'} 帶尾 · ${b.fastened[i]?tensionName(b.tension[i])==='comfortable'?'已固定':tensionName(b.tension[i])==='tight'?'太緊':'太鬆':'拉動固定'}`,show:care?!b.detached[i]:m.step===1||m.step===4})),
  {id:'abdomen',label:'放到腹部',show:!care&&(held==='US'||held==='TOCO'),target:true},
  {id:'underTarget',label:'拉過另一側',show:held==='strap0'&&!b.under[0]||held==='strap1'&&!b.under[1],target:true},
  {id:'pulse',label:m.pulse?'母體脈搏 82':'按住手腕量脈搏',show:!care&&m.step===4&&!m.pulse},
  {id:'zero',label:m.zero?'已歸零':'TOCO 歸零',show:!care&&m.step===5},
  {id:'record',label:m.step===6?'完成觀察並停止':m.recording?'停止記錄':'開始記錄',show:!care&&m.step>=5},
  {id:'volume',label:'音量旋鈕',show:!care&&m.step===5},
  {id:'tissue',label:'拿擦拭紙巾',show:care&&s.care.includes('remove')&&!b.tissueDisposed&&held!=='tissue'},
  {id:'tray',label:'放回器材盤',show:care&&(held==='US'||held==='TOCO'),target:true},
  {id:'bin',label:'處理用過的紙巾',show:care&&held==='tissue'&&b.tissueUsed,target:true},
  {id:'cover',label:'拉回被單',show:care&&s.care.includes('wipePatient')&&!s.care.includes('cover')},
  {id:'wash',label:s.care.includes('wash')?'手部衛生完成':'壓取手部衛生用品',show:care&&s.care.includes('clean')&&!s.care.includes('wash')}
 ];

 useEffect(()=>{
  const el=host.current;if(!el)return;let dead=false,raf=0,previous=0,presentation=0,appliedView='',cameraMoving=true;
  setStatus('loading');live.current.onReady(false);let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{setStatus('error');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<760?1.25:1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','可直接操作接頭、凝膠、探頭、固定帶與收尾物件的三維產房');el.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e5ece9');const camera=new THREE.PerspectiveCamera(43,1,.03,35);camera.position.set(...CAMERAS.wide.position);
  const pmrem=new THREE.PMREMGenerator(renderer),env=new RoomEnvironment(),environment=pmrem.fromScene(env,.04);scene.environment=environment.texture;scene.environmentIntensity=.5;env.dispose();pmrem.dispose();scene.add(new THREE.HemisphereLight(0xffffff,0xc1cec4,1));
  const key=new THREE.DirectionalLight(0xfff8eb,2);key.position.set(-3,6,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-3,right:3,top:4,bottom:-3,near:.1,far:15});key.shadow.normalBias=.015;scene.add(key);const fill=new THREE.DirectionalLight(0xd9eaf1,.6);fill.position.set(3,3,-2);scene.add(fill);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(...CAMERAS.wide.target);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=.5;controls.maxDistance=5;controls.maxPolarAngle=Math.PI*.48;
  let root:THREE.Group|undefined;const nodes:Record<string,THREE.Object3D|undefined>={},bases=new Map<THREE.Object3D,{position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}>(),morphs:THREE.Mesh[]=[];
  const screenCanvas=document.createElement('canvas');screenCanvas.width=640;screenCanvas.height=400;const ctx=screenCanvas.getContext('2d')!,screenTexture=new THREE.CanvasTexture(screenCanvas);screenTexture.colorSpace=THREE.SRGBColorSpace;screenTexture.flipY=false;let screenStamp=0;
  const dots=GEL_DOTS.map(()=>{const mesh=new THREE.Mesh(new THREE.CircleGeometry(.018,16),new THREE.MeshPhysicalMaterial({color:0xd3e9e8,transparent:true,opacity:.3,roughness:.12,metalness:.04,side:THREE.DoubleSide,depthWrite:false}));scene.add(mesh);return mesh;});
  const stream=new THREE.Mesh(new THREE.CylinderGeometry(.003,.005,.13,10),new THREE.MeshPhysicalMaterial({color:0xa3d7dc,transparent:true,opacity:.7,roughness:.1}));scene.add(stream);stream.visible=false;
  const cables=(['US','TOCO','power'] as const).map(()=>{const l=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x495d63}));scene.add(l);return l;});
  new GLTFLoader().load('/models/palpation-room.glb?v=1.1.0',g=>{if(dead){dispose(g.scene);return;}root=g.scene;scene.add(root);root.traverse(o=>{nodes[o.name]=o;bases.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;if(o.morphTargetDictionary)morphs.push(o);}if(o.name.startsWith('Examiner_'))o.visible=false;});
   const screen=nodes.Monitor_screen;if(screen instanceof THREE.Mesh){const old=screen.material;screen.material=new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false});for(const m of Array.isArray(old)?old:[old])m.dispose();}
   const cover=nodes.Privacy_cover;if(cover instanceof THREE.Mesh){for(const m of Array.isArray(cover.material)?cover.material:[cover.material]){m.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,0,1),-.37)];m.clipShadows=true;}}
   setStatus('ready');live.current.onReady(true);live.current.onAction({type:'bedside',event:{kind:'activate'}});
  },undefined,()=>{if(!dead){setStatus('error');live.current.onReady(false);}});
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),desired=new THREE.Vector3(),target=new THREE.Vector3(),tmp=new THREE.Vector3();
  let drag:{id:number;tool:Tool;x:number;y:number;value:number;travel:number;uv:XY|null;point:THREE.Vector3|null}|null=null,previewUV:XY|null=null,previewTool:Tool|null=null,previewValue:number|null=null,heldPoint:THREE.Vector3|null=null,pour=0,sanitize=0,pulseStart=0,pulsePointer=-1,coverPreview:number|null=null;
  const emit=(event:BedsideEvent)=>live.current.onAction({type:'bedside',event});
  const message=(text:string)=>live.current.onAction({type:'message',text});
  const world=(id:string)=>{if(id==='abdomen')return surface(.1,0).add(new THREE.Vector3(0,.06,0));if(id==='underTarget'){const i=current.current.held==='strap0'?0:1;return new THREE.Vector3(.29,1.01,i===0?.09:-.24);}if(id==='cover')return new THREE.Vector3(0,1.0,.34-(coverPreview??live.current.state.monitor.objects.cover)*.68);return nodes[NAMES[id]??id]?.getWorldPosition(new THREE.Vector3())??new THREE.Vector3();};
  const project=(point:THREE.Vector3)=>{tmp.copy(point).project(camera);return {x:(tmp.x+1)*el!.clientWidth/2,y:(1-tmp.y)*el!.clientHeight/2,z:tmp.z};};
  function setRay(x:number,y:number){const r=renderer.domElement.getBoundingClientRect();pointer.set((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2);ray.setFromCamera(pointer,camera);}
  function abdomenHit(x:number,y:number):XY|null{setRay(x,y);const belly=nodes.Palpation_abdomen;if(!belly)return null;const hit=ray.intersectObject(belly,true)[0];if(!hit)return null;let u=hit.point.x/.245,v=(hit.point.z+.02)/.345;const n=Math.hypot(u,v);if(n>.94){u*=.94/n;v*=.94/n;}return [u,v];}
  const near=(id:string,x:number,y:number,radius=42)=>{const p=project(world(id)),r=renderer.domElement.getBoundingClientRect();return p.z<1&&Math.hypot(p.x-x+r.left,p.y-y+r.top)<radius;};
  function select(tool:Tool|null){heldPoint=tool==='gel'||tool==='tissue'?world(tool).add(new THREE.Vector3(0,.045,0)):null;setHeld(tool);current.current.held=tool;previewTool=tool;previewUV=null;previewValue=null;}
  function act(id:string){const p=live.current,s=p.state,m=s.monitor,b=m.objects,h=current.current.held;
   if(id.startsWith('socket_')){if(h?.startsWith('plug_')){emit({kind:'connect',plug:h.slice(5),socket:id.slice(7)});select(null);}return;}
   if(id==='cap'){emit({kind:'cap'});return;}
   if(id==='power'||id==='zero'||id==='record'||id==='wash'){if(id==='record'&&s.phase===5&&m.step===6){p.onAction({type:'finishMonitoring'});return;}if(id==='wash')sanitize=1.2;emit({kind:'control',control:id==='record'?(m.recording?'stop':'record'):id,relaxed:p.relaxed});return;}
   if(id==='pulse'){message('按住手腕約兩秒，觀察脈搏節奏。');return;}
   if(id==='underTarget'&&(h==='strap0'||h==='strap1')){emit({kind:'under',index:h==='strap0'?0:1});select(null);return;}
   if(id==='abdomen'&&(h==='US'||h==='TOCO')){message('請點腹部的實際位置放置，或用下方替代控制細調。');return;}
   if(id==='tray'&&(h==='US'||h==='TOCO')){emit({kind:'return',probe:h});select(null);return;}
   if(id==='bin'&&h==='tissue'){emit({kind:'dispose'});select(null);return;}
   if((id==='US'||id==='TOCO')&&h==='gel'){emit({kind:'gel',target:id});if(id==='US'&&b.capOpen){pour=.8;select(null);}return;}
   if(id==='US'&&h==='tissue'){message('按住紙巾，在探頭表面擦拭；也可使用鍵盤擦拭控制。');return;}
   if(id==='US'||id==='TOCO'||id==='gel'||id==='tissue'||id.startsWith('plug_')||id==='strap0'||id==='strap1'||id==='cover'||id==='volume'){select(id as Tool);}
  }
  function begin(id:string,e:PointerEvent){if(!root||e.button!==0)return;e.preventDefault();e.stopPropagation();controls.enabled=false;
   if(id==='pulse'){pulseStart=performance.now();pulsePointer=e.pointerId;renderer.domElement.setPointerCapture(e.pointerId);return;}
   const old=current.current.held;act(id);const tool=current.current.held;
   if(!tool||id==='cap'||id.startsWith('socket_')||id==='underTarget'||id==='tray'||id==='bin'||id==='power'||id==='zero'||id==='record'||id==='wash'||old==='gel'&&(id==='US'||id==='TOCO')){controls.enabled=true;return;}
   const b=live.current.state.monitor.objects,index=tool==='strap1'?1:0;drag={id:e.pointerId,tool,x:e.clientX,y:e.clientY,value:tool==='volume'?b.volume:tool==='cover'?b.cover:b.tension[index],travel:0,uv:null,point:world(tool)};renderer.domElement.setPointerCapture(e.pointerId);
  }
  api.current={begin,choose:act};
  function move(e:PointerEvent){if(!drag||drag.id!==e.pointerId)return;e.preventDefault();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.travel=Math.max(drag.travel,Math.hypot(dx,dy));const tool=drag.tool,b=live.current.state.monitor.objects;setRay(e.clientX,e.clientY);
   drag.point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-1.2),new THREE.Vector3());
   if(tool==='US'||tool==='TOCO'){const uv=abdomenHit(e.clientX,e.clientY);if(uv){drag.uv=uv;previewUV=uv;previewTool=tool;live.current.onPreview({probe:tool,position:uv});}}
   if(tool==='volume'){previewValue=Math.max(0,Math.min(1,drag.value+(dx-dy)/160));emit({kind:'volume',value:previewValue,finish:false});}
   if(tool==='strap0'||tool==='strap1')previewValue=Math.max(0,Math.min(1,drag.value+dx/150));
   if(tool==='cover')coverPreview=Math.max(0,Math.min(1,drag.value-dy/180));
   if(tool==='tissue'&&live.current.state.phase===6){const uv=abdomenHit(e.clientX,e.clientY);if(uv){const cells=wipeCells(live.current.state.monitor.us,uv).filter(i=>!b.wiped.includes(i));if(cells.length)emit({kind:'wipe',cells});drag.point=surface(...uv).add(new THREE.Vector3(0,.02,0));}if(drag.travel>15&&near('US',e.clientX,e.clientY,48)&&!b.probeClean)emit({kind:'wipeProbe'});}
  }
  function end(e:PointerEvent){if(pulsePointer===e.pointerId){if(e.type==='pointerup'&&performance.now()-pulseStart>=1800)emit({kind:'control',control:'pulse'});else if(e.type==='pointerup')message('停留時間不足，請按住手腕約兩秒。');pulseStart=0;pulsePointer=-1;controls.enabled=true;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);return;}
   if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;controls.enabled=true;if(renderer.domElement.hasPointerCapture(d.id))renderer.domElement.releasePointerCapture(d.id);
   if(e.type!=='pointerup'){previewUV=null;previewTool=null;previewValue=null;coverPreview=null;live.current.onPreview(null);return;}
   if(d.travel<6)return;
   const h=d.tool,b=live.current.state.monitor.objects,care=live.current.state.phase===6;if((h==='tissue'||h==='gel')&&d.point)heldPoint=d.point.clone();
   if(h.startsWith('plug_')){const socket=['US','TOCO','power'].find(p=>near('socket_'+p,e.clientX,e.clientY,45));if(socket){emit({kind:'connect',plug:h.slice(5),socket});select(null);}else message('把接頭移到有標示的插孔，再放開。');}
   else if(h==='US'||h==='TOCO'){if(care){if(near('tray',e.clientX,e.clientY,90)){emit({kind:'return',probe:h});select(null);}else message('把探頭放回器材盤。');}else if(abdomenHit(e.clientX,e.clientY)){emit({kind:'place',probe:h,position:abdomenHit(e.clientX,e.clientY)!,finish:true});select(null);}else message('請將探頭放在腹部表面。');}
   else if(h==='gel'){const probe=near('US',e.clientX,e.clientY,50)?'US':near('TOCO',e.clientX,e.clientY,50)?'TOCO':null;if(probe){emit({kind:'gel',target:probe});if(probe==='US'&&b.capOpen){pour=.8;select(null);}}else message('將瓶口移到 FHR 探頭的接觸面。');}
   else if(h==='strap0'||h==='strap1'){const i=h==='strap0'?0:1;if(care||b.fastened[i]&&Math.abs(e.clientY-d.y)>45){emit({kind:'detach',index:i});select(null);}else if(!b.under[i]){if(near('underTarget',e.clientX,e.clientY,65)){emit({kind:'under',index:i});select(null);}else message('抓住帶尾拉過腹部另一側，再放開。');}else {emit({kind:'strap',index:i,tension:previewValue??d.value,finish:true});select(null);}}
   else if(h==='volume'){emit({kind:'volume',value:previewValue??d.value,finish:true});select(null);}
   else if(h==='cover'){emit({kind:'cover',progress:coverPreview??d.value,finish:true});select(null);}
   else if(h==='tissue'&&near('bin',e.clientX,e.clientY,55)){emit({kind:'dispose'});select(null);}
   previewUV=null;previewTool=null;previewValue=null;coverPreview=null;live.current.onPreview(null);
  }
  function cancel(){if(drag){const d=drag;drag=null;if(renderer.domElement.hasPointerCapture(d.id))renderer.domElement.releasePointerCapture(d.id);}pulsePointer=-1;pulseStart=0;previewUV=null;previewTool=null;previewValue=null;coverPreview=null;live.current.onPreview(null);controls.enabled=true;}
  function down(e:PointerEvent){if(!root||e.button!==0)return;const h=current.current.held;if(h){if(h==='US'||h==='TOCO'){const uv=abdomenHit(e.clientX,e.clientY);if(uv){begin(h,e);if(drag){drag.uv=uv;drag.travel=7;previewUV=uv;previewTool=h;live.current.onPreview({probe:h,position:uv});}return;}}begin(h,e);return;}
   setRay(e.clientX,e.clientY);for(const hit of ray.intersectObject(root,true)){let node:THREE.Object3D|null=hit.object;while(node){const id=Object.entries(NAMES).find(([,name])=>name===node!.name)?.[0];if(id&&hot.current.has(id)&&hot.current.get(id)?.style.visibility!=='hidden'){begin(id,e);return;}node=node.parent;}}
  }
  renderer.domElement.addEventListener('pointerdown',down,true);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',end);renderer.domElement.addEventListener('pointercancel',end);renderer.domElement.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);const hide=()=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',hide);
  const resize=new ResizeObserver(()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.fov=camera.aspect<1?61:43;camera.updateProjectionMatrix();});resize.observe(el);
  function place(node:THREE.Object3D,point:THREE.Vector3){node.position.copy(node.parent?node.parent.worldToLocal(point.clone()):point);}
  function drawScreen(now:number){const p=live.current,s=p.state,m=s.monitor;let show=s;if(previewUV&&(previewTool==='US'||previewTool==='TOCO')){show={...s,monitor:{...m,[previewTool==='US'?'us':'toco']:previewUV,objects:{...m.objects,onBody:previewTool==='US'?[true,m.objects.onBody[1]]:m.objects.onBody}}};}const q=monitorSignal(show,signalAt);ctx.fillStyle='#152f3c';ctx.fillRect(0,0,640,400);if(m.power){ctx.fillStyle='#b8d5d9';ctx.font='22px sans-serif';ctx.fillText('FHR   bpm',24,35);ctx.fillText('TOCO relative',350,35);ctx.font='bold 62px sans-serif';ctx.fillStyle='#8ee1c9';ctx.fillText(m.gel&&show.monitor.objects.onBody[0]&&maternalZone(show.monitor.us)?'82':q>=70?'140':'--',24,105);ctx.font='24px sans-serif';ctx.fillStyle='#e6edce';ctx.fillText(m.tocoPlaced?(p.relaxed?'REST':'CONTRACTION'):'--',350,95);ctx.font='20px sans-serif';ctx.fillStyle='#b8d5d9';ctx.fillText('MHR '+(m.pulse?'82':'--'),24,150);ctx.fillText('SIGNAL '+q+'%',350,150);ctx.strokeStyle='#38545e';for(let y=190;y<360;y+=35){ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(616,y);ctx.stroke();}if(m.recorded){for(const track of [0,1]){ctx.beginPath();for(let i=0;i<=180;i++){const x=24+i*3.28,y=track===0?230+Math.sin(i*1.9+p.time)*4+Math.sin(i*.4)*6:350-23*Math.exp(-(((i-70)/19)**2))-30*Math.exp(-(((i-150)/19)**2));i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle=track===0?'#8ee1c9':'#e0e7c4';ctx.lineWidth=2;ctx.stroke();}}ctx.font='18px sans-serif';ctx.fillStyle='#b8d5d9';ctx.fillText(m.recording?'TEACHING RECORDING':'RECORD STOPPED',24,390);}screenTexture.needsUpdate=true;screenStamp=now;}
  const beltStamp=['',''];
  function render(now:number){raf=requestAnimationFrame(render);if(document.hidden||now-previous<1000/30)return;const dt=Math.min(.08,(now-previous)/1000);previous=now;const p=live.current,s=p.state,m=s.monitor,b=m.objects,h=current.current.held;
   if(appliedView!==current.current.view){appliedView=current.current.view;desired.set(...CAMERAS[current.current.view].position);target.set(...CAMERAS[current.current.view].target);cameraMoving=true;}
   if(cameraMoving){const f=p.reduced?1:1-Math.exp(-dt*8);camera.position.lerp(desired,f);controls.target.lerp(target,f);if(camera.position.distanceTo(desired)<.005)cameraMoving=false;}controls.update();camera.position.x=THREE.MathUtils.clamp(camera.position.x,-1.5,1.60);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-1.07,1.10);camera.position.y=THREE.MathUtils.clamp(camera.position.y,.65,2.48);camera.lookAt(controls.target);if(!p.reduced)presentation+=dt;
   if(root){for(const mesh of morphs){const dict=mesh.morphTargetDictionary!,weights=mesh.morphTargetInfluences!;for(const [key,value] of [['Breath',p.reduced?.25:(Math.sin(presentation*1.45)*.5+.5)],['Blink',p.reduced?0:Math.max(0,1-Math.abs(presentation%4.9-4.7)/.1)],['Contraction',p.relaxed?0:.4],['Knees_flex',1]] as const)if(dict[key]!==undefined)weights[dict[key]]=value;}
    for(const name of ['Curtain_dynamic','Curtain_front_dynamic','Curtain_right_dynamic']){const curtain=nodes[name];if(curtain)curtain.scale[name==='Curtain_front_dynamic'?'x':'z']=s.prep.includes('privacy')?1:.14;}
    if(nodes.Gel_patch)nodes.Gel_patch.visible=false;
    for(const id of ['gel','tissue','plug_US','plug_TOCO','plug_power','volume']){const node=nodes[NAMES[id]];if(!node)continue;const base=bases.get(node)!;node.position.copy(base.position);node.quaternion.copy(base.quaternion);node.scale.copy(base.scale);}
    const cap=nodes.Gel_cap;if(cap){const base=bases.get(cap)!;cap.position.copy(base.position);cap.quaternion.copy(base.quaternion);if(b.capOpen)cap.rotateX(-1.919862);}
    for(const [kind,name] of [['US','FHR_transducer'],['TOCO','TOCO_transducer']] as const){const node=nodes[name];if(!node)continue;const i=probeIndex(kind),base=bases.get(node)!;node.visible=true;node.position.copy(base.position);node.quaternion.copy(base.quaternion);if(b.onBody[i]||previewUV&&previewTool===kind){const uv=previewUV&&previewTool===kind?previewUV:kind==='US'?m.us:m.toco,n=normal(...uv);node.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);const point=surface(...uv).addScaledVector(n,.019);if(b.fastened[i]&&tensionName(b.tension[i])==='loose'&&!p.reduced)point.x+=Math.sin(presentation*3)*.004;place(node,point);}}
    for(const i of [0,1] as const){const belt=nodes[i===0?'Belt_FHR':'Belt_TOCO'],buckle=nodes[i===0?'Buckle_FHR':'Buckle_TOCO'],uv=i===0?m.us:m.toco,tension=drag?.tool===`strap${i}`&&previewValue!==null?previewValue:b.tension[i];if(belt){belt.visible=b.under[i]&&!b.detached[i];const stamp=`${uv[1]}:${tension.toFixed(2)}:${b.fastened[i]}`;if(belt instanceof THREE.Mesh&&stamp!==beltStamp[i]){belt.geometry.dispose();belt.geometry=beltGeometry(uv[1],tension,b.fastened[i]);for(const material of Array.isArray(belt.material)?belt.material:[belt.material])material.side=THREE.DoubleSide;beltStamp[i]=stamp;}}
     if(buckle){const point=!b.under[i]?new THREE.Vector3(-.30,.92,i===0?.10:-.24):surface(Math.min(.8,uv[0]+.22),uv[1]).add(new THREE.Vector3(0,.04,0));if(drag?.tool===`strap${i}`&&drag.point)point.lerp(drag.point,.4);place(buckle,point);buckle.visible=!b.detached[i];}}
    for(const [i,pair] of (['US','TOCO','power'] as const).entries()){const plug=nodes['Cable_plug_'+pair],socket=nodes['Socket_'+pair];if(plug&&socket&&m.connections.includes(pair)){place(plug,socket.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,0,.04)));}if(plug){const start=pair==='power'?new THREE.Vector3(1.05,.4,-.5):nodes[pair==='US'?'FHR_transducer':'TOCO_transducer']?.getWorldPosition(new THREE.Vector3())??new THREE.Vector3();const end=plug.getWorldPosition(new THREE.Vector3()),middle=start.clone().lerp(end,.5);middle.y-=.14;const points=new THREE.QuadraticBezierCurve3(start,middle,end).getPoints(20);cables[i].geometry.dispose();cables[i].geometry=new THREE.BufferGeometry().setFromPoints(points);}}
    if(!drag&&heldPoint&&(h==='gel'||h==='tissue')){const node=nodes[NAMES[h]];if(node)place(node,heldPoint);}
    if(drag?.point&&['gel','tissue','plug_US','plug_TOCO','plug_power'].includes(drag.tool)){const node=nodes[NAMES[drag.tool]];if(node)place(node,drag.point);}
    const bottle=nodes.Gel_bottle;if(pour>0&&bottle){pour=Math.max(0,pour-dt);const at=world('US');place(bottle,at.clone().add(new THREE.Vector3(0,.17,0)));bottle.rotateZ(-1.8);stream.visible=true;stream.position.copy(at).y+=.09;}else stream.visible=false;
    if(nodes.Clean_tissue){nodes.Clean_tissue.visible=!b.tissueDisposed;if(nodes.Clean_tissue instanceof THREE.Mesh){const mat=nodes.Clean_tissue.material;if(!Array.isArray(mat)&&mat instanceof THREE.MeshStandardMaterial)mat.color.set(b.tissueUsed?'#d1ded8':'#f8faf4');}}
    for(const [i,dot] of dots.entries()){dot.visible=m.gel&&b.onBody[0]===false&&s.phase===6&&!b.wiped.includes(i)||m.gel&&s.phase===5&&b.onBody[0];const uv:XY=[m.us[0]+GEL_DOTS[i][0],m.us[1]+GEL_DOTS[i][1]];if(Math.hypot(...uv)>.96){dot.visible=false;continue;}dot.scale.set(1,.68+(i%3)*.12,1);const n=normal(...uv);dot.position.copy(surface(...uv).addScaledVector(n,.006));dot.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);}
    const cover=nodes.Privacy_cover,coverAmount=coverPreview??b.cover;if(cover){cover.visible=s.phase===6&&coverAmount>0;if(cover instanceof THREE.Mesh)for(const mat of Array.isArray(cover.material)?cover.material:[cover.material])if(mat.clippingPlanes)mat.clippingPlanes[0].constant=-(.37-coverAmount*.76);}
    const pump=nodes.Sanitizer_pump;if(pump){const base=bases.get(pump)!;pump.position.copy(base.position);if(sanitize>0){sanitize=Math.max(0,sanitize-dt);pump.position.y-=Math.sin((1.2-sanitize)/1.2*Math.PI)*.014;}}
    const knob=nodes.Control_volume;if(knob)knob.rotateZ((b.volume-.5)*Math.PI*1.6);
    if(now-screenStamp>150)drawScreen(now);
    scene.updateMatrixWorld(true);
    for(const [id,button] of hot.current){const point=world(id);if(id==='cap')point.y+=.03;if(id==='pulse')point.y+=.025;if(id.startsWith('anatomy'))point.y+=.06;const v=project(point);if(id.startsWith('socket_'))v.y+=9;if(id==='power')v.y-=14;button.style.left=`${v.x}px`;button.style.top=`${v.y}px`;button.style.visibility=v.z>1||v.x<18||v.y<65||v.x>el!.clientWidth-18||v.y>el!.clientHeight-20?'hidden':'visible';if(id==='pulse')button.style.setProperty('--hold',`${Math.min(100,pulseStart?(now-pulseStart)/18:0)}%`);}
   }renderer.render(scene,camera);
  }raf=requestAnimationFrame(render);
  const lost=(e:Event)=>{e.preventDefault();cancel();setStatus('error');live.current.onReady(false);};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{dead=true;cancelAnimationFrame(raf);cancel();api.current=null;resize.disconnect();controls.dispose();window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hide);if(root){scene.remove(root);dispose(root);}dots.forEach(o=>{o.geometry.dispose();o.material.dispose();});stream.geometry.dispose();stream.material.dispose();cables.forEach(l=>{l.geometry.dispose();l.material.dispose();});screenTexture.dispose();environment.texture.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();live.current.onReady(false);};
 },[retry]);

 const event=(event:BedsideEvent)=>props.onAction({type:'bedside',event});
 function fine(probe:Probe,dx:number,dy:number){const p=probe==='US'?m.us:m.toco;event({kind:'place',probe,position:[Math.max(-.92,Math.min(.92,p[0]+dx)),Math.max(-.92,Math.min(.92,p[1]+dy))],finish:true});}
 return <div className="bedside-workbench">
  <div className="pal-viewer bedside-viewer"><div className="pal-mount" ref={host}/>
   <div className="pal-scene-views">{([['wide','床邊全景'],['bed','腹部'],['tray','器材盤'],['monitor','監視器']] as const).map(([v,label])=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{label}</button>)}</div>
   <div className="bedside-hotspots">{view==='bed'&&[['anatomyFundus','子宮底'],['anatomyFeet','恥骨方向'],['anatomyLeft','母體左側'],['anatomyRight','母體右側']].map(([id,label])=><span key={id} className="bedside-anatomy" ref={node=>{if(node)hot.current.set(id,node);else hot.current.delete(id);}}>{label}</span>)}{descriptors.filter(d=>d.show).map(d=><button key={d.id} ref={node=>{if(node)hot.current.set(d.id,node);else hot.current.delete(d.id);}} className={`bedside-hotspot${d.target?' target':''}${held===d.id?' held':''}`} aria-label={d.label} onPointerDown={e=>api.current?.begin(d.id,e.nativeEvent)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(d.id==='pulse')event({kind:'control',control:'pulse'});else api.current?.choose(d.id);}}}>{d.label}</button>)}</div>
   {status!=='ready'&&<div className="pal-loading">{status==='loading'?'正在準備可操作的床邊物件…':<>無法載入床邊模型。<button className="secondary" onClick={()=>setRetry(v=>v+1)}>重新載入</button></>}</div>}
   {held&&<button className="bedside-put-down" onClick={()=>{setHeld(null);current.current.held=null;props.onPreview(null);}}>放下手中物件</button>}
  </div>
  <div className="bedside-instruction" role="status"><span>{held?'操作中':'床邊操作'}</span><p>{hint}</p></div>
  <button className="text-button bedside-alternative-toggle" aria-expanded={alternatives} onClick={()=>setAlternatives(!alternatives)}>鍵盤與觸控替代控制</button>
  {alternatives&&<div className="bedside-alternatives"><p>替代控制使用相同操作條件，不會略過核對與先後順序。</p>
   {!care?<>{m.step===0?<>{(['US','TOCO','power'] as const).map(p=><button key={p} disabled={m.connections.includes(p)} onClick={()=>event({kind:'connect',plug:p,socket:p})}>拿起並接妥 {p==='power'?'電源':p}</button>)}<button onClick={()=>event({kind:'control',control:'power'})}>操作電源</button></>:m.step===1?<>{([0,1] as const).map(i=><button key={i} onClick={()=>event({kind:'under',index:i})}>拿起並放入第 {i+1} 條固定帶</button>)}</>:m.step===2||m.step===3?<>{m.step===3&&<><button onClick={()=>event({kind:'cap'})}>{b.capOpen?'蓋回':'打開'}瓶蓋</button><button onClick={()=>event({kind:'gel',target:'US'})}>將凝膠瓶移到 FHR 探頭並擠出</button></>}{(['TOCO','US'] as const).filter(p=>m.step===2?p==='TOCO':p==='US').map(p=><div key={p} className="bedside-fine"><b>{p} 探頭</b><button onClick={()=>fine(p,0,-.1)}>往子宮底</button><button onClick={()=>fine(p,-.1,0)}>往母體右側</button><button onClick={()=>fine(p,.1,0)}>往母體左側</button><button onClick={()=>fine(p,0,.1)}>往恥骨</button></div>)}</>:m.step===4?<><button onClick={()=>event({kind:'control',control:'pulse'})}>在手腕量取脈搏</button>{([0,1] as const).map(i=><div key={i}><b>{i===0?'FHR':'TOCO'} 帶尾</b><button onClick={()=>event({kind:'strap',index:i,tension:b.tension[i]-.15,finish:true})}>鬆開一段</button><button onClick={()=>event({kind:'strap',index:i,tension:b.tension[i]+.15,finish:true})}>拉緊一段</button><span>{tensionName(b.tension[i])==='comfortable'?'舒適且穩定':tensionName(b.tension[i])==='tight'?'過緊':'過鬆'}</span></div>)}</>:m.step===6?<button onClick={()=>props.onAction({type:'finishMonitoring'})}>完成觀察並停止監測</button>:<><button onClick={()=>event({kind:'control',control:'zero',relaxed:props.relaxed})}>操作歸零</button><button onClick={()=>event({kind:'control',control:m.recording?'stop':'record'})}>{m.recording?'停止':'開始'}記錄</button><button onClick={()=>event({kind:'volume',value:b.volume-.15,finish:true})}>旋小音量</button><button onClick={()=>event({kind:'volume',value:b.volume+.15,finish:true})}>旋大音量</button></>}</>:<>{([0,1] as const).map(i=><div key={i}><button onClick={()=>event({kind:'detach',index:i})}>解開 {i===0?'FHR':'TOCO'} 帶扣</button><button onClick={()=>event({kind:'return',probe:i===0?'US':'TOCO'})}>取下並放回 {i===0?'FHR':'TOCO'} 探頭</button></div>)}<button onClick={()=>event({kind:'wipe',cells:GEL_DOTS.flatMap((_,i)=>b.wiped.includes(i)?[]:[i]).slice(0,3)})}>拿紙巾擦拭一片腹部區域</button><button onClick={()=>event({kind:'wipeProbe'})}>擦拭探頭接觸面</button><button onClick={()=>event({kind:'dispose'})}>處理使用過的紙巾</button><button onClick={()=>event({kind:'cover',progress:b.cover+.3,finish:true})}>向上拉回一段被單</button><button onClick={()=>event({kind:'control',control:'wash'})}>壓取並完成手部衛生</button></>}
  </div>}
 </div>;
}
