import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDemoHarness} from './demo-harness.mjs';
import {extractFunction} from './source-harness.mjs';
import vm from 'node:vm';
const source=readFileSync(process.env.YAMATO_SOURCE || new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html',import.meta.url),'utf8');

test('overview frames all hull corners with margin at both released viewport sizes',()=>{
  const block=source.slice(source.indexOf('overview: {'),source.indexOf('captain: {'));
  const n=name=>Number(new RegExp(`${name}:\\s*(-?[0-9.]+)`).exec(block)[1]);
  const target=/target:\s*new THREE\.Vector3\((-?[0-9.]+),\s*(-?[0-9.]+),\s*(-?[0-9.]+)\)/.exec(block).slice(1).map(Number);
  const radius=n('radius'),phi=n('phi'),theta=n('theta');
  const z=[Math.sin(phi)*Math.sin(theta),Math.cos(phi),Math.sin(phi)*Math.cos(theta)];
  const x=[z[2],0,-z[0]],len=Math.hypot(...x);x.forEach((v,i)=>x[i]=v/len);
  const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
  for(const [w,h] of [[1450,1223],[1280,720]])for(const px of [-131.5,131.5])for(const py of [-2,47])for(const pz of [-19.45,19.45]){
    const d=[px-target[0],py-target[1],pz-target[2]];
    const dot=a=>d.reduce((s,v,i)=>s+v*a[i],0),depth=radius-dot(z),tan=Math.tan(Math.PI/8);
    assert.ok(depth>1,'whole hull is in front of camera');
    assert.ok(Math.abs(dot(x)/depth/tan/(w/h))<=.86,`${w}x${h} horizontal margin`);
    assert.ok(Math.abs(dot(y)/depth/tan)<=.86,`${w}x${h} vertical margin`);
  }
});

test('foam uses short tapered runs outside the hull rather than long detached angular lines',()=>{
  const h=createDemoHarness(source),specs=h.context.createFoamRibbonSpecs();
  for(const spec of specs){
    const first=spec.points[0],last=spec.points.at(-1);
    assert.ok(Math.hypot(last.x-first.x,last.z-first.z)<=48,`${spec.name} is an interrupted run`);
    if(spec.name.includes('hull')||spec.name.includes('bow'))for(const p of spec.points)
      assert.ok(Math.abs(p.z)>=h.context.getHalfBeamAtX(p.x),`${spec.name} follows the exterior waterline`);
    const d=h.context.createFoamRibbon(spec,'rough');
    const width=i=>Math.hypot(d.positions[i*6]-d.positions[i*6+3],d.positions[i*6+2]-d.positions[i*6+5]);
    assert.ok(width(0)<width(Math.floor(spec.points.length/2))*.3,'foam tips taper visibly');
    assert.ok(width(spec.points.length-1)<width(Math.floor(spec.points.length/2))*.3,'both ends taper');
  }
});

test('rendered near water resolves five metre detail and retains the distant horizon',()=>{
  const h=createDemoHarness(source);
  vm.runInContext(extractFunction(source,'createOceanGeometry')+'\n'+extractFunction(source,'buildEnvironment'),h.context);
  h.context.buildEnvironment();
  const positions=h.context.oceanMesh.geometry.attributes.position.array;
  const xs=[...new Set(Array.from({length:positions.length/3},(_,i)=>positions[i*3]))].sort((a,b)=>a-b);
  const central=xs.filter(x=>Math.abs(x)<=225);
  assert.ok(central.length>=90,'near-ship water resolves local crests instead of broad facets');
  assert.ok(central.slice(1).every((x,i)=>x-central[i]<=5.01),'no near-ship horizontal gap exceeds five metres');
  const all=[...h.scene.children].flatMap(m=>m.geometry?.attributes?.position ? [...m.geometry.attributes.position.array]:[]);
  assert.ok(Math.max(...all)>=999,'distant ocean reaches the retained one kilometre horizon');
});

test('crest contrast distinguishes seas and foam stays close to the actual rendered triangles',()=>{
  const h=createDemoHarness(source);
  vm.runInContext(extractFunction(source,'createOceanGeometry')+'\n'+extractFunction(source,'buildEnvironment'),h.context);
  h.context.buildEnvironment();
  const contrast=[];
  for(const sea of ['calm','moderate','rough']){
    h.seaButtons.find(b=>b.dataset.sea===sea).dispatch('click');h.context.updateDemoSimulation(3.7);
    const mesh=h.context.oceanMesh,colors=mesh.geometry.attributes.color?.array;
    assert.ok(colors,'renderer receives crest colours');
    assert.ok([...colors].every(Number.isFinite),'all live crest colours are finite');
    const greens=Array.from({length:colors.length/3},(_,i)=>colors[i*3+1]);
    contrast.push(Math.max(...greens)-Math.min(...greens));
    const p=mesh.geometry.attributes.position.array,side=Math.round(Math.sqrt(p.length/3)),step=p[3]-p[0],edge=p[0];
    const at=(x,z)=>p[(z*side+x)*3+1];
    for(const foam of [...h.scene.children].filter(m=>m.material?.transparent)){
      const v=foam.geometry.attributes.position.array;
      for(let i=0;i<v.length;i+=3){
        const gx=(v[i]-edge)/step,gz=(v[i+2]-edge)/step,x=Math.floor(gx),z=Math.floor(gz),u=gx-x,w=gz-z;
        const height=u+w<=1 ? at(x,z)*(1-u-w)+at(x+1,z)*u+at(x,z+1)*w : at(x+1,z)*(1-w)+at(x,z+1)*(1-u)+at(x+1,z+1)*(u+w-1);
        assert.ok(Math.abs(v[i+1]-height)<.17,`${sea}: foam stays within17cm of the visible triangle, not an unrendered surface`);
      }
    }
  }
  assert.ok(contrast[1]>contrast[0]*1.4,'moderate crests have clearly stronger contrast than calm');
  assert.ok(contrast[2]>contrast[1]*1.4,'rough crests have clearly stronger contrast than moderate');
});
