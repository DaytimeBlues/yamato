import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { reproduceBaseline } from '../tests/camera-harness.mjs';

const path = process.argv[2];
assert.ok(path, 'usage: node tools/probe_camera_baseline.mjs EXACT_F206799_HTML');
const source = readFileSync(path, 'utf8');
const sha256 = createHash('sha256').update(source).digest('hex');
assert.equal(sha256, '418f1d2ce3481a9d53e2c225889d4528fee57615c4beeb4fb1d545b17f8bdae1');
console.log(JSON.stringify({ baseline_commit: 'f206799b4f05251e3e4e9fd4a6cb9704efce9988', source_sha256: sha256,
  status: 'RED reproduced: actual fixed-pose response varies with callback cadence and matches old per-callback oracle',
  absolute_tolerance: 1e-10, rows: reproduceBaseline(source),
  limit: 'Extracted actual animate with deterministic clock; no browser/Three.js/GPU evidence.' }, null, 2));
