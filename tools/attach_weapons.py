"""
Blender weapon attachment script – Final Fighter
=================================================
Takes a Mixamo-rigged character FBX + weapon GLB,
parents the weapon to the hand bone, and exports
the final rigged character as GLB.

Usage:
  blender --background --python tools/attach_weapons.py

Input:  tools/mixamo_rigged/<Name>_rigged.fbx  (from Mixamo)
        characters/weapons/<ModelId>_weapon.glb (from export_for_mixamo.py)
Output: characters/<ModelId>_rigged.glb         (ready for game)

Requires Blender 3.x+.
"""

import bpy, os, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
RIGGED_DIR = os.path.join(SCRIPT_DIR, "mixamo_rigged")
WEAPON_DIR = os.path.join(PROJECT_DIR, "characters", "weapons")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "characters")

CHARACTERS = [
    {"prefix": "Model001", "name": "CaoPi",        "hand": "mixamorigRightHand"},
    {"prefix": "Model002", "name": "CaoZijian",     "hand": "mixamorigRightHand"},
    {"prefix": "Model003", "name": "DianWei",       "hand": "mixamorigRightHand"},
    {"prefix": "Model004", "name": "DiaoChan",      "hand": "mixamorigRightHand"},
    {"prefix": "Model005", "name": "DongZhuo",      "hand": "mixamorigRightHand"},
    {"prefix": "Model006", "name": "GuoJia",        "hand": "mixamorigRightHand"},
    {"prefix": "Model007", "name": "HuangGai",      "hand": None},  # unarmed
    {"prefix": "Model008", "name": "HuangYueying",  "hand": "mixamorigRightHand"},
    {"prefix": "Model009", "name": "XuKui",         "hand": "mixamorigRightHand"},
    {"prefix": "Model010", "name": "LiuBei",        "hand": "mixamorigRightHand"},
    {"prefix": "Model011", "name": "LuBu",          "hand": "mixamorigRightHand"},
    {"prefix": "Model012", "name": "LuMeng",        "hand": "mixamorigRightHand"},
]


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for b in bpy.data.meshes:
        if b.users == 0: bpy.data.meshes.remove(b)
    for b in bpy.data.materials:
        if b.users == 0: bpy.data.materials.remove(b)
    for b in bpy.data.armatures:
        if b.users == 0: bpy.data.armatures.remove(b)


def find_bone(armature, bone_name):
    """Find a bone by name in an armature."""
    if armature and armature.type == 'ARMATURE':
        return armature.pose.bones.get(bone_name)
    return None


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    count = 0
    for char in CHARACTERS:
        rigged_fbx = os.path.join(RIGGED_DIR, f"{char['name']}_rigged.fbx")
        weapon_glb = os.path.join(WEAPON_DIR, f"{char['prefix']}_weapon.glb")
        output_glb = os.path.join(OUTPUT_DIR, f"{char['prefix']}_rigged.glb")

        if not os.path.isfile(rigged_fbx):
            print(f"[SKIP] No rigged FBX for {char['name']}: {rigged_fbx}")
            continue

        print(f"\n{'='*50}")
        print(f"[ATTACH] {char['name']}")

        clear_scene()

        # Import rigged character
        bpy.ops.import_scene.fbx(filepath=rigged_fbx)
        print(f"  Imported rigged FBX")

        # Find armature
        armature = None
        for obj in bpy.data.objects:
            if obj.type == 'ARMATURE':
                armature = obj
                break

        if not armature:
            print(f"  [WARN] No armature found — exporting without weapon")
        elif char["hand"] and os.path.isfile(weapon_glb):
            # Import weapon
            bpy.ops.import_scene.gltf(filepath=weapon_glb)
            print(f"  Imported weapon GLB")

            # Find weapon mesh (most recently imported object)
            weapon_objs = [o for o in bpy.data.objects
                          if o.type == 'MESH' and 'weapon' in o.name.lower()]

            if weapon_objs:
                # Join weapon parts if multiple
                if len(weapon_objs) > 1:
                    bpy.ops.object.select_all(action='DESELECT')
                    for o in weapon_objs: o.select_set(True)
                    bpy.context.view_layer.objects.active = weapon_objs[0]
                    bpy.ops.object.join()
                    weapon = bpy.context.active_object
                else:
                    weapon = weapon_objs[0]

                # Parent weapon to hand bone
                bone = find_bone(armature, char["hand"])
                if bone:
                    weapon.parent = armature
                    weapon.parent_type = 'BONE'
                    weapon.parent_bone = char["hand"]
                    # Reset weapon transform relative to bone
                    weapon.location = (0, 0, 0)
                    weapon.rotation_euler = (0, 0, 0)
                    print(f"  Parented weapon to {char['hand']}")
                else:
                    print(f"  [WARN] Bone '{char['hand']}' not found")
            else:
                print(f"  [WARN] No weapon meshes found after import")
        else:
            print(f"  No weapon to attach")

        # Select all and export as GLB
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(
            filepath=output_glb,
            export_format='GLB',
            use_selection=True,
            export_apply=False,  # preserve armature
            export_animations=True,
            export_skins=True,
        )
        print(f"  → {output_glb}")
        count += 1

    print(f"\n{'='*50}")
    print(f"[DONE] Exported {count} rigged characters to {OUTPUT_DIR}")
    print(f"\nWorkflow complete! Characters are ready for the game.")
    print(f"Update CHARACTERS array glb paths to use *_rigged.glb files.")


if __name__ == "__main__":
    main()
