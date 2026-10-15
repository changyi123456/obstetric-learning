import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RotateCcw, Plus, Minus, LoaderCircle, RefreshCw } from 'lucide-react';
import { getPosition, type PoseCode } from './positions';

type Props = { pose: PoseCode; showLabels: boolean; opacity: number; showOcciput: boolean; onReady?: (ready: boolean) => void };
type View = 'top'|'front'|'side';
type SceneController = { setView: (v: View) => void; zoom: (factor: number) => void; rotate: (amount: number) => void };
const VIEWS: Record<View,[number,number,number]> = { top: [0,6.2,.015], front: [0,2.1,5.8], side: [5.8,2.1,0] };
const DIRECTIONS = [{ text: '前', sub: '母體腹側', point: new THREE.Vector3(0,.1,1.65) }, { text:'後', sub:'母體背側',point:new THREE.Vector3(0,.1,-1.65) },{text:'左',sub:'母體左側',point:new THREE.Vector3(1.8,.1,0)},{text:'右',sub:'母體右側',point:new THREE.Vector3(-1.8,.1,0)}];

export default function AnatomyViewer(props: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLDivElement|null)[]>([]);
  const propsRef=useRef(props); propsRef.current=props;
  const controller=useRef<SceneController|null>(null);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [view,setView]=useState<View>('front');
  const [retry,setRetry]=useState(0);

  useEffect(()=>{
    const host=mount.current; if(!host)return;
    let disposed=false, frame=0;
    propsRef.current.onReady?.(false);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(35,1,.05,80);
    camera.position.set(...VIEWS.front);
    let renderer:THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'}); }
    catch {setStatus('error');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    renderer.setClearColor('#e9f0f4',1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.domElement.setAttribute('aria-label','骨盆與胎兒的互動 3D 模型；可拖曳觀察，或使用視角與旋轉按鈕。');
    renderer.domElement.setAttribute('role','img');
    host.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,.65,0); controls.enableDamping=true;controls.dampingFactor=.13;
    controls.enablePan=false;controls.minDistance=3.4;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.86;
    controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
    scene.add(new THREE.HemisphereLight(0xffffff,0xa1aeb6,1.5));
    const key=new THREE.DirectionalLight(0xfff7ed,2.5);key.position.set(-3,6,4);scene.add(key);
    const rim=new THREE.DirectionalLight(0xd9f0ff,1.1);rim.position.set(4,2,-3);scene.add(rim);
    const pelvis=new THREE.Group(),fetus=new THREE.Group();scene.add(pelvis,fetus);
    const occiput=new THREE.Mesh(new THREE.SphereGeometry(.055,24,16),new THREE.MeshStandardMaterial({color:'#1594a0',emissive:'#126b70',emissiveIntensity:.25}));
    occiput.position.set(0,.24,.455);fetus.add(occiput);
    const markerRing=new THREE.Mesh(new THREE.TorusGeometry(.09,.01,8,36),new THREE.MeshBasicMaterial({color:'#1594a0'}));markerRing.position.copy(occiput.position);fetus.add(markerRing);
    const loader=new GLTFLoader();
    setStatus('loading');
    Promise.all([loader.loadAsync('/models/pelvis.glb'),loader.loadAsync('/models/fetus.glb')]).then(([p,f])=>{
      if(disposed)return;
      p.scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.material=new THREE.MeshStandardMaterial({color:'#eee1c8',roughness:.78,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:propsRef.current.opacity,depthWrite:true});}});
      pelvis.add(p.scene);fetus.add(f.scene);setStatus('ready');propsRef.current.onReady?.(true);
    }).catch(()=>{if(!disposed)setStatus('error');});
    controller.current={
      setView(v){camera.position.set(...VIEWS[v]);controls.target.set(0,.65,0);controls.update();},
      zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();},
      rotate(amount){const v=camera.position.clone().sub(controls.target);v.applyAxisAngle(new THREE.Vector3(0,1,0),amount);camera.position.copy(v.add(controls.target));controls.update();}
    };
    const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(host);
    const contextLost=(e:Event)=>{e.preventDefault();if(!disposed){setStatus('error');propsRef.current.onReady?.(false);}};renderer.domElement.addEventListener('webglcontextlost',contextLost);
    let last=0;const v=new THREE.Vector3();
    const animate=(time:number)=>{
      frame=requestAnimationFrame(animate);if(document.hidden||time-last<1000/30)return;last=time;
      fetus.rotation.y=getPosition(propsRef.current.pose).angle*Math.PI/180;
      occiput.visible=propsRef.current.showOcciput;markerRing.visible=propsRef.current.showOcciput;
      pelvis.traverse(obj=>{if(obj instanceof THREE.Mesh){const m=obj.material as THREE.MeshStandardMaterial;m.opacity=propsRef.current.opacity;m.depthWrite=propsRef.current.opacity>.95;}});
      controls.update();renderer.render(scene,camera);
      DIRECTIONS.forEach((d,i)=>{const el=labels.current[i];if(!el)return;v.copy(d.point).project(camera);el.style.left=`${(v.x*.5+.5)*100}%`;el.style.top=`${(-v.y*.5+.5)*100}%`;el.style.visibility=v.z>1||!propsRef.current.showLabels?'hidden':'visible';});
    };frame=requestAnimationFrame(animate);
    return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();controller.current=null;renderer.domElement.removeEventListener('webglcontextlost',contextLost);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
  },[retry]);

  function changeView(v:View){setView(v);controller.current?.setView(v);}
  return <div className="anatomy-stage">
    <div className="view-toolbar" aria-label="觀察視角">{(['top','front','side'] as const).map(v=><button key={v} className={view===v?'selected':''} onClick={()=>changeView(v)} aria-pressed={view===v}>{v==='top'?'俯視':v==='front'?'正面':'側面'}</button>)}<button onClick={()=>changeView('front')} aria-label="重設視角"><RotateCcw size={16}/><span>重設</span></button></div>
    <div className="model-mount" ref={mount}/>
    <div className="directions-layer">{DIRECTIONS.map((d,i)=><div key={d.text} className="direction-label" ref={el=>{labels.current[i]=el;}}><strong>{d.text}</strong><span>{d.sub}</span></div>)}</div>
    {status!=='ready'&&<div className="model-status" role={status==='error'?'alert':'status'}>{status==='loading'?<><LoaderCircle className="spin" size={28}/><span>正在準備骨盆與胎兒模型</span></>:<><span>模型暫時無法載入</span><small>請確認網路，或重新開啟 3D 觀察區。</small><button className="primary" onClick={()=>setRetry(x=>x+1)}><RefreshCw size={17}/>重新載入模型</button></>}</div>}
    <div className="camera-buttons" aria-label="視角微調"><button aria-label="向左旋轉視角" onClick={()=>controller.current?.rotate(-Math.PI/8)}>↶</button><button aria-label="向右旋轉視角" onClick={()=>controller.current?.rotate(Math.PI/8)}>↷</button><span/><button aria-label="放大模型" onClick={()=>controller.current?.zoom(.88)}><Plus size={17}/></button><button aria-label="縮小模型" onClick={()=>controller.current?.zoom(1.12)}><Minus size={17}/></button></div>
    <div className="gesture-hint">拖曳轉動視角 · 雙指縮放</div>
  </div>;
}
