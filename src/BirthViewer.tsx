import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Plus,Minus,RotateCcw,LoaderCircle,RefreshCw,RotateCw} from 'lucide-react';
import {sampleBirth} from './birth';
import motion from './birth-poses.json';
type View='oblique'|'front'|'side'|'top';
type Props={time:number;opacity:number;cutaway:boolean;onReady:(ready:boolean)=>void};
const OFFSETS:Record<View,[number,number,number]>={oblique:[5.1,1.8,5.1],front:[0,1.6,7.2],side:[7.2,1.1,0],top:[0,7.8,.015]};
function framing(time:number){const y=sampleBirth(time).position[1],low=Math.min(-.72,y-.35),high=Math.max(1.15,y+2.2*motion.scale);return {center:(low+high)/2,distance:Math.max(4.8,(high-low)/2/Math.tan(21*Math.PI/180)*1.3)};}
function dispose(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});}
export default function BirthViewer(props:Props){
  const hostRef=useRef<HTMLDivElement>(null),live=useRef(props);live.current=props;
  const control=useRef<{view:(v:View)=>void;zoom:(v:number)=>void;rotate:(v:number)=>void}|null>(null);
  const [view,setView]=useState<View>('oblique'),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[retry,setRetry]=useState(0);
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
    let fit=framing(live.current.time);controls.target.set(0,fit.center,0);camera.position.copy(controls.target).add(new THREE.Vector3(...OFFSETS.oblique).normalize().multiplyScalar(fit.distance));controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff,0xa1aeb6,1.5));
    const key=new THREE.DirectionalLight(0xfff7ed,2.5);key.position.set(-3,6,4);scene.add(key);const rim=new THREE.DirectionalLight(0xd9f0ff,1.1);rim.position.set(4,2,-3);scene.add(rim);
    const clip=new THREE.Plane(new THREE.Vector3(-1,0,0),0),bones:THREE.MeshStandardMaterial[]=[];
    let body:THREE.Mesh|undefined,mixer:THREE.AnimationMixer|undefined,action:THREE.AnimationAction|undefined;
    const curve=new THREE.CatmullRomCurve3(Array.from({length:65},(_,i)=>{const z=.48*Math.sin(i/64*Math.PI*2);return new THREE.Vector3(.64*Math.cos(i/64*Math.PI*2),.35-.7*z,z);}),true);
    const inlet=new THREE.Mesh(new THREE.TubeGeometry(curve,80,.009,6,true),new THREE.MeshBasicMaterial({color:'#80aeb6',transparent:true,opacity:.8}));scene.add(inlet);
    const loader=new GLTFLoader();
    Promise.all([loader.loadAsync('/models/pelvis.glb'),loader.loadAsync(`/models/birth-fetus.glb?v=${motion.version}`)]).then(([pelvis,fetus])=>{
      if(dead){dispose(pelvis.scene);dispose(fetus.scene);return;}
      pelvis.scene.traverse(o=>{if(o instanceof THREE.Mesh){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());const mat=new THREE.MeshStandardMaterial({color:'#eee1c8',roughness:.78,transparent:true,side:THREE.DoubleSide});o.material=mat;bones.push(mat);}});
      fetus.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.frustumCulled=false;o.material=(o.material as THREE.Material).clone();if(o.name.startsWith('Birth_body_surface'))body=o;}});
      const clip=fetus.animations.find(c=>c.name.includes('Birth_Sequence'))??fetus.animations[0];if(!clip)throw Error('Missing authored motion');
      scene.add(pelvis.scene,fetus.scene);mixer=new THREE.AnimationMixer(fetus.scene);action=mixer.clipAction(clip);action.play();action.paused=true;
      setStatus('ready');live.current.onReady(true);
    }).catch(()=>{if(!dead){setStatus('error');live.current.onReady(false);}});
    let activeView:View='oblique';
    control.current={view(v){activeView=v;camera.position.copy(controls.target).add(new THREE.Vector3(...OFFSETS[v]).normalize().multiplyScalar(fit.distance));controls.update();},zoom(v){camera.position.sub(controls.target).multiplyScalar(v).add(controls.target);controls.update();},rotate(v){camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),v).add(controls.target);controls.update();}};
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
      bones.forEach(m=>{m.opacity=p.opacity;m.depthWrite=p.opacity>.95;m.clippingPlanes=p.cutaway?[clip]:[];});
      if(body){const mat=body.material as THREE.MeshStandardMaterial;mat.transparent=activeView==='top';mat.opacity=activeView==='top'?.23:1;mat.depthWrite=activeView!=='top';}
      controls.update();renderer.render(scene,camera);
    }
    raf=requestAnimationFrame(render);
    return()=>{dead=true;cancelAnimationFrame(raf);resize.disconnect();controls.dispose();mixer?.stopAllAction();dispose(scene);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.dispose();renderer.domElement.remove();control.current=null;};
  },[retry]);
  function change(v:View){setView(v);control.current?.view(v);}
  return <div className="anatomy-stage birth-stage">
    <div className="view-toolbar" aria-label="分娩觀察視角">{(['oblique','front','side','top'] as const).map(v=><button key={v} className={view===v?'selected':''} aria-pressed={view===v} onClick={()=>change(v)}>{({oblique:'斜側',front:'正面',side:'側面',top:'俯視'})[v]}</button>)}<button aria-label="重設分娩視角" onClick={()=>change('oblique')}><RotateCcw size={16}/><span>重設</span></button></div>
    <div className="model-mount" ref={hostRef}/>
    <div className="birth-legend"><span><i/>枕部</span><span><i/>肩部方向</span><span><i/>入口參考線</span></div>
    <div className="camera-buttons"><button aria-label="分娩視角向左轉" onClick={()=>control.current?.rotate(-Math.PI/8)}><RotateCcw size={16}/></button><button aria-label="分娩視角向右轉" onClick={()=>control.current?.rotate(Math.PI/8)}><RotateCw size={16}/></button><span/><button aria-label="放大分娩模型" onClick={()=>control.current?.zoom(.88)}><Plus size={17}/></button><button aria-label="縮小分娩模型" onClick={()=>control.current?.zoom(1.12)}><Minus size={17}/></button></div>
    <div className="gesture-hint">{view==='top'?'俯視時淡化軀幹，便於比較頭肩方向':'拖曳轉動視角 · 雙指縮放'}</div>
    {status!=='ready'&&<div className="model-status" role={status==='error'?'alert':'status'}>{status==='loading'?<><LoaderCircle className="spin" size={28}/>正在載入分娩動畫</>:<><span>分娩模型暫時無法載入</span><small>保留目前進度，可重新載入。</small><button className="primary" onClick={()=>setRetry(x=>x+1)}><RefreshCw size={16}/>重新載入分娩模型</button></>}</div>}
  </div>;
}
