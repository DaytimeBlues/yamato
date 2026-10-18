import { readSource, readTracked, stripApprovedAADelta } from './aa-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createHarness, deckMetrics, extractFunction } from './source-harness.mjs';
import { stripApprovedInputDelta } from './input-scope.mjs';

const baseline = readTracked('baseline/recovered-original.html');
const source = readSource();

test('preserved supplied baseline has exact original byte identity', () => {
  assert.equal(Buffer.byteLength(baseline), 156963);
  assert.equal(createHash('sha256').update(baseline).digest('hex'), '228d3e4c4421965e21b50e49dbabf9116ae7b6a71ff8f269c60522746f893c1d');
});

test('complete inline script compiles without executing remote dependencies', () => {
  const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc\s*=/.test(m[1]));
  assert.equal(scripts.length, 1);
  new vm.Script(scripts[0][2], { filename: 'candidate-inline-script.js' });
  assert.deepEqual([...source.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m => m[1]), ['https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js']);
  assert.match(source, /const apiKey = "";/);
});

for (const [material, expectedTriangles] of [['teakDeck', 220], ['nonSlipGrey', 52]]) {
  test(`${material} actual procedural triangles all face upward and remain single-sided`, () => {
    const h = createHarness(source), hull = h.makeHull();
    const mesh = hull.children.find(m => m.material === h.context.MAT[material]);
    assert.ok(mesh);
    assert.equal(mesh.material.side, 0, 'r128 FrontSide default is retained');
    const metrics = deckMetrics(mesh);
    assert.equal(metrics.triangles, expectedTriangles);
    assert.equal(metrics.up, expectedTriangles, JSON.stringify(metrics));
    assert.equal(metrics.down + metrics.zero, 0);
    assert.equal(mesh.geometry.normalsRequested, true);
  });
}

test('all generated positions, UVs, primitive dimensions and persistent materials match original', () => {
  const a = createHarness(baseline), b = createHarness(source);
  const ah = a.makeHull(), bh = b.makeHull();
  assert.equal(ah.children.length, bh.children.length);
  ah.children.forEach((mesh, i) => {
    const candidate = bh.children[i];
    assert.equal(Object.keys(a.context.MAT).find(k => a.context.MAT[k] === mesh.material), Object.keys(b.context.MAT).find(k => b.context.MAT[k] === candidate.material));
    if (mesh.geometry.attributes) {
      for (const key of Object.keys(mesh.geometry.attributes)) assert.deepEqual(candidate.geometry.attributes[key].array, mesh.geometry.attributes[key].array, `${i}:${key}`);
      if (![1, 2].includes(i)) assert.deepEqual(candidate.geometry.index, mesh.geometry.index, `unchanged geometry index ${i}`);
    } else assert.deepEqual(candidate.geometry.args, mesh.geometry.args);
  });
  assert.equal(extractFunction(source, 'initMaterials'), extractFunction(baseline, 'initMaterials'));
  assert.equal(extractFunction(source, 'triggerMainSalvo'), extractFunction(baseline, 'triggerMainSalvo'));
  assert.equal(extractFunction(source, 'spawnAATracers'), extractFunction(baseline, 'spawnAATracers'));
});

test('entire candidate differs only by approved winding and owned-effect cleanup edits', () => {
  // Retain this historical exact inverse gate. Remove only the separately pinned
  // input delta approved on top of exact geometry-cleanup commit 3aec708 first.
  const historicalSource = stripApprovedInputDelta(source);
  const helper = `            // Only for transient effect meshes that own their geometry and material.
            // Ship geometry and shared MAT resources must never use this cleanup path.
            function removeOwnedEffectMesh(mesh) {
                scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
            }

`;
  const undone = historicalSource
    .replace('deckIndices.push(a, b, c, b, d, c);', 'deckIndices.push(a, c, b, b, c, d);')
    .replace('sternDeckIndices.push(a, b, c, b, d, c);', 'sternDeckIndices.push(a, c, b, b, c, d);')
    .replace(helper, '')
    .replace(`removeOwnedEffectMesh(eff.flash);
                        removeOwnedEffectMesh(eff.smoke);
                        removeOwnedEffectMesh(eff.shell);`, 'scene.remove(eff.flash, eff.smoke, eff.shell);')
    .replace('removeOwnedEffectMesh(tr.mesh);', 'scene.remove(tr.mesh);');
  assert.equal(undone, baseline, 'no controls, dimensions, art, AI configuration or unrelated source changed');
});

