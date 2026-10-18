import { stripApprovedAADelta } from './aa-scope.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const delta = JSON.parse(readFileSync(new URL('../baseline/camera-cadence-approved-delta.json', import.meta.url), 'utf8'));
export const sha256 = source => createHash('sha256').update(source).digest('hex');
export const CAMERA_BASE_SHA = '418f1d2ce3481a9d53e2c225889d4528fee57615c4beeb4fb1d545b17f8bdae1';
export const CAMERA_SOURCE_SHA = '14a976b94d621050d28efbab9090f3a72a59cc81cfe82fd812ce7a560fe324fd';

export function stripApprovedCameraDelta(source) {
  source = stripApprovedAADelta(source);
  assert.equal(delta.base_commit, 'f206799b4f05251e3e4e9fd4a6cb9704efce9988');
  assert.equal(delta.base_source_sha256, CAMERA_BASE_SHA);
  assert.equal(delta.candidate_source_sha256, CAMERA_SOURCE_SHA);
  // Historical original/geometry/input sources still run their original gates.
  if (!source.includes(delta.after_block)) return source;
  assert.equal(sha256(source), CAMERA_SOURCE_SHA, 'camera candidate matches the separately pinned full-source identity');
  assert.equal(source.split(delta.after_block).length, 2, 'exactly one approved camera block');
  const restored = source.replace(delta.after_block, delta.before_block);
  assert.equal(sha256(restored), CAMERA_BASE_SHA, 'camera-only inverse restores exact f206799 source');
  assert.equal(Buffer.byteLength(restored), 160546);
  return restored;
}
