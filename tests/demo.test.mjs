// YAM-DEMO-01 candidate behavior tests.
// They execute functions extracted unchanged from the production inline script,
// with dependency-free Three/DOM doubles only at external boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { extractFunction } from './source-harness.mjs';
import { createInputHarness } from './input-harness.mjs';
import { cadenceChecks, zeroChecks, lifecycleChecks } from './aa-checks.mjs';
import { createCrewHarness, createDemoHarness } from './demo-harness.mjs';

const source = process.env.YAMATO_SOURCE
  ? readFileSync(process.env.YAMATO_SOURCE, 'utf8')
  : readFileSync(new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html', import.meta.url), 'utf8');
const sha256 = text => createHash('sha256').update(text).digest('hex');

function readBaseline(name) {
  return readFileSync(new URL(`../baseline/${name}`, import.meta.url));
}

test('descendant scope contract keeps every immutable baseline fixture exact and one bounded demo runtime', () => {
  const pinned = {
    'recovered-original.html': ['228d3e4c4421965e21b50e49dbabf9116ae7b6a71ff8f269c60522746f893c1d', 156963],
    'geometry-cleanup-3aec708.html': ['3ef3661c981e2464869dc57de326a09651b14ad698034df5a574b81e84bff4f7', 157433],
    'aa-cadence-approved-delta.json': ['50fb3b25c676ca1bac4e08120e223f004b82d0354a897dbc767de6bf2865846a', 1833],
    'camera-cadence-approved-delta.json': ['3f58d4fff8d6eac0f8df5ba8f4df0b46d9afb61fa9286299ae4879e00b6f7645', 1456],
    'input-ownership-approved-delta.json': ['99bc98279d75e3eb823757e3ea7e64f88b8fae03602d73b58cd334620e4033a9', 578]
  };
  for (const [name, [hash, bytes]] of Object.entries(pinned)) {
    const fixture = readBaseline(name);
    assert.equal(fixture.length, bytes, `${name} bytes unchanged`);
    assert.equal(sha256(fixture), hash, `${name} hash unchanged`);
  }
  assert.equal(source.split('// YAM-DEMO-RUNTIME-BEGIN').length, 2, 'exactly one demo runtime block');
  assert.equal(source.split('// YAM-DEMO-RUNTIME-END').length, 2, 'exactly one demo runtime end marker');
  assert.ok(Buffer.byteLength(source) > 161488, 'candidate is a larger descendant of the pinned source');
  assert.match(source, /function setupDemoControls\(\)/);
  assert.match(source, /function setupEventListeners\(\)/);
});

test('the integrated inline script compiles and keeps inherited remote scripts and empty key', () => {
  const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc\s*=/.test(m[1]));
  assert.equal(scripts.length, 1);
  new vm.Script(scripts[0][2], { filename: 'candidate-inline-script.js' });
  assert.deepEqual([...source.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m => m[1]), [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
  ]);
  assert.match(source, /const apiKey = "";/);
});

test('crew is excluded at the creation boundary and the HUD reports no rendered personnel', () => {
  const h = createCrewHarness(source);
  const parent = new h.THREE.Group();
  h.context.populateCrew(parent);
  assert.equal(parent.children.length, 0, 'no crew group or figure may be added to the ship');
  assert.equal(h.context.animatedCrew.length, 0, 'no crew animation entries may be queued');
  assert.match(h.elements.get('hud-crew-count').textContent, /not rendered|excluded/i);
  assert.match(source, /DEMO_CREW_RENDERED\s*=\s*false/);
  assert.doesNotMatch(source, /158 Officers & Sailors/);
});

