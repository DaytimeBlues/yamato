// Actual production animate with deterministic clocks; no renderer/RAF emulation.
import assert from 'node:assert/strict';
import { createHarness } from './source-harness.mjs';

export const EPSILON = 1e-10; // absolute per component, including radius <= 420
export const START = [0, 0, 0, 165, 1, 0.65];
export const DESIRED = [1, -2, 3, 250, 1.5, -1];
export const pose = h => {
  const s = h.context.camState;
  return [s.target.x, s.target.y, s.target.z, s.spherical.radius, s.spherical.phi, s.spherical.theta];
};
export function setDesired(h, values) {
  const s = h.context.camState;
  s.desiredTarget.set(...values.slice(0, 3));
  ['radius', 'phi', 'theta'].forEach((key, i) => { s.desiredSpherical[key] = values[i + 3]; });
}
export function setPose(h, values) {
  const s = h.context.camState;
  s.target.set(...values.slice(0, 3));
  ['radius', 'phi', 'theta'].forEach((key, i) => { s.spherical[key] = values[i + 3]; });
}
export function bindClock(h) {
  const stats = { deltaCalls: 0, elapsedCalls: 0, renders: 0, rafCalls: 0, rawElapsed: 0 };
  let nextDelta = 0;
  h.context.clock.getDelta = () => { stats.deltaCalls++; stats.rawElapsed += nextDelta; return nextDelta; };
  h.context.clock.getElapsedTime = () => { stats.elapsedCalls++; return stats.rawElapsed; };
  h.context.renderer.render = () => { stats.renders++; };
  h.context.requestAnimationFrame = () => { stats.rafCalls++; };
  return { stats, step(dt) { nextDelta = dt; h.tick(1); return pose(h); } };
}
export function cameraHarness(source, start = START, desired = DESIRED) {
  const h = createHarness(source);
  // Keep other scene/effect arrays empty and leave the harness random source alone.
  for (const key of ['aaMounts', 'shellEffects', 'aaTracers', 'animatedCrew', 'radarArrays', 'flagMeshes']) h.context[key] = [];
  setPose(h, start); setDesired(h, desired);
  return Object.assign(h, bindClock(h));
}
export function assertPose(actual, expected, label = '', tolerance = EPSILON) {
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) <= tolerance,
    `${label} component ${i}: ${value} != ${expected[i]} (absolute tolerance ${tolerance})`));
}
// Independent oracle uses exp/log rather than the production pow expression.
export const oracle = (start, desired, acceptedSeconds) => start.map((v, i) =>
  desired[i] + (v - desired[i]) * Math.exp(Math.log(0.9) * 60 * acceptedSeconds));
export const fixedDeltas = (seconds, hz) => Array(Math.round(seconds * hz)).fill(1 / hz);
export function advance(h, deltas) { deltas.forEach(dt => h.step(dt)); return pose(h); }

export function reproduceBaseline(source) {
  const rows = [];
  for (const seconds of [0.1, 0.2, 1]) for (const hz of [30, 60, 120]) {
    const h = cameraHarness(source), frames = Math.round(seconds * hz);
    const actual = advance(h, fixedDeltas(seconds, hz));
    const oldOracle = START.map((v, i) => DESIRED[i] + (v - DESIRED[i]) * 0.9 ** frames);
    assertPose(actual, oldOracle, `baseline ${hz}Hz/${seconds}s`);
    assert.equal(h.stats.deltaCalls, frames); assert.equal(h.stats.elapsedCalls, frames);
    rows.push({ seconds, hz, frames, actual, oldOracle });
  }
  for (const seconds of [0.1, 0.2, 1]) {
    const values = rows.filter(row => row.seconds === seconds).map(row => row.actual[0]);
    assert.ok(values[2] - values[0] > 0.001, 'baseline must reproduce unequal cadence response');
  }
  return rows;
}
