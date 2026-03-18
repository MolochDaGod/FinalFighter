/**
 * split_characters.js
 * Reads scene.gltf, extracts each character (Model001-012) into
 * standalone, origin-centered GLB files ready for Mixamo upload.
 *
 * Output per character:
 *   characters/Model00X.glb          — combined (body + weapons) for the game
 *   characters/Model00X_body.glb     — body only (upload to Mixamo for auto-rig)
 *   characters/Model00X_weapons.glb  — weapons only (attach to hand bone post-rig)
 *
 * Usage: node tools/split_characters.js
 */

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GLTF_PATH = path.join(ROOT, 'scene.gltf');
const OUT_DIR = path.join(ROOT, 'characters');

const CHARACTERS = [
  { id: 'Model001', name: 'CaoPi' },
  { id: 'Model002', name: 'CaoZijian' },
  { id: 'Model003', name: 'DianWei' },
  { id: 'Model004', name: 'DiaoChan' },
  { id: 'Model005', name: 'DongZhuo' },
  { id: 'Model006', name: 'GuoJia' },
  { id: 'Model007', name: 'HuangGai' },
  { id: 'Model008', name: 'HuangYueying' },
  { id: 'Model009', name: 'XuKui' },
  { id: 'Model010', name: 'LiuBei' },
  { id: 'Model011', name: 'LuBu' },
  { id: 'Model012', name: 'LuMeng' },
];

// Override map: node name substring → target character id.
// Fixes meshes mislabeled under the wrong ModelXXX group in the source file.
// e.g. Dian Wei's shorts mesh is named under Model002 but belongs to Model003.
const MESH_OVERRIDES = {
  '0010_Model002_7_+0004-hair-1': 'Model003',  // DW shorts, not CZ hair
  '0078_Model011_6_0003-LB-body': 'Model012',  // LuMeng body, not LuBu
  '0036_Model005_6_+dongzhuo-weaponmetal-2': 'Model006',  // GuoJia sword, not DongZhuo
};

// Keywords that identify weapon/accessory meshes (case-insensitive)
const WEAPON_KEYWORDS = ['weapon', 'sword'];

function isWeaponNode(node) {
  const name = (node.getName() || '').toLowerCase();
  return WEAPON_KEYWORDS.some(kw => name.includes(kw));
}

/**
 * Copies a set of source nodes into a new GLB, centered at origin.
 * Returns { sizeKB, count } or null if srcNodes is empty.
 */