test('nine main barrels recoil and return exactly to stored neutral transforms after 20 complete salvos', () => {
  const h = createDemoHarness(source);
  const turrets = h.buildMainTurrets();
  assert.equal(turrets.length, 3, 'three actual 46cm turrets');
  const barrels = h.barrels();
  assert.equal(barrels.length, 9, 'nine actual barrels');
  const neutrals = barrels.map(barrel => ({
    position: [barrel.neutralPosition.x, barrel.neutralPosition.y, barrel.neutralPosition.z],
    rotation: [barrel.neutralRotation.x, barrel.neutralRotation.y, barrel.neutralRotation.z]
  }));
  // Independent, non-neutral traverse/elevation/sea poses must not contaminate locals.
  turrets.forEach((turret, index) => {
    turret.turretPivot.rotation.y = turret.baseYaw + 0.4 + index * 0.25;
    turret.elevationPivot.rotation.z = 0.2 + index * 0.05;
  });
  h.context.yamatoGroup.rotation.x = 0.02;
  h.context.yamatoGroup.rotation.z = -0.015;
  h.context.yamatoGroup.position.y = 0.7;
  const shipResources = h.resources.slice();
  const mark = h.resources.length;
  for (let salvo = 0; salvo < 20; salvo++) {
    const request = h.context.requestMainSalvo();
    assert.equal(request.accepted, true, `salvo ${salvo + 1} accepted`);
    let frames = 0, sawRecoil = false;
    while (h.context.demoState.activeSalvo && frames++ < 600) {
      h.context.updateDemoSimulation(1 / 60);
      if (barrels.some(barrel => barrel.rig.position.x < -0.25)) sawRecoil = true;
    }
    assert.ok(frames < 600, `salvo ${salvo + 1} completed`);
    assert.ok(sawRecoil, `salvo ${salvo + 1} produced visible local recoil`);
    barrels.forEach((barrel, index) => {
      assert.ok(Math.abs(barrel.rig.position.x - neutrals[index].position[0]) <= 1e-9, `barrel ${index} x neutral`);
      assert.ok(Math.abs(barrel.rig.position.y - neutrals[index].position[1]) <= 1e-9, `barrel ${index} y neutral`);
      assert.ok(Math.abs(barrel.rig.position.z - neutrals[index].position[2]) <= 1e-9, `barrel ${index} z neutral`);
      assert.ok(Math.abs(barrel.rig.rotation.x - neutrals[index].rotation[0]) <= 1e-9, `barrel ${index} rot x neutral`);
      assert.ok(Math.abs(barrel.rig.rotation.y - neutrals[index].rotation[1]) <= 1e-9, `barrel ${index} rot y neutral`);
      assert.ok(Math.abs(barrel.rig.rotation.z - neutrals[index].rotation[2]) <= 1e-9, `barrel ${index} rot z neutral`);
    });
  }
  assert.equal(h.context.demoState.shotsFired, 180, 'twenty salvos of nine barrels');
  h.advance(4);
  assert.equal(h.context.mainBlastEffects.length, 0, 'all owned effects expired');
  const owned = h.resources.slice(mark);
  assert.ok(owned.length > 0, 'blast effects were actually allocated');
  owned.forEach(resource => assert.equal(resource.disposeCount, 1, `owned ${resource.kind} disposed exactly once`));
  shipResources.forEach(resource => assert.equal(resource.disposeCount, 0, `ship ${resource.kind} ${resource.id} survives`));
  Object.values(h.context.MAT).forEach(material => assert.equal(material.disposeCount, 0, 'shared hull material survives'));
  assert.equal([...h.scene.children].some(mesh => mesh.geometry && mesh.material && mesh.material.transparent === true), false, 'no blast meshes remain in the scene');
});

