import { readTracked } from './aa-scope.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extractFunction } from './source-harness.mjs';
import { stripApprovedCameraDelta } from './camera-scope.mjs';

export const inputBaseline = readTracked('baseline/geometry-cleanup-3aec708.html');
const approval = JSON.parse(readFileSync(new URL('../baseline/input-ownership-approved-delta.json', import.meta.url), 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');

export function stripApprovedInputDelta(source) {
  source = stripApprovedCameraDelta(source);
  assert.equal(sha(inputBaseline), '3ef3661c981e2464869dc57de326a09651b14ad698034df5a574b81e84bff4f7');
  assert.equal(Buffer.byteLength(inputBaseline), 157433);
  assert.equal(approval.base_commit, '3aec7086416b991240d45dd4ddd8cdadea83b67d');
  assert.equal(approval.base_source_sha256, sha(inputBaseline));
  const before = extractFunction(inputBaseline, 'setupEventListeners');
  const after = extractFunction(source, 'setupEventListeners');
  // Keep the historical original/geometry negative controls executable unchanged.
  if (after === before) return source;
  assert.equal(sha(source), approval.candidate_source_sha256, 'candidate source matches the exact reviewed delta pin');
  assert.equal(sha(after), approval.setup_function_sha256, 'only the reviewed exact input-listener delta is permitted');
  const restored = source.replace(after, before);
  assert.equal(restored, inputBaseline, 'every byte outside the approved listener delta matches exact 3aec708');
  return restored;
}
