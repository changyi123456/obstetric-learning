"""Blender 4.5: author the continuous teaching animation from shared JSON.

blender --background --python scripts/build_birth_rig.py -- PROJECT_ROOT
HRA pelvis attribution is retained in licenses/HRA-CC-BY-4.0.txt.
"""
import bpy, sys, os, math, json
from mathutils import Vector, Matrix

root=sys.argv[sys.argv.index('--')+1]
data=json.load(open(os.path.join(root,'src/birth-poses.json')))
bpy.ops.wm.open_mainfile(filepath=os.path.join(root,'assets-source/fetal-position-assembly.blend'))
pelvis=[o for o in bpy.data.objects if o.name.startswith('VH_F_') and o.type=='MESH']
# Rebuild the same accepted surface components before union so hands remain
# attached to the torso instead of being welded to the head during extension.
for o in list(bpy.data.objects):
    if o.type in ['MESH','CURVE'] and o not in pelvis:bpy.data.objects.remove(o,do_unlink=True)
def material(name,color,roughness=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=roughness;return m
script=open(os.path.join(root,'scripts/build_models.py')).read()
fragment=script[script.index('# Authored fetal model'):script.index("bpy.ops.object.select_all(action='DESELECT')\nfor o in body_parts")]
exec(fragment,globals())
neck_objects=[o for o in body_parts if o.name=='Neck']
head_objects=[o for o in body_parts if o.name.startswith(('Cranium','Ear'))]
body_objects=[o for o in body_parts if o not in neck_objects+head_objects]
def sculpt(objects,name,voxel):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    m=o.modifiers.new('Sculpt union','REMESH');m.mode='VOXEL';m.voxel_size=voxel;m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Polish','SMOOTH');m.factor=.5;m.iterations=3;bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Surface refinement','SUBSURF');m.levels=1;bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Web optimization','DECIMATE');m.ratio=.30;bpy.ops.object.modifier_apply(modifier=m.name)
    return o
fetal=[sculpt(body_objects,'Birth_body_surface',.014),sculpt(head_objects,'Birth_head_surface',.008),*neck_objects,*details]
def web(p):return Vector((p[0],-p[2],p[1]))
for o in fetal:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
    o.data.transform(o.matrix_world);o.matrix_world=Matrix.Identity(4)
    for poly in o.data.polygons:poly.use_smooth=True

# Markers are skinned with the relevant anatomical region.
for name,point,color in [('Occiput_marker',(0,.24,.455),(.02,.42,.48)),('Shoulder_marker_L',(-.42,1.18,.14),(.67,.39,.12)),('Shoulder_marker_R',(.42,1.18,.14),(.67,.39,.12))]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=.035,location=web(point));o=bpy.context.object;o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(material(name,color));fetal.append(o)

arm=bpy.data.armatures.new('Birth teaching skeleton')
rig=bpy.data.objects.new('BirthRig',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
body=arm.edit_bones.new('Birth_body');body.head=(0,0,0);body.tail=(0,0,1.2)
neck_bone=arm.edit_bones.new('Birth_neck');neck_bone.head=web((0,.95,.07));neck_bone.tail=web(data['neckPivot']);neck_bone.parent=body
head=arm.edit_bones.new('Birth_head');head.head=web(data['neckPivot']);head.tail=web((0,.15,.06));head.parent=neck_bone
bpy.ops.object.mode_set(mode='OBJECT')
rig.scale=(data['scale'],)*3;rig.rotation_mode='QUATERNION'
def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)
for o in fetal:
    groups={name:o.vertex_groups.new(name=name) for name in ['Birth_body','Birth_neck','Birth_head']}
    for v in o.data.vertices:
        if o.name.startswith('Birth_body_surface') or o.name.startswith(('Navel','Shoulder_marker')):weights=[1,0,0]
        elif o.name=='Neck':
            h=1-smooth((v.co.z-.60)/.18);b=smooth((v.co.z-.77)/.20);weights=[b,max(0,1-b-h),h]
        else:weights=[0,0,1]
        for group,weight in zip(groups.values(),weights):
            if weight>0:group.add([v.index],weight,'REPLACE')
    mod=o.modifiers.new('Continuous head neck deformation','ARMATURE');mod.object=rig
    o.parent=rig;o.matrix_parent_inverse=Matrix.Identity(4)
    o['model_role']='Original Blender-authored educational fetus with weighted head, neck and body bones'