test('repeat-fire policy coalesces overlaps deterministically and drains queued work', () => {
  const h = createDemoHarness(source);
  h.buildMainTurrets();
  const first = h.context.requestMainSalvo();
  assert.deepEqual({ accepted: first.accepted, queued: first.queued }, { accepted: true, queued: false });
  h.advance(0.4);
  const firstId = h.context.demoState.activeSalvo.id;
  const overlap = h.context.requestMainSalvo();
  assert.deepEqual({ accepted: overlap.accepted, queued: overlap.queued, reason: overlap.reason }, { accepted: false, queued: true, reason: 'busy' });
  assert.equal(h.context.demoState.activeSalvo.id, firstId, 'overlap cannot replace the live salvo');
  assert.equal(h.context.requestMainSalvo().queued, true, 'extra repeats coalesce into one queued salvo');
  assert.equal(h.context.demoState.queuedSalvo, true);
  let frames = 0;
  while (h.context.demoState.salvosFired < 2 && frames++ < 1200) h.context.updateDemoSimulation(1 / 60);
  assert.equal(h.context.demoState.salvosFired, 2, 'exactly one queued salvo starts');
  assert.equal(h.context.demoState.shotsFired, 18);
  assert.equal(h.context.demoState.queuedSalvo, false, 'queue drained');
  frames = 0;
  while (h.context.demoState.activeSalvo && frames++ < 600) h.context.updateDemoSimulation(1 / 60);
  assert.equal(h.context.demoState.salvosFired, 2, 'no speculative third salvo');
  h.advance(4);
  assert.equal(h.context.mainBlastEffects.length, 0);
});

test('main-battery blast is briefly flashy and smoke expands, dissipates and is privately owned', () => {
  const h = createDemoHarness(source);
  h.buildMainTurrets();
  const mark = h.resources.length;
  h.context.requestMainSalvo();
  h.context.updateDemoSimulation(1 / 60);
  const flash = h.context.mainBlastEffects.find(effect => effect.kind === 'flash');
  const smoke = h.context.mainBlastEffects.filter(effect => effect.kind === 'smoke');
  assert.ok(flash, 'first barrel fires a flash');
  assert.equal(smoke.length, 5, 'five smoke puffs per barrel');
  assert.ok(flash.life > 0 && flash.life <= 0.2, 'flash lifetime is brief');
  assert.ok(smoke.every(puff => puff.life >= 1.5 && puff.life <= 3), 'smoke lifetime is declared and bounded');
  const firstPuff = smoke[0];
  const initialRadius = firstPuff.mesh.geometry.args[0];
  const initialScale = firstPuff.mesh.scale.x;
  const initialOpacity = firstPuff.mesh.material.opacity;
  assert.ok(initialRadius <= 1.05, 'a single puff does not blanket the ship');
  h.advance(0.1);
  assert.ok(firstPuff.mesh.scale.x > initialScale, 'smoke expands');
  assert.ok(firstPuff.mesh.material.opacity < initialOpacity, 'smoke dissipates');
  assert.ok(firstPuff.mesh.scale.x * initialRadius < 5, 'expanded puff radius stays local to the muzzle');
  h.advance(0.1);
  assert.equal(h.context.mainBlastEffects.includes(flash), false, 'flash is removed after its brief life');
  h.advance(3);
  assert.equal(h.context.mainBlastEffects.length, 0, 'all smoke expires');
  const owned = h.resources.slice(mark);
  owned.forEach(resource => assert.equal(resource.disposeCount, 1, 'each owned geometry/material disposed once'));
  Object.values(h.context.MAT).forEach(material => assert.equal(material.disposeCount, 0, 'shared ship materials untouched'));
  assert.equal([...h.scene.children].some(mesh => mesh.material === h.context.MAT.kureGrey), false, 'no blast effect used shared ship material');
});

