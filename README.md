# Grudge Warlords: Final Fighter

A 3D fighting game built with **Three.js** — no build tools, no npm, just a single HTML file and GLTF character models.

**Grudge Studio** | [Report Issues](https://github.com/MolochDaGod/FinalFighter/issues)

---

## Features

### Characters
- 12 Dynasty Warriors-style fighters loaded from a single GLTF scene
- Each character has unique ATK/DEF/SPD stats affecting gameplay
- Auto-rotate preview on character select with orbit controls

### Combat System
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

### Physics & Colliders
- **Body colliders** — AABB built from each character's actual mesh dimensions
- **Body collision response** — fighters push apart on overlap, can't walk through each other
- **Per-character sizing** — colliders auto-measured from GLTF bounding box (larger characters get wider colliders)
- **Arena bounds** — fighters clamped to ±3.5 units

### AI Opponent
- Distance-based behavior: approach when far, retreat when too close
- Speed scaled by character SPD stat
- Weighted attack selection: punches > kicks > specials > blocks
- Proper cooldown and stun handling

### Technical
- Single `index.html` — no build system, no npm
- Three.js v0.164.1 via CDN importmap
- GLTF models with baked world transforms (fixes Sketchfab hierarchy issues)
- Proper `requestAnimationFrame` delta timing
- Responsive canvas resizing

---

## Controls

| Key | Action |
|-----|--------|
| A/D or Arrow Keys | Move left/right |
| J | Punch |
| K | Kick |
| L | Special |
| Space | Block |
| Esc | Back to menu |
| ` (backtick) | Toggle debug colliders |

### Debug Mode
Press **backtick** during a fight to see wireframe colliders:
- **Gold/Blue** outlines = P1/P2 body colliders
- **Red/Orange/Green** = upper/mid/lower hurtbox zones
- Attack hitboxes flash **green** on hit, **red** on whiff

---

## Setup

### Model Assets
This repo contains the game code. The GLTF model assets (`scene.gltf`, `scene.bin`, `textures/`) are from the [Final Fighter Characters Part 01](https://sketchfab.com/) pack and must be placed in the same directory as `index.html`.

Expected file structure:
```
FinalFighter/
├── index.html          # Game (all code)
├── scene.gltf          # Character model scene
├── scene.bin           # Model geometry data
├── textures/           # Character textures
│   ├── *_baseColor.png
│   └── *_normal.png
├── license.txt         # Model license
└── README.md
```

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
1. GLTFLoader loads `scene.gltf` (Sketchfab export)
2. `parseCharacters()` traverses the scene, collecting only `isMesh` nodes (avoids duplicate group+mesh collection)
3. `gltfScene.updateMatrixWorld(true)` ensures parent transforms are computed
4. When cloning for preview/battle, `mesh.matrixWorld.decompose()` bakes the full hierarchy transform (display.fbx 0.01 scale + axis swap, Sketchfab_model rotation) into each clone

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

## Roadmap
- [ ] Skeletal animations (idle, punch, kick, block, hit-react) via Mixamo
- [ ] Per-character special moves with unique hitbox shapes
- [ ] Round system (best of 3)
- [ ] Player 2 local controls
- [ ] Sound effects and hit-stop
- [ ] Vercel deployment

---

## License
Game code: MIT
Character models: See `license.txt` (Sketchfab license terms apply)