async function buildGLB(srcNodes, charId, sceneName, io, outPath) {
  if (srcNodes.length === 0) return null;

  const doc = new Document();
  const buf = doc.createBuffer();
  const scene = doc.createScene(sceneName);
  const root = doc.createNode(charId);
  scene.addChild(root);

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  const copiedNodes = [];

  for (const srcNode of srcNodes) {
    const srcMesh = srcNode.getMesh();
    if (!srcMesh) continue;

    const newNode = doc.createNode(srcNode.getName());
    const newMesh = doc.createMesh(srcMesh.getName());

    for (const srcPrim of srcMesh.listPrimitives()) {
      const newPrim = doc.createPrimitive();

      for (const semantic of srcPrim.listSemantics()) {
        const srcAcc = srcPrim.getAttribute(semantic);
        if (!srcAcc) continue;
        const newAcc = doc.createAccessor(srcAcc.getName())
          .setType(srcAcc.getType())
          .setBuffer(buf)
          .setArray(srcAcc.getArray().slice());
        newPrim.setAttribute(semantic, newAcc);

        if (semantic === 'POSITION') {
          const arr = newAcc.getArray();
          for (let i = 0; i < arr.length; i += 3) {
            minX = Math.min(minX, arr[i]);     maxX = Math.max(maxX, arr[i]);
            minY = Math.min(minY, arr[i + 1]); maxY = Math.max(maxY, arr[i + 1]);
            minZ = Math.min(minZ, arr[i + 2]); maxZ = Math.max(maxZ, arr[i + 2]);
          }
        }
      }

      const srcIndices = srcPrim.getIndices();
      if (srcIndices) {
        const newIndices = doc.createAccessor(srcIndices.getName())
          .setType(srcIndices.getType())
          .setBuffer(buf)
          .setArray(srcIndices.getArray().slice());
        newPrim.setIndices(newIndices);
      }

      const srcMat = srcPrim.getMaterial();
      if (srcMat) {
        const newMat = doc.createMaterial(srcMat.getName())
          .setBaseColorFactor(srcMat.getBaseColorFactor())
          .setMetallicFactor(srcMat.getMetallicFactor())
          .setRoughnessFactor(srcMat.getRoughnessFactor())
          .setDoubleSided(srcMat.getDoubleSided())
          .setAlphaMode(srcMat.getAlphaMode());

        const bcTex = srcMat.getBaseColorTexture();
        if (bcTex) {
          const newTex = doc.createTexture(bcTex.getName())
            .setImage(bcTex.getImage())
            .setMimeType(bcTex.getMimeType());
          newMat.setBaseColorTexture(newTex);
        }

        const nTex = srcMat.getNormalTexture();
        if (nTex) {
          const newNTex = doc.createTexture(nTex.getName())
            .setImage(nTex.getImage())
            .setMimeType(nTex.getMimeType());
          newMat.setNormalTexture(newNTex);
          newMat.setNormalScale(srcMat.getNormalScale());
        }

        newPrim.setMaterial(newMat);
      }

      newMesh.addPrimitive(newPrim);
    }

    newNode.setMesh(newMesh);
    root.addChild(newNode);
    copiedNodes.push(newNode);
  }

  // Center at origin: feet at Y=0
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  for (const node of copiedNodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const posAcc = prim.getAttribute('POSITION');
      if (!posAcc) continue;
      const arr = posAcc.getArray();
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] -= cx;
        arr[i + 1] -= minY;
        arr[i + 2] -= cz;
      }
    }
  }

  await io.write(outPath, doc);
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(0);
  return { count: srcNodes.length, sizeKB };
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const srcDoc = await io.read(GLTF_PATH);
  const srcRoot = srcDoc.getRoot();

  console.log(`Loaded scene.gltf — ${srcRoot.listMeshes().length} meshes, ${srcRoot.listNodes().length} nodes`);

  for (const char of CHARACTERS) {
    // Collect matching mesh nodes from source
    const matchingNodes = srcRoot.listNodes().filter(node => {
      const name = node.getName() || '';
      if (!node.getMesh()) return false;

      // Check if this node has an override directing it to a different character
      for (const [pattern, targetId] of Object.entries(MESH_OVERRIDES)) {
        if (name.includes(pattern)) {
          return targetId === char.id;
        }
      }

      return name.includes(char.id);
    });

    if (matchingNodes.length === 0) {
      console.warn(`  ${char.id} (${char.name}): no meshes found, skipping`);
      continue;
    }

    // Classify nodes as body or weapon
    const bodyNodes = matchingNodes.filter(n => !isWeaponNode(n));
    const weaponNodes = matchingNodes.filter(n => isWeaponNode(n));

    // 1. Combined GLB (for the game)
    const combined = await buildGLB(
      matchingNodes, char.id, char.name, io,
      path.join(OUT_DIR, `${char.id}.glb`)
    );
    let line = `  ${char.id} (${char.name}): ${combined.count} meshes → ${char.id}.glb (${combined.sizeKB} KB)`;

    // 2. Body-only GLB (for Mixamo upload — no weapon geometry to confuse auto-rigger)
    if (bodyNodes.length > 0 && weaponNodes.length > 0) {
      const body = await buildGLB(
        bodyNodes, char.id, char.name + '_body', io,
        path.join(OUT_DIR, `${char.id}_body.glb`)
      );
      line += ` | body: ${body.count} meshes (${body.sizeKB} KB)`;

      // 3. Weapons-only GLB (attach to hand bone after Mixamo rig)
      const weapons = await buildGLB(
        weaponNodes, char.id, char.name + '_weapons', io,
        path.join(OUT_DIR, `${char.id}_weapons.glb`)
      );
      line += ` | weapons: ${weapons.count} meshes (${weapons.sizeKB} KB)`;
    } else {
      line += weaponNodes.length === 0 ? ' (no weapons detected)' : ' (all weapon meshes)';
    }

    console.log(line);
  }

  console.log('\nDone! Characters exported to characters/ directory.');
  console.log('Workflow:');
  console.log('  1. Upload *_body.glb files to mixamo.com for auto-rigging');
  console.log('  2. Download rigged FBX/GLB with desired animations');
  console.log('  3. Attach *_weapons.glb meshes to the hand bone in the rigged model');
  console.log('  4. Game loads combined *.glb files as before');
}

main().catch(err => { console.error(err); process.exit(1); });