function transientResources(h, mark) { return h.resources.slice(mark); }
function fire(h) { h.context.triggerMainSalvo(); h.drainTimers(); }
function spawn(h) { h.context.aaDrillActive = true; h.context.spawnAATracers(); h.context.aaDrillActive = false; }
function assertReleased(h, resources) {
  for (const resource of resources) {
    assert.equal(resource.disposeCount, 1, `owned ${resource.kind} ${resource.id} must be disposed exactly once`);
    const disposeIndex = h.events.findIndex(e => e.type === 'dispose' && e.resource === resource);
    const owners = h.meshes.filter(m => m.geometry === resource || m.material === resource);
    for (const mesh of owners) {
      assert.equal(h.scene.children.has(mesh), false);
      const removeIndex = h.events.findIndex(e => e.type === 'remove' && e.mesh === mesh);
      assert.ok(removeIndex >= 0 && removeIndex < disposeIndex, 'remove from scene precedes disposal');
    }
  }
}

test('salvo resources remain live before expiry then are removed and disposed exactly once', () => {
  const h = createHarness(source), mark = h.resources.length;
  h.context.triggerMainSalvo();
  assert.deepEqual(h.timers.map(t => t.delay), [0, 160, 320]);
  h.drainTimers();
  assert.equal(h.context.shellEffects.length, 9);
  const owned = transientResources(h, mark);
  assert.equal(owned.length, 54, '9 rounds, 3 geometries and 3 materials each');
  h.tick(14);
  assert.equal(h.context.shellEffects.length, 9);
  owned.forEach(r => assert.equal(r.disposeCount, 0));
  h.tick(2);
  assert.equal(h.context.shellEffects.length, 0);
  assertReleased(h, owned);
  h.tick(3);
  assertReleased(h, owned);
  h.persistentResources.forEach(r => assert.equal(r.disposeCount, 0));
});

test('tracer resources obey disabled/enabled drill and expire with exactly-once cleanup', () => {
  const h = createHarness(source), mark = h.resources.length;
  h.context.spawnAATracers();
  assert.equal(h.context.aaTracers.length, 0);
  spawn(h);
  assert.equal(h.context.aaTracers.length, 4);
  const owned = transientResources(h, mark);
  assert.equal(owned.length, 8);
  h.tick(13);
  assert.equal(h.context.aaTracers.length, 4);
  owned.forEach(r => assert.equal(r.disposeCount, 0));
  h.tick(2);
  assert.equal(h.context.aaTracers.length, 0);
  assertReleased(h, owned);
  h.tick(3);
  assertReleased(h, owned);
  h.persistentResources.forEach(r => assert.equal(r.disposeCount, 0));
});

test('staggered effects preserve newer allocations while older effects expire', () => {
  const h = createHarness(source), first = h.resources.length;
  fire(h); spawn(h); h.tick(10);
  const second = h.resources.length;
  fire(h); spawn(h); h.tick(6);
  assertReleased(h, h.resources.slice(first, second));
  const newer = h.resources.slice(second);
  assert.equal(h.context.shellEffects.length, 9);
  assert.equal(h.context.aaTracers.length, 4);
  newer.forEach(r => assert.equal(r.disposeCount, 0));
  h.tick(10); assertReleased(h, newer);
});

test('100 repeated mixed cycles release all private effect resources and preserve shared hull assets', () => {
  const h = createHarness(source), hull = h.makeHull();
  h.scene.add(hull);
  const shared = [...h.resources], mark = h.resources.length;
  for (let cycle = 0; cycle < 100; cycle++) {
    fire(h); for (let i = 0; i < 5; i++) spawn(h);
    h.tick(16);
    assert.equal(h.context.shellEffects.length + h.context.aaTracers.length, 0);
    assert.deepEqual([...h.scene.children], [hull]);
    shared.forEach(r => assert.equal(r.disposeCount, 0));
  }
  const owned = transientResources(h, mark);
  assert.equal(owned.length, 9400);
  assertReleased(h, owned);
});
