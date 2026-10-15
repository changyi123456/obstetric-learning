"""Render authored poses and inspect fetal/bone surface intersections.

Blender --background --python scripts/inspect_birth.py -- ROOT REVIEW_DIRECTORY
Intersections are a geometry diagnostic, not clinical validation.
"""
import bpy,sys,os,json,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:];root,out=args[:2];os.makedirs(out,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.join(root,'assets-source/birth-mechanism-rig.blend'))
scene=bpy.context.scene;cam=scene.camera
def geometry(obj,deps):
    e=obj.evaluated_get(deps);m=e.to_mesh();m.calc_loop_triangles()
    vertices=[e.matrix_world@v.co for v in m.vertices];faces=[tuple(t.vertices) for t in m.loop_triangles]
    e.to_mesh_clear();return vertices,faces
def bvh(obj,deps):
    v,f=geometry(obj,deps);return BVHTree.FromPolygons(v,f,all_triangles=True)
deps=bpy.context.evaluated_depsgraph_get()
bones=[o for o in scene.objects if o.name.startswith('VH_F_') and o.type=='MESH']
trees={o.name:bvh(o,deps) for o in bones}
vertices=[];faces=[]
for o in bones:
    v,f=geometry(o,deps);offset=len(vertices);vertices+=v;faces.extend([tuple(i+offset for i in tri) for tri in f])
combined=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
targets=[bpy.data.objects[name] for name in ['Birth_head_surface','Birth_body_surface','Neck']];report=[]
times=([i/180 for i in range(1261)] if '--all-frames' in args else sorted(set([i/16 for i in range(113)]+[5.5,6.35,6.65,6.85])))
for t in times:
    scene.frame_set(round(t*180));deps=bpy.context.evaluated_depsgraph_get();intersections={}
    for target_mesh in targets:
        tree=bvh(target_mesh,deps)
        if tree.overlap(combined):
            for name,other in trees.items():
                count=len(tree.overlap(other))
                if count:intersections[target_mesh.name+' / '+name]=count
    report.append({'time':t,'surfaceIntersections':intersections})
    if '--no-render' not in args and t in [0,1,2,3,4,5,5.5,6,6.35,6.65,7]:
        pts=[o.evaluated_get(deps).matrix_world@Vector(corner) for o in scene.objects if o.type=='MESH' for corner in o.evaluated_get(deps).bound_box]
        lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);target=(lo+hi)/2
        cam.location=target+Vector((5,-6,2.2));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();inv=cam.matrix_world.inverted();bpy.context.view_layer.update();inv=cam.matrix_world.inverted();projected=[inv@p for p in pts]
        cam.data.ortho_scale=max(max(p.x for p in projected)-min(p.x for p in projected),max(p.y for p in projected)-min(p.y for p in projected))*1.15
        scene.render.filepath=os.path.join(out,f'stage-{str(t).replace(".","-")}.png');bpy.ops.render.render(write_still=True)
json.dump(report,open(os.path.join(out,'geometry-review.json'),'w'),indent=2)
failed=[x for x in report if x['surfaceIntersections']]
print('FETAL_BONE_INTERSECTIONS',failed,flush=True)
print('CHECKED_POSES',len(report),'FAILED_POSES',len(failed),flush=True)
if '--strict' in args and failed:raise RuntimeError('Authored motion intersects the pelvis; review geometry-review.json')
