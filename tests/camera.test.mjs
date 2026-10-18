import { readSource, readTracked, stripApprovedAADelta } from './aa-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInputHarness, touch } from './input-harness.mjs';
import { stripApprovedCameraDelta, CAMERA_BASE_SHA, CAMERA_SOURCE_SHA, sha256 } from './camera-scope.mjs';
import { bindClock, pose, setDesired, assertPose, oracle, DESIRED, reproduceBaseline } from './camera-harness.mjs';
import { cadenceChecks, preserve60Checks, partitionChecks, boundaryChecks } from './camera-checks.mjs';

const canonical = readFileSync(new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html', import.meta.url), 'utf8');
const source = readSource();
const baseline = stripApprovedCameraDelta(canonical);

test('separate camera-only inverse restores exact f206799 full-source pin', () => {
  assert.equal(sha256(stripApprovedAADelta(source)), CAMERA_SOURCE_SHA);
  assert.notEqual(source, stripApprovedCameraDelta(source));
  assert.equal(sha256(stripApprovedCameraDelta(source)), CAMERA_BASE_SHA);
});
test('exact f206799 reproduces baseline red at 30/60/120Hz and all durations', () => { reproduceBaseline(baseline); });
test('actual candidate converges to the exponential oracle across cadences signs and settled poses', () => { cadenceChecks(source); });
test('actual candidate preserves every component of 180 baseline 60Hz frames', () => { preserve60Checks(source, baseline); });
test('actual candidate agrees across jitter zero callbacks and matched target-change boundaries', () => { partitionChecks(source); });
test('actual delta boundary behavior uses existing cap with monotonic non-overshooting convergence', () => { boundaryChecks(source); });

test('registered lifecycle cancellation fixes desired pose while easing continues and fresh input rearms', () => {
  for (const kind of ['blur', 'hidden', 'pagehide', 'editable', 'IME']) {
    const h = createInputHarness(source), clock = bindClock(h);
    setDesired(h, DESIRED);
    h.window.dispatch('keydown', { key: 'w', target: h.dom });
    h.dom.dispatch('mousedown', { button: 2 });
    h.dom.dispatch('touchstart', { touches: [touch(0, 0), touch(10, 0)] });
    if (kind === 'blur') h.window.dispatch('blur');
    if (kind === 'hidden') { h.document.hidden = true; h.document.dispatch('visibilitychange'); }
    if (kind === 'pagehide') h.window.dispatch('pagehide', { persisted: true });
    if (kind === 'editable') h.focus(h.element('INPUT'));
    if (kind === 'IME') h.document.dispatch('compositionstart');
    assert.ok(Object.values(h.state.keys).every(value => value === false), kind);
    assert.equal(h.state.isDragging, false); assert.equal(h.state.isPanning, false);
    const desired = h.snapshot(), start = pose(h);
    h.window.dispatch('mousemove', { clientX: 200, clientY: 300 });
    h.dom.dispatch('touchmove', { touches: [touch(0, 0), touch(100, 0)] });
    let accepted = 0;
    for (const dt of [0.1, 0, 0.03]) { accepted += dt; clock.step(dt); assertPose(pose(h), oracle(start, DESIRED, accepted), kind); }
    assert.deepEqual(h.snapshot(), desired, `${kind}: stale input must not alter desired pose`);
    h.document.hidden = false; h.document.activeElement = h.body;
    h.window.dispatch('focus'); h.window.dispatch('pageshow'); h.document.dispatch('visibilitychange'); h.document.dispatch('compositionend');
    h.window.dispatch('keydown', { key: 'w', repeat: true, target: h.dom }); clock.step(1 / 60);
    assert.deepEqual(h.snapshot(), desired, `${kind}: focus/show/repeat alone cannot rearm`);
    h.window.dispatch('keydown', { key: 'w', target: h.dom }); clock.step(1 / 60);
    assert.equal(h.state.keys.w, true); assert.notDeepEqual(h.snapshot().target, desired.target, `${kind}: fresh press moves`);
    h.window.dispatch('keyup', { key: 'w', target: h.dom });
  }
});