keys=data['keyframes'];fps=data['fps'];seconds=data['secondsPerStage']
scene=bpy.context.scene;scene.render.fps=fps;scene.frame_start=0;scene.frame_end=round(7*seconds*fps)
def sample(t):
    i=next((i for i in range(1,len(keys)) if keys[i]['time']>=t),len(keys)-1)
    a,b=keys[i-1],keys[i];u=smooth((t-a['time'])/(b['time']-a['time']))
    p={k:a[k]+(b[k]-a[k])*u for k in ['bodyYaw','headYaw','headPitch','bodyTilt','bodyRoll']}
    p['position']=[a['position'][i]+(b['position'][i]-a['position'][i])*u for i in range(3)]
    return p
def rx(a):return Matrix.Rotation(math.radians(a),4,'X')
def ry(a):return Matrix.Rotation(math.radians(a),4,'Y')
def rz(a):return Matrix.Rotation(math.radians(a),4,'Z')
neck=web(data['neckPivot']);neck_base=web((0,.95,.07));rest=arm.bones['Birth_head'].matrix_local.copy();neck_rest=arm.bones['Birth_neck'].matrix_local.copy()
for f in range(scene.frame_end+1):
    p=sample(f/(fps*seconds));scene.frame_set(f)
    rig.location=web(p['position'])
    # WEB Y yaw -> Blender Z, WEB Z roll -> Blender -Y.
    rig.rotation_quaternion=(rx(p['bodyTilt'])@rz(p['bodyYaw'])@ry(-p['bodyRoll'])).to_quaternion()
    head=rig.pose.bones['Birth_head'];head.rotation_mode='QUATERNION'
    neck_transform=Matrix.Translation(neck_base)@rx(p['headPitch']*.4)@Matrix.Translation(-neck_base)
    n=rig.pose.bones['Birth_neck'];n.rotation_mode='QUATERNION';n.matrix=neck_transform@neck_rest
    head.matrix=neck_transform@Matrix.Translation(neck)@rz(p['headYaw'])@rx(p['headPitch']*.6)@Matrix.Translation(-neck)@rest
    rig.keyframe_insert('location',frame=f);rig.keyframe_insert('rotation_quaternion',frame=f)
    for bone in [head,n]:
        for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(prop,frame=f)
rig.animation_data.action.name='Birth_Sequence'
rig['motion_version']=data['version'];rig['motion_units']='Illustrative normalized coordinates; not clinical measurements'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in fetal:o.select_set(True)
scene.frame_set(0)
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'public/models/birth-fetus.glb'),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,export_frame_range=True,export_extras=True)
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
cam=scene.camera;cam.data.ortho_scale=4.7
review=os.path.join(root,'assets-source/birth-review');os.makedirs(review,exist_ok=True)
for stage in ([] if '--no-render' in sys.argv else range(8)):
    scene.frame_set(stage*seconds*fps)
    deps=bpy.context.evaluated_depsgraph_get()
    points=[o.evaluated_get(deps).matrix_world@Vector(c) for o in scene.objects if o.type=='MESH' for c in o.evaluated_get(deps).bound_box]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);target=(lo+hi)/2
    cam.location=target+Vector((5,-6,2.2));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update();inverse=cam.matrix_world.inverted();projected=[inverse@p for p in points]
    cam.data.ortho_scale=max(max(p.x for p in projected)-min(p.x for p in projected),max(p.y for p in projected)-min(p.y for p in projected))*1.15
    scene.render.filepath=os.path.join(review,f'stage-{stage}.png');bpy.ops.render.render(write_still=True)
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'assets-source/birth-mechanism-rig.blend'),compress=True)
print('BIRTH_RIG_READY',flush=True)