test('scheduled smoke puffs stay hidden until their own birth then restore declared opacity', () => {
  const h = createDemoHarness(source);
  h.buildMainTurrets();
  h.context.requestMainSalvo();
  h.context.updateDemoSimulation(1 / 60);
  const now = h.context.demoState.time;
  const smoke = h.context.mainBlastEffects.filter(effect => effect.kind === 'smoke');
  assert.equal(smoke.length, 5, 'one barrel schedules five puffs');
  const future = smoke.filter(effect => effect.born > now);
  const born = smoke.filter(effect => effect.born <= now);
  assert.equal(future.length, 4, 'four puffs are scheduled after the first shot');
  future.forEach(effect => {
    assert.equal(effect.mesh.visible, false, 'future puff is hidden before birth');
    assert.equal(effect.mesh.material.opacity, 0, 'future puff has zero pre-birth opacity');
  });
  born.forEach(effect => {
    assert.equal(effect.mesh.visible, true, 'born puff is visible');
    assert.ok(effect.mesh.material.opacity > 0, 'born puff has declared opacity');
  });
  const firstFuture = future[0];
  h.context.updateDemoSimulation(0.041);
  assert.equal(firstFuture.mesh.visible, true, 'puff becomes visible at birth');
  assert.ok(firstFuture.mesh.material.opacity > 0, 'puff restores nonzero opacity at birth');
  assert.ok(firstFuture.mesh.material.opacity <= firstFuture.baseOpacity + 1e-12, 'opacity does not exceed its declared value');
  future.slice(1).forEach(effect => {
    if (effect.born > h.context.demoState.time) {
      assert.equal(effect.mesh.visible, false, 'later puffs remain hidden');
      assert.equal(effect.mesh.material.opacity, 0);
    }
  });
});

test('foam edge vertices sample their own planar water height independently', () => {
  const h = createDemoHarness(source);
  const spec = { name: 'planar-fixture', points: [{ x: -1, z: -1 }, { x: 0, z: 0 }, { x: 1, z: 1 }], width: 2, opacityScale: 1 };
  const descriptor = h.context.createFoamRibbon(spec, 'moderate');
  const planar = (x, z) => 0.1 * x + 0.2 * z;
  h.context.updateFoamRibbon(descriptor, 0, 'moderate', planar);
  let differingEdges = 0;
  for (let i = 0; i < descriptor.points.length; i++) {
    const leftX = descriptor.positions[i * 6], leftZ = descriptor.positions[i * 6 + 2];
    const rightX = descriptor.positions[i * 6 + 3], rightZ = descriptor.positions[i * 6 + 5];
    const leftY = descriptor.positions[i * 6 + 1], rightY = descriptor.positions[i * 6 + 4];
    assert.ok(Math.abs(leftY - (0.1 * leftX + 0.2 * leftZ + 0.06)) <= 1e-6, `left edge ${i} uses its own x/z`);
    assert.ok(Math.abs(rightY - (0.1 * rightX + 0.2 * rightZ + 0.06)) <= 1e-6, `right edge ${i} uses its own x/z`);
    if (Math.abs(leftY - rightY) > 0.05) differingEdges++;
  }
  assert.ok(differingEdges > 0, 'a planar slope produces different edge heights');
});

test('foam and wake ribbons are narrow strips that follow the shared water height', () => {
  const h = createDemoHarness(source);
  const specs = h.context.createFoamRibbonSpecs();
  assert.ok(specs.length >= 6, 'hull, bow-wave and stern-wake strips exist');
  assert.ok(specs.every(spec => spec.width <= 3), 'foam cues are narrow rather than a filled patch');
  const rough = h.context.createFoamRibbon(specs[0], 'rough');
  for (let i = 0; i < rough.points.length; i++) {
    const leftX = rough.positions[i * 6], leftZ = rough.positions[i * 6 + 2];
    const rightX = rough.positions[i * 6 + 3], rightZ = rough.positions[i * 6 + 5];
    const expectedLeft = h.context.sampleWaterHeight(leftX, leftZ, h.context.demoState.time, 'rough') + 0.06;
    const expectedRight = h.context.sampleWaterHeight(rightX, rightZ, h.context.demoState.time, 'rough') + 0.06;
    assert.ok(Math.abs(rough.positions[i * 6 + 1] - expectedLeft) <= 1e-5, `ribbon left edge ${i} follows the water at its own x/z`);
    assert.ok(Math.abs(rough.positions[i * 6 + 4] - expectedRight) <= 1e-5, `ribbon right edge ${i} follows the water at its own x/z`);
  }
  const calm = h.context.createFoamRibbon(specs[0], 'calm');
  assert.notEqual(calm.material.opacity, rough.material.opacity, 'foam amount follows the selected sea state');
  rough.points.forEach((point, i) => {
    void point;
    const edgeDistance = Math.hypot(
      rough.positions[i * 6] - rough.positions[i * 6 + 3],
      rough.positions[i * 6 + 2] - rough.positions[i * 6 + 5]
    );
    assert.ok(edgeDistance > 0 && edgeDistance <= rough.width + 1e-4, 'ribbon width stays narrow and bounded');
  });
});

