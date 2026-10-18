// Each source mutant lives only in memory; no project/source copies are created.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { cadenceChecks, boundaryChecks } from '../tests/camera-checks.mjs';
const source = readFileSync(new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html', import.meta.url), 'utf8');
const cases = [
  ['fixed-0.1', 'const cameraBlend = 1 - Math.pow(0.9, dt * 60);', 'const cameraBlend = 0.1;', cadenceChecks],
  ['theta-left-fixed', 'camState.spherical.theta) * cameraBlend;', 'camState.spherical.theta) * 0.1;', cadenceChecks],
  ['missing-60', 'Math.pow(0.9, dt * 60)', 'Math.pow(0.9, dt)', cadenceChecks],
  ['uncapped-delta', 'Math.min(clock.getDelta(), 0.1)', 'clock.getDelta()', boundaryChecks]
];
const rows = [];
for (const [name, before, after, check] of cases) {
  assert.equal(source.split(before).length, 2, name);
  let failure;
  try { check(source.replace(before, after)); } catch (error) { failure = error.message; }
  assert.ok(failure, `${name}: expected behavioral failure, not a scope-only rejection`);
  rows.push({ name, detected: true, behavioral_failure: failure });
}
console.log(JSON.stringify({ status: 'PASS: all four camera behavioral mutations detected', rows }, null, 2));
