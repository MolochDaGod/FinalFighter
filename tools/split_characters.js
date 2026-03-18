/**
 * split_characters.js
 * Reads scene.gltf, extracts each character (Model001-012) into a
 * standalone, origin-centered GLB file ready for Mixamo upload.
 *
 * Usage: node tools/split_characters.js
 * Output: characters/Model001.glb … characters/Model012.glb
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

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const srcDoc = await io.read(GLTF_PATH);
  const srcRoot = srcDoc.getRoot();

  console.log(`Loaded scene.gltf — ${srcRoot.listMeshes().length} meshes, ${srcRoot.listNodes().length} nodes`);

  for (const char of CHARACTERS) {
    const charDoc = new Document();
    const charBuffer = charDoc.createBuffer();
    const charScene = charDoc.createScene(char.name);
    const charRoot = charDoc.createNode(char.id);
    charScene.addChild(charRoot);

    // Collect matching mesh nodes from source
    const matchingNodes = srcRoot.listNodes().filter(node => {
      const name = node.getName() || '';
      return name.includes(char.id) && node.getMesh();
    });

    if (matchingNodes.length === 0) {
      console.warn(`  ${char.id} (${char.name}): no meshes found, skipping`);
      continue;
    }

    // Copy meshes and materials into the new document
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    const copiedNodes = [];

    for (const srcNode of matchingNodes) {
      const srcMesh = srcNode.getMesh();
      if (!srcMesh) continue;

      // Deep copy mesh + primitives + materials + textures
      const newNode = charDoc.createNode(srcNode.getName());
      const newMesh = charDoc.createMesh(srcMesh.getName());

      for (const srcPrim of srcMesh.listPrimitives()) {
        const newPrim = charDoc.createPrimitive();

        // Copy attributes
        for (const semantic of srcPrim.listSemantics()) {
          const srcAcc = srcPrim.getAttribute(semantic);
          if (!srcAcc) continue;
          const newAcc = charDoc.createAccessor(srcAcc.getName())
            .setType(srcAcc.getType())
            .setBuffer(charBuffer)
            .setArray(srcAcc.getArray().slice()); // deep copy buffer
          newPrim.setAttribute(semantic, newAcc);

          // Track bounding box from POSITION
          if (semantic === 'POSITION') {
            const arr = newAcc.getArray();
            for (let i = 0; i < arr.length; i += 3) {
              minX = Math.min(minX, arr[i]);     maxX = Math.max(maxX, arr[i]);
              minY = Math.min(minY, arr[i + 1]); maxY = Math.max(maxY, arr[i + 1]);
              minZ = Math.min(minZ, arr[i + 2]); maxZ = Math.max(maxZ, arr[i + 2]);
            }
          }
        }

        // Copy indices
        const srcIndices = srcPrim.getIndices();
        if (srcIndices) {
          const newIndices = charDoc.createAccessor(srcIndices.getName())
            .setType(srcIndices.getType())
            .setBuffer(charBuffer)
            .setArray(srcIndices.getArray().slice());
          newPrim.setIndices(newIndices);
        }

        // Copy material (basic properties)
        const srcMat = srcPrim.getMaterial();
        if (srcMat) {
          const newMat = charDoc.createMaterial(srcMat.getName())
            .setBaseColorFactor(srcMat.getBaseColorFactor())
            .setMetallicFactor(srcMat.getMetallicFactor())
            .setRoughnessFactor(srcMat.getRoughnessFactor())
            .setDoubleSided(srcMat.getDoubleSided())
            .setAlphaMode(srcMat.getAlphaMode());

          // Copy base color texture
          const bcTexInfo = srcMat.getBaseColorTextureInfo();
          const bcTex = srcMat.getBaseColorTexture();
          if (bcTex) {
            const newTex = charDoc.createTexture(bcTex.getName())
              .setImage(bcTex.getImage())
              .setMimeType(bcTex.getMimeType());
            newMat.setBaseColorTexture(newTex);
          }

          // Copy normal texture
          const nTex = srcMat.getNormalTexture();
          if (nTex) {
            const newNTex = charDoc.createTexture(nTex.getName())
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
      charRoot.addChild(newNode);
      copiedNodes.push(newNode);
    }

    // Center at origin: offset all POSITION data by -center
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
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
          arr[i + 1] -= minY; // feet at Y=0 (not centered, floored)
          arr[i + 2] -= cz;
        }
      }
    }

    // Write GLB
    const outPath = path.join(OUT_DIR, `${char.id}.glb`);
    await io.write(outPath, charDoc);
    const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`  ${char.id} (${char.name}): ${matchingNodes.length} meshes → ${outPath} (${sizeKB} KB)`);
  }

  console.log('\nDone! Characters exported to characters/ directory.');
  console.log('Next: upload each GLB to mixamo.com for auto-rigging.');
}

main().catch(err => { console.error(err); process.exit(1); });
