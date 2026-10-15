"""Build the editable first-stage teaching assets in Blender 4.5.

Blender --background --python scripts/build_models.py -- EXTRACTED_BLEND PROJECT_ROOT
Web axes: +X maternal left, +Y superior, +Z anterior. Blender: (X, -Z, Y).
"""
import bpy, math, os, sys, json
from mathutils import Vector

source, root=sys.argv[sys.argv.index('--')+1:]
out=os.path.join(root,'public','models'); editable=os.path.join(root,'assets-source')
os.makedirs(out,exist_ok=True); os.makedirs(editable,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=source)
bones=[o for o in bpy.data.objects if o.type=='MESH']
scale=2.8/(.14984172582626343+.16699616611003876)
def material(name,color,roughness=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=roughness
    return m
bone=material('Ivory bone',(.76,.69,.56),.73)
for o in bones:
    for v in o.data.vertices:
        v.co=Vector(((v.co.x+.0085)*scale,(v.co.y-.09)*scale,(v.co.z-.035)*scale))
    o.data.materials.clear();o.data.materials.append(bone)
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00002);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    for p in o.data.polygons:p.use_smooth=True
    o.select_set(False)
    o['source']='HRA United Female v1.5, doi:10.48539/HBM352.BTSQ.586, CC BY 4.0'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'pelvis.glb'),export_format='GLB',use_selection=True,export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(editable,'female-pelvis.blend'),compress=True)

# Authored fetal model: a continuous soft body, flexed limbs and detailed face.
# All positions below use the canonical web axes for easy review.
for o in bpy.data.objects:o.select_set(False)
skin=material('Warm medical clay',(.61,.36,.27),.7)
crease=material('Soft anatomical creases',(.32,.17,.13),.85)
body_parts=[];details=[]
def web(p):return (p[0],-p[2],p[1])
def ellipsoid(name,center,radii,mat=skin,body=True,detailed=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96 if detailed else 40,ring_count=64 if detailed else 28,location=web(center))
    o=bpy.context.object;o.name=name;o.scale=(radii[0],radii[2],radii[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    (body_parts if body else details).append(o)
    return o
def tube(name,points,radii,mat=skin,body=True):
    # Skin modifier followed by subdivision gives a continuous rounded limb.
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([web(p) for p in points],[(i,i+1) for i in range(len(points)-1)],[]);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True)
    m=o.modifiers.new('Rounded anatomical profile','SKIN');bpy.context.view_layer.update()
    for i,r in enumerate(radii):o.data.skin_vertices[0].data[i].radius=(r,r)
    o.data.skin_vertices[0].data[0].use_root=True
    s=o.modifiers.new('Smooth curve','SUBSURF');s.levels=2
    bpy.ops.object.modifier_apply(modifier=m.name);bpy.ops.object.modifier_apply(modifier=s.name)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    o.select_set(False);(body_parts if body else details).append(o);return o
def line(name,points,radius=.012,mat=crease):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=16;c.bevel_depth=radius;c.bevel_resolution=3
    sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for b,p in zip(sp.bezier_points,points):b.co=web(p);b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat);details.append(o);return o

head=ellipsoid('Cranium and continuous facial surface',(0,.30,.015),(.405,.465,.43),detailed=True)
def gaussian(x,y,cx,cy,sx,sy):return math.exp(-.5*(((x-cx)/sx)**2+((y-cy)/sy)**2))
for v in head.data.vertices:
    x=v.co.x;y=v.co.z+.30;z=-v.co.y+.015
    v.co.x*=1-.24*max(0,min(1,(y-.38)/.385))
    if z<.015:
        front=max(0,min(1,(-z+.015)/.25))
        # Model the face within the cranial surface, without a separate mask.
        relief=.0
        relief+=.032*gaussian(x,y,-.18,.31,.095,.10)+.032*gaussian(x,y,.18,.31,.095,.10)
        relief+=.024*gaussian(x,y,0,.245,.040,.10)+.055*gaussian(x,y,0,.335,.060,.060)+.017*gaussian(x,y,-.041,.35,.027,.031)+.017*gaussian(x,y,.041,.35,.027,.031)
        relief+=.015*gaussian(x,y,0,.435,.085,.05)+.018*gaussian(x,y,0,.53,.11,.065)
        relief-=.014*gaussian(x,y,-.14,.17,.065,.045)+.014*gaussian(x,y,.14,.17,.065,.045)
        z-=relief*front
        v.co.y=-(z-.015)
