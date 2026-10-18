// Runs the complete actual setupEventListeners function, then dispatches to its
// registered listeners. These small DOM doubles do not emulate a browser/GPU.
import vm from 'node:vm';
import { createHarness, extractFunction } from './source-harness.mjs';

class EventTargetDouble {
  constructor(tagName = '', parentElement = null) {
    Object.assign(this, { tagName, parentElement, isContentEditable: false, listeners: new Map(), dataset: {}, style: {} });
    this.classList = { toggle() {} };
  }
  addEventListener(type, callback, options) {
    const entries = this.listeners.get(type) || [];
    entries.push({ callback, options }); this.listeners.set(type, entries);
  }
  dispatch(type, fields = {}) {
    const event = { target: this, key: '', button: 0, buttons: 1, clientX: 10, clientY: 20,
      shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, isComposing: false,
      keyCode: 0, touches: [], defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields };
    for (const { callback } of this.listeners.get(type) || []) callback(event);
    return event;
  }
  closest(selector) {
    for (let element = this; element; element = element.parentElement) {
      if (selector.includes('input') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return element;
      if (selector.includes('[role="textbox"]') && element.role === 'textbox') return element;
    }
    return null;
  }
}

export function createInputHarness(source) {
  const h = createHarness(source), window = new EventTargetDouble(), document = new EventTargetDouble();
  const dom = new EventTargetDouble('CANVAS'), body = new EventTargetDouble('BODY');
  const elements = new Map();
  Object.assign(document, { hidden: false, focused: true, activeElement: body, designMode: 'off',
    hasFocus() { return this.focused; }, querySelectorAll() { return []; },
    getElementById(id) { if (!elements.has(id)) elements.set(id, new EventTargetDouble('DIV')); return elements.get(id); } });
  h.THREE.MathUtils = { clamp: (x, low, high) => Math.max(low, Math.min(high, x)), degToRad: x => x * Math.PI / 180 };
  h.context.renderer.domElement = dom;
  Object.assign(h.context, { window, document, Object });
  // Initial input fields have the same values as the production camState.
  Object.assign(h.context.camState, { isDragging: false, isPanning: false, prevMouse: { x: 0, y: 0 },
    keys: { w: false, a: false, s: false, d: false, q: false, e: false } });
  vm.runInContext(extractFunction(source, 'setupEventListeners'), h.context, { filename: 'actual-input-listeners.js' });
  h.context.setupEventListeners();
  return { ...h, window, document, dom, body, elements,
    element(tagName, parentElement = null) { return new EventTargetDouble(tagName, parentElement); },
    focus(element) { document.activeElement = element; document.dispatch('focusin', { target: element }); },
    state: h.context.camState,
    snapshot() { const s = h.context.camState; return { target: [s.desiredTarget.x, s.desiredTarget.y, s.desiredTarget.z],
      orbit: [s.desiredSpherical.radius, s.desiredSpherical.phi, s.desiredSpherical.theta] }; } };
}

export const touch = (clientX, clientY) => ({ clientX, clientY });