test('actual animate advances the illustrative sea pose from the accepted delta', () => {
  const h = createDemoHarness(source);
  h.buildMainTurrets();
  h.tick(1);
  const pose = h.context.sampleHullPose(h.context.demoState.time, h.context.demoState.seaState);
  assert.equal(h.context.yamatoGroup.rotation.x, -pose.roll);
  assert.equal(h.context.yamatoGroup.rotation.z, pose.pitch);
  assert.equal(h.context.yamatoGroup.position.y, pose.heave);
});

test('inherited camera listener, AA emitter and owned-effect cleanup functions are byte-identical', () => {
  const pinned = {
    setupEventListeners: '4d56b16bc6ffaf0806a8a89b814b56194421106ebb37bef92e396f2af8a69af6',
    advanceAAEmission: '957c40c0c5736a813ad7a43c103edfcd1c3844c9c374377140f43f57e50e155a',
    spawnAATracers: '01ebc6932f8cb4faa742481605e7bc8cbb6bef1d3c12c9e32867f6e11749bff9',
    removeOwnedEffectMesh: 'b45a10f61d8673136812365abc327b7e6f0c34fef461da7031c6975adf161695'
  };
  for (const [name, hash] of Object.entries(pinned)) {
    assert.equal(sha256(extractFunction(source, name)), hash, `${name} unchanged from the accepted baseline source`);
  }
  assert.match(source, /const cameraBlend = 1 - Math.pow\(0.9, dt \* 60\);/);
  assert.match(source, /camState.target.lerp\(camState.desiredTarget, cameraBlend\);/);
  assert.match(source, /camState.spherical.radius \+= \(camState.desiredSpherical.radius - camState.spherical.radius\) \* cameraBlend;/);
  assert.match(source, /camState.spherical.phi \+= \(camState.desiredSpherical.phi - camState.spherical.phi\) \* cameraBlend;/);
  assert.match(source, /camState.spherical.theta \+= \(camState.desiredSpherical.theta - camState.spherical.theta\) \* cameraBlend;/);
});

test('inherited AA birth cadence, zero-delta phase and lifecycle behaviors are preserved', () => {
  cadenceChecks(source);
  zeroChecks(source);
  lifecycleChecks(source);
});

test('inherited editable, blur and IME camera-input cancellation still requires a fresh rearm', () => {
  const h = createInputHarness(source);
  h.window.dispatch('keydown', { key: 'w', target: h.dom });
  assert.equal(h.state.keys.w, true);
  h.focus(h.element('INPUT'));
  assert.equal(h.state.keys.w, false, 'editable focus clears held movement');
  h.window.dispatch('keydown', { key: 'w', repeat: true, target: h.dom });
  assert.equal(h.state.keys.w, false, 'repeat alone cannot rearm');
  h.document.activeElement = h.body;
  h.window.dispatch('keydown', { key: 'w', target: h.dom });
  assert.equal(h.state.keys.w, true, 'fresh press rearms after leaving the editable control');
  h.window.dispatch('blur');
  assert.equal(h.state.keys.w, false, 'blur cancels');
  h.document.dispatch('compositionstart');
  h.window.dispatch('keydown', { key: 'a', target: h.dom });
  assert.equal(h.state.keys.a, false, 'IME composition blocks camera keys');
  h.document.dispatch('compositionend');
  h.window.dispatch('keydown', { key: 'a', target: h.dom });
  assert.equal(h.state.keys.a, true);
});

