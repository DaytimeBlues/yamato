import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
// Sparse worktrees read omitted, tracked historical fixture bytes from local Git.
// Requires the existing complete Git database; no network or accepted-worktree mutation.
export function readTracked(name) {
  const path=new URL('../'+name,import.meta.url);
  return existsSync(path)?readFileSync(path,'utf8'):execFileSync('git',['show',`HEAD:${name}`],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
}
export function readSource() { return process.env.YAMATO_SOURCE_STDIN?readFileSync(0,'utf8'):process.env.YAMATO_SOURCE?readFileSync(process.env.YAMATO_SOURCE,'utf8'):readTracked('src/ijn_battleship_yamato_1_1_scale_3d_simulation.html'); }
const delta=JSON.parse(readTracked('baseline/aa-cadence-approved-delta.json'));
export const sha256=s=>createHash('sha256').update(s).digest('hex');
export const AA_BASE_SHA='14a976b94d621050d28efbab9090f3a72a59cc81cfe82fd812ce7a560fe324fd';
export const AA_SOURCE_SHA='f59f4c1d3cdb0ad691b4a9c20dc65cdef4774489e2837b39e81031999545e61d';
export function stripApprovedAADelta(source) {
  assert.equal(delta.base_commit,'eb1d034e88fd5567bf2690d0e39025f1053accab');assert.equal(delta.base_source_sha256,AA_BASE_SHA);assert.equal(delta.candidate_source_sha256,AA_SOURCE_SHA);
  if(!source.includes('function advanceAAEmission('))return source;
  assert.equal(sha256(source),AA_SOURCE_SHA,'exact separately pinned AA candidate source');assert.equal(Buffer.byteLength(source),delta.candidate_source_bytes);
  for(const {before,after}of [...delta.fragments].reverse()){assert.equal(source.split(after).length,2,'exact approved AA fragment occurs once');source=source.replace(after,before);}
  assert.equal(Buffer.byteLength(source),160644);assert.equal(sha256(source),AA_BASE_SHA,'AA inverse reconstructs every accepted camera-source byte');return source;
}