head.data.update()
ellipsoid('Neck',(0,.76,.07),(.20,.24,.21))
ellipsoid('Thorax',(0,1.16,.14),(.32,.46,.27))
ellipsoid('Abdomen',(0,1.51,.03),(.35,.39,.32))
ellipsoid('Buttocks',(0,1.79,.14),(.32,.26,.29))
for s in [-1,1]:
    ellipsoid('Ear',(.382*s,.35,.01),(.045,.106,.060))
    ellipsoid('Ear concha',(.419*s,.35,-.012),(.006,.052,.023),crease,False)
    tube('Upper arm',[(.23*s,1.31,.13),(.4*s,1.19,-.06),(.41*s,.98,-.13)],[.13,.125,.10])
    tube('Flexed forearm',[(.41*s,.98,-.13),(.27*s,.91,-.31),(.18*s,.76,-.34)],[.10,.09,.075])
    ellipsoid('Hand',(.18*s,.72,-.35),(.095,.12,.055))
    for i in range(4):
        x=(.125+i*.032)*s
        tube('Finger',[(x,.75,-.374),(x,.66,-.397),(x,.61+abs(i-1.5)*.015,-.38)],[.022,.019,.014])
    tube('Thumb',[(.11*s,.73,-.34),(.08*s,.68,-.39),(.10*s,.64,-.40)],[.029,.023,.018])
    tube('Thigh flexed to abdomen',[(.20*s,1.78,.10),(.39*s,1.61,-.14),(.41*s,1.30,-.38)],[.21,.21,.16])
    ellipsoid('Knee',(.40*s,1.29,-.35),(.16,.16,.16))
    tube('Shin',[(.4*s,1.30,-.36),(.35*s,1.61,-.48),(.27*s,1.90,-.40)],[.13,.115,.08])
    foot=ellipsoid('Foot',(.245*s,1.98,-.38),(.105,.17,.09));foot.rotation_euler.y=s*.25
    for i in range(5):
        ellipsoid('Toe',((.175+i*.033)*s,2.09-abs(i-1.5)*.011,-.405),(.026,.055-i*.003,.035))
for s in [-1,1]:
    line('Delicate closed eyelid',[(.070*s,.170,-.391),(.143*s,.187,-.377),(.214*s,.170,-.347)],.0045)
line('Mouth crease',[(-.065,.433,-.408),(0,.445,-.432),(.065,.433,-.408)],.0045)
line('Navel',[(-.025,1.43,-.284),(0,1.414,-.294),(.023,1.43,-.284)],.012)

bpy.ops.object.select_all(action='DESELECT')
for o in body_parts:o.select_set(True)
bpy.context.view_layer.objects.active=body_parts[0];bpy.ops.object.join();body=bpy.context.object;body.name='Fetal continuous body'
m=body.modifiers.new('Sculpted surface union','REMESH');m.mode='VOXEL';m.voxel_size=.008;m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
m=body.modifiers.new('Soft tissue smoothing','SMOOTH');m.factor=.65;m.iterations=5;bpy.ops.object.modifier_apply(modifier=m.name)
m=body.modifiers.new('Web mesh optimization','DECIMATE');m.ratio=.5;bpy.ops.object.modifier_apply(modifier=m.name)
m=body.modifiers.new('Final sculpt polish','SUBSURF');m.levels=1;bpy.ops.object.modifier_apply(modifier=m.name)
m=body.modifiers.new('Delivery optimization','DECIMATE');m.ratio=.22;bpy.ops.object.modifier_apply(modifier=m.name)
for p in body.data.polygons:p.use_smooth=True
body['purpose']='Illustrative cephalic fetal position model; not a biometric or biomechanical model.'
bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
for o in details:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'fetus.glb'),export_format='GLB',use_selection=True,export_extras=True)

# Editable assembly and proof images, using the same front/top axes as the app.
bpy.ops.object.select_all(action='SELECT')
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.curvature_ridge_factor=1.3
scene.display.shading.background_type='WORLD';scene.world.color=(.78,.84,.89)
scene.render.resolution_x=1100;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.9
for name,pos,target in [('front',(0,-6,2.5),(0,0,.65)),('oblique',(4,-6,3.2),(0,0,.65)),('top',(0,-.001,7),(0,0,.65))]:
    cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(root,'docs','model-'+name+'.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(editable,'fetal-position-assembly.blend'),compress=True)
print('MODELS_SAVED',out,flush=True)
