"""Extract the outer female pelvic bones from the HRA v1.5 GLB.

Run with Blender --background --python scripts/extract_pelvis.py -- SOURCE OUTPUT.
The source is CC BY 4.0; see licenses/HRA-CC-BY-4.0.md.
"""
import bpy, sys, os
from mathutils import Vector

source, destination = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
names = ['VH_F_sacrum','VH_F_coccyx'] + [f'VH_F_{bone}_compact_bone_{side}' for bone in ['pubis','ilium','ischium'] for side in ['L','R']]
kept = [o for o in bpy.data.objects if o.type == 'MESH' and o.name in names]
assert len(kept) == 8, [o.name for o in kept]
for obj in kept:
    obj.data.transform(obj.matrix_world)
    obj.parent = None
    obj.matrix_world.identity()
for obj in list(bpy.data.objects):
    if obj not in kept:
        bpy.data.objects.remove(obj, do_unlink=True)
def center(obj):
    return sum((v.co for v in obj.data.vertices),Vector())/len(obj.data.vertices)
for obj in kept:
    print('BONE',obj.name,'CENTER',list(center(obj)),'VERTICES',len(obj.data.vertices),flush=True)
points=[v.co.copy() for o in kept for v in o.data.vertices]
lo=Vector([min(p[i] for p in points) for i in range(3)])
hi=Vector([max(p[i] for p in points) for i in range(3)])
print('BOUNDS',list(lo),list(hi),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=destination)
