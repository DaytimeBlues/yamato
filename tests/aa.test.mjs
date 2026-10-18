import test from 'node:test';
import assert from 'node:assert/strict';
import { readSource, readTracked, stripApprovedAADelta, sha256, AA_BASE_SHA, AA_SOURCE_SHA } from './aa-scope.mjs';
import { extractFunction } from './source-harness.mjs';
import { checks, parityChecks, nonAAChecks } from './aa-checks.mjs';
const canonical=readTracked('src/ijn_battleship_yamato_1_1_scale_3d_simulation.html'),source=readSource(),base=stripApprovedAADelta(canonical);
for(const [name,check]of Object.entries(checks))test('AA '+name,()=>check(source));
test('AA exact 60Hz real factory every callback parity',()=>parityChecks(source,base));
test('AA non-AA shell camera clock RAF render parity',()=>nonAAChecks(source,base));
test('AA exact inverse and unchanged source sub-block pins',()=>{
 assert.equal(sha256(source),AA_SOURCE_SHA);assert.equal(sha256(stripApprovedAADelta(source)),AA_BASE_SHA);
 for(const name of ['spawnAATracers','triggerMainSalvo','removeOwnedEffectMesh'])assert.equal(extractFunction(source,name),extractFunction(base,name),name);
 const between=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
 for(const [a,b]of [['for (let i = aaTracers.length - 1;','updateFloatingPins();'],['const dt = Math.min(clock.getDelta(), 0.1);','// Gentle heavy battleship ocean swell'],['const cameraBlend =','// Animate Patrolling Sailors on Deck'],['// Camera Orbit & Smooth Target State','// 3D Interactive Station Definitions']]){
  assert.ok(source.includes(a)&&base.includes(a)&&source.includes(b)&&base.includes(b));assert.equal(between(source,a,b),between(base,a,b),a);
 }
 assert.equal(extractFunction(source,'setupEventListeners').replace('                    aaEmissionPhase = 0;\n',''),extractFunction(base,'setupEventListeners'));
});
