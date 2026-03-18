# Mixamo Animation Pipeline — Final Fighter

## Directory Structure

```
anims/
├── shared/          ← Animations that work for ALL characters (same skeleton)
│   ├── idle.glb
│   ├── walk_fwd.glb
│   ├── walk_back.glb
│   ├── punch.glb
│   ├── kick.glb
│   ├── special.glb
│   ├── block.glb
│   ├── hit_react.glb
│   ├── knockdown.glb
│   ├── ko.glb
│   └── victory.glb
├── CaoPi/           ← Character-specific overrides (optional)
│   └── special.glb  ← Overrides shared/special.glb for this character
├── CaoZijian/
├── DianWei/
├── ...
└── LuMeng/
```

## Step-by-Step Workflow

### 1. Export Characters for Mixamo

Run the Blender batch export script:

```bash
blender --background --python tools/export_for_mixamo.py
```

This produces 12 FBX files in `tools/mixamo_exports/`.

### 2. Upload to Mixamo

1. Go to [mixamo.com](https://www.mixamo.com) and sign in
2. Click **Upload Character** → select one FBX file (e.g. `CaoPi.fbx`)
3. Place the auto-rig markers (chin, wrists, elbows, knees, groin)
4. Click **Next** → Mixamo auto-rigs the character

### 3. Download Animations

For each animation needed, search Mixamo's library and download:

| State       | Suggested Mixamo Search     | Format  |
|-------------|----------------------------|---------|
| idle        | "Idle" or "Breathing Idle"  | GLB     |
| walk_fwd    | "Walking"                   | GLB     |
| walk_back   | "Walking Backward"          | GLB     |
| punch       | "Jab" or "Cross Punch"      | GLB     |
| kick        | "Roundhouse Kick"           | GLB     |
| special     | "Sword Slash" or "Spell"    | GLB     |
| block       | "Blocking"                  | GLB     |
| hit_react   | "Hit Reaction"              | GLB     |
| knockdown   | "Falling Down"              | GLB     |
| ko          | "Death"                     | GLB     |
| victory     | "Victory" or "Celebrate"    | GLB     |

**Download settings:**
- Format: **GLB** (for web, works directly with Three.js GLTFLoader)
- Skin: **Without Skin** for shared anims (animation data only, smaller files)
- Skin: **With Skin** if you want per-character rigged models
- Frames per second: **30**
- Keyframe reduction: **none** (for best quality)

### 4. Place Files

- Shared animations → `anims/shared/idle.glb`, `anims/shared/punch.glb`, etc.
- Character-specific overrides → `anims/CaoPi/special.glb`, etc.

### 5. Update the Manifest

In `index.html`, find `MIXAMO_CLIP_MANIFEST` and update:

```js
const MIXAMO_CLIP_MANIFEST = {
  shared: {
    idle: './anims/shared/idle.glb',
    walk_fwd: './anims/shared/walk_fwd.glb',
    walk_back: './anims/shared/walk_back.glb',
    punch: './anims/shared/punch.glb',
    kick: './anims/shared/kick.glb',
    special: './anims/shared/special.glb',
    block: './anims/shared/block.glb',
    hit_react: './anims/shared/hit_react.glb',
    knockdown: './anims/shared/knockdown.glb',
    ko: './anims/shared/ko.glb',
    victory: './anims/shared/victory.glb',
  },
  perCharacter: {
    Model001: { special: './anims/CaoPi/special.glb' },
    // ... add per-character overrides as needed
  },
};
```

The animation system auto-loads, maps clip names to combat states, and cross-fades between them. When clips are present, procedural fallback animations are automatically disabled.

## Troubleshooting

- **Model too small in Mixamo:** Re-run export with different scale in Blender
- **Mixamo can't auto-rig:** Model may have too many disconnected parts — check the FBX in Blender first
- **Animation plays wrong:** Check clip name mapping in `MIXAMO_STATE_ALIASES`
- **Animation doesn't blend:** Ensure all clips share the same skeleton hierarchy
