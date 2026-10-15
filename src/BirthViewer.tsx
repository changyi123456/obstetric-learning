import {assetUrl} from './assets';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Plus,Minus,RotateCcw,LoaderCircle,RefreshCw,RotateCw,Hand,Orbit} from 'lucide-react';
import {BIRTH_STAGES,sampleBirth} from './birth';
import {angleStep,manipulation,type MotionPart} from './birth-manipulation';
import motion from './birth-poses.json';
type View='oblique'|'front'|'side'|'top';
type Practice={stage:number;part:MotionPart;primary:number;secondary:number;locked:boolean;onChange:(part:MotionPart,value:number)=>void;onRelease:(advance:boolean)=>void};
type Props={time:number;opacity:number;cutaway:boolean;onReady:(ready:boolean)=>void;practice?:Practice};
const OFFSETS:Record<View,[number,number,number]>={oblique:[5.1,1.8,5.1],front:[0,1.6,7.2],side:[7.2,1.1,0],top:[0,7.8,.015]};
function framing(time:number){const y=sampleBirth(time).position[1],low=Math.min(-.72,y-.35),high=Math.max(1.15,y+2.2*motion.scale);return {center:(low+high)/2,distance:Math.max(4.8,(high-low)/2/Math.tan(21*Math.PI/180)*1.3)};}
function dispose(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});}
export default function BirthViewer(props:Props){
  const hostRef=useRef<HTMLDivElement>(null),live=useRef(props);live.current=props;
  const handleRef=useRef<HTMLButtonElement>(null),guideRef=useRef<SVGSVGElement>(null),inputMode=useRef<'model'|'camera'>('model');
  const keyStart=useRef<number|null>(null);
  const control=useRef<{view:(v:View)=>void;zoom:(v:number)=>void;rotate:(v:number)=>void;start:(e:PointerEvent,handle:boolean)=>void;cancel:()=>void}|null>(null);
  const [view,setView]=useState<View>('oblique'),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[retry,setRetry]=useState(0);
  const [interaction,setInteraction]=useState<'model'|'camera'>('model'),[dragging,setDragging]=useState(false);inputMode.current=interaction;
  const exercise=props.practice,gesture=exercise?manipulation(exercise.stage,exercise.part):undefined;
  const meta=exercise?BIRTH_STAGES[exercise.stage]:undefined;
  const label=meta?(exercise?.part===1&&'second' in meta?meta.second:meta.control):'';
  const atTarget=exercise&&(exercise.part===0?exercise.primary:exercise.secondary)>=85;
  const grabText=exercise?.locked?'已確認動作':exercise&&exercise.primary<0?'方向相反 · 沿提示調整':atTarget?(exercise&&exercise.stage>=5&&exercise.part===0?'已到位 · 放開繼續':'已到位 · 請確認'):exercise&&exercise.stage>=5?`${label} · ${gesture?.kind==='turn'?'轉動':'拖動'}`:gesture?.kind==='turn'?'抓住模型轉動':'抓住模型拖動';
  useEffect(()=>{if(exercise){const v=manipulation(exercise.stage,0).view;setView(v);setInteraction('model');control.current?.cancel();control.current?.view(v);}},[exercise?.stage,!!exercise,retry]);
  useEffect(()=>{
    const host=hostRef.current;if(!host)return;
    let dead=false,raf=0,last=0,previousTime=-1;
    setStatus('loading');live.current.onReady(false);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.05,80);
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{setStatus('error');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor('#e9f0f4');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.localClippingEnabled=true;
    renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','分娩機轉 3D 動畫，使用視角與縮放按鈕觀察頭、頸、肩及骨盆。');host.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.2;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.88;
    const initialView=live.current.practice?manipulation(live.current.practice.stage,0).view:'oblique';
    let fit=framing(live.current.time);controls.target.set(0,fit.center,0);camera.position.copy(controls.target).add(new THREE.Vector3(...OFFSETS[initialView]).normalize().multiplyScalar(fit.distance));controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff,0xa1aeb6,1.5));
    const key=new THREE.DirectionalLight(0xfff7ed,2.5);key.position.set(-3,6,4);scene.add(key);const rim=new THREE.DirectionalLight(0xd9f0ff,1.1);rim.position.set(4,2,-3);scene.add(rim);
    const clip=new THREE.Plane(new THREE.Vector3(-1,0,0),0),bones:THREE.MeshStandardMaterial[]=[];
    let body:THREE.Mesh|undefined,headBone:THREE.Object3D|undefined,bodyBone:THREE.Object3D|undefined,mixer:THREE.AnimationMixer|undefined,action:THREE.AnimationAction|undefined;
    const fetalMeshes:THREE.Mesh[]=[];
    const curve=new THREE.CatmullRomCurve3(Array.from({length:65},(_,i)=>{const z=.48*Math.sin(i/64*Math.PI*2);return new THREE.Vector3(.64*Math.cos(i/64*Math.PI*2),.35-.7*z,z);}),true);
    const inlet=new THREE.Mesh(new THREE.TubeGeometry(curve,80,.009,6,true),new THREE.MeshBasicMaterial({color:'#80aeb6',transparent:true,opacity:.8}));scene.add(inlet);
    const loader=new GLTFLoader();
    Promise.all([loader.loadAsync(assetUrl('models/pelvis.glb')),loader.loadAsync(assetUrl(`models/birth-fetus.glb?v=${motion.version}`))]).then(([pelvis,fetus])=>{
      if(dead){dispose(pelvis.scene);dispose(fetus.scene);return;}
      pelvis.scene.traverse(o=>{if(o instanceof THREE.Mesh){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());const mat=new THREE.MeshStandardMaterial({color:'#eee1c8',roughness:.78,transparent:true,side:THREE.DoubleSide});o.material=mat;bones.push(mat);}});
      fetus.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.frustumCulled=false;o.material=(o.material as THREE.Material).clone();fetalMeshes.push(o);if(o.name.startsWith('Birth_body_surface'))body=o;}});
      headBone=fetus.scene.getObjectByName('Birth_head');bodyBone=fetus.scene.getObjectByName('Birth_body');
      const clip=fetus.animations.find(c=>c.name.includes('Birth_Sequence'))??fetus.animations[0];if(!clip)throw Error('Missing authored motion');
      scene.add(pelvis.scene,fetus.scene);mixer=new THREE.AnimationMixer(fetus.scene);action=mixer.clipAction(clip);action.play();action.paused=true;
      setStatus('ready');live.current.onReady(true);
    }).catch(()=>{if(!dead){setStatus('error');live.current.onReady(false);}});
    let activeView:View=initialView;
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const anchor=new THREE.Vector3(),projected=new THREE.Vector3();
    type Drag={id:number;part:MotionPart;stage:number;value:number;x:number;y:number;cx:number;cy:number;angle:number;total:number;sign:number;direction:THREE.Vector2;span:number;kind:'move'|'turn';degrees:number};
    let drag:Drag|undefined;
    function worldAnchor(){const p=live.current.practice;if(!p)return anchor.set(0,0,0);const head=manipulation(p.stage,p.part).target==='head';const bone=head?headBone:bodyBone;return bone?bone.localToWorld(anchor.set(0,head?.38:1.15,0)):anchor.set(0,0,0);}
    function screen(v:THREE.Vector3){projected.copy(v).project(camera);return new THREE.Vector2((projected.x+1)*host!.clientWidth/2,(1-projected.y)*host!.clientHeight/2);}
    function direction(){const p=live.current.practice!;const start=p.stage===6?(p.part===0?6:6.35):p.stage,end=p.stage===6?(p.part===0?6.35:7):p.stage+1;
      const a=sampleBirth(start).position,b=sampleBirth(end).position;const v=screen(worldAnchor().clone().add(new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]))).sub(screen(worldAnchor()));return v.length()<12?new THREE.Vector2(0,1):v.normalize();}
    function turnSign(){const p=live.current.practice!,pose=sampleBirth(live.current.time),pitch=p.stage===2||p.stage===4;
      const axis=pitch?new THREE.Vector3(Math.cos(pose.bodyYaw*Math.PI/180),0,-Math.sin(pose.bodyYaw*Math.PI/180)):new THREE.Vector3(0,1,0);
      const radial=pitch?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);const c=screen(worldAnchor()),a=screen(worldAnchor().clone().add(radial.clone().multiplyScalar(.4))).sub(c);
      const sign=p.stage===2||p.stage===5?1:-1;const b=screen(worldAnchor().clone().add(radial.applyAxisAngle(axis,sign*.1).multiplyScalar(.4))).sub(c);
      const cross=a.x*b.y-a.y*b.x;return Math.abs(cross)<.5?1:Math.sign(cross);}
    function finish(cancelled=false){if(!drag)return;const id=drag.id,advance=drag.part===0&&drag.value<85&&(live.current.practice?.primary??0)>=85;drag=undefined;setDragging(false);if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);if(!cancelled)live.current.practice?.onRelease(advance);}
    function start(e:PointerEvent,fromHandle:boolean){
      const p=live.current.practice;if(!p||inputMode.current!=='model'||p.locked||!action||e.button!==0)return;
      if(drag){e.preventDefault();e.stopImmediatePropagation();return;}
      const rect=renderer.domElement.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
      scene.updateMatrixWorld(true);
      if(!fromHandle){pointer.set(x/rect.width*2-1,1-y/rect.height*2);raycaster.setFromCamera(pointer,camera);for(const o of fetalMeshes){if(o instanceof THREE.SkinnedMesh){o.skeleton.update();o.computeBoundingSphere();}}if(!raycaster.intersectObjects(fetalMeshes,false).length)return;}
      e.preventDefault();e.stopImmediatePropagation();controls.enabled=false;controls.update();
      const info=manipulation(p.stage,p.part),center=screen(worldAnchor());
      // A grab near the center uses a virtual pivot below the finger so the first
      // sideways movement remains a stable rotation rather than an angle jump.
      if(info.kind==='turn'&&Math.hypot(x-center.x,y-center.y)<18){center.x=x;center.y=y+44;}
      drag={id:e.pointerId,part:p.part,stage:p.stage,value:p.part===0?p.primary:p.secondary,x,y,cx:center.x,cy:center.y,angle:Math.atan2(y-center.y,x-center.x),total:0,sign:turnSign(),direction:direction(),span:Math.min(180,Math.max(95,rect.height*.32)),kind:info.kind,degrees:info.degrees};
      renderer.domElement.setPointerCapture(e.pointerId);setDragging(true);handleRef.current?.focus({preventScroll:true});
    }
    function move(e:PointerEvent){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopImmediatePropagation();const p=live.current.practice;if(!p||p.locked||p.stage!==drag.stage||p.part!==drag.part){finish(true);return;}
      const r=renderer.domElement.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let amount=0;
      if(drag.kind==='move')amount=((x-drag.x)*drag.direction.x+(y-drag.y)*drag.direction.y)/drag.span*100;
      else{const angle=Math.atan2(y-drag.cy,x-drag.cx);drag.total+=angleStep(drag.angle,angle);drag.angle=angle;amount=drag.total*drag.sign/(drag.degrees*Math.PI/180)*100;}
      p.onChange(drag.part,drag.value+amount);
    }
    function up(e:PointerEvent){if(drag&&e.pointerId===drag.id){e.preventDefault();e.stopImmediatePropagation();finish(e.type!=='pointerup');}}
    const down=(e:PointerEvent)=>start(e,false);
    const cancelDrag=()=>finish(true),hidden=()=>{if(document.hidden)cancelDrag();};
    renderer.domElement.addEventListener('pointerdown',down,true);renderer.domElement.addEventListener('pointermove',move,true);renderer.domElement.addEventListener('pointerup',up,true);renderer.domElement.addEventListener('pointercancel',up,true);renderer.domElement.addEventListener('lostpointercapture',up,true);
    window.addEventListener('blur',cancelDrag);document.addEventListener('visibilitychange',hidden);
    control.current={view(v){activeView=v;camera.position.copy(controls.target).add(new THREE.Vector3(...OFFSETS[v]).normalize().multiplyScalar(fit.distance));controls.update();},zoom(v){camera.position.sub(controls.target).multiplyScalar(v).add(controls.target);controls.update();},rotate(v){camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),v).add(controls.target);controls.update();},start,cancel:()=>finish(true)};
    const resize=new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();});resize.observe(host);
    const lost=(e:Event)=>{e.preventDefault();setStatus('error');live.current.onReady(false);};renderer.domElement.addEventListener('webglcontextlost',lost);
    const delta=new THREE.Vector3();
    function render(now:number){
      raf=requestAnimationFrame(render);if(document.hidden||now-last<1000/30)return;last=now;
      const p=live.current;
      if(action&&mixer&&previousTime!==p.time){action.time=Math.max(0,Math.min(action.getClip().duration,p.time*6));mixer.update(0);previousTime=p.time;}
      const nextFit=framing(p.time);
      delta.set(0,nextFit.center-controls.target.y,0);camera.position.add(delta);controls.target.add(delta);
      if(nextFit.distance!==fit.distance)camera.position.sub(controls.target).multiplyScalar(nextFit.distance/fit.distance).add(controls.target);fit=nextFit;
      controls.enabled=!drag&&(!p.practice||inputMode.current==='camera');
      bones.forEach(m=>{m.opacity=p.opacity;m.depthWrite=p.opacity>.95;m.clippingPlanes=p.cutaway?[clip]:[];});
      if(body){const mat=body.material as THREE.MeshStandardMaterial;mat.transparent=activeView==='top';mat.opacity=activeView==='top'?.23:1;mat.depthWrite=activeView!=='top';}
      controls.update();scene.updateMatrixWorld(true);
      if(p.practice&&handleRef.current){const c=screen(worldAnchor());handleRef.current.style.left=`${Math.max(36,Math.min(host!.clientWidth-36,c.x))}px`;handleRef.current.style.top=`${Math.max(115,Math.min(host!.clientHeight-80,c.y))}px`;
        if(guideRef.current){if(manipulation(p.practice.stage,p.practice.part).kind==='turn')guideRef.current.style.transform=`scaleX(${turnSign()})`;else{const d=direction();guideRef.current.style.transform=`rotate(${Math.atan2(-d.x,d.y)*180/Math.PI}deg)`;}}}
      renderer.domElement.style.cursor=p.practice&&inputMode.current==='model'?(drag?'grabbing':'grab'):'grab';renderer.render(scene,camera);
    }
    raf=requestAnimationFrame(render);
    return()=>{dead=true;finish(true);cancelAnimationFrame(raf);resize.disconnect();controls.dispose();mixer?.stopAllAction();dispose(scene);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('pointerdown',down,true);renderer.domElement.removeEventListener('pointermove',move,true);renderer.domElement.removeEventListener('pointerup',up,true);renderer.domElement.removeEventListener('pointercancel',up,true);renderer.domElement.removeEventListener('lostpointercapture',up,true);window.removeEventListener('blur',cancelDrag);document.removeEventListener('visibilitychange',hidden);renderer.dispose();renderer.domElement.remove();control.current=null;};
  },[retry]);
  function change(v:View){control.current?.cancel();setView(v);control.current?.view(v);}
  function keyboard(e:React.KeyboardEvent){if(!exercise||exercise.locked)return;const current=exercise.part===0?exercise.primary:exercise.secondary;const delta=({ArrowRight:5,ArrowDown:5,ArrowLeft:-5,ArrowUp:-5,PageDown:20,PageUp:-20,Enter:5,' ':5} as Record<string,number>)[e.key];if(delta===undefined&&e.key!=='Home'&&e.key!=='End')return;e.preventDefault();keyStart.current??=current;exercise.onChange(exercise.part,e.key==='Home'?0:e.key==='End'?100:current+delta);}
  return <div className="anatomy-stage birth-stage">
    <div className="view-toolbar" aria-label="分娩觀察視角">{(['oblique','front','side','top'] as const).map(v=><button key={v} className={view===v?'selected':''} aria-pressed={view===v} onClick={()=>change(v)}>{({oblique:'斜側',front:'正面',side:'側面',top:'俯視'})[v]}</button>)}<button aria-label="重設分娩視角" onClick={()=>change('oblique')}><RotateCcw size={16}/><span>重設</span></button></div>
    <div className="model-mount" ref={hostRef}/>
    {exercise&&<div className="model-input-switch" aria-label="模型操作方式"><button aria-pressed={interaction==='model'} className={interaction==='model'?'selected':''} onClick={()=>{control.current?.cancel();setInteraction('model');}}><Hand size={15}/>操作模型</button><button aria-pressed={interaction==='camera'} className={interaction==='camera'?'selected':''} onClick={()=>{control.current?.cancel();setInteraction('camera');}}><Orbit size={15}/>轉動視角</button></div>}
    {exercise&&gesture&&interaction==='model'&&status==='ready'&&<button ref={handleRef} className={`model-grab-target ${dragging?'is-grabbing':''} ${exercise.locked?'is-locked':''} ${atTarget?'is-at-target':''}`} aria-label={`直接操作模型：${label}`} aria-describedby="model-direct-help" disabled={exercise.locked} onPointerDown={e=>control.current?.start(e.nativeEvent,true)} onKeyDown={keyboard} onKeyUp={()=>{exercise.onRelease(keyStart.current!==null&&keyStart.current<85&&exercise.primary>=85);keyStart.current=null;}} onBlur={()=>{keyStart.current=null;}}><svg ref={guideRef} viewBox="-40 -40 80 80" aria-hidden="true">{gesture.kind==='turn'?<><path d="M -29 9 A 31 31 0 1 1 25 19"/><path d="M 25 7 L 25 19 L 37 17"/></>:<><path d="M 0 -32 L 0 33 M -12 21 L 0 33 L 12 21"/><path className="grab-direction-back" d="M 0 -32 L -8 -24 M 0 -32 L 8 -24"/></>}</svg><span className="grab-center"><Hand size={18}/></span><span className="grab-label">{grabText}</span></button>}
    <div className="birth-legend"><span><i/>枕部</span><span><i/>肩部方向</span><span><i/>入口參考線</span></div>
    <div className="camera-buttons"><button aria-label="分娩視角向左轉" onClick={()=>control.current?.rotate(-Math.PI/8)}><RotateCcw size={16}/></button><button aria-label="分娩視角向右轉" onClick={()=>control.current?.rotate(Math.PI/8)}><RotateCw size={16}/></button><span/><button aria-label="放大分娩模型" onClick={()=>control.current?.zoom(.88)}><Plus size={17}/></button><button aria-label="縮小分娩模型" onClick={()=>control.current?.zoom(1.12)}><Minus size={17}/></button></div>
    <div className="gesture-hint" id="model-direct-help">{exercise?(interaction==='model'?'抓住胎兒或青綠標記操作 · 方向鍵微調':'拖曳轉動視角 · 不改變動作答案'):view==='top'?'俯視時淡化軀幹，便於比較頭肩方向':'拖曳轉動視角 · 雙指縮放'}</div>
    {status!=='ready'&&<div className="model-status" role={status==='error'?'alert':'status'}>{status==='loading'?<><LoaderCircle className="spin" size={28}/>正在載入分娩動畫</>:<><span>分娩模型暫時無法載入</span><small>保留目前進度，可重新載入。</small><button className="primary" onClick={()=>setRetry(x=>x+1)}><RefreshCw size={16}/>重新載入分娩模型</button></>}</div>}
  </div>;
}