test('illustrative water is finite, zero-delta stable and the three presets are distinct', () => {
  const h = createDemoHarness(source);
  const keys = ['calm', 'moderate', 'rough'];
  for (const key of keys) {
    const preset = h.context.demoSeaPreset(key);
    assert.equal(preset.key, key);
    for (const time of [0, 0.013, 3.7, 120.5, -2, NaN, Infinity]) {
      for (const [x, z] of [[0, 0], [120, 0], [-110, 15], [1e6, -1e6], [NaN, 3]]) {
        const height = h.context.sampleWaterHeight(x, z, time, key);
        assert.ok(Number.isFinite(height), `${key} height finite at ${time}/${x}/${z}`);
        assert.ok(Math.abs(height) <= preset.amplitude + 1e-12, `${key} height bounded`);
      }
    }
    const grid = h.context.createOceanGrid(400, 8);
    h.context.updateOceanGrid(grid, 3.7, key);
    assert.ok([...grid.y].every(Number.isFinite), `${key} grid heights finite`);
    assert.ok([...grid.normals].every(Number.isFinite), `${key} grid normals finite`);
    for (let i = 0; i < grid.x.length; i++) {
      assert.ok(Math.abs(grid.y[i] - h.context.sampleWaterHeight(grid.x[i], grid.z[i], 3.7, key)) <= 1e-6, 'grid uses the shared surface function');
    }
    const zero = h.context.createOceanGrid(400, 8);
    h.context.updateOceanGrid(zero, 3.7, key);
    h.context.updateOceanGrid(zero, 3.7, key);
    assert.deepEqual([...zero.y], [...grid.y], 'zero-delta sampling is stable');
  }
  const samples = {};
  for (const key of keys) {
    samples[key] = [];
    for (const x of [-120, -40, 0, 40, 120]) for (const z of [-18, 0, 18]) samples[key].push(h.context.sampleWaterHeight(x, z, 3.7, key));
  }
  for (const [a, b] of [['calm', 'moderate'], ['moderate', 'rough'], ['calm', 'rough']]) {
    const maxDifference = Math.max(...samples[a].map((value, i) => Math.abs(value - samples[b][i])));
    assert.ok(maxDifference > 0.1, `${a} and ${b} are visibly distinct (max difference ${maxDifference})`);
  }
});

test('hull pose comes from the same water surface and sea changes preserve camera and gun state', () => {
  const h = createDemoHarness(source);
  const turrets = h.buildMainTurrets();
  const preset = h.context.demoSeaPreset('rough');
  const halfLength = 263 * 0.42, halfBeam = 38.9 * 0.40;
  const bow = h.context.sampleWaterHeight(halfLength, 0, 3.7, 'rough');
  const stern = h.context.sampleWaterHeight(-halfLength, 0, 3.7, 'rough');
  const port = h.context.sampleWaterHeight(0, -halfBeam, 3.7, 'rough');
  const starboard = h.context.sampleWaterHeight(0, halfBeam, 3.7, 'rough');
  const pose = h.context.sampleHullPose(3.7, 'rough');
  assert.ok(Math.abs(pose.heave - 0.5 * (bow + stern + port + starboard) / 4) < 1e-12, 'heave uses sampled surface heights');
  assert.equal(Math.sign(pose.pitch), Math.sign(bow - stern), 'pitch follows bow/stern surface difference');
  assert.equal(Math.sign(pose.roll), Math.sign(starboard - port), 'roll follows starboard/port surface difference');
  assert.ok(Math.abs(pose.pitch) <= (preset.hullResponse * Math.PI / 180) * 2, 'hull pitch stays restrained');

  const group = h.context.yamatoGroup;
  const applied = h.context.applyHullPose(group, 3.7, 'rough', false);
  assert.equal(group.position.y, applied.heave);
  assert.equal(group.rotation.z, applied.pitch);
  assert.equal(group.rotation.x, -applied.roll);

  h.context.camState.desiredTarget.set(3, 4, 5);
  h.context.camState.desiredSpherical.radius = 123;
  turrets[0].turretPivot.rotation.y = 0.77;
  turrets[1].elevationPivot.rotation.z = 0.31;
  const cameraBefore = JSON.stringify(h.snapshot());
  h.seaButtons.find(button => button.dataset.sea === 'rough').dispatch('click');
  assert.equal(h.context.demoState.seaState, 'rough');
  assert.equal(h.seaButtons.find(button => button.dataset.sea === 'rough')['aria-pressed'], 'true');
  assert.equal(h.seaButtons.find(button => button.dataset.sea === 'calm')['aria-pressed'], 'false');
  assert.equal(JSON.stringify(h.snapshot()), cameraBefore, 'sea change does not reset camera target/orbit');
  assert.equal(turrets[0].turretPivot.rotation.y, 0.77, 'sea change does not reset traverse');
  assert.equal(turrets[1].elevationPivot.rotation.z, 0.31, 'sea change does not reset elevation');
  const calmPose = h.context.sampleHullPose(3.7, 'calm');
  assert.notEqual(calmPose.heave, pose.heave, 'sea presets drive different hull response');
});

