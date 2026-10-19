// Dependency-free doubles around the actual YAM-DEMO-01 runtime functions.
// These are test doubles only: no Three.js execution, WebGL, browser or GPU.
import vm from 'node:vm';
import { extractFunction } from './source-harness.mjs';
import { createInputHarness } from './input-harness.mjs';

export const RUNTIME_BEGIN = '// YAM-DEMO-RUNTIME-BEGIN';
export const RUNTIME_END = '// YAM-DEMO-RUNTIME-END';

export function extractBlock(source) {
  const start = source.indexOf(RUNTIME_BEGIN);
  const end = source.indexOf(RUNTIME_END);
  if (start < 0 || end < 0 || end <= start) throw new Error('Missing actual YAM-DEMO runtime block');
  return source.slice(start + RUNTIME_BEGIN.length, end);
}

class Euler {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  clone() { return new Euler(this.x, this.y, this.z); }
}

// Replace THREE.Group with a position/rotation/children double so the actual
// turret factory and recoil rig can run without a renderer.
export function installDemoDoubles(h) {
  const V = h.THREE.Vector3.prototype;
  V.multiplyScalar = function (s) { this.x *= s; this.y *= s; this.z *= s; return this; };
  V.setScalar = function (s) { return this.set(s, s, s); };
  V.length = function () { return Math.hypot(this.x, this.y, this.z); };
  V.sub = function (v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); };

  h.THREE.Euler = Euler;
  h.THREE.MathUtils = {
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
    degToRad: degrees => degrees * Math.PI / 180,
    radToDeg: radians => radians * 180 / Math.PI
  };
  // Real Three.BufferAttribute shares typed storage and counts dirty versions.
  h.THREE.BufferAttribute = class BufferAttribute {
    constructor(array,itemSize,normalized=false) {
      Object.assign(this,{array,itemSize,normalized,count:array.length/itemSize,version:0});
    }
    set needsUpdate(value) { if(value===true)this.version++; }
  };
  const BaseGeometry = h.THREE.CylinderGeometry;
  for (const name of ['BoxGeometry', 'TorusGeometry', 'ExtrudeGeometry', 'PlaneGeometry', 'CircleGeometry', 'ConeGeometry']) {
    if (!h.THREE[name]) h.THREE[name] = class extends BaseGeometry {};
  }
  BaseGeometry.prototype.rotateX = function () { return this; };
  class DemoGroup {
    constructor() {
      this.children = [];
      this.position = new h.THREE.Vector3();
      this.rotation = new Euler();
      this.scale = new h.THREE.Vector3(1, 1, 1);
    }
    add(...items) { this.children.push(...items); return this; }
    // Translation-only/identity doubles are enough for numeric effect fixtures.
    localToWorld(v) { return v.add(this.position); }
    getWorldQuaternion(q) { return q; }
  }
  h.THREE.Group = DemoGroup;
  h.THREE.Shape = class Shape {
    moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {}
  };
}

function loadFunctions(h, source, names, filename) {
  vm.runInContext(names.map(name => extractFunction(source, name)).join('\n'), h.context, { filename });
}

// Crew-only harness: exercises the actual populateCrew/createHumanFigure
// functions without requiring the later demo runtime block to exist.
export function createCrewHarness(source) {
  const h = createInputHarness(source);
  installDemoDoubles(h);
  const crewFlag = source.match(/const DEMO_CREW_RENDERED = (?:true|false);/);
  if (!crewFlag) throw new Error('Missing actual DEMO_CREW_RENDERED boundary');
  vm.runInContext(
    crewFlag[0] + '\n' + ['getDeckHeightAtX', 'updateCrewHud', 'createHumanFigure', 'populateCrew']
      .map(name => extractFunction(source, name)).join('\n'),
    h.context,
    { filename: 'actual-crew-functions.js' }
  );
  return h;
}

