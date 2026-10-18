// Dependency-free test doubles, not a Three.js renderer or a GPU-memory probe.
// The geometry and effect algorithms under test are extracted unchanged from the HTML.
import vm from 'node:vm';

export function extractFunction(source, name, optional = false) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0 && optional) return '';
  if (start < 0) throw new Error(`Missing actual source function ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = null, comment = null;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (comment === '//') { if (c === '\n') comment = null; continue; }
    if (comment === '/*') { if (c === '*' && n === '/') { comment = null; i++; } continue; }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '/' && (n === '/' || n === '*')) { comment = '/' + n; i++; continue; }
    if ('\'"`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

export function createHarness(source) {
  const resources = [], meshes = [], events = [], timers = [];
  class Resource {
    constructor(kind) { this.kind = kind; this.id = resources.length; this.disposeCount = 0; resources.push(this); }
    dispose() { this.disposeCount++; events.push({ type: 'dispose', resource: this }); }
  }
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v) { return this.set(v.x, v.y, v.z); }
    add(v) { return this.addScaledVector(v, 1); }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    addScalar(s) { this.x += s; this.y += s; this.z += s; return this; }
    normalize() { const d = Math.hypot(this.x, this.y, this.z) || 1; return this.set(this.x / d, this.y / d, this.z / d); }
    applyQuaternion() { return this; } // Identity muzzle transform fixture only.
    lerp(v, t) { return this.addScaledVector(new Vector3(v.x - this.x, v.y - this.y, v.z - this.z), t); }
    crossVectors(a, b) { return this.set(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x); }
    setFromSpherical(s) { return this.set(s.radius*Math.sin(s.phi)*Math.sin(s.theta), s.radius*Math.cos(s.phi), s.radius*Math.sin(s.phi)*Math.cos(s.theta)); }
  }
  class Quaternion { setFromUnitVectors() { return this; } }
  class Group {
    constructor() { this.children = []; this.rotation = {}; }
    add(...items) { this.children.push(...items); }
  }
  class Material extends Resource {
    constructor(params = {}) { super('material'); this.side = 0; Object.assign(this, params); }
  }
  class BufferGeometry extends Resource {
    constructor() { super('geometry'); this.attributes = {}; }
    setAttribute(name, attr) { this.attributes[name] = attr; return this; }
    setIndex(index) { this.index = Array.from(index); return this; }
    computeVertexNormals() { this.normalsRequested = true; }
  }
  class PrimitiveGeometry extends Resource {
    constructor(...args) { super('geometry'); this.args = args; }
  }
  class Mesh {
    constructor(geometry, material) {
      Object.assign(this, { geometry, material, position: new Vector3(), scale: new Vector3(1, 1, 1), quaternion: new Quaternion(), rotation: {} });
      meshes.push(this);
    }
  }
  class Float32BufferAttribute {
    constructor(values, itemSize) { this.array = new Float32Array(values); this.itemSize = itemSize; this.count = values.length / itemSize; }
  }
  const THREE = { Vector3, Quaternion, Group, Mesh, BufferGeometry, Float32BufferAttribute,
    CylinderGeometry: PrimitiveGeometry, SphereGeometry: PrimitiveGeometry, DodecahedronGeometry: PrimitiveGeometry,
    MeshStandardMaterial: Material, MeshBasicMaterial: Material, MeshLambertMaterial: Material, DoubleSide: 2 };
  const scene = { children: new Set(), add(...items) { items.forEach(x => this.children.add(x)); },
    remove(...items) { items.forEach(x => { this.children.delete(x); events.push({ type: 'remove', mesh: x }); }); } };
  const pivot = { localToWorld(v) { return v; }, getWorldQuaternion(q) { return q; } };
  let elapsed = 0;
  const math = Object.create(Math); math.random = () => 0.99;
  const context = vm.createContext({ THREE, Math: math, SHIP_LOA: 263, SHIP_BEAM: 38.9, MAT: null,
    scene, camera: { position: new Vector3(), lookAt() {}, getWorldDirection(v) { return v.set(1, 0, 0); } },
    renderer: { render() {} }, clock: { getDelta() { elapsed += 0.1; return 0.1; }, getElapsedTime() { return elapsed; } },
    camState: { target: new Vector3(), desiredTarget: new Vector3(), spherical: { radius: 165, phi: 1, theta: 0.65 }, desiredSpherical: { radius: 165, phi: 1, theta: 0.65 }, keys: {} },
    mainTurrets: Array.from({ length: 3 }, () => ({ elevationPivot: pivot, muzzleOffsets: [-2, 0, 2].map(z => new Vector3(16.5, 0, z)) })),
    aaMounts: [{ side: 1, worldPos: new Vector3(0, 15, 3), pivot: { rotation: {} }, barrels: { rotation: {} } }],
    shellEffects: [], aaTracers: [], aaDrillActive: false, aaEmissionPhase: 0, yamatoGroup: null, animatedCrew: [], radarArrays: [], flagMeshes: [],
    setTimeout(fn, delay) { timers.push({ fn, delay }); }, requestAnimationFrame() {}, updateFloatingPins() {},
    createTeakTexture() { return { fixture: 'teak' }; }, createKureGreyTexture() { return { fixture: 'hull' }; }, createRisingSunEnsignTexture() { return { fixture: 'flag' }; }
  });
  const names = ['initMaterials', 'getHalfBeamAtStation', 'getDeckHeightAtX', 'getHalfBeamAtX', 'buildHull', 'triggerMainSalvo', 'spawnAATracers', 'animate'];
  vm.runInContext(names.map(name => extractFunction(source, name)).join('\n') + '\n' + extractFunction(source, 'removeOwnedEffectMesh', true) + '\n' + extractFunction(source, 'advanceAAEmission', true), context, { filename: 'extracted-actual-yamato-functions.js' });
  context.initMaterials();
  const persistentResources = [...resources];
  return { context, THREE, scene, resources, meshes, events, timers, persistentResources,
    drainTimers() { while (timers.length) timers.shift().fn(); },
    tick(count) { for (let i = 0; i < count; i++) context.animate(); },
    makeHull() { const root = new Group(); context.buildHull(root); return root.children[0]; } };
}

export function deckMetrics(mesh) {
  const p = mesh.geometry.attributes.position.array, index = mesh.geometry.index;
  let up = 0, down = 0, zero = 0, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = index.slice(i, i + 3).map(v => v * 3);
    // Independently compute (B-A) cross (C-A); +Y must face above the deck.
    const y = (p[b+2] - p[a+2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c+2] - p[a+2]);
    if (y > 0) up++; else if (y < 0) down++; else zero++;
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { triangles: index.length / 3, up, down, zero, minCrossY: minY, maxCrossY: maxY };
}
