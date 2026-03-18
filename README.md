# Grudge Warlords: Final Fighter

A 3D fighting game built with **Three.js** — no build tools, just a single HTML file and GLTF character models. MK/Virtua Fighter-style 2.5D combat.

**Live Demo:** [finalfighter-characterspart01.vercel.app](https://finalfighter-characterspart01.vercel.app)  
**Grudge Studio** | [Report Issues](https://github.com/MolochDaGod/FinalFighter/issues)

---

## Features

### Characters
- 12 Dynasty Warriors-style fighters with individual GLB models
- Each character has unique ATK/DEF/SPD stats affecting gameplay
- Auto-rotate preview on character select with orbit controls
- Per-character bounding boxes auto-measured from mesh geometry

### Combat System
- **11-state combat state machine** — idle, walk, punch, kick, special, block, hit-react, knockdown, getup, victory, KO
- **Hitbox/Hurtbox collision** using Three.js `Box3` (zero external dependencies)
- 3 attack types with different reach and damage:
  - **Punch** (J) — short range, fast recovery
  - **Kick** (K) — medium range, moderate recovery
  - **Special** (L) — wide reach, high damage, long cooldown
- **Hurtbox zones** — body split into upper/mid/lower thirds:
  - Upper (head): 1.25x damage
  - Mid (torso): 1.0x damage
  - Lower (legs): 0.8x damage
- **Whiff mechanic** — missed attacks still commit to a cooldown
- **Blocking** (Space) — reduces damage to 20%, blocked specials stun the attacker
- **Combo tracking** — 3+ hit combos deal 1.3x damage
- **Knockback** — scaled per attack type (special > kick > punch)
- **Procedural animations** — bob, tilt, attack wind-up/follow-through (pre-Mixamo)

### VFX
- Slash arc trails on attacks (color-coded per type)
- Impact spark particles on hit/block
- Screen shake on heavy hits

### Gamepad Support
- PS5 DualSense default mapping (works with any standard gamepad)
- Fully rebindable keyboard and gamepad controls via in-game Settings
- Bindings saved to localStorage
- D-pad and analog stick movement

### Physics & Colliders
- **Body colliders** — AABB built from each character's actual mesh dimensions
- **Body collision response** — fighters push apart on overlap, can't walk through each other
- **Per-character sizing** — colliders auto-measured from GLTF bounding box
- **Arena bounds** — fighters clamped to ±3.5 units

### AI Opponent
- Distance-based behavior: approach when far, retreat when too close
- Speed scaled by character SPD stat
- Weighted attack selection: punches > kicks > specials > blocks
- Proper cooldown and stun handling

### Technical
- Single `index.html` — no build system required
- Three.js v0.164.1 via CDN importmap
- Individual GLB models per character (with monolithic scene.gltf fallback)
- Geometry-baked world transforms (fixes Sketchfab/FBX hierarchy issues)
- Mixamo animation system ready (AnimationMixer, clip manifest, state aliases)
- Proper `requestAnimationFrame` delta timing
- Responsive canvas resizing
- Deployed on Vercel

---

## Controls

### Keyboard

| Key | Action |
|-----|--------|
| A/D or Arrow Keys | Move left/right |
| J | Punch |
| K | Kick |
| L | Special |
| Space | Block |
| Esc | Back to menu |
| ` (backtick) | Toggle debug colliders |

### Gamepad (PS5 DualSense defaults)

| Button | Action |
|--------|--------|
| Left stick / D-pad | Move |
| Square (0) | Punch |
| Cross (1) | Kick |
| Triangle (2) | Special |
| R1 (5) | Block |
| Options (9) | Back to menu |
| L1 (4) | Toggle debug |

All controls are rebindable in the **Settings** panel (gear icon).

### Debug Mode
Press **backtick** (or L1 on gamepad) during a fight to see wireframe colliders:
- **Gold/Blue** outlines = P1/P2 body colliders
- **Red/Orange/Green** = upper/mid/lower hurtbox zones
- Attack hitboxes flash **green** on hit, **red** on whiff
- State overlay shows current combat state for both fighters

---

## Setup

### Model Assets
The GLTF model assets (`scene.gltf`, `scene.bin`, `textures/`) are from the [Final Fighter Characters Part 01](https://sketchfab.com/) pack.

Expected file structure:
```
FinalFighter/
├── index.html            # Game (all code)
├── package.json          # Vercel deploy config
├── scene.gltf            # Monolithic character scene (fallback)
├── scene.bin             # Model geometry data
├── textures/             # Character textures
├── characters/           # Individual GLB models (generated)
│   ├── Model001.glb
│   ├── Model002.glb
│   └── ... (12 total)
├── tools/                # Build tools
│   └── split_characters.js  # Splits scene.gltf → individual GLBs
├── anims/                # Mixamo animation pipeline (see README inside)
├── license.txt           # Model license
└── README.md
```

### Splitting Characters (optional)
To regenerate individual GLB files from the monolithic scene:
```bash
cd tools
npm install
node split_characters.js
```
This produces 12 GLB files in `characters/`, each centered at origin with feet at Y=0.

### Running Locally
Serve with any static file server:
```bash
npx serve .
# or
python -m http.server 8000
```
Open `http://localhost:8000` (or the port shown).

> **Note:** Opening `index.html` directly (`file://`) won't work due to CORS restrictions on GLTF loading.

---

## Architecture

### Model Loading Pipeline
1. `loadAllCharacters()` parallel-loads individual GLBs from `characters/` directory
2. Falls back to monolithic `scene.gltf` if GLBs unavailable
3. `cloneCharacterModel(charId, targetHeight)` deep-clones and normalizes any character
4. Geometry baking via `applyMatrix4()` fixes Sketchfab/FBX hierarchy transforms (axis swap + 0.01 scale)

### Combat State Machine
- 11 states with defined transitions and lockout rules
- `updateFighterStateMachine()` drives both player and AI
- Procedural animation layer maps states to visual feedback
- Mixamo `AnimationMixer` integration ready — just add rigged FBX clips

### Feet-on-Ground Positioning
- `Box3.setFromObject(group)` measures the unscaled bounding box
- `group.position.y = -box.min.y * scale` offsets so the lowest vertex sits at Y=0
- Arena placement only modifies `position.x`, preserving the Y offset

### Collider System
- Uses Three.js built-in `Box3` — no external physics library needed
- `getBodyCollider(fighter)` builds AABB from measured `characterBounds`
- `getHurtboxes(fighter)` splits body into 3 vertical zones
- `getAttackHitbox(attacker, type)` extends a box from body edge in facing direction
- `resolveBodyCollision()` pushes overlapping fighters apart each frame
- `Box3.intersectsBox()` for all hit detection

---

## Mixamo Animation Pipeline
The animation system is built and ready. To add skeletal animations:
1. Upload individual GLBs from `characters/` to [Mixamo](https://www.mixamo.com/)
2. Auto-rig each character
3. Download FBX animation clips (idle, punch, kick, block, hit, knockdown, getup, victory, KO)
4. Place in `anims/` following the naming convention in `anims/README.md`
5. The game auto-maps clips via `MIXAMO_CLIP_MANIFEST` and `MIXAMO_STATE_ALIASES`

---

## Roadmap
- [x] 11-state combat system with hitbox/hurtbox collision
- [x] Gamepad support (PS5 DualSense + rebindable)
- [x] VFX (slash arcs, sparks, screen shake)
- [x] Individual GLB character loading
- [x] Mixamo animation system (code ready)
- [x] Vercel deployment
- [ ] Skeletal animations via Mixamo rigging
- [ ] 2.5D side-view camera (MK/Virtua Fighter style)
- [ ] Per-character special moves with unique hitbox shapes
- [ ] Round system (best of 3)
- [ ] Player 2 local controls
- [ ] Sound effects and hit-stop

---

## License
Game code: MIT  
Character models: See `license.txt` (Sketchfab license terms apply)
