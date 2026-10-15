"""Rebuild the editable bedside FHR scene using Blender 4.5 only.

No add-ons or third-party executable code. MakeHuman CC0 core data is read as
geometry, deltas and skin weights. All room/furniture/clothing/hair is authored
here. Coordinates exposed in the GLB are metres, +Y up, bed head toward -Z.
"""
import bpy, math, json, hashlib, random, struct, sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets-source/makehuman-core'
random.seed(19)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for x in bpy.data.materials: bpy.data.materials.remove(x)
C = Matrix(((1,0,0),(0,0,-1),(0,1,0)))
def W(p): return C @ Vector(p)
def mat(name, color, rough=.55, metallic=0, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metallic
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
ivory=mat('Warm hospital enamel',(.62,.68,.67),.34)
white=mat('Clean warm cotton',(.73,.76,.73),.88)
frame=mat('Bed frame satin aluminum',(.42,.52,.55),.31,.62)
dark=mat('Caster rubber and accents',(.045,.07,.082),.63)
teal=mat('Curtain woven sage',(.21,.49,.47),.96)
skin=mat('Natural adult skin',(.58,.34,.245),.59)
ps=next(n for n in skin.node_tree.nodes if n.type=='BSDF_PRINCIPLED');ps.inputs['Subsurface Weight'].default_value=.075
ps.inputs['Subsurface Radius'].default_value=(1,.45,.25)
ps.inputs['Specular IOR Level'].default_value=.22
vc=skin.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Complexion'
skin.node_tree.links.new(vc.outputs['Color'],ps.inputs['Base Color'])
hair=mat('Dark brown hair',(.009,.006,.004),.62)
hairlight=mat('Hair strand warm highlights',(.022,.013,.008),.66)
for m in [hair,hairlight]:next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Specular IOR Level'].default_value=.18
gownmat=mat('Patterned maternity gown',(.58,.69,.75),.95)
wall=mat('Linen warm wall',(.60,.62,.56),.95)
wood=mat('Ash wood laminate',(.47,.32,.19),.61)
floor=mat('Matte warm grey floor',(.46,.5,.48),.82)
screen=mat('Monitor dark glass',(.008,.035,.047),.28)
cyan=mat('Monitor cyan phosphor',(.05,.78,.71),.33,0,.65)
gold=mat('Muted amber detail',(.8,.57,.23),.5)
blue=mat('Clinical blue accent',(.10,.36,.48),.65)

def texture_gown():
    im=bpy.data.images.new('Original woven gown dots',width=256,height=256)
    arr=[]
    for y in range(256):
        for x in range(256):
            noise=random.uniform(-.014,.014)
            a=(x%24)-12;b=(y%24)-12
            dot=(a*a+b*b)<4
            base=(.17,.30,.40) if dot else (.48,.61,.67)
            arr.extend([max(0,min(1,c+noise)) for c in base]+[1])
    im.pixels=arr;im.pack()
    n=gownmat.node_tree.nodes.new('ShaderNodeTexImage');n.image=im
    uv=gownmat.node_tree.nodes.new('ShaderNodeTexCoord')
    mapping=gownmat.node_tree.nodes.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=(5,5,5)
    gownmat.node_tree.links.new(uv.outputs['UV'],mapping.inputs['Vector']);gownmat.node_tree.links.new(mapping.outputs['Vector'],n.inputs['Vector'])
    gownmat.node_tree.links.new(n.outputs['Color'],next(n for n in gownmat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])
texture_gown()

def finish(o,name,m,smooth=True):
    o.name=name
    if m:o.data.materials.append(m)
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=smooth
    return o
def cube(name,p,size,m,bevel=.025,rx=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=W(p));o=bpy.context.object
    o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.rotation_euler.x=math.radians(rx)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edge','BEVEL');mod.width=bevel;mod.segments=3
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return finish(o,name,m)
def sphere(name,p,radii,m,segments=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=W(p))
    o=bpy.context.object;o.scale=(radii[0],radii[2],radii[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m)
def cylinder(name,p,r,depth,m,axis=(0,1,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=W(p))
    o=bpy.context.object;o.rotation_quaternion=Vector((0,0,1)).rotation_difference(W(axis));o.rotation_mode='QUATERNION'
    mod=o.modifiers.new('Rounded machined rim','BEVEL');mod.width=.006;mod.segments=2
    return finish(o,name,m)
def path(name,points,r,m):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=10;c.bevel_depth=r;c.bevel_resolution=3
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for b,p in zip(s.bezier_points,points):b.co=W(p);b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(m);return o
def mesh(name,verts,faces,m,uvs=None,faceuv=None):
    me=bpy.data.meshes.new(name);me.from_pydata([W(v) for v in verts],[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,name,m)
    if uvs and faceuv:
        layer=me.uv_layers.new(name='UVMap')
        for p,fu in zip(me.polygons,faceuv):
            for li,ui in zip(p.loop_indices,fu):layer.data[li].uv=uvs[ui]
    return o
def empty(name,p):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=W(p);o.empty_display_size=.06;return o

# MakeHuman data: preserve original index correspondence for official deltas.
def objread(file):
    vs=[];uv=[];groups={};g='body'
    for l in Path(file).read_text().splitlines():
        a=l.split()
        if not a:continue
        if a[0]=='v':vs.append(Vector(tuple(map(float,a[1:4]))))
        elif a[0]=='vt':uv.append(tuple(map(float,a[1:3])))
        elif a[0]=='g':g=a[1]
        elif a[0]=='f':groups.setdefault(g,[]).append([(int(v.split('/')[0])-1,int(v.split('/')[1])-1 if '/' in v else 0) for v in a[1:]])
    return vs,uv,groups
base,uv,groups=objread(SRC/'base.obj')
def target(file):
    d={}
    for l in Path(file).read_text().splitlines():
        a=l.split()
        if a and not a[0].startswith('#'):d[int(a[0])]=Vector(tuple(map(float,a[1:4])))
    return d
v=[x.copy() for x in base]
for file in ['asian-female-young.target','universal-female-young-averagemuscle-averageweight.target']:
    for i,d in target(SRC/file).items():v[i]+=d
def joint(g):
    inds=set(i for face in groups[g] for i,u in face);return sum((v[i] for i in inds),Vector())/len(inds)
hip=joint('joint-pelvis').y
weights=json.loads((SRC/'default_weights.mhw').read_text())['weights']
arm={s:[0.0]*len(v) for s in ['L','R']};handw={s:[0.0]*len(v) for s in ['L','R']};forearm_lift=[0.0]*len(v)
for bn,vals in weights.items():
    for s in ['L','R']:
        if bn.endswith('.'+s) and bn.split('.')[0].startswith(('upperarm','lowerarm','wrist','finger','metacarpal')):
            for i,w in vals:arm[s][i]+=w
        if bn.endswith('.'+s) and bn.split('.')[0].startswith(('wrist','finger','metacarpal')):
            for i,w in vals:handw[s][i]+=w
        if bn.endswith('.'+s) and bn.split('.')[0].startswith(('wrist','finger','metacarpal','lowerarm')):
            for i,w in vals:forearm_lift[i]+=w*(.45 if bn.startswith('lowerarm') else 1)
shoulders={s:joint('joint-'+('l' if s=='L' else 'r')+'-shoulder') for s in ['L','R']}
S=.111;A=math.radians(38)
hand_pivots={}
for s,ang in [('L',-30),('R',30)]:
    p=joint('joint-'+('l' if s=='L' else 'r')+'-hand')
    q=shoulders[s]+Matrix.Rotation(math.radians(ang),3,'Z')@(p-shoulders[s])
    h=q.y-hip;aa=A*min(1,max(0,h/.75))
    hand_pivots[s]=Vector((q.x*S,.865+h*S*math.sin(aa)+q.z*S*math.cos(aa),.10-h*S*math.cos(aa)+q.z*S*math.sin(aa)))
def bodypose(p,i=None,cloth=False):
    q=Vector(p)
    if i is not None:
        for s,ang in [('L',-30),('R',30)]:
            w=min(1,arm[s][i]);r=Matrix.Rotation(math.radians(ang),3,'Z')
            if w:q=q.lerp(shoulders[s]+r@(q-shoulders[s]),w)
    # Rounded late-pregnancy silhouette; front-only smooth anatomical deformation.
    if abs(p.x)<2.0 and p.y<3.2 and p.y>hip-1.5:
        bump=1.8*math.exp(-((p.x/1.35)**2+((p.y-(hip+1.45))/1.65)**2))
        q.z+=bump*max(0,min(1,(p.z+.2)/.9))
    if cloth:
        q.x*=1.06
        q.z+=.16 if p.z>0 else -.12
    h=q.y-hip
    t=min(1,max(0,h/.75));aa=A*t
    result=Vector((q.x*S,.78+h*S*math.sin(aa)+q.z*S*math.cos(aa),.10-h*S*math.cos(aa)+q.z*S*math.sin(aa)))
    if i is not None:
        result.y+=.085*min(1,forearm_lift[i])
        for s in ['L','R']:
            w=min(1,handw[s][i])
            if w:
                # Relax palms on the sheet rather than retaining standing A-pose
                # fingers pointing upward. Wrist weights make a smooth transition.
                posed=hand_pivots[s]+Matrix.Rotation(math.radians(75),3,'X')@(result-hand_pivots[s])
                result=result.lerp(posed,w)
    return result

blink=target(SRC/'expression/eye-left-closure.target')
for i,d in target(SRC/'expression/eye-right-closure.target').items():blink[i]=blink.get(i,Vector())+d
talk=target(SRC/'expression/mouth-open.target')
strain={}
for f in ['eyebrows-left-down.target','eyebrows-right-down.target','mouth-compression.target']:
    for i,d in target(SRC/'expression'/f).items():strain[i]=strain.get(i,Vector())+d*.65

def make_part(name,selected,m,cloth=False):
    used=sorted(set(i for f in selected for i,u in f));mp={old:new for new,old in enumerate(used)}
    vv=[bodypose(v[i],i,cloth) for i in used]
    o=mesh(name,vv,[[mp[i] for i,u in f] for f in selected],m,uv,[[u for i,u in f] for f in selected])
    # Body remains smooth with a true continuous human surface, rather than primitive limbs.
    if m==skin:
        attr=o.data.color_attributes.new(name='Complexion',type='FLOAT_COLOR',domain='POINT')
        for ni,idx in enumerate(used):
            p=v[idx];col=Vector((.41,.235,.155))
            # Small controlled natural colour: lips, cheeks, ears and eye sockets.
            lip=math.exp(-((p.x/.31)**4+((p.y-5.15)/.105)**4))*max(0,min(1,(p.z-.9)*5))
            cheek=math.exp(-(((abs(p.x)-.43)/.26)**2+((p.y-5.48)/.22)**2))*max(0,min(1,p.z))
            eye=math.exp(-(((abs(p.x)-.28)/.24)**4+((p.y-5.8)/.15)**4))*max(0,min(1,p.z))
            col=col.lerp(Vector((.37,.115,.105)),lip*.65).lerp(Vector((.48,.205,.17)),cheek*.25).lerp(Vector((.31,.15,.105)),eye*.18)
            attr.data[ni].color=(*col,1)
    o.shape_key_add(name='Basis')
    for key,deltas in [('Blink',blink),('Talk',talk),('Contraction',strain),('Breath',{})]:
        sk=o.shape_key_add(name=key)
        for ni,idx in enumerate(used):
            p=v[idx]
            if key=='Breath':
                strength=math.exp(-((p.y-(hip+3.0))/1.5)**2)*max(0,min(1,(p.z+.2)))
                delta=Vector((0,.006*strength,.003*strength))
            else:delta=bodypose(p+deltas.get(idx,Vector()),idx,cloth)-vv[ni]
            sk.data[ni].co=W(vv[ni]+delta)
    # Shape keys also on clothes allow the chest to rise without moving the whole scene.
    return o

headfaces=[];bodyfaces=[];leftfaces=[];rightfaces=[];gownfaces=[]
for f in groups['body']:
    ids=[i for i,u in f];p=sum((v[i] for i in ids),Vector())/len(ids)
    aw=max(sum(arm[s][i] for i in ids)/len(ids) for s in ['L','R'])
    hw={s:sum(handw[s][i] for i in ids)/len(ids) for s in ['L','R']}
    if p.y>4.65:headfaces.append(f)
    elif hw['L']>.6:leftfaces.append(f)
    elif hw['R']>.6:rightfaces.append(f)
    elif aw>.55 and p.y<2.8:bodyfaces.append(f)
    elif p.y>4.15:bodyfaces.append(f)
    if hip-.65<p.y<4.22 and (aw<.65 or p.y>2.82):gownfaces.append(f)
patient=make_part('Patient_head',headfaces,skin)
arms=make_part('Patient_body',bodyfaces,skin)
left=make_part('Patient_left_hand',leftfaces,skin)
right=make_part('Patient_right_hand',rightfaces,skin)
gown=make_part('Patient_chest',gownfaces,gownmat,True)

# Exact official eye proxy uses base-mesh helper indices and its own UV map.
ev,euv,eg=objread(SRC/'eyes.obj')
rows=(SRC/'eyes.mhclo').read_text().split('verts 0')[1].strip().splitlines()
eids=[int(l) for l in rows if l.strip().isdigit()]
eyeverts=[bodypose(v[i],i) for i in eids]
eyemat=mat('Brown eyes',(.7,.68,.6),.28)
im=bpy.data.images.load(str(SRC/'brown_eye.png'));im.pack()
im.scale(256,256);im.pack()
n=eyemat.node_tree.nodes.new('ShaderNodeTexImage');n.image=im
eyemat.node_tree.links.new(n.outputs['Color'],next(n for n in eyemat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])
allfaces=[f for fs in eg.values() for f in fs]
eyes=mesh('Patient_eyes',eyeverts,[[i for i,u in f] for f in allfaces],eyemat,euv,[[u for i,u in f] for f in allfaces])
iris=mat('Natural brown iris',(.045,.017,.006),.32)
pupil=mat('Pupil',(.002,.0015,.001),.25)
for m in [iris,pupil]:
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Specular IOR Level'].default_value=0;p.inputs['Roughness'].default_value=.8
for s in ['l','r']:
    eye=joint('joint-'+s+'-eye')
    for name,r,ma,front in [('iris',.057,iris,.151),('pupil',.024,pupil,.153)]:
        vv=[bodypose(eye+Vector((0,0,front)))]
        for k in range(33):
            a=k/32*2*math.pi;vv.append(bodypose(eye+Vector((r*math.cos(a),r*math.sin(a),front-.007))))
        mesh('Patient_eye_'+name+'_'+s,vv,[(0,k+1,k+2) for k in range(32)],ma)

# Closely fitted scalp derived from the same human mesh, with swept-back strands.
hairfaces=[]
for f in headfaces:
    p=sum((v[i] for i,u in f),Vector())/len(f)
    if p.y>6.16 or (p.y>5.45 and p.z<.1) or (abs(p.x)>.61 and p.y>5.92):hairfaces.append(f)
used=sorted(set(i for f in hairfaces for i,u in f));mp={a:b for b,a in enumerate(used)}
hairverts=[]
for i in used:
    p=v[i];center=Vector((0,5.94,.15));q=center+(p-center)*1.065
    hairverts.append(bodypose(q,i))
haircap=mesh('Patient_hair_cap',hairverts,[[mp[i] for i,u in f] for f in hairfaces],hair)
sub=haircap.modifiers.new('Smooth natural hairline','SUBSURF');sub.levels=2;sub.render_levels=2
solid=haircap.modifiers.new('Fine hairline thickness','SOLIDIFY');solid.thickness=.0015
for k in range(34):
    theta=2*math.pi*k/34
    # Scalp ellipsoid side part and individual swept strands.
    pts=[]
    for j in range(7):
        a=.38+(j/6)*1.55
        p=Vector((.71*math.sin(a)*math.sin(theta),5.95+.92*math.cos(a),.14+.73*math.sin(a)*math.cos(theta)))
        if p.z>.3 and p.y<6.17:continue
        pts.append(bodypose(p))
    if len(pts)>2:path('Patient_hair_strand_%02d'%k,pts,.0011,hairlight)
for s in [-1,1]:
    pts=[bodypose(Vector((s*x,y,z))) for x,y,z in [(0.40,6.30,.76),(.67,6.13,.58),(.76,5.88,.23),(.71,5.54,-.08),(.55,5.50,-.31)]]
    path('Patient_temple_hair_'+str(s),pts,.008,hair)
bun=sphere('Patient_hair_bun',bodypose(Vector((0,5.8,-.68))),(.075,.048,.074),hair)
# Eyebrows are fine curved geometry rather than large painted blocks.
for s in [-1,1]:
    pts=[]
    headids=set(i for f in headfaces for i,u in f)
    for j in range(7):
        x=.115+j*.062;y=6.025+.035*math.sin(j/6*math.pi)
        near=min((i for i in headids if v[i].z>.7),key=lambda i:(v[i].x-s*x)**2+(v[i].y-y)**2)
        p=Vector((s*x,y,v[near].z+.035));pts.append(bodypose(p,near))
    brow=path('Patient_eyebrow_'+str(s),pts,.0011,hair)
    for j,b in enumerate(brow.data.splines[0].bezier_points):b.radius=.35+.65*math.sin(j/6*math.pi)

# Keep head attachments together for subtle runtime nods (local transforms preserve
# their absolute placement). Body motion primarily uses exported morph targets.
headorigin=W(bodypose(joint('joint-neck')))
patient.location=headorigin
for sk in patient.data.shape_keys.key_blocks:
    for ve in sk.data:ve.co-=headorigin
bpy.context.view_layer.update()
for o in list(bpy.context.scene.objects):
    if o!=patient and (o.name.startswith('Patient_hair') or o.name.startswith('Patient_temple') or o.name.startswith('Patient_eye') or o==eyes):
        o.parent=patient;o.matrix_parent_inverse=patient.matrix_world.inverted()
for hand in [left,right]:
    center=sum((ve.co for ve in hand.data.vertices),Vector())/len(hand.data.vertices)
    hand.location=center
    for sk in hand.data.shape_keys.key_blocks:
        for ve in sk.data:ve.co-=center

# Adjustable bed: layered surfaces, rounded rails, control panels and casters.
cube('Bed_lower_chassis',(0,.25,.08),(.94,.17,1.60),ivory,.08)
cube('Bed_lift_column',(0,.46,.05),(.33,.42,.55),frame,.04)
cube('Bed_upper_chassis',(0,.64,.12),(1.02,.12,2.12),ivory,.06)
cube('Mattress_leg_section',(0,.765,.61),(.89,.14,1.12),white,.07)
cube('Mattress_backrest',(0,1.0,-.40),(.89,.14,1.02),white,.07,38)
cube('Bed_backrest_support',(0,.91,-.46),(.96,.09,1.05),ivory,.04,38)
cube('Pillow',(0,1.22,-.65),(.57,.145,.38),white,.08,38)
for x in [-.46,.46]:
    for z in [-.66,.86]:
        cylinder('Bed_caster',(x,.12,z),.095,.07,dark,(1,0,0))
        cylinder('Caster_hub',(x+(.04 if x>0 else -.04),.12,z),.045,.012,frame,(1,0,0))
        cube('Caster_fork',(x,.20,z),(.06,.17,.05),frame,.01)
for x in [-.535,.535]:
    drop=.17 if x>0 else 0
    path('Bed_safety_rail',[(x,.81-drop,-.66),(x,1.12-drop,-.57),(x,1.02-drop,.24),(x,.82-drop,.43)],.035,ivory)
    path('Rail_lower',[(x,.78-drop,-.59),(x,.89-drop,-.50),(x,.83-drop,.29)],.026,ivory)
    for z in [-.42,-.10,.20]:path('Rail_spindle',[(x,.83-drop,z),(x,1.025-.16*(z+.42)-drop,z)],.016,ivory)
    panel=cube('Bed_rail_control',(x,.94-drop,-.29),(.04,.15,.25),blue,.025)
    for j in range(3):sphere('Rail_control_button',(x+(.025 if x>0 else -.025),.96-drop,-.36+j*.065),(.008,.013,.013),ivory,12,8)
cube('Bed_foot_board',(0,.94,1.20),(1.04,.51,.09),ivory,.055)
cube('Foot_board_insert',(0,.97,1.251),(.60,.22,.012),blue,.025)

# A real cloth surface with a lap/leg silhouette and small diagonal fold ridges.
bv=[];bf=[];NU=38;NV=38
for j in range(NV+1):
    z=.21+j/NV*.98
    for i in range(NU+1):
        x=-.49+i/NU*.98
        edge=max(0,(abs(x)-.35)/.14)
        belly=.13*math.exp(-((z-.21)/.24)**2-(x/.33)**2)
        legs=.072*(math.exp(-((x-.15)/.12)**2)+math.exp(-((x+.15)/.12)**2))*math.exp(-((z-.55)/.55)**4)
        folds=.012*math.sin(27*x+13*z)*(.3+.7*abs(x)/.49)+.006*math.sin(43*z+11*x)
        y=.897+belly+legs+folds-.19*edge**1.9
        bv.append((x,y,z))
for j in range(NV):
    for i in range(NU):a=j*(NU+1)+i;bf.append((a,a+1,a+NU+2,a+NU+1))
blanket=mesh('Patient_lower_blanket',bv,bf,white)
sol=blanket.modifiers.new('Cotton hem thickness','SOLIDIFY');sol.thickness=.004
path('Blanket_turned_hem',[(-.48,.92,.21),(-.25,.98,.21),(0,1.03,.21),(.25,.98,.21),(.48,.92,.21)],.013,white)

# Two independent clothed-abdomen probes, named for live signal-contact adjustment.
# These are schematic visual positions, not placement certification.
probes=[]
def garment_surface(x,z):
    hit,co,n,face=gown.ray_cast(W((x,3,z)),W((0,-1,0)))
    if not hit:return Vector((x,1.12,z)),Vector((0,1,0))
    return C.inverted()@co,C.inverted()@n
probe_positions=[]
for name,x,z,ma in [('FHR_transducer',.055,.08,blue),('TOCO_transducer',-.04,-.115,ivory)]:
    surf,normal=garment_surface(x,z);pos=surf+normal*.023;probe_positions.append(tuple(pos))
    o=cylinder(name,pos,.049,.032,ma,normal);probes.append(o)
    lip=cylinder(name+'_face',pos+normal*.021,.039,.012,ivory,normal)
    bpy.context.view_layer.update();lip.parent=o;lip.matrix_parent_inverse=o.matrix_world.inverted()
    path(name+'_lead',[pos,(.34,pos[1]-.05,pos[2]),(.57,.90,-.10),(.85,.81,-.37),(1.08,1.02,-.59)],.0045,dark)
for z in [-.115,.08]:
    verts=[];faces=[]
    for i in range(35):
        x=-.15+i*.30/34
        for zz in [z-.014,z+.014]:
            p,n=garment_surface(x,zz);verts.append(p+n*.004)
    for i in range(34):a=i*2;faces.append((a,a+2,a+3,a+1))
    belt=mesh('Elastic_monitor_belt',verts,faces,mat('Belt neutral grey '+str(z),(.38,.42,.41),.93))
    mod=belt.modifiers.new('Woven strap thickness','SOLIDIFY');mod.thickness=.0015

# Bedside monitoring cart and glass screen (runtime can replace screen material).
cube('Monitor_cart_base',(1.05,.17,-.52),(.60,.09,.52),ivory,.055)
cylinder('Monitor_cart_stem',(1.05,.68,-.52),.045,1.02,frame)
cube('Monitor_cart_shelf',(1.05,1.04,-.52),(.62,.055,.45),ivory,.025)
cube('Monitor_housing',(1.05,1.32,-.53),(.55,.43,.13),ivory,.035)
monitor_screen=mesh('Monitor_screen',[(-.23,-.15,0),(.23,-.15,0),(.23,.15,0),(-.23,.15,0)],[(0,1,2,3)],screen,[(0,0),(1,0),(1,1),(0,1)],[(0,1,2,3)])
monitor_screen.location=W((1.05,1.34,-.455))
# No baked waveform: Monitor_screen is replaced by the runtime's synchronized
# CanvasTexture. Static traces would contradict the teaching time line.
for j in range(3):cylinder('Monitor_button',(1.23,1.18+j*.045,-.447),.010,.008,blue,(0,0,1))
cube('Monitor_print_tray',(1.05,1.07,-.28),(.45,.035,.17),ivory,.012)
cube('Monitor_blank_paper',(1.05,1.09,-.27),(.25,.002,.14),white,.001)
for x in [.84,1.26]:
    for z in [-.69,-.35]:cylinder('Cart_caster',(x,.105,z),.048,.035,dark,(1,0,0))

# Hospital room shell with a warm headwall, recessed service rail and daylight.
cube('Room_floor',(0,-.055,.0),(4.3,.10,4.6),floor,.02)
cube('Room_head_wall',(0,1.45,-1.56),(4.3,2.9,.12),wall,.015)
cube('Headwall_wood_band',(0,1.01,-1.48),(4.15,.43,.045),wood,.01)
cube('Medical_services_rail',(0,1.58,-1.46),(2.20,.19,.07),ivory,.018)
for k in range(5):
    x=-.87+k*.29
    cube('Service_outlet_plate',(x,1.59,-1.414),(.17,.14,.012),white,.005)
    cylinder('Medical_outlet',(x,1.60,-1.40),.025,.014,blue if k%2 else gold,(0,0,1))
    cylinder('Outlet_center',(x,1.60,-1.39),.010,.015,dark,(0,0,1))
cube('Recessed_head_light',(0,1.86,-1.43),(2.6,.055,.06),mat('Warm headlight glow',(.93,.84,.66),.5,0,1.4),.01)
cube('Window_wall',(-1.86,1.4,-.12),(.10,2.8,2.85),wall,.01)
cube('Window_glass',(-1.798,1.69,-.27),(.014,1.70,1.85),mat('Soft daylight glazing',(.66,.81,.84),.4,0,.35),.001)
for z in [-1.22,.68]:cube('Window_vertical_frame',(-1.77,1.69,z),(.08,1.85,.06),ivory,.012)
for y in [.77,2.60]:cube('Window_horizontal_frame',(-1.77,y,-.27),(.08,.07,1.97),ivory,.01)
cube('Window_center_mullion',(-1.75,1.69,-.27),(.08,1.75,.035),ivory,.005)
# Pleated curtain partially open; its folds can sway independently at runtime.
cv=[];cf=[]
for j in range(25):
    y=.20+j/24*2.45
    for i in range(49):
        z=-1.19+i/48*.78
        cv.append((-1.56+.045*math.cos(i*math.pi/3),y,z+.008*math.sin(j*.6)))
for j in range(24):
    for i in range(48):a=j*49+i;cf.append((a,a+1,a+50,a+49))
mesh('Curtain_dynamic',cv,cf,teal)
path('Curtain_ceiling_track',[(-1.57,2.72,-1.25),(-1.57,2.72,.92),(-1.25,2.72,1.11)],.018,frame)
for z in [-1.14,-1.01,-.88,-.75,-.62,-.49]:path('Curtain_suspension',[(-1.56,2.65,z),(-1.56,2.72,z)],.005,ivory)

# Small practical details keep the room readable at bed view without clutter.
cube('Bedside_cabinet',(-.95,.53,-.95),(.43,.88,.42),wood,.035)
cube('Cabinet_top',(-.95,.99,-.95),(.48,.045,.47),ivory,.018)
for y in [.40,.73]:
    cube('Cabinet_drawer',(-.95,y,-.728),(.36,.27,.018),ivory,.012)
    path('Cabinet_handle',[(-1.02,y+.06,-.707),(-.89,y+.06,-.707)],.009,frame)
cylinder('Water_cup',(-.94,1.08,-.95),.043,.13,mat('Frosted tumbler',(.64,.78,.79),.36))
cube('Tissue_box',(-.95,1.05,-.81),(.18,.08,.10),white,.012)
cube('Headwall_notice',(1.13,2.14,-1.48),(.62,.42,.025),ivory,.014)
for k in range(3):cube('Notice_line',(1.13,2.24-k*.065,-1.461),(.40 if k!=1 else .31,.015,.004),teal,.001)

empty('Anchor_patient',(0,1.49,-.38))
empty('Anchor_pulse',tuple(Vector(W(left.location)).to_tuple()) if False else (.31,1.08,.12))
empty('Anchor_monitor',(1.05,1.49,-.45))
empty('Anchor_abdomen',(.06,1.28,-.02))

# Editable material meshes are retained, modifiers applied only by GLB export.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world.color=(.36,.39,.39)
scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs['Color'].default_value=(.13,.16,.17,1);bg.inputs['Strength'].default_value=.4
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.45
def area(name,loc,energy,size,color,target):
    bpy.ops.object.light_add(type='AREA',location=W(loc));o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=color
    o.rotation_euler=(W(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Window daylight',(-1.2,2.7,.3),220,2.6,(.83,.93,1),(0,.9,0))
area('Soft ceiling',(.8,2.8,.0),160,2.3,(1,.91,.78),(0,.8,0))
area('Camera soft fill',(2.5,2.0,2.0),70,3,(1,.95,.87),(0,1,0))
bpy.ops.object.camera_add(location=W((2.35,2.28,2.55)))
cam=bpy.context.object;cam.name='Room_review_camera';cam.rotation_euler=(W((0,1.12,-.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=48;scene.camera=cam
scene.render.image_settings.file_format='PNG';scene.render.filepath='/private/tmp/fhr-room-review.png'
ROOT.joinpath('public/models').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/fhr-room.blend'))
# Export optimization only: the .blend above retains every editable object,
# curve and modifier. Join static room parts by material to reduce draw calls.
keep={'Patient_head','Patient_body','Patient_chest','Patient_left_hand','Patient_right_hand','Patient_eyes','Curtain_dynamic','FHR_transducer','FHR_transducer_face','TOCO_transducer','TOCO_transducer_face','Monitor_screen'}
static=[o for o in scene.objects if o.type in {'MESH','CURVE'} and o.name not in keep]
for o in static:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
    for mod in list(o.modifiers):
        try:bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError:pass
batches={}
for o in static:
    if o.type!='MESH':continue
    key=(o.data.materials[0].name if o.data.materials else 'none',o.parent.name if o.parent else '')
    batches.setdefault(key,[]).append(o)
for (material,parent),objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    objects[0].name=('Patient_hair_' if parent else 'Room_static_')+material.replace(' ','_')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/fhr-room.glb'),export_format='GLB',export_animations=False,export_morph=True,export_morph_normal=False,export_morph_tangent=False,export_apply=True,export_lights=False,export_cameras=False,export_extras=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True)
    cam.location=W((1.0,1.85,.58));cam.rotation_euler=(W((0,1.27,-.36))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=60
    scene.render.filepath='/private/tmp/fhr-room-patient-close.png';bpy.ops.render.render(write_still=True)
glb=ROOT/'public/models/fhr-room.glb';blob=glb.read_bytes();n=struct.unpack_from('<I',blob,12)[0];gltf=json.loads(blob[20:20+n])
node_names={o['name'] for o in gltf['nodes']}
required=['Patient_head','Patient_body','Patient_chest','Patient_left_hand','Patient_right_hand','FHR_transducer','TOCO_transducer','Monitor_screen','Curtain_dynamic','Anchor_patient','Anchor_pulse','Anchor_monitor','Anchor_abdomen']
assert all(x in node_names for x in required)
sources=[]
for p in sorted(SRC.rglob('*')):
    if p.is_file():sources.append({'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'license':'CC0-1.0'})
provenance={
    'asset':'fhr-room','version':'1.0','prepared_date':'2026-10-15','tool':'Blender '+bpy.app.version_string,
    'purpose':'Original interactive obstetric teaching room with clothed fictional adult pregnant patient; no patient photograph or health record.',
    'upstream':{'project':'MakeHuman Community core assets','repository':'https://github.com/makehumancommunity/makehuman','commit':'a8bc2d54ff0ac92e78ff71431b1023eda42bf482','asset_license':'CC0-1.0','asset_license_file':'licenses/MakeHuman-core-CC0.md','official_license_statement':'https://static.makehumancommunity.org/about/license.html','official_core_asset_faq':'https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html','rights_holders_as_recorded':'Data Collection AB, Joel Palmius, Jonas Hauquier; target files also record the transfer from Manuel Bastioni. See preserved per-file headers.','software_distinction':'MakeHuman source code is AGPL; only its explicitly CC0 core data files were used. No MakeHuman code or add-on is executed or included.'},
    'preserved_core_files':sources,
    'original_work':['Room architecture, furniture, bedding, curtain, monitor, cables, independent transducer meshes','Maternity gown derived from core body topology, original woven dot texture and coverage','Pregnancy surface deformation, semi-reclined arm/hand pose, hair surface and swept strands, face complexion and iris detail','All Blender construction/export/optimization code'],
    'modifications':['Apply asian-female-young and universal-female-young-averagemuscle-averageweight core targets at weight 1','Uniform base scale 0.111; pose changes are for this illustrative fictional adult and are not a clinical anatomical measurement','Clothed late-pregnancy silhouette, covered lower body, bedside left-hand interaction surface','Official Asian face-unit targets supply bilateral Blink, mouth-open Talk, eyebrows-down/mouth-compression Contraction','Original Breath morph adds a small smooth chest rise; other body parts retain four compatible named keys','Core brown-eye texture resized to 256 px; original full texture retained in editable source folder','Export-only static mesh batching by material; editable .blend retains separate room parts, curves and modifiers'],
    'runtime':{'units':'metres','axes':'+X room right, +Y up, bed head toward -Z','bed_surface_y':0.78,'camera_example':[2.35,2.28,2.55],'camera_target':[0,1.12,-0.05],'required_nodes':required,'morph_targets':['Blink','Talk','Contraction','Breath'],'morph_range':[0,1],'head_pivot_web':[0,1.1136907,-0.3300254],'head_children':'Eyes, brows and batched hair/iris meshes inherit Patient_head; preserve base transforms and use only small nod/turn offsets.','hand_pivot':'Patient_left_hand and Patient_right_hand origins are surface centroids, suitable for small gesture offsets; do not rotate through a wide angle.','monitor_uv':'Single quad facing +Z; full 0-1 UV. In GLB, upper left is (0,0), lower right is (1,1). CanvasTexture.flipY=false.','probe_motion':'Independent FHR_transducer / TOCO_transducer nodes; their *_face children move with them. Raycast Patient_chest to keep small changes on the surface. Suggested X-only adjustment approximately 0.03 m.','probe_initial_positions':{o['name']:o.get('translation',[0,0,0]) for o in gltf['nodes'] if o.get('name') in ['FHR_transducer','TOCO_transducer']},'static_waveforms':False,'clinical_scope':'Device positions are schematic visual interaction locations on covered clothing, not clinical placement instruction or treatment simulation.'},
    'outputs':{'glb':'public/models/fhr-room.glb','glb_bytes':len(blob),'glb_sha256':hashlib.sha256(blob).hexdigest(),'editable_blend':'assets-source/fhr-room.blend','blend_sha256':hashlib.sha256((ROOT/'assets-source/fhr-room.blend').read_bytes()).hexdigest(),'rebuild_script':'scripts/build_fhr_room.py','script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'nodes':len(gltf['nodes']),'meshes':len(gltf['meshes']),'primitives':sum(len(m['primitives']) for m in gltf['meshes'])},
    'review':{'overall_render':'/private/tmp/fhr-room-review.png','patient_close_render':'/private/tmp/fhr-room-patient-close.png','required_node_check':'passed','medical_content_approval':'User review pending; this is illustrative synthetic teaching content.'}
}
(ROOT/'docs/fhr-room-provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
print('FHR_ROOM_COMPLETE', (ROOT/'public/models/fhr-room.glb').stat().st_size)
