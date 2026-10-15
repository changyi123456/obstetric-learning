"""Build M1 palpation room, without executing or overwriting the M2 builder.

Blender 4.5.3 LTS. Uses only explicitly CC0 MakeHuman core geometry/weights,
plus the project's editable original room. Web coordinates are metres, Y up,
head toward -Z; maternal left is +X. Run with -- --no-render to skip proof PNGs.
"""
import bpy, bmesh, ast, math, json, hashlib, random, struct, sys
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'assets-source/makehuman-core'
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-source/fhr-room.blend'))
# Reuse only locally authored pure helper function definitions. Never run the
# old module: doing so would save/export M2 files. The source .blend is read-only.
tree=ast.parse((ROOT/'scripts/build_fhr_room.py').read_text())
helper_names={'W','mat','finish','cube','sphere','cylinder','path','mesh','empty','objread','target'}
helpers=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in helper_names],type_ignores=[])
exec(compile(helpers,'<shared local construction helpers>','exec'),globals())
ivory=bpy.data.materials['Warm hospital enamel'];white=bpy.data.materials['Clean warm cotton']
frame=bpy.data.materials['Bed frame satin aluminum'];dark=bpy.data.materials['Caster rubber and accents']
blue=bpy.data.materials['Clinical blue accent'];gownmat=bpy.data.materials['Patterned maternity gown']
skinmat=mat('M1 abdomen natural skin',(.41,.235,.155),.64)
p=next(n for n in skinmat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Subsurface Weight'].default_value=.065;p.inputs['Specular IOR Level'].default_value=.20
exam_skin=mat('Examiner clean bare hands',(.47,.28,.19),.60)
p=next(n for n in exam_skin.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Subsurface Weight'].default_value=.06;p.inputs['Specular IOR Level'].default_value=.18
scrubs=mat('Examiner blue scrub cuff',(.12,.29,.35),.93)
gelmat=mat('Clear gel bottle pale blue',(.40,.65,.69),.37)

def delete(o):
    for ch in list(o.children):delete(ch)
    bpy.data.objects.remove(o,do_unlink=True)
def set_pose(o,p,rx=0):
    o.location=W(p);o.rotation_mode='XYZ';o.rotation_euler=(math.radians(rx),0,0)
def webpoint(o,p):return C.inverted()@(o.matrix_world@p)

# Lower the torso/head as one rigid block: same adult face, no new caricature.
hipweb=Vector((0,.78,.10));G=Matrix.Translation(W(hipweb))@Matrix.Rotation(math.radians(-26),4,'X')@Matrix.Translation(-W(hipweb))
for name in ['Patient_head','Patient_body','Patient_left_hand','Patient_right_hand','Patient_chest']:
    o=bpy.data.objects[name];o.matrix_world=G@o.matrix_world
bpy.context.view_layer.update()
# Retain the continuous neck/chest patch, but replace both original split arms.
# A single CC0 skin surface now runs from covered upper arm through wrist to
# fingertips. Three weighted segment frames retain actual anatomical topology.
o=bpy.data.objects['Patient_body'];source_matrix=o.matrix_world.copy();source_keys=o.data.shape_keys.key_blocks
body_faces=[]
for f in o.data.polygons:
    q=sum((C.inverted()@(source_matrix@source_keys['Basis'].data[i].co) for i in f.vertices),Vector())/len(f.vertices)
    if abs(q.x)<.14 and q.z<-.20:body_faces.append(tuple(f.vertices))
used=sorted(set(i for f in body_faces for i in f));mapping={a:b for b,a in enumerate(used)}
source_color=o.data.color_attributes['Complexion'];source_material=o.data.materials[0];o.name='Patient_body_old_split'
body=mesh('Patient_body',[C.inverted()@(source_matrix@source_keys['Basis'].data[i].co) for i in used],[[mapping[i] for i in f] for f in body_faces],source_material)
color=body.data.color_attributes.new(name='Complexion',type='FLOAT_COLOR',domain='POINT')
for j,i in enumerate(used):color.data[j].color=source_color.data[i].color
for oldkey in source_keys:
    key=body.shape_key_add(name=oldkey.name)
    for j,i in enumerate(used):key.data[j].co=source_matrix@oldkey.data[i].co
delete(o)
for name in ['Patient_left_hand','Patient_right_hand']:delete(bpy.data.objects[name])
patient_raw,_,patient_groups=objread(SRC/'base.obj')
for file in ['asian-female-young.target','universal-female-young-averagemuscle-averageweight.target']:
    for i,d in target(SRC/file).items():patient_raw[i]+=d
patient_weights=json.loads((SRC/'default_weights.mhw').read_text())['weights']
def patient_joint(name):
    ids=set(i for f in patient_groups[name] for i,u in f);return sum((patient_raw[i] for i in ids),Vector())/len(ids)
def longitudinal_frame(direction,front):
    z=direction.normalized();y=(front-z*front.dot(z)).normalized();x=y.cross(z).normalized()
    return Matrix((x,y,z)).transposed()
patient_arm_api={}
patient_arm_skin=mat('Patient continuous arm natural skin',(.41,.235,.155),.64)
p=next(n for n in patient_arm_skin.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Subsurface Weight'].default_value=.065;p.inputs['Specular IOR Level'].default_value=.20
for side,short,sign,name in [('L','l',1,'Patient_left_hand'),('R','r',-1,'Patient_right_hand')]:
    source_s=patient_joint('joint-'+short+'-shoulder');source_e=patient_joint('joint-'+short+'-elbow');source_w=patient_joint('joint-'+short+'-hand');source_f=patient_joint('joint-'+short+'-finger-3-4')
    shoulder=Vector((sign*.165,.892,-.355))
    elbow=shoulder+Vector((sign*.115,-.024,.210)).normalized()*(source_e-source_s).length*.111
    wrist=elbow+Vector((sign*.018,.004,.224)).normalized()*(source_w-source_e).length*.111
    transforms=[]
    for A,B,targetA,targetB in [(source_s,source_e,shoulder,elbow),(source_e,source_w,elbow,wrist),(source_w,source_f,wrist,wrist+Vector((-sign*.025,-.010,.17)))]:
        R=longitudinal_frame(targetB-targetA,Vector((0,1,0)))@longitudinal_frame(B-A,Vector((0,0,1))).transposed()
        transforms.append((R,A,targetA))
    segment_weights=[[0.0]*len(patient_raw) for k in range(3)]
    for bone,values in patient_weights.items():
        if not bone.endswith('.'+side):continue
        prefix=bone.split('.')[0];k=0 if prefix.startswith('upperarm') else 1 if prefix.startswith('lowerarm') else 2 if prefix.startswith(('wrist','finger','metacarpal')) else -1
        if k>=0:
            for i,w in values:segment_weights[k][i]+=w
    totals=[sum(k[i] for k in segment_weights) for i in range(len(patient_raw))]
    fs=[f for f in patient_groups['body'] if sum(totals[i] for i,u in f)/len(f)>.55]
    used=sorted(set(i for f in fs for i,u in f));mp={a:b for b,a in enumerate(used)};vertices=[]
    for i in used:
        q=sum(((R@(patient_raw[i]-A)*.111+targetA)*segment_weights[k][i] for k,(R,A,targetA) in enumerate(transforms)),Vector())/max(totals[i],1e-6)
        vertices.append(q)
    arm=mesh(name,vertices,[[mp[i] for i,u in f] for f in fs],patient_arm_skin)
    # Wrist origin still permits subtle bedside hand gestures; source blend keeps
    # the full arm editable as a continuous mesh with no extra stump primitives.
    origin=W(wrist);arm.location=origin
    for vertex in arm.data.vertices:vertex.co-=origin
    arm.shape_key_add(name='Basis')
    for key in ['Blink','Talk','Contraction','Breath']:arm.shape_key_add(name=key)
    # A sewn short sleeve hides the proximal topology seam beneath the blouse.
    axis=(elbow-shoulder).normalized();front=(Vector((0,1,0))-axis*axis.y).normalized();across=front.cross(axis).normalized()
    sleeve_vertices=[];sleeve_faces=[];NN=28
    for length,radius in [(-.060,.085),(.018,.082),(.105,.055),(.120,.050)]:
        center=shoulder+axis*length
        for j in range(NN):
            a=j/NN*2*math.pi;sleeve_vertices.append(center+across*(radius*math.cos(a))+front*(radius*.92*math.sin(a)))
    for ring in range(3):
        for j in range(NN):a=ring*NN+j;b=ring*NN+(j+1)%NN;sleeve_faces.append((a,b,b+NN,a+NN))
    sleeve_faces.append(tuple(range(NN-1,-1,-1)))
    sleeve=mesh('Patient_short_sleeve_'+side,sleeve_vertices,sleeve_faces,gownmat)
    mod=sleeve.modifiers.new('Sewn cotton thickness','SOLIDIFY');mod.thickness=.002
    patient_arm_api[name]={'wristWeb':list(wrist),'shoulderWeb':list(shoulder),'elbowWeb':list(elbow),'scope':'One continuous upper-arm/forearm/palm/finger mesh; preserve baseline transform; only small gesture offsets.'}
set_pose(bpy.data.objects['Mattress_backrest'],(0,.83,-.42),12)
set_pose(bpy.data.objects['Bed_backrest_support'],(0,.755,-.43),12)
set_pose(bpy.data.objects['Pillow'],(0,.965,-.66),12)

# Keep the actual patterned gown around the chest/upper arms, remove its old
# maternity-belly portion. An opaque chest cover always remains in the model.
delete(bpy.data.objects['Patient_chest'])
remove_names=[o.name for o in bpy.context.scene.objects if o.name.startswith(('Patient_lower_blanket','Blanket_turned_hem','Elastic_monitor_belt','FHR_transducer','TOCO_transducer'))]
for name in remove_names:
    if name in bpy.data.objects:delete(bpy.data.objects[name])

# Smooth skin surface and matching analytic hit-test API. Geometry uses the same
# formula as the recorded API; it is a stylized fictional pregnant abdomen.
RX=.245;RZ=.345;CY=.835;RY=.300;CZ=-.020
def abdomen_y(x,z):
    u=x/RX;v=(z-CZ)/RZ;q=max(0,1-u*u-v*v)
    return CY+RY*math.sqrt(q)-.009*math.exp(-(x/.022)**2-((z-.025)/.025)**2)
def abdomen_normal(x,z):
    eps=.0001;dx=(abdomen_y(x+eps,z)-abdomen_y(x-eps,z))/(2*eps);dz=(abdomen_y(x,z+eps)-abdomen_y(x,z-eps))/(2*eps)
    return Vector((-dx,1,-dz)).normalized()
def UV(u,v):
    x=u*RX;z=CZ+v*RZ;return Vector((x,abdomen_y(x,z),z))
# A purpose-made opaque blouse covers the chest and upper arms. Its central
# rolled hem stops above the palpation surface; lateral wings are short sleeves.
cv=[];cf=[];cuv=[];NX=42;NZ=24
def chest_end(x):
    a=min(1,max(0,(abs(x)-.20)/.07));a=a*a*(3-2*a)
    return -.285+.36*a
def chest_lower_y(x):
    z=chest_end(x);q=1-(x/RX)**2-((z-CZ)/RZ)**2
    return abdomen_y(x,z)+.009 if q>0 else .865
for j in range(NZ+1):
    t=j/NZ
    for i in range(NX+1):
        x=-.285+i/NX*.57;ztop=-.52+.09*math.exp(-(x/.075)**2);z=ztop*(1-t)+chest_end(x)*t
        y=(.925-.065*(abs(x)/.285)**1.8)*(1-t)+chest_lower_y(x)*t+.004*math.sin(34*x+19*z)
        cv.append((x,y,z));cuv.append((i/NX*.45,j/NZ*.45))
for j in range(NZ):
    for i in range(NX):a=j*(NX+1)+i;cf.append((a,a+NX+1,a+NX+2,a+1))
chest=mesh('Chest_cover',cv,cf,gownmat,cuv,cf)
mod=chest.modifiers.new('Opaque blouse cotton','SOLIDIFY');mod.thickness=.003
av=[(0,abdomen_y(0,CZ),CZ)];af=[];N=72;RINGS=26
for j in range(1,RINGS+1):
    r=j/RINGS
    for i in range(N):
        a=i/N*2*math.pi;x=RX*r*math.cos(a);z=CZ+RZ*r*math.sin(a);av.append((x,abdomen_y(x,z),z))
for i in range(N):af.append((0,1+i,1+(i+1)%N))
for j in range(RINGS-1):
    for i in range(N):a=1+j*N+i;b=1+j*N+(i+1)%N;af.append((a,a+N,b+N,b))
abd=mesh('Palpation_abdomen',av,[tuple(reversed(f)) for f in af],skinmat)
# Per-point coloration is authored here, no patient photograph or image asset.
attr=abd.data.color_attributes.new(name='AbdomenComplexion',type='FLOAT_COLOR',domain='POINT')
for i,(x,y,z) in enumerate(av):
    d=.09*math.exp(-(x/.022)**2-((z-.025)/.025)**2)
    attr.data[i].color=(.41-d,.235-d*.65,.155-d*.35,1)
vnode=skinmat.node_tree.nodes.new('ShaderNodeVertexColor');vnode.layer_name='AbdomenComplexion'
skinmat.node_tree.links.new(vnode.outputs['Color'],next(n for n in skinmat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])
abd.shape_key_add(name='Basis');breath=abd.shape_key_add(name='Breath')
for i,(x,y,z) in enumerate(av):breath.data[i].co=W((x,y+.004*max(0,1-(x/RX)**2-((z-CZ)/RZ)**2),z))
abd['surfaceAPI']='x=.245u, z=-.02+.345v; see provenance JSON for matching height function'
chest.shape_key_add(name='Basis');bk=chest.shape_key_add(name='Breath')
for ve,key in zip(chest.data.vertices,bk.data):key.co=ve.co+W((0,.004,0))
path('Chest_cover_soft_rolled_edge',[(x,chest_lower_y(x)+.002,chest_end(x)) for x in [-.285,-.245,-.20,-.13,0,.13,.20,.245,.285]],.005,gownmat)

# Knee flexion is visible through the opaque lower drape. Chest and pelvis stay
# covered even after Privacy_cover is hidden by the preparation interaction.
verts=[];faces=[];NU=38;NV=42
for j in range(NV+1):
    z=.255+j/NV*.93
    for i in range(NU+1):
        x=-.48+i/NU*.96;edge=max(0,(abs(x)-.35)/.13)
        legs=.045*(math.exp(-((x-.15)/.12)**2)+math.exp(-((x+.15)/.12)**2))
        y=.89+legs+.008*math.sin(30*x+19*z)-.18*edge**1.7
        verts.append((x,y,z))
for j in range(NV):
    for i in range(NU):a=j*(NU+1)+i;faces.append((a,a+1,a+NU+2,a+NU+1))
pelvis=mesh('Pelvis_cover',verts,[tuple(reversed(f)) for f in faces],white)
pelvis.shape_key_add(name='Basis');knees=pelvis.shape_key_add(name='Knees_flex')
for i,(x,y,z) in enumerate(verts):
    bend=.22*(math.exp(-((x-.16)/.13)**2)+math.exp(-((x+.16)/.13)**2))*math.exp(-((z-.63)/.23)**2)
    knees.data[i].co=W((x,y+bend,z))
knees.value=1
mod=pelvis.modifiers.new('Opaque drape hem','SOLIDIFY');mod.thickness=.004
# Rectangular privacy sheet follows the belly and drapes down at both flanks.
pv=[];pf=[];NU=36;NV=40
for j in range(NV+1):
    z=-.37+j/NV*.73
    for i in range(NU+1):
        x=-.31+i/NU*.62;q=1-(x/RX)**2-((z-CZ)/RZ)**2
        y=abdomen_y(x,z)+.010 if q>0 else .85-.17*max(0,(abs(x)-RX)/.065)
        y+=.004*math.sin(39*x+13*z)
        pv.append((x,y,z))
for j in range(NV):
    for i in range(NU):a=j*(NU+1)+i;pf.append((a,a+1,a+NU+2,a+NU+1))
privacy=mesh('Privacy_cover',pv,[tuple(reversed(f)) for f in pf],white);mod=privacy.modifiers.new('Opaque privacy sheet','SOLIDIFY');mod.thickness=.003
privacy['defaultVisible']=True

# Two independent full belt loops, flattened below the back to avoid the bed.
belts=[]
for name,z in [('Belt_FHR',CZ+.28*RZ),('Belt_TOCO',CZ-.64*RZ)]:
    bv=[];bf=[];NN=72
    for i in range(NN):
        a=i/NN*2*math.pi
        for zz in [z-.018,z+.018]:
            vv=(zz-CZ)/RZ;r=math.sqrt(max(.02,1-vv*vv));x=RX*r*math.sin(a)
            yy=CY+RY*r*math.cos(a)
            if math.cos(a)>=0:
                point=Vector((x,yy,zz))+abdomen_normal(x,zz)*.008
            else:point=Vector((x,max(.792,yy)+.004,zz))
            bv.append(point)
    for i in range(NN):a=i*2;b=((i+1)%NN)*2;bf.append((a,b,b+1,a+1))
    belt_color=(.14,.23,.26) if name=='Belt_FHR' else (.25,.29,.28)
    o=mesh(name,bv,bf,mat(name+' woven elastic',belt_color,.93));belts.append(o);o['defaultVisible']=False
    mod=o.modifiers.new('Thin woven belt','SOLIDIFY');mod.thickness=.0015

probe_api={}
for name,u,v,ma in [('FHR_transducer',.56,.28,blue),('TOCO_transducer',0,-.64,ivory)]:
    surface=UV(u,v);normal=abdomen_normal(surface.x,surface.z);center=surface+Vector((0,.019,0))
    o=cylinder(name,center,.043,.030,ma);o['defaultVisible']=False
    cap=cylinder(name+'_face',center+Vector((0,.019,0)),.035,.010,ivory)
    bpy.context.view_layer.update();cap.parent=o;cap.matrix_parent_inverse=o.matrix_world.inverted()
    probe_api[name]={'uv':[u,v],'surface':list(surface),'nodePosition':list(center),'normal':list(normal),'axis':'+Y','root':'body center; lowest point local Y=-.015m; runtime position surface+(0,.019,0)'}

# Original non-branded bedside preparation props. Each whole prop is a parented
# node so runtime may pick, hide, or move it without severing caps or labels.
gel=empty('Gel_bottle',(1.10,1.12,-.31))
for o in [cylinder('Gel_bottle_body',(1.10,1.16,-.31),.030,.13,gelmat),cylinder('Gel_bottle_neck',(1.10,1.24,-.31),.012,.035,ivory),cube('Gel_bottle_label',(1.10,1.17,-.276),(.040,.055,.003),white,.003)]:
    bpy.context.view_layer.update();o.parent=gel;o.matrix_parent_inverse=gel.matrix_world.inverted()
paper=cube('Monitor_recording_paper',(.97,1.088,-.28),(.19,.004,.14),white,.002)
tissue=mesh('Clean_tissue',[(.93,1.11,-.38),(1.02,1.12,-.37),(1.035,1.116,-.28),(.945,1.109,-.29)],[(0,1,2,3)],white)
tissue['defaultVisible']=True

# Anatomical examiner hands. Read the official core fingers/palm/forearm, derive
# a wrist-based local frame, then cup the actual mesh rather than substituting
# ellipsoids or mitten primitives. Local +Z=fingers, +Y=dorsum, palm faces -Y.
raw,raw_uv,raw_groups=objread(SRC/'base.obj')
for file in ['asian-female-young.target','universal-female-young-averagemuscle-averageweight.target']:
    for i,d in target(SRC/file).items():raw[i]+=d
def jnt(name):
    ids=set(i for face in raw_groups[name] for i,u in face);return sum((raw[i] for i in ids),Vector())/len(ids)
weights=json.loads((SRC/'default_weights.mhw').read_text())['weights']
hand_data={}
for side,short,sign in [('L','l',1),('R','r',-1)]:
    wrist=jnt('joint-'+short+'-hand');mid=jnt('joint-'+short+'-finger-3-4')
    zz=(mid-wrist).normalized();across=jnt('joint-'+short+'-finger-2-1')-jnt('joint-'+short+'-finger-5-1')
    xx=(across-zz*across.dot(zz)).normalized()*sign;yy=zz.cross(xx).normalized();B=Matrix((xx,yy,zz)).transposed()
    local=[B.transposed()@(p-wrist)*.111 for p in raw]
    limb=[0.0]*len(raw);thumb=[0.0]*len(raw)
    for bn,vals in weights.items():
        if bn.endswith('.'+side) and bn.split('.')[0].startswith(('lowerarm','wrist','finger','metacarpal')):
            for i,w in vals:limb[i]+=w
        if bn.endswith('.'+side) and bn.split('.')[0].startswith(('finger1','metacarpal1')):
            for i,w in vals:thumb[i]+=w
    fs=[]
    for f in raw_groups['body']:
        ids=[i for i,u in f]
        if sum(limb[i] for i in ids)/len(ids)>.65 and min(local[i].z for i in ids)>-.080:fs.append(f)
    hand_data[side]=(local,fs,thumb,limb)

pose_defs={
 's1':{'L':{'uv0':[-.66,.56],'uv1':[-.66,-.59],'finger':[.38,0,-.92],'curl':7},'R':{'uv0':[.66,.56],'uv1':[.66,-.59],'finger':[-.38,0,-.92],'curl':7}},
 's2':{'L':{'uv0':[-.73,-.54],'uv1':[-.73,.52],'finger':[.12,0,-1],'curl':2.6},'R':{'uv0':[.73,-.54],'uv1':[.73,.52],'finger':[-.12,0,-1],'curl':2.6}},
 's3':{'L':{'uv0':[-.12,-.68],'uv1':[-.12,-.68],'finger':[.10,0,-1],'curl':6},'R':{'uv0':[-.22,.67],'uv1':[.22,.67],'finger':[-.8,0,-.4],'curl':11,'C_grip':True}},
 's4':{'L':{'uv0':[.53,.15],'uv1':[.53,.72],'finger':[-.22,0,1],'curl':4},'R':{'uv0':[-.53,.15],'uv1':[-.53,.72],'finger':[.22,0,1],'curl':4}}
}
hand_api={};hand_roots=[]
for stage,sides in pose_defs.items():
    for side,pdef in sides.items():
        local,fs,thumb,limb=hand_data[side];used=sorted(set(i for f in fs for i,u in f));mp={a:b for b,a in enumerate(used)};vv=[]
        for i in used:
            p=local[i].copy();z0=.052;k=pdef['curl']
            if p.z>z0:
                t=p.z-z0;a=t*k;p.y-=(1-math.cos(a))/k;p.z=z0+math.sin(a)/k
            if pdef.get('C_grip'):
                tw=min(1,thumb[i]);p.y-=.028*tw;p.x*=1-.18*tw;p.z+=.012*tw
            vv.append(p)
        # The lowest skin vertex is the contact support point. Everything stays
        # above its tangent plane on a convex abdomen, preventing clipping.
        ci=min(range(len(vv)),key=lambda j:vv[j].y if vv[j].z>.025 else 10)
        contact=vv[ci].copy();name='Examiner_'+stage+'_'+side
        root=empty(name,(0,0,0));root['defaultVisible']=False;root['handedness']=side;root['stage']=stage
        skin=mesh(name+'_skin',vv,[[mp[i] for i,u in f] for f in fs],exam_skin)
        skin.parent=root
        # Scrub sleeve overlaps the cut forearm and ends in a sewn cuff.
        sv=[];sf=[];NN=24
        for j,z in enumerate([-.110,-.100,-.047,-.035]):
            points=[local[i] for i in range(len(local)) if limb[i]>.65 and abs(local[i].z-z)<.020]
            center=sum(points,Vector())/len(points)
            rx=max(abs(p.x-center.x) for p in points)+.005;ry=max(abs(p.y-center.y) for p in points)+.005
            for i in range(NN):a=i/NN*2*math.pi;sv.append((center.x+rx*math.cos(a),center.y+ry*math.sin(a),z))
        for j in range(3):
            for i in range(NN):a=j*NN+i;b=j*NN+(i+1)%NN;sf.append((a,a+NN,b+NN,b))
        sf.append(tuple(range(NN-1,-1,-1)))
        sleeve=mesh(name+'_sleeve',sv,sf,scrubs);sleeve.parent=root
        # Parent-local coordinates are Blender coordinates; root frame converts
        # our Web-local +Y dorsum / +Z fingers to the chosen surface tangent.
        u,v=pdef['uv1'];s=UV(u,v);normal=abdomen_normal(s.x,s.z)
        direction=Vector(pdef['finger']);direction=(direction-normal*direction.dot(normal)).normalized()
        xx=normal.cross(direction).normalized();R=Matrix((xx,normal,direction)).transposed()
        pos=s-R@contact
        root.matrix_world=Matrix.Translation(W(pos))@(C@R@C.inverted()).to_4x4()
        root['contactLocal']=list(contact);root['surfaceContact']=list(s);root['wristOffset']=list(pos-s);root['fingerHint']=pdef['finger'];root['defaultUV']=pdef['uv1'];root['pathUV0']=pdef['uv0'];root['pathUV1']=pdef['uv1']
        hand_api[name]={'handedness':side,'root':'wrist','contactLocal':list(contact),'defaultUV':pdef['uv1'],'surfaceContact':list(s),'nodePosition':list(pos),'quaternion_xyzw':list(R.to_quaternion())[1:]+[list(R.to_quaternion())[0]],'wristOffset':list(pos-s),'pathUV0':pdef['uv0'],'pathUV1':pdef['uv1'],'fingerHint':pdef['finger'],'fingerDirectionWeb':list(direction),'normalWeb':list(normal),'curl_radians_per_metre':pdef['curl'],'cGrip':pdef.get('C_grip',False),'hoverOffset':.025}
        hand_roots.append(root)

# Reference anchors use the exact normalized abdomen mapping.
anchors={'Anchor_fundus':(0,-.64),'Anchor_suprapubic':(0,.72),'Anchor_maternal_left':(.75,0),'Anchor_maternal_right':(-.75,0),'Anchor_abdomen':(0,0)}
for name,(u,v) in anchors.items():
    if name in bpy.data.objects:delete(bpy.data.objects[name])
    o=empty(name,UV(u,v));o['uv']=[u,v]
# Reposition generic patient/pulse anchors to the new supine layout.
bpy.data.objects['Anchor_patient'].location=W((0,1.14,-.58))
bpy.data.objects['Anchor_pulse'].location=W((.294,.93,.03))

# Reduce hidden hair draw/triangle cost. Source curves remain individually editable.
for o in bpy.context.scene.objects:
    if o.type=='CURVE' and o.name.startswith('Patient_hair_strand'):o.data.resolution_u=5;o.data.bevel_resolution=2
    if o.name=='Patient_hair_cap':
        for m in o.modifiers:
            if m.type=='SUBSURF':m.levels=1;m.render_levels=1

scene=bpy.context.scene;scene.cycles.samples=28
cam=scene.camera;cam.location=W((1.65,2.00,1.62));cam.rotation_euler=(W((0,1.00,-.07))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=52
scene.render.resolution_x=1400;scene.render.resolution_y=1000
scene.render.filepath='/private/tmp/palpation-room-review.png'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/palpation-room.blend'))

# Batch only static furniture, preserving all interaction and pose roots. Export
# every examiner hand, regardless of its intended runtime default visibility.
keep={'Patient_head','Patient_body','Patient_left_hand','Patient_right_hand','Patient_eyes','Chest_cover','Pelvis_cover','Privacy_cover','Palpation_abdomen','Belt_FHR','Belt_TOCO','FHR_transducer','FHR_transducer_face','TOCO_transducer','TOCO_transducer_face','Monitor_screen','Curtain_dynamic','Monitor_recording_paper','Clean_tissue'}
static=[o for o in scene.objects if o.type in {'MESH','CURVE'} and o.name not in keep and not o.name.startswith('Examiner_') and not (o.parent and o.parent.name=='Gel_bottle')]
for o in static:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
    for mod in list(o.modifiers):
        try:bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError:pass
batches={}
for o in static:
    if o.type=='MESH':batches.setdefault((o.data.materials[0].name if o.data.materials else 'none',o.parent.name if o.parent else ''),[]).append(o)
for (material,parent),objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    objects[0].name=('Patient_attachment_' if parent else 'Palpation_static_')+material.replace(' ','_')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/palpation-room.glb'),export_format='GLB',export_animations=False,export_morph=True,export_morph_normal=False,export_morph_tangent=False,export_apply=True,export_lights=False,export_cameras=False,export_extras=True)

def show_tree(root,value):
    root.hide_render=not value
    for o in root.children_recursive:o.hide_render=not value
def render_stage(stage,filename):
    for root in hand_roots:show_tree(root,root['stage']==stage)
    privacy.hide_render=True
    for o in belts:show_tree(o,False)
    for name in probe_api:show_tree(bpy.data.objects[name],False)
    scene.render.filepath=filename;bpy.ops.render.render(write_still=True)
if '--no-render' not in sys.argv:
    render_stage('s1','/private/tmp/palpation-room-review.png')
    cam.location=W((.85,1.95,.82));cam.rotation_euler=(W((0,1.03,-.03))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=58
    scene.render.resolution_x=1100;scene.render.resolution_y=900
    for stage in ['s1','s2','s3','s4']:render_stage(stage,'/private/tmp/palpation-hands-'+stage+'.png')
    for root in hand_roots:show_tree(root,False)
    for o in belts:show_tree(o,True)
    for name,api in probe_api.items():
        o=bpy.data.objects[name];show_tree(o,True);normal=Vector(api['normal']);surface=Vector(api['surface'])
        o.location=W(surface+normal*.019);o.rotation_mode='QUATERNION';o.rotation_quaternion=W((0,1,0)).rotation_difference(W(normal))
    abd.data.shape_keys.key_blocks['Breath'].value=1
    cam.location=W((.16,2.05,.06));cam.rotation_euler=(W((0,1,-.02))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=45
    scene.render.filepath='/private/tmp/palpation-monitor-review.png';bpy.ops.render.render(write_still=True)

blob=(ROOT/'public/models/palpation-room.glb').read_bytes();n=struct.unpack_from('<I',blob,12)[0];gltf=json.loads(blob[20:20+n]);names={o['name'] for o in gltf['nodes']}
required=['Palpation_abdomen','Privacy_cover','Chest_cover','Pelvis_cover','Belt_FHR','Belt_TOCO','FHR_transducer','TOCO_transducer','Gel_bottle','Clean_tissue','Monitor_recording_paper']+list(hand_api)+list(anchors)
assert all(name in names for name in required)
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
provenance={
 'asset':'palpation-room','version':'1.0','prepared_date':'2026-10-15','tool':'Blender '+bpy.app.version_string,
 'purpose':'Synthetic four-step Leopold palpation teaching room. Patient and examiner are fictional adults. No patient photographs or records.',
 'source':{'shared_editable_room':'assets-source/fhr-room.blend','shared_room_sha256':hashlib.sha256((ROOT/'assets-source/fhr-room.blend').read_bytes()).hexdigest(),'shared_helpers':'scripts/build_fhr_room.py, pure construction functions only via AST; no top-level code executed','core_repository':'https://github.com/makehumancommunity/makehuman','core_commit':'a8bc2d54ff0ac92e78ff71431b1023eda42bf482','core_license':'CC0-1.0','license_file':'licenses/MakeHuman-core-CC0.md','official_asset_statement':'https://static.makehumancommunity.org/about/license.html','source_license_distinction':'Only explicitly CC0 basemesh, adult female targets, face units, eyes and skin weights are reused. MakeHuman AGPL executable/source code is not included or executed.','no_complete_hand_pose_asset_found':'The project resource review found no suitable complete authorized four-maneuver set; these poses are newly authored from the CC0 palm/finger/forearm topology.'},
 'authored_changes':['Supine adult torso and pillow, lower backrest; opaque chest/pelvis coverings and separate privacy abdomen cover','Continuous analytic pregnant skin mesh with subtle navel and matched raycast/height formula','Paired knee contours under an opaque drape with Knees_flex morph','Eight distinct left/right examiner hand poses using genuine palm/finger/forearm topology and short scrub cuffs','Two independently controlled full belt loops and two repositionable transducers','Unbranded gel bottle, tissue and recording paper'],
 'axes':{'units':'metres','up':'+Y','head':'-Z','feet':'+Z','maternal_left':'+X','maternal_right':'-X','examiner_hand_labels':'L/R always refer to the examiner\u2019s actual physical hand, never the maternal side. s1/s2 examiner faces head, s4 examiner faces feet.'},
 'abdomen':{'node':'Palpation_abdomen','xRadius':RX,'zRadius':RZ,'centerZ':CZ,'baseY':CY,'height':RY,'mapping':'x=.245*u; z=-.020+.345*v','domain':'u*u+v*v <= 1; interactive path should stay below 0.94 squared radius','heightFunction':'y=.835+.300*sqrt(max(0,1-(x/.245)^2-((z+.020)/.345)^2))-.009*exp(-(x/.022)^2-((z-.025)/.025)^2)','normal':'normalize([-dy/dx,1,-dy/dz]); central differences epsilon=.0001 m match the builder','hoverOffset':.025,'collision':'Use the exported mesh raycast or identical analytic surface. Contact-root placement = surfaceTarget - rotation*contactLocal + normal*hoverOffset; hoverOffset zero means tangent contact. The whole hand stays above its contact tangent plane.'},
 'anchors':{name:{'uv':list(uv),'web':list(UV(*uv))} for name,uv in anchors.items()},
 'hands':hand_api,
 'defaultVisibility':{**{n:False for n in hand_api},'Privacy_cover':True,'Chest_cover':True,'Pelvis_cover':True,'Palpation_abdomen':True,'Belt_FHR':False,'Belt_TOCO':False,'FHR_transducer':False,'TOCO_transducer':False,'Gel_bottle':True,'Clean_tissue':True,'Monitor_recording_paper':True},
 'visibilityNote':'All nodes are exported. Three.js must apply defaultVisibility before first rendering. GLB extras.defaultVisible is an app hint, not native visibility enforcement.',
 'patientArms':patient_arm_api,
 'patientMotion':{'nodes':['Patient_head','Patient_body','Patient_left_hand','Patient_right_hand','Chest_cover','Palpation_abdomen'],'keys':'Existing face Blink/Talk/Contraction/Breath retained; new chest/abdomen Breath; Pelvis_cover Knees_flex 0=flat, 1=paired bent-knee drape. Preserve each node\u2019s imported baseline quaternion, including supine -26 degree change.','kneeScope':'Knee flexion is represented by anatomically placed contours under an opaque drape, not exposed leg-joint kinematics.'},
 'probes':probe_api,'beltNodes':['Belt_FHR','Belt_TOCO'],'beltClearance':'Top belt surface offset .008m along analytic normal, above maximum .004m belly Breath deformation. Underside flattened under back.','monitor':'Monitor_screen is a complete single quad; CanvasTexture.flipY=false, same full UV as M2.',
 'camera':{'position':[1.65,2.0,1.62],'target':[0,1,-.07],'closePosition':[.85,1.95,.82],'closeTarget':[0,1.03,-.03],'monitorPosition':[.22,1.95,.12],'monitorTarget':[0,1,-.02]},
 'outputs':{'glb':'public/models/palpation-room.glb','glb_bytes':len(blob),'glb_sha256':hashlib.sha256(blob).hexdigest(),'blend':'assets-source/palpation-room.blend','blend_sha256':hashlib.sha256((ROOT/'assets-source/palpation-room.blend').read_bytes()).hexdigest(),'builder':'scripts/build_palpation_room.py','script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'nodes':len(gltf['nodes']),'triangles':triangles},
 'review':{'full':'/private/tmp/palpation-room-review.png','poses':['/private/tmp/palpation-hands-'+s+'.png' for s in pose_defs],'monitor_with_both_belts':'/private/tmp/palpation-monitor-review.png','node_check':'passed','medical_scope':'Schematic educational geometry and hand animations, pending user content review; no patient-specific diagnosis or force simulation.'}
}
(ROOT/'docs/palpation-room-provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
print('PALPATION_ASSET_COMPLETE',len(blob),'bytes',triangles,'triangles',len(gltf['nodes']),'nodes')
