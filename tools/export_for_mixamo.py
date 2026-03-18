"""
Blender batch export – Final Fighter → Mixamo pipeline (weapon-aware)
=====================================================================
Separates each character into BODY and WEAPON meshes:
  1. Body-only FBX  → tools/mixamo_exports/<Name>_body.fbx
  2. Weapon-only GLB → characters/weapons/<ModelId>_weapon.glb

Body FBX excludes weapons so Mixamo auto-rigger sees a clean humanoid.
Weapon GLBs are centered at grip point for runtime bone parenting.

Usage:  blender --background --python tools/export_for_mixamo.py
Requires Blender 3.x+ with built-in glTF importer.
"""

import bpy, os, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
GLTF_PATH = os.path.join(PROJECT_DIR, "scene.gltf")
EXPORT_DIR = os.path.join(SCRIPT_DIR, "mixamo_exports")
WEAPON_DIR = os.path.join(PROJECT_DIR, "characters", "weapons")

WEAPON_KEYWORDS = ["weapon", "sword", "wing"]

CHARACTERS = [
    {"prefix": "Model001", "name": "CaoPi",        "weaponHints": ["caopi-R-weapon"]},
    {"prefix": "Model002", "name": "CaoZijian",     "weaponHints": []},
    {"prefix": "Model003", "name": "DianWei",       "weaponHints": ["DW-weapon"]},
    {"prefix": "Model004", "name": "DiaoChan",      "weaponHints": ["DC-weapon"]},
    {"prefix": "Model005", "name": "DongZhuo",      "weaponHints": ["dongzhuo-weapon"]},
    {"prefix": "Model006", "name": "GuoJia",        "weaponHints": []},
    {"prefix": "Model007", "name": "HuangGai",      "weaponHints": []},
    {"prefix": "Model008", "name": "HuangYueying",  "weaponHints": ["yingwu-wing"]},
    {"prefix": "Model009", "name": "XuKui",         "weaponHints": []},
    {"prefix": "Model010", "name": "LiuBei",        "weaponHints": ["liubei-m-weapon", "liubei-weapon"]},
    {"prefix": "Model011", "name": "LuBu",          "weaponHints": []},
    {"prefix": "Model012", "name": "LuMeng",        "weaponHints": ["LM-sword"]},
]


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0: bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0: bpy.data.materials.remove(block)


def import_gltf(path):
    print(f"[EXPORT] Importing {path}")
    bpy.ops.import_scene.gltf(filepath=path)


def is_weapon_mesh(name, hints):
    lower = name.lower()
    for h in hints:
        if h.lower() in lower: return True
    for kw in WEAPON_KEYWORDS:
        if kw in lower: return True
    return False


def collect_meshes(prefix):
    return [o for o in bpy.data.objects if o.type == 'MESH' and prefix in o.name]


def join_meshes(objs):
    if not objs: return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1: bpy.ops.object.join()
    return bpy.context.active_object


def center_and_ground(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    import mathutils
    bbox = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    xs, ys, zs = [v.x for v in bbox], [v.y for v in bbox], [v.z for v in bbox]
    obj.location.x -= (min(xs) + max(xs)) / 2
    obj.location.y -= min(ys)
    obj.location.z -= (min(zs) + max(zs)) / 2
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def export_fbx(obj, path):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.fbx(
        filepath=path, use_selection=True,
        apply_scale_options='FBX_SCALE_ALL',
        axis_forward='-Z', axis_up='Y',
        mesh_smooth_type='FACE', use_mesh_modifiers=True,
        add_leaf_bones=False,
    )
    print(f"  → Body FBX: {path}")


def export_glb(obj, path):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB',
        use_selection=True, export_apply=True,
    )
    print(f"  → Weapon GLB: {path}")


def delete_objects(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.ops.object.delete(use_global=False)


def main():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    os.makedirs(WEAPON_DIR, exist_ok=True)

    if not os.path.isfile(GLTF_PATH):
        print(f"[ERROR] scene.gltf not found at {GLTF_PATH}")
        sys.exit(1)

    wpn_count = 0
    for char in CHARACTERS:
        print(f"\n{'='*50}")
        print(f"[EXPORT] {char['name']} ({char['prefix']})")

        clear_scene()
        import_gltf(GLTF_PATH)

        meshes = collect_meshes(char["prefix"])
        if not meshes:
            print(f"  [WARN] No meshes — skipping")
            continue

        # Delete non-matching objects
        bpy.ops.object.select_all(action='DESELECT')
        for o in list(bpy.data.objects):
            if o not in meshes: o.select_set(True)
        bpy.ops.object.delete(use_global=False)

        # Split body vs weapon
        body, weapons = [], []
        for m in meshes:
            (weapons if is_weapon_mesh(m.name, char["weaponHints"]) else body).append(m)
        print(f"  Body: {len(body)}, Weapon: {len(weapons)}")

        # Export weapon GLB
        if weapons:
            wj = join_meshes(weapons)
            if wj:
                wj.name = f"{char['prefix']}_weapon"
                center_and_ground(wj)
                export_glb(wj, os.path.join(WEAPON_DIR, f"{char['prefix']}_weapon.glb"))
                wpn_count += 1
                delete_objects([wj])
            body = [o for o in bpy.data.objects if o.type == 'MESH' and char["prefix"] in o.name]

        # Export body FBX
        if body:
            bj = join_meshes(body)
            if bj:
                bj.name = char["name"]
                center_and_ground(bj)
                export_fbx(bj, os.path.join(EXPORT_DIR, f"{char['name']}_body.fbx"))

    print(f"\n{'='*50}")
    print(f"[DONE] Body FBXs: {EXPORT_DIR}")
    print(f"       Weapon GLBs: {WEAPON_DIR} ({wpn_count})")
    print(f"\nNext: Upload *_body.fbx to mixamo.com → auto-rig → download animations")


if __name__ == "__main__":
    main()