test('planar water world transforms raise the bow and starboard hull points', () => {
  const h = createDemoHarness(source);
  const halfLength = 263 * 0.42;
  const halfBeam = 38.9 * 0.40;

  // Planar fixture height = 0.01*x: water rises toward the +X bow.
  const pitchPose = h.context.hullPoseFromHeights(0.01 * halfLength, -0.01 * halfLength, 0, 0, 0.55);
  const pitchGroup = new h.THREE.Group();
  const pitchApplied = h.context.applyHullPoseValues(pitchGroup, pitchPose, false);
  // Independent rotation-about-Z matrix applied to local bow (x=+halfLength, y=0).
  const cosZ = Math.cos(pitchGroup.rotation.z), sinZ = Math.sin(pitchGroup.rotation.z);
  const bowWorldY = pitchGroup.position.y + halfLength * sinZ;
  const sternWorldY = pitchGroup.position.y - halfLength * sinZ;
  assert.ok(bowWorldY > 0.5, `rising bow slope must raise the bow point (got ${bowWorldY})`);
  assert.ok(bowWorldY < 0.01 * halfLength, 'restrained response stays below the raw water rise');
  assert.ok(sternWorldY < -0.5, 'the opposite end drops');
  assert.ok(Math.abs(bowWorldY - (pitchApplied.heave + halfLength * Math.sin(pitchApplied.pitch))) <= 1e-12,
    'actual transform matches the intended positive-pitch world lift');
  assert.equal(pitchGroup.rotation.z, pitchApplied.pitch);
  assert.equal(cosZ, Math.cos(pitchApplied.pitch));

  // Planar fixture height = 0.02*z: water rises toward +Z starboard.
  const rollPose = h.context.hullPoseFromHeights(0, 0, -0.02 * halfBeam, 0.02 * halfBeam, 0.55);
  const rollGroup = new h.THREE.Group();
  const rollApplied = h.context.applyHullPoseValues(rollGroup, rollPose, false);
  // Independent rotation-about-X matrix applied to local starboard (y=0, z=+halfBeam).
  const sinX = Math.sin(rollGroup.rotation.x);
  const starboardWorldY = rollGroup.position.y - halfBeam * sinX;
  const portWorldY = rollGroup.position.y + halfBeam * sinX;
  assert.ok(starboardWorldY > 0.1, `rising starboard slope must raise the starboard point (got ${starboardWorldY})`);
  assert.ok(starboardWorldY < 0.02 * halfBeam, 'restrained roll stays below the raw water rise');
  assert.ok(portWorldY < -0.1, 'the port side drops');
  assert.ok(Math.abs(starboardWorldY - (rollApplied.heave + halfBeam * Math.sin(rollApplied.roll))) <= 1e-12,
    'actual transform matches the intended positive-roll world lift');
  assert.equal(rollGroup.rotation.x, -rollApplied.roll);
  assert.equal(sinX, Math.sin(-rollApplied.roll));
});

