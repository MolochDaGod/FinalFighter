"""
Blender batch export script – Final Fighter → Mixamo pipeline
=============================================================
Opens the main scene.gltf, isolates each of the 12 characters,
joins their mesh parts into a single mesh, and exports individual
FBX files that Mixamo can auto-rig.

Usage (from a terminal):
  blender --background --python tools/export_for_mixamo.py

Requires Blender 3.x+ with the built-in glTF importer.
Output goes to: tools/mixamo_exports/<CharName>.fbx
"""

import bpy
import os
import sys

# ── Configuration ────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
GLTF_PATH = os.path.join(PROJECT_DIR, "scene.gltf")
EXPORT_DIR = os.path.join(SCRIPT_DIR, "mixamo_exports")

CHARACTERS = [
    {"prefix": "Model001", "name": "CaoPi"},
    {"prefix": "Model002", "name": "CaoZijian"},
    {"prefix": "Model003", "name": "DianWei"},
    {"prefix": "Model004", "name": "DiaoChan"},
    {"prefix": "Model005", "name": "DongZhuo"},
    {"prefix": "Model006", "name": "GuoJia"},
    {"prefix": "Model007", "name": "HuangGai"},
    {"prefix": "Model008", "name": "HuangYueying"},
    {"prefix": "Model009", "name": "XuKui"},
    {"prefix": "Model010", "name": "LiuBei"},
    {"prefix": "Model011", "name": "LuBu"},
    {"prefix": "Model012", "name": "LuMeng"},
]

# ── Helpers ──────────────────────────────────────────────────────────
def clear_scene():
    """Delete everything in the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Purge orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def import_gltf(path):
    """Import the main scene.gltf."""
    print(f"[MIXAMO EXPORT] Importing {path}")
    bpy.ops.import_scene.gltf(filepath=path)


def collect_meshes_for_prefix(prefix):
    """Return a list of mesh objects whose name contains `prefix`."""
    return [
        obj for obj in bpy.data.objects
        if obj.type == 'MESH' and prefix in obj.name
    ]


def join_meshes(mesh_objects):
    """
    Join multiple mesh objects into one, applying transforms first.
    Returns the single joined object.
    """
    if not mesh_objects:
        return None

    # Deselect all
    bpy.ops.object.select_all(action='DESELECT')

    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]

    # Apply all transforms so the merge is in world space
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Join into one object
    if len(mesh_objects) > 1:
        bpy.ops.object.join()

    joined = bpy.context.active_object
    return joined


def center_and_ground(obj):
    """
    Move the object so it is centered on X/Z and feet (min Y) sit at Y=0.
    This is what Mixamo expects: character standing at origin.
    """
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # Compute bounding box in world space
    import mathutils
    bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]

    xs = [v.x for v in bbox]
    ys = [v.y for v in bbox]
    zs = [v.z for v in bbox]

    center_x = (min(xs) + max(xs)) / 2
    min_y = min(ys)
    center_z = (min(zs) + max(zs)) / 2

    obj.location.x -= center_x
    obj.location.y -= min_y
    obj.location.z -= center_z

    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def export_fbx(obj, filepath):
    """Export a single object as FBX."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.export_scene.fbx(
        filepath=filepath,
        use_selection=True,
        apply_scale_options='FBX_SCALE_ALL',
        axis_forward='-Z',
        axis_up='Y',
        mesh_smooth_type='FACE',
        use_mesh_modifiers=True,
        add_leaf_bones=False,
    )
    print(f"[MIXAMO EXPORT] Exported → {filepath}")


# ── Main ─────────────────────────────────────────────────────────────
def main():
    os.makedirs(EXPORT_DIR, exist_ok=True)

    if not os.path.isfile(GLTF_PATH):
        print(f"[ERROR] scene.gltf not found at {GLTF_PATH}")
        sys.exit(1)

    for char in CHARACTERS:
        print(f"\n{'='*60}")
        print(f"[MIXAMO EXPORT] Processing {char['name']} ({char['prefix']})")
        print(f"{'='*60}")

        # Start fresh
        clear_scene()
        import_gltf(GLTF_PATH)

        # Collect this character's mesh parts
        meshes = collect_meshes_for_prefix(char["prefix"])
        if not meshes:
            print(f"[WARN] No meshes found for {char['prefix']} — skipping")
            continue

        print(f"  Found {len(meshes)} mesh parts")

        # Delete everything else (non-matching objects)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in list(bpy.data.objects):
            if obj not in meshes:
                obj.select_set(True)
        bpy.ops.object.delete(use_global=False)

        # Join into single mesh
        joined = join_meshes(meshes)
        if not joined:
            print(f"[WARN] Join failed for {char['prefix']} — skipping")
            continue

        joined.name = char["name"]

        # Center at origin, feet on ground
        center_and_ground(joined)

        # Export FBX
        fbx_path = os.path.join(EXPORT_DIR, f"{char['name']}.fbx")
        export_fbx(joined, fbx_path)

    print(f"\n{'='*60}")
    print(f"[MIXAMO EXPORT] Done! {len(CHARACTERS)} characters exported to:")
    print(f"  {EXPORT_DIR}")
    print(f"{'='*60}")
    print(f"\nNext steps:")
    print(f"  1. Go to https://www.mixamo.com")
    print(f"  2. Upload each FBX file")
    print(f"  3. Let Mixamo auto-rig (place markers on skeleton)")
    print(f"  4. Download animations as GLB (\"Without Skin\" for shared anims)")
    print(f"  5. Place GLB files in anims/shared/ or anims/<CharName>/")


if __name__ == "__main__":
    main()
