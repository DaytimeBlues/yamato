import { readSource, readTracked, stripApprovedAADelta } from './aa-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInputHarness, touch } from './input-harness.mjs';
import { stripApprovedInputDelta } from './input-scope.mjs';

const source = readSource();
const idle = h => {
  assert.ok(Object.values(h.state.keys).every(value => value === false), 'all movement keys released');
  assert.equal(h.state.isDragging, false, 'drag released');
  assert.equal(h.state.isPanning, false, 'pan released');
};
const arm = h => {
  for (const key of ['w', 'a', 's', 'd', 'q', 'e']) h.window.dispatch('keydown', { key, target: h.dom });
  h.dom.dispatch('mousedown', { button: 2 });
};

test('input listener delta is bound to exact approved geometry-cleanup baseline', () => {
  stripApprovedInputDelta(source);
});

test('ordinary case-insensitive WASD moves through actual animate and keyup stops movement', () => {
  for (const key of ['w', 'A', 's', 'D']) {
    const h = createInputHarness(source), before = h.snapshot();
    h.window.dispatch('keydown', { key, target: h.dom, shiftKey: key === key.toUpperCase() }); h.tick(1);
    assert.notDeepEqual(h.snapshot().target, before.target);
    h.window.dispatch('keyup', { key, target: h.dom });
    const stopped = h.snapshot(); h.tick(3); assert.deepEqual(h.snapshot().target, stopped.target);
  }
});

test('editable event targets and active controls cannot claim camera keyboard input', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    for (const targetOnly of [false, true]) {
      const h = createInputHarness(source), field = h.element(tagName);
      if (!targetOnly) h.document.activeElement = field;
      const before = h.snapshot();
      h.window.dispatch('keydown', { key: 'w', target: targetOnly ? field : h.dom }); h.tick(2);
      idle(h); assert.deepEqual(h.snapshot().target, before.target, tagName);
    }
  }
  for (const kind of ['contenteditable', 'textbox', 'designMode']) {
    const h = createInputHarness(source), field = h.element('DIV');
    if (kind === 'contenteditable') field.isContentEditable = true;
    if (kind === 'textbox') field.role = 'textbox';
    if (kind === 'designMode') h.document.designMode = 'on';
    const child = h.element('SPAN', field);
    if (kind === 'contenteditable') child.isContentEditable = true;
    h.window.dispatch('keydown', { key: 'd', target: child }); idle(h);
  }
});

test('modifier shortcuts and IME key events cannot latch movement', () => {
  for (const fields of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }]) {
    const h = createInputHarness(source); arm(h);
    h.window.dispatch('keydown', { key: 'a', target: h.dom, ...fields }); idle(h);
  }
});

test('keyup always releases even when focus composition or modifiers changed', () => {
  const h = createInputHarness(source);
  h.window.dispatch('keydown', { key: 'w', target: h.dom });
  const field = h.element('INPUT'); h.document.activeElement = field;
  h.window.dispatch('keyup', { key: 'W', target: field, ctrlKey: true, isComposing: true }); idle(h);
});

test('focus transfer to editable controls immediately clears held movement and pan', () => {
  const h = createInputHarness(source); arm(h); h.focus(h.element('INPUT')); idle(h);
  const before = h.snapshot(); h.tick(3); h.window.dispatch('mousemove', { clientX: 200, clientY: 300 });
  assert.deepEqual(h.snapshot(), before);
});

test('window blur cancels held movement and pointer ownership without resuming on focus', () => {
  const h = createInputHarness(source); arm(h); h.window.dispatch('blur'); idle(h);
  const before = h.snapshot(); h.window.dispatch('focus');
  h.window.dispatch('keydown', { key: 'w', repeat: true, target: h.dom }); idle(h); h.tick(3);
  h.window.dispatch('mousemove', { clientX: 200, clientY: 300 }); assert.deepEqual(h.snapshot(), before);
  h.window.dispatch('keydown', { key: 'w', target: h.dom }); assert.equal(h.state.keys.w, true);
});

test('hidden documents cancel input while visible visibility changes preserve a live key', () => {
  const h = createInputHarness(source); arm(h); h.document.dispatch('visibilitychange');
  assert.equal(h.state.keys.w, true);
  h.document.hidden = true; h.document.dispatch('visibilitychange'); idle(h);
  h.window.dispatch('keydown', { key: 'a', target: h.dom }); idle(h);
  h.document.hidden = false; h.document.dispatch('visibilitychange'); idle(h);
});

test('pagehide cancels input and pageshow does not synthesize a new hold', () => {
  const h = createInputHarness(source); arm(h); h.window.dispatch('pagehide', { persisted: true }); idle(h);
  h.window.dispatch('pageshow', { persisted: true }); idle(h);
});

test('unfocused documents reject new keyboard mouse touch and wheel input', () => {
  const h = createInputHarness(source); h.document.focused = false;
  const before = h.snapshot();
  h.window.dispatch('keydown', { key: 'w', target: h.dom });
  h.dom.dispatch('mousedown'); h.window.dispatch('mousemove', { clientX: 100, clientY: 200 });
  h.dom.dispatch('touchstart', { touches: [touch(0, 0), touch(10, 0)] });
  h.dom.dispatch('touchmove', { touches: [touch(0, 0), touch(50, 0)] });
  h.dom.dispatch('wheel', { deltaY: 1 }); idle(h); assert.deepEqual(h.snapshot(), before);
});

