import assert from 'node:assert/strict';
import { START, DESIRED, cameraHarness, pose, setDesired, assertPose, oracle, advance, fixedDeltas } from './camera-harness.mjs';

export function cadenceChecks(source) {
  const rows = [];
  const poses = [
    { start: START, desired: DESIRED },
    { start: [9, -6, 3, 420, 2.4, -2], desired: [-7, 8, -9, 30, 0.4, 1.8] },
    { start: DESIRED, desired: DESIRED }
  ];
  for (const [index, { start, desired }] of poses.entries()) for (const seconds of [0.1, 0.2, 1]) {
    let reference;
    for (const hz of [30, 60, 120]) {
      const h = cameraHarness(source, start, desired), actual = advance(h, fixedDeltas(seconds, hz));
      assertPose(actual, oracle(start, desired, seconds), `pose ${index}/${hz}Hz/${seconds}s`);
      if (reference) assertPose(actual, reference, 'cross-cadence agreement');
      reference = actual;
      rows.push({ pose: index, seconds, hz, actual });
    }
  }
  return rows;
}

export function preserve60Checks(source, baseline) {
  const a = cameraHarness(baseline), b = cameraHarness(source);
  for (let frame = 1; frame <= 180; frame++) {
    assertPose(b.step(1 / 60), a.step(1 / 60), `60Hz frame ${frame}`, 1e-11);
    assertPose(pose(b), oracle(START, DESIRED, frame / 60), `60Hz oracle frame ${frame}`);
  }
  return { frames: 180, absolute_tolerance: 1e-11 };
}

export function partitionChecks(source) {
  const fixed = cameraHarness(source), jitter = cameraHarness(source), rows = [];
  const segments = [
    { seconds: 0.1, deltas: [0.013, 0, 0.027, 0.06], desired: DESIRED },
    { seconds: 0.2, deltas: [0, 0.099, 0.001, 0.037, 0.063, 0], desired: [-11, 7, -3, 80, 2.2, 2.4] },
    { seconds: 0.3, deltas: [0.08, 0.003, 0, 0.017, 0.1, 0.08, 0.02], desired: [13, -19, 23, 300, 0.3, -2.1] }
  ];
  for (const { seconds, deltas, desired } of segments) {
    assert.ok(deltas.every(dt => dt >= 0 && dt <= 0.1));
    assert.ok(Math.abs(deltas.reduce((a, b) => a + b, 0) - seconds) < 1e-15);
    const start = pose(fixed);
    setDesired(fixed, desired); setDesired(jitter, desired);
    const actual = advance(jitter, deltas), expected = advance(fixed, fixedDeltas(seconds, 60));
    assertPose(actual, expected, 'equal accepted-time partitions');
    assertPose(actual, oracle(start, desired, seconds), 'target-change boundary oracle');
    rows.push({ seconds, deltas, desired, actual });
  }
  return rows;
}

export function boundaryChecks(source) {
  const rows = [];
  for (const raw of [0, 1 / 120, 1 / 60, 1 / 30, 0.1, 0.5, 10]) {
    const h = cameraHarness(source), accepted = Math.min(raw, 0.1);
    let previous = [...START];
    for (let frame = 1; frame <= 5; frame++) {
      const actual = h.step(raw);
      assertPose(actual, oracle(START, DESIRED, accepted * frame), `raw ${raw} frame ${frame}`);
      actual.forEach((v, i) => {
        assert.ok(v >= Math.min(START[i], DESIRED[i]) - 1e-12 && v <= Math.max(START[i], DESIRED[i]) + 1e-12, 'no overshoot');
        assert.ok(Math.abs(DESIRED[i] - v) <= Math.abs(DESIRED[i] - previous[i]) + 1e-12, 'monotonic convergence');
      });
      previous = actual;
    }
    if (raw === 0) assert.deepEqual(pose(h), START, 'zero delta does not advance smoothing');
    assert.equal(h.stats.deltaCalls, 5); assert.equal(h.stats.elapsedCalls, 5);
    assert.equal(h.stats.renders, 5); assert.equal(h.stats.rafCalls, 5);
    rows.push({ raw_delta: raw, accepted_delta: accepted, after_five_callbacks: pose(h), clock: h.stats });
  }
  const noFrames = cameraHarness(source), initial = pose(noFrames);
  assert.deepEqual(pose(noFrames), initial); assert.equal(noFrames.stats.deltaCalls, 0);
  return rows;
}
