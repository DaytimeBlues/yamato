import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDemoHarness} from './demo-harness.mjs';
import {extractFunction} from './source-harness.mjs';
import vm from 'node:vm';
const source=readFileSync(process.env.YAMATO_SOURCE||new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html',import.meta.url),'utf8');
test('steady water frames reuse invariant spatial work instead of vertex-scaled trigonometry',()=>{
  const h=createDemoHarness(source),grid=h.context.createOceanGrid(900,180);
  h.context.updateOceanGrid(grid,0,'rough');
  const counts={sin:0,cos:0};
  for(const name of Object.keys(counts))h.context.Math[name]=(...args)=>{counts[name]++;return Math[name](...args);};
  h.context.updateOceanGrid(grid,1/60,'rough');
  assert.ok(counts.sin+counts.cos<=12,`steady frame trig calls are bounded, observed ${counts.sin+counts.cos}`);
});

test('water geometry shares update storage and sends normalised byte colours',()=>{
  const h=createDemoHarness(source),grid=h.context.createOceanGrid(900,180);
  h.context.updateOceanGrid(grid,3.7,'rough');
  const geometry=h.context.createOceanGeometry(grid),attrs=geometry.attributes;
  assert.equal(attrs.color.array.constructor.name,'Uint8Array','one byte per colour channel');
  assert.equal(attrs.color.normalized,true,'GPU receives0..1colour values');
  assert.equal(attrs.color.array.byteLength,32761*3,'quarter of floatRGBupload size');
  assert.equal(attrs.position.array,grid.positions,'no per-frame position copy');
  assert.equal(attrs.normal.array,grid.normals,'no per-frame normal copy');
  assert.equal(attrs.color.array,grid.colors,'no per-frame colour copy');
});

test('stationary horizon colour is uploaded once per actual sea change',()=>{
  const h=createDemoHarness(source);
  vm.runInContext(extractFunction(source,'buildEnvironment'),h.context);h.context.buildEnvironment();
  const horizon=[...h.scene.children].find(m=>!m.material.transparent&&m.geometry.attributes.position.count===16).geometry.attributes.color;
  const initial=horizon.version;
  const attrs=h.context.oceanMesh.geometry.attributes,versions=['position','normal','color'].map(n=>attrs[n].version);
  h.context.updateDemoSimulation(.016);assert.equal(horizon.version,initial,'same sea has no horizon upload');
  ['position','normal','color'].forEach((n,i)=>assert.equal(attrs[n].version,versions[i]+1,`${n} shared buffer is still marked dirty for the real renderer`));
  h.seaButtons.find(b=>b.dataset.sea==='rough').dispatch('click');h.context.updateDemoSimulation(.016);
  assert.equal(horizon.version,initial+1,'changed sea uploads once');
  h.context.updateDemoSimulation(.016);assert.equal(horizon.version,initial+1,'next unchanged frame has no upload');
});

test('canonical field preserves the reviewed source and cached grids invalidate across every sea state',()=>{
  const h=createDemoHarness(source),reference=JSON.parse(readFileSync(new URL('./water-field-reference.json',import.meta.url),'utf8'));
  assert.equal(reference.sourceSha256,'bff37dc4b022c98d302636e03be5133a4d762f3cb06f72ff2bb1b47920ad9800');
  for(const p of reference.samples)assert.ok(Math.abs(h.context.sampleWaterHeight(p.x,p.z,p.time,p.sea)-p.height)<1e-12,'reviewed canonical wave field is preserved');
  const grid=h.context.createOceanGrid(900,180);
  for(const sea of ['calm','moderate','rough']){
    h.context.updateOceanGrid(grid,3.7,sea);
    for(let i=0;i<grid.count;i++)assert.ok(Math.abs(grid.y[i]-h.context.sampleWaterHeight(grid.x[i],grid.z[i],3.7,sea))<1e-6,'every rendered vertex agrees with the canonical sampler');
  }
  for(const sea of ['calm','rough','moderate','calm'])for(const time of [0,.016,3.7,120.5,999999,1e8,1e308,-1e308,Infinity,NaN]){
    h.context.updateOceanGrid(grid,time,sea);
    for(const i of [0,9110,16380,16400,18355,23600,32760]){
      assert.ok(Number.isFinite(grid.y[i]),'finite rendered surface even at extreme finite phases');
      assert.ok(Math.abs(grid.y[i]-h.context.sampleWaterHeight(grid.x[i],grid.z[i],time,sea))<1e-6,'kernel and actual canonical sampler agree after state/time changes');
    }
  }
});