// Full demo harness: input listeners from the candidate, actual demo runtime
// block, actual 46cm turret factory and actual salvo button route.
export function createDemoHarness(source) {
  const h = createInputHarness(source);
  installDemoDoubles(h);

  const seaButtons = ['calm', 'moderate', 'rough'].map(key => {
    const btn = h.element('BUTTON');
    btn.dataset.sea = key;
    btn.classList = { active: false, toggle(name, force) { if (name === 'active') btn.classList.active = !!force; }, add() {}, remove() {} };
    btn.setAttribute = (name, value) => { btn[name] = String(value); };
    return btn;
  });
  const originalQuery = h.document.querySelectorAll.bind(h.document);
  h.document.querySelectorAll = selector => {
    if (selector === '[data-sea]' || selector === '.sea-btn') return seaButtons;
    return originalQuery(selector);
  };
  h.seaButtons = seaButtons;
  const motionButton = h.element('BUTTON');
  motionButton.setAttribute = (name, value) => { motionButton[name] = String(value); };
  h.elements.set('btn-reduced-motion', motionButton);

  let mediaReduced = false;
  const mediaListeners = [];
  h.window.matchMedia = query => ({
    media: query,
    get matches() { return mediaReduced; },
    addEventListener(type, callback) { if (type === 'change') mediaListeners.push(callback); },
    addListener(callback) { mediaListeners.push(callback); },
    removeEventListener() {}
  });
  h.setMediaReduced = value => {
    mediaReduced = !!value;
    mediaListeners.forEach(callback => callback({ matches: mediaReduced }));
  };

  // Expose the real script-local bindings so tests can call the actual functions.
  // This is a test harness concern only; production stays inside its IIFE.
  const exposed = ['demoState', 'mainBlastEffects', 'mainGunRecoilOffset', 'createBarrelRecoilRig',
    'setBarrelRecoil', 'restoreBarrelNeutral', 'spawnMainBlast', 'updateMainBlastEffects', 'fireMainShot',
    'startMainSalvo', 'requestMainSalvo', 'updateMainBattery', 'updateDemoSimulation',
    'demoSeaPreset', 'sampleWaterHeight', 'hullPoseFromHeights', 'sampleHullPose', 'applyHullPoseValues',
    'applyHullPose', 'createOceanGrid',
    'updateOceanGrid', 'createFoamRibbonSpecs', 'createFoamRibbon', 'updateFoamRibbon', 'setupDemoControls',
    'setSeaState', 'setReducedMotion', 'resolveReducedMotion'];
  vm.runInContext(
    [extractFunction(source, 'getDeckHeightAtX'), extractBlock(source), extractFunction(source, 'create46cmTurret'),
      extractFunction(source, 'triggerMainSalvo'),
      exposed.map(name => `globalThis.${name} = ${name};`).join('\n')].join('\n'),
    h.context,
    { filename: 'actual-demo-runtime-and-turret.js' }
  );
  if (typeof h.context.setupDemoControls === 'function') h.context.setupDemoControls();

  h.buildMainTurrets = () => {
    const root = new h.THREE.Group();
    const specs = [[63.0, 10.8, false], [37.0, 13.8, false], [-64.0, 10.6, true]];
    const turrets = specs.map(([x, y, aft]) => h.context.create46cmTurret(x, y, aft));
    turrets.forEach(turret => root.add(turret.group));
    h.context.mainTurrets = turrets;
    h.context.yamatoGroup = root;
    return turrets;
  };
  h.barrels = () => h.context.mainTurrets.flatMap(turret => turret.barrels || []);
  h.advance = seconds => {
    const steps = Math.max(1, Math.round(seconds * 60));
    for (let i = 0; i < steps; i++) h.context.updateDemoSimulation(1 / 60);
  };
  return h;
}

export function mainTurretSpecs() {
  return [[63.0, 10.8, false], [37.0, 13.8, false], [-64.0, 10.6, true]];
}
