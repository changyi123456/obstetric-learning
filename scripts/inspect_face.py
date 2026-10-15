import bpy,sys,os
from mathutils import Vector
root=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=os.path.join(root,'assets-source/fetal-position-assembly.blend'))
for o in bpy.data.objects:
    if o.name.startswith('VH_F_'):o.hide_render=True
scene=bpy.context.scene;cam=scene.camera;cam.data.ortho_scale=1.22
for name,loc in [('face-front',(0,6,.38)),('face-oblique',(3,6,.6))]:
    cam.location=loc;cam.rotation_euler=(Vector((0,.04,.30))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(root,'docs',name+'.png');bpy.ops.render.render(write_still=True)