test('composition lifecycle clears held input and requires a fresh post-composition keydown', () => {
  const h = createInputHarness(source); arm(h); h.document.dispatch('compositionstart'); idle(h);
  h.window.dispatch('keydown', { key: 'w', target: h.dom }); idle(h);
  h.document.dispatch('compositionend'); idle(h);
  h.window.dispatch('keydown', { key: 'w', repeat: true, target: h.dom }); idle(h);
  h.window.dispatch('keydown', { key: 'w', target: h.dom }); assert.equal(h.state.keys.w, true);
});

test('ordinary mouse orbit shift/right pan wheel and mouseup retain original control math', () => {
  const h = createInputHarness(source), initial = h.snapshot();
  h.dom.dispatch('mousedown', { clientX: 0, clientY: 0 });
  h.window.dispatch('mousemove', { clientX: 10, clientY: 20 });
  assert.equal(h.state.desiredSpherical.theta, initial.orbit[2] - 10 * 0.0055);
  assert.equal(h.state.desiredSpherical.phi, initial.orbit[1] - 20 * 0.0055);
  h.window.dispatch('mouseup'); idle(h);
  for (const fields of [{ button: 2 }, { button: 0, shiftKey: true }]) {
    const before = h.snapshot(); h.dom.dispatch('mousedown', { clientX: 0, clientY: 0, ...fields });
    h.window.dispatch('mousemove', { clientX: 10, clientY: 20 });
    assert.notDeepEqual(h.snapshot().target, before.target); assert.deepEqual(h.snapshot().orbit, before.orbit);
    h.window.dispatch('mouseup');
  }
  const radius = h.state.desiredSpherical.radius;
  assert.equal(h.dom.dispatch('wheel', { deltaY: 1 }).defaultPrevented, true);
  assert.equal(h.state.desiredSpherical.radius, radius * 1.12);
  h.dom.dispatch('wheel', { deltaY: -1 }); assert.equal(h.state.desiredSpherical.radius, radius * 1.12 * 0.89);
  h.window.dispatch('keydown', { key: 'w', target: h.dom }); h.window.dispatch('mouseup');
  assert.equal(h.state.keys.w, true, 'ordinary pointer release must preserve a held walking key');
});

test('new mouse presses replace stale pan/drag and no-button move cancels missed mouseup', () => {
  const h = createInputHarness(source); h.dom.dispatch('mousedown', { button: 2 });
  h.dom.dispatch('mousedown', { button: 0 }); assert.equal(h.state.isPanning, false);
  const before = h.snapshot(); h.window.dispatch('mousemove', { buttons: 0, clientX: 300, clientY: 400 });
  idle(h); assert.deepEqual(h.snapshot(), before);
});

test('ordinary one-touch orbit and two-touch pinch preserve original control math', () => {
  const h = createInputHarness(source), initial = h.snapshot();
  h.dom.dispatch('touchstart', { touches: [touch(0, 0)] });
  h.dom.dispatch('touchmove', { touches: [touch(10, 20)] });
  assert.equal(h.state.desiredSpherical.theta, initial.orbit[2] - 10 * 0.006);
  assert.equal(h.state.desiredSpherical.phi, initial.orbit[1] - 20 * 0.006);
  h.dom.dispatch('touchend'); idle(h);
  h.dom.dispatch('touchstart', { touches: [touch(0, 0), touch(10, 0)] });
  h.dom.dispatch('touchmove', { touches: [touch(0, 0), touch(20, 0)] });
  assert.equal(h.state.desiredSpherical.radius, initial.orbit[0] / 2);
});

test('touchcancel and focus loss reject stale pinch moves until a fresh touchstart', () => {
  for (const cancel of [h => h.dom.dispatch('touchcancel'), h => h.window.dispatch('blur'), h => h.focus(h.element('TEXTAREA'))]) {
    const h = createInputHarness(source);
    h.dom.dispatch('touchstart', { touches: [touch(0, 0), touch(10, 0)] }); cancel(h); idle(h);
    h.document.activeElement = h.body;
    const before = h.snapshot();
    h.dom.dispatch('touchmove', { touches: [touch(0, 0), touch(100, 0)] });
    h.dom.dispatch('touchmove', { touches: [touch(0, 0), touch(200, 0)] }); assert.deepEqual(h.snapshot(), before);
    h.dom.dispatch('touchstart', { touches: [touch(0, 0), touch(10, 0)] });
    h.dom.dispatch('touchmove', { touches: [touch(0, 0), touch(20, 0)] });
    assert.equal(h.state.desiredSpherical.radius, before.orbit[0] / 2);
  }
});

test('touchend discards pinch ownership and zero-distance gestures cannot jump zoom', () => {
  const h = createInputHarness(source);
  h.dom.dispatch('touchstart', { touches: [touch(0, 0), touch(10, 0)] }); h.dom.dispatch('touchend');
  const before = h.snapshot();
  h.dom.dispatch('touchmove', { touches: [touch(0, 0), touch(100, 0)] }); assert.deepEqual(h.snapshot(), before);
  h.dom.dispatch('touchstart', { touches: [touch(0, 0), touch(10, 0)] });
  h.dom.dispatch('touchmove', { touches: [touch(0, 0), touch(0, 0)] }); assert.deepEqual(h.snapshot(), before);
});
