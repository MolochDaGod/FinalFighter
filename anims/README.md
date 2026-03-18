# Mixamo Animation Pipeline — Final Fighter

## Full Rigging & Animation Workflow

### Step 1: Export Characters (body + weapon separated)
```bash
blender --background --python tools/export_for_mixamo.py
```
Produces body FBX (for Mixamo) + weapon GLB (for runtime attachment).

### Step 2: Upload body FBX to mixamo.com → auto-rig
Place skeleton markers (chin, wrists, elbows, knees, groin).

### Step 3: Download rigged T-pose as FBX ("With Skin")
Save to `tools/mixamo_rigged/<Name>_rigged.fbx`.

### Step 4: Download animations as GLB ("Without Skin", 30fps, no keyframe reduction)

**Shared (all characters):** idle, idle_combat, walk_fwd, walk_back, run_fwd, run_back, block_high, dodge_back, dodge_left, dodge_right, jump, land, crouch, hit_react_high, hit_react_mid, hit_react_low, knockdown, getup, stun, ko, victory, intro, taunt

**Sword:** slash_1, slash_2, slash_combo, thrust, overhead, special_whirlwind
**Dual Sword:** dual_slash_1, dual_slash_2, dual_cross_slash, special_storm
**Axe:** swing_1, swing_2, overhead_smash, special_ground_pound
**Fan:** fan_swipe_1, fan_swipe_2, fan_throw, special_dance
**Mace:** smash_1, smash_2, uppercut, special_slam
**Spear:** thrust_1, thrust_2, sweep, special_charge
**Unarmed:** punch_1, punch_2, kick_1, kick_2, special_combo

### Step 5: Attach weapons and export final rigged GLBs
```bash
blender --background --python tools/attach_weapons.py
```

### Step 6: Place files
- `anims/shared/*.glb` — standard animations
- `anims/weapon_<type>/*.glb` — weapon-specific combat
- `anims/<CharName>/*.glb` — character overrides

### Step 7: Update `MIXAMO_CLIP_MANIFEST` in index.html

## Mixamo Search Terms

| Clip | Search Term |
|------|------------|
| idle | "Breathing Idle" / "Fighting Idle" |
| walk_fwd | "Walking" |
| walk_back | "Walking Backward" |
| run_fwd | "Running" / "Jogging" |
| block_high | "Blocking" |
| dodge_back | "Dodge" / "Quick Step" |
| hit_react | "Head Hit" / "Hit Reaction" |
| knockdown | "Getting Knocked Down" |
| getup | "Getting Up" / "Kip Up" |
| stun | "Stunned" / "Dizzy" |
| ko | "Death From Front" |
| victory | "Victory" / "Celebrate" |
| slash_1 | "Sword Slash" |
| slash_combo | "Sword Combo" |
| swing_1 | "Great Sword Slash" |
| overhead_smash | "Overhead Attack" |
| punch_1 | "Jab" / "Cross Punch" |
| kick_1 | "Roundhouse Kick" |

## Animation Resolution Order
1. `shared` — base for all characters
2. `weaponType` — weapon-specific overrides
3. `perCharacter` — unique character overrides (highest priority)
