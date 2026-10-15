import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.wm.stl_import(filepath='/private/tmp/obstetric-assets/pelvis-source.stl')
o=bpy.context.object
lo=Vector([min(v.co[i] for v in o.data.vertices) for i in range(3)])
hi=Vector([max(v.co[i] for v in o.data.vertices) for i in range(3)])
c=(lo+hi)/2;s=2.6/(hi.y-lo.y)
for v in o.data.vertices:
    old=v.co.copy();v.co=((old.y-c.y)*s,(old.x-c.x)*s,(old.z-lo.z)*s)
mod=o.modifiers.new('Web simplification','DECIMATE');mod.ratio=.025;bpy.ops.object.modifier_apply(modifier=mod.name)
for poly in o.data.polygons:poly.use_smooth=True
print('DECIMATED',len(o.data.polygons),'DIMS',list(o.dimensions),flush=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='SINGLE';scene.display.shading.single_color=(.76,.66,.48)
scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
scene.display.shading.background_type='WORLD';scene.world.color=(.85,.9,.93)
scene.render.resolution_x=800;scene.render.resolution_y=700;scene.render.resolution_percentage=100
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.5
for name,pos in [('front',(0,-5,2)),('back',(0,5,2)),('top',(0,-.001,5))]:
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath='/private/tmp/obstetric-assets/pelvis-'+name+'.png';bpy.ops.render.render(write_still=True)