test('reduced motion honors media preference and explicit control, dampens hull motion and leaves camera stable', () => {
  const h = createDemoHarness(source);
  assert.equal(h.context.demoState.reducedMotion, false);
  h.setMediaReduced(true);
  assert.equal(h.context.demoState.reducedMotion, true, 'media preference is honored');
  const group = h.context.yamatoGroup;
  const full = h.context.applyHullPose(group, 2.3, 'rough', false);
  const reduced = h.context.applyHullPose(group, 2.3, 'rough', true);
  assert.ok(Math.abs(reduced.pitch - full.pitch * 0.12) < 1e-12, 'exaggerated hull motion is suppressed');
  assert.ok(Math.abs(reduced.heave - full.heave * 0.12) < 1e-12);
  const cameraBefore = JSON.stringify(h.snapshot());
  const toggle = h.elements.get('btn-reduced-motion');
  toggle.dispatch('click');
  assert.equal(h.context.demoState.reducedMotionExplicit, false, 'explicit control wins');
  assert.equal(h.context.demoState.reducedMotion, false);
  h.setMediaReduced(true);
  assert.equal(h.context.demoState.reducedMotion, false, 'explicit off survives later media changes');
  toggle.dispatch('click');
  assert.equal(h.context.demoState.reducedMotion, true);
  assert.equal(toggle['aria-pressed'], 'true');
  assert.equal(JSON.stringify(h.snapshot()), cameraBefore, 'motion preference never moves the camera');
  assert.equal(h.context.resolveReducedMotion(null, true), true);
  assert.equal(h.context.resolveReducedMotion(false, true), false);
  assert.equal(h.context.resolveReducedMotion(true, false), true);
});

test('zero, negative and irregular deltas keep demo time finite and monotonic', () => {
  const h = createDemoHarness(source);
  h.buildMainTurrets();
  h.context.updateDemoSimulation(0);
  h.context.updateDemoSimulation(-1);
  h.context.updateDemoSimulation(NaN);
  h.context.updateDemoSimulation(Infinity);
  assert.equal(h.context.demoState.time, 0);
  for (const dt of [1 / 60, 0, 0.037, 0.1, 1 / 120, 0.013]) h.context.updateDemoSimulation(dt);
  assert.ok(Number.isFinite(h.context.demoState.time));
  assert.ok(h.context.demoState.time > 0.15 && h.context.demoState.time < 0.2);
  h.context.requestMainSalvo();
  h.context.updateDemoSimulation(0.016);
  h.context.updateDemoSimulation(0);
  h.context.updateDemoSimulation(0.016);
  assert.ok(Number.isFinite(h.context.demoState.time));
});

test('sea controls are visible, labelled as illustrative, and the old static wake and sine rocking are gone', () => {
  assert.match(source, /data-sea="calm"/);
  assert.match(source, /data-sea="moderate"/);
  assert.match(source, /data-sea="rough"/);
  assert.match(source, /id="btn-reduced-motion"/);
  assert.match(source, /id="hud-sea-state"/);
  assert.match(source, /Illustrative visual sea-state model/);
  assert.doesNotMatch(source, /Math\.sin\(elapsed \* 0\.55\) \* 0\.0035/);
  assert.doesNotMatch(source, /wakeShape\.quadraticCurveTo/);
  assert.doesNotMatch(source, /PERSONNEL RENDERED/);
  for (const retired of ['Captain & Compass Bridge', 'Admiral Ito & Flag Staff', 'Bow Sailors & Chrysanthemum',
    '25mm AA Gun Crews', 'Floatplanes & Flight Crew', '1.7m Sailor Eye-Level']) {
    assert.equal(source.includes(retired), false, `retired crew-facing label remains coherent: ${retired}`);
  }
  const runtime = source.slice(source.indexOf('// YAM-DEMO-RUNTIME-BEGIN'), source.indexOf('// YAM-DEMO-RUNTIME-END'));
  assert.doesNotMatch(runtime, /https?:\/\//, 'demo runtime adds no external endpoint');
  assert.doesNotMatch(runtime, /\bfetch\s*\(/, 'demo runtime performs no network fetch');
});
