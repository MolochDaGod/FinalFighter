#!/usr/bin/env node
/**
 * upload_to_storage.js — Upload FinalFighter assets to Grudge Studio object storage
 *
 * Usage:
 *   node tools/upload_to_storage.js [--dry-run] [--bucket=finalfighter]
 *
 * Environment:
 *   GRUDGE_STORAGE_URL   — Object storage API base URL (e.g. https://objects.grudge-studio.com)
 *   GRUDGE_STORAGE_KEY   — API key or auth token for uploads
 *
 * This script uploads all game assets (character GLBs, weapon GLBs, animations,
 * textures, and the monolithic scene fallback) to object storage so the game
 * can serve models from a CDN instead of the Git repo.
 *
 * After uploading, update ASSET_BASE_URL in index.html to:
 *   `${GRUDGE_STORAGE_URL}/${bucket}/`
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config ---
const STORAGE_URL = process.env.GRUDGE_STORAGE_URL || 'https://objects.grudge-studio.com';
const STORAGE_KEY = process.env.GRUDGE_STORAGE_KEY || '';
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BUCKET = (args.find(a => a.startsWith('--bucket=')) || '--bucket=finalfighter').split('=')[1];

const ROOT = path.resolve(__dirname, '..');

// Asset directories and files to upload
const ASSET_PATTERNS = [
  // Character models (rigged + body + weapons)
  { dir: 'characters', glob: '*.glb' },
  // Animation clips
  { dir: 'anims/shared', glob: '*.glb' },
  { dir: 'anims/weapon_sword', glob: '*.glb' },
  { dir: 'anims/weapon_dual_sword', glob: '*.glb' },
  { dir: 'anims/weapon_dual_blade', glob: '*.glb' },
  { dir: 'anims/weapon_axe', glob: '*.glb' },
  { dir: 'anims/weapon_fan', glob: '*.glb' },
  { dir: 'anims/weapon_mace', glob: '*.glb' },
  { dir: 'anims/weapon_spear', glob: '*.glb' },
  { dir: 'anims/weapon_crossbow', glob: '*.glb' },
  { dir: 'anims/weapon_staff', glob: '*.glb' },
  { dir: 'anims/weapon_unarmed', glob: '*.glb' },
  { dir: 'anims/Leonidas', glob: '*.glb' },
  // Textures (for monolithic scene fallback)
  { dir: 'textures', glob: '*.png' },
  // Monolithic scene fallback
  { file: 'scene.gltf' },
  { file: 'scene.bin' },
];

// --- Helpers ---

function collectFiles(pattern) {
  const files = [];
  if (pattern.file) {
    const full = path.join(ROOT, pattern.file);
    if (fs.existsSync(full)) {
      files.push({ local: full, key: pattern.file });
    }
    return files;
  }

  const dir = path.join(ROOT, pattern.dir);
  if (!fs.existsSync(dir)) return files;

  const ext = pattern.glob.replace('*', '');
  for (const entry of fs.readdirSync(dir)) {
    if (entry.endsWith(ext)) {
      files.push({
        local: path.join(dir, entry),
        key: `${pattern.dir}/${entry}`,
      });
    }
  }
  return files;
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimes = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.bin': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return mimes[ext] || 'application/octet-stream';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadFile(localPath, storageKey) {
  return new Promise((resolve, reject) => {
    const data = fs.readFileSync(localPath);
    const mime = getMimeType(localPath);
    const url = new URL(`/${BUCKET}/${storageKey}`, STORAGE_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      method: 'PUT',
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      headers: {
        'Content-Type': mime,
        'Content-Length': data.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...(STORAGE_KEY ? { 'Authorization': `Bearer ${STORAGE_KEY}` } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, key: storageKey });
        } else {
          reject(new Error(`Upload ${storageKey} failed: HTTP ${res.statusCode} — ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// --- Main ---

async function main() {
  console.log(`\n📦 FinalFighter Asset Upload`);
  console.log(`   Storage: ${STORAGE_URL}`);
  console.log(`   Bucket:  ${BUCKET}`);
  console.log(`   Auth:    ${STORAGE_KEY ? '✓ token set' : '✗ no token (set GRUDGE_STORAGE_KEY)'}`);
  console.log(`   Mode:    ${DRY_RUN ? 'DRY RUN (no uploads)' : 'LIVE UPLOAD'}`);
  console.log('');

  // Collect all files
  let allFiles = [];
  for (const pattern of ASSET_PATTERNS) {
    allFiles = allFiles.concat(collectFiles(pattern));
  }

  if (allFiles.length === 0) {
    console.log('❌ No asset files found. Run from the repo root.');
    process.exit(1);
  }

  // Summary
  let totalSize = 0;
  for (const f of allFiles) {
    const stat = fs.statSync(f.local);
    f.size = stat.size;
    totalSize += stat.size;
  }

  console.log(`Found ${allFiles.length} files (${formatSize(totalSize)} total):`);
  const byDir = {};
  for (const f of allFiles) {
    const dir = path.dirname(f.key);
    byDir[dir] = (byDir[dir] || 0) + 1;
  }
  for (const [dir, count] of Object.entries(byDir)) {
    console.log(`  ${dir}/  — ${count} file(s)`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('🏁 Dry run — listing files that would be uploaded:\n');
    for (const f of allFiles) {
      console.log(`  ${f.key}  (${formatSize(f.size)})`);
    }
    console.log(`\n✅ ${allFiles.length} files would be uploaded to ${STORAGE_URL}/${BUCKET}/`);
    console.log(`\nAfter uploading, set ASSET_BASE_URL in index.html to:`);
    console.log(`  const ASSET_BASE_URL = '${STORAGE_URL}/${BUCKET}/';`);
    return;
  }

  if (!STORAGE_KEY) {
    console.error('❌ GRUDGE_STORAGE_KEY not set. Set it before uploading.');
    console.error('   Example: set GRUDGE_STORAGE_KEY=your-token-here');
    process.exit(1);
  }

  // Upload
  let uploaded = 0;
  let failed = 0;
  for (const f of allFiles) {
    try {
      process.stdout.write(`  ⬆ ${f.key} (${formatSize(f.size)})... `);
      await uploadFile(f.local, f.key);
      console.log('✓');
      uploaded++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n🏁 Done: ${uploaded} uploaded, ${failed} failed`);
  if (uploaded > 0 && failed === 0) {
    console.log(`\n✅ All assets uploaded! Update ASSET_BASE_URL in index.html:`);
    console.log(`   const ASSET_BASE_URL = '${STORAGE_URL}/${BUCKET}/';`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
