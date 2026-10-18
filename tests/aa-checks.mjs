// Actual animate, optional actual scheduler, real emitter, actual registered click/lifecycle listeners.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createInputHarness } from './input-harness.mjs';
import { extractFunction } from './source-harness.mjs';
import { bindClock, pose, setDesired, DESIRED } from './camera-harness.mjs';
const vector = v => [v.x,v.y,v.z];
const plain = x => JSON.parse(JSON.stringify(x));
export function aaHarness(source, {seed=1, mode='seed', mounts=3, mock=false}={}) {
  const h=createInputHarness(source), clock=bindClock(h), draws=[], batches=[], perFrame=[];
  h.context.aaMounts=Array.from({length:mounts},(_,i)=>({side:i%2?-1:1,worldPos:new h.THREE.Vector3(i*19-12,15+i, i*7-4),pivot:{rotation:{}},barrels:{rotation:{}}}));
  let inside=false,state=seed>>>0,trials=0;
  h.context.Math.random=()=>{
    let value;
    if(mode==='success') value=.1;
    else if(mode==='failure') value=.99;
    else if(mode==='threshold') value=.45;
    else if(mode==='periodic') value=((draws.length%100)+.5)/100;
    else { state=(Math.imul(state,1664525)+1013904223)>>>0;value=state/4294967296; }
    draws.push([inside?'factory':'trial',value]); if(!inside) trials++;
    return value;
  };
  const real=h.context.spawnAATracers;
  h.context.spawnAATracers=()=>{
    const mark=h.context.aaTracers.length;inside=true;
    try {if(!mock)real();}finally{inside=false;}
    batches.push(h.context.aaTracers.slice(mark).map(t=>({origin:vector(t.mesh.position),dir:vector(t.dir),age:t.age,args:plain(t.mesh.geometry.args),color:t.mesh.material.color})));
  };
  const click=()=>h.elements.get('btn-aa-barrage').dispatch('click');
  Object.defineProperty(h,'trials',{get:()=>trials});
  return Object.assign(h,clock,{draws,batches,perFrame,click,step(raw){const before=trials;clock.step(raw);perFrame.push(trials-before);return pose(h);}});
}
export function cadenceChecks(source) {
  const result=[];
  for(const hz of [30,60,120,144]) {
    const h=aaHarness(source,{mode:'periodic',mock:true});h.click();
    for(let i=0;i<hz*10;i++)h.step(1/hz);
    assert.equal(h.trials,600,`${hz}Hz opportunities`);assert.equal(h.batches.length,270,`${hz}Hz diagnostic batches`);
    assert.ok(h.perFrame.every(n=>n<=6));result.push({hz,trials:h.trials,batches:h.batches.length});
  }
  for(const seed of [1,42,0xdeadbeef]) for(const mounts of [0,1,3]) {
    let reference;
    for(const hz of [30,60,120,144]) {
      const h=aaHarness(source,{seed,mounts});h.click();for(let i=0;i<hz*10;i++)h.step(1/hz);
      assert.equal(h.trials,600,`${hz} real-factory opportunities`);
      const actual={draws:h.draws,batches:h.batches};if(reference)assert.deepEqual(actual,reference,`seed ${seed}, mounts ${mounts}, ${hz}Hz ordered actual births/draws`);reference=actual;
    }
  }
  return result;
}
export function zeroChecks(source) {
  const h=aaHarness(source,{mock:true,mode:'success'});h.click();h.step(1/120);
  for(let i=0;i<600;i++)h.step(0);
  assert.equal(h.trials,0,'zero accepted time cannot create emission');
  assert.equal(h.context.aaEmissionPhase,.5,'zero dt preserves fractional phase');
  h.context.aaEmissionPhase=1-5e-10;h.step(0);assert.equal(h.trials,0,'zero dt cannot spend near-boundary phase');
  assert.equal(h.context.aaEmissionPhase,1-5e-10);
  for(const dt of [-1,NaN,Infinity,-Infinity]) {
    h.context.aaEmissionPhase=.5;
    // Infinity is globally capped to .1; helper-local invalid inputs are tested directly.
    if(typeof h.context.advanceAAEmission==='function')h.context.advanceAAEmission(dt);else h.step(dt);
    assert.equal(h.context.aaEmissionPhase,0,'invalid AA-local dt resets phase');assert.equal(h.trials,0,'invalid local dt makes no draws');
  }
}
// Integer 1/6000-second units; cumulative integer quotient, never production floating accumulator.
export function rationalChecks(source) {
  const h=aaHarness(source,{mock:true,mode:'failure'});h.click();let units=0,expected=0,state=73;
  while(units<60000){state=(Math.imul(state,1103515245)+12345)>>>0;const n=Math.min(1+state%600,60000-units);units+=n;const next=Math.floor(units/100);h.step(n/6000);assert.equal(h.trials,next,'independent rational cumulative tick oracle');assert.equal(h.perFrame.at(-1),next-expected);expected=next;h.step(0);assert.equal(h.trials,next);assert.ok(Number.isFinite(h.context.aaEmissionPhase)&&h.context.aaEmissionPhase>=-1.01e-9&&h.context.aaEmissionPhase<1+1e-9);}
  assert.equal(h.trials,600);
  for(const raw of [.5,10]){const s=aaHarness(source,{mock:true});s.click();s.step(1/120);for(let i=0;i<100;i++)s.step(raw);assert.equal(s.trials,600,'raw stall only accepted .1');assert.ok(s.perFrame.every(n=>n<=6));assert.ok(Math.abs(s.context.aaEmissionPhase-.5)<1e-10);}
  const near=aaHarness(source,{mock:true,mode:'failure'});near.click();for(let i=0;i<100000;i++)near.step((1-5e-10)/60);assert.equal(near.trials,99999,'signed deficit must not be repeatedly clamped');assert.ok(near.context.aaEmissionPhase>0&&near.context.aaEmissionPhase<1);
  const cap=aaHarness(source,{mock:true});cap.click();cap.context.aaEmissionPhase=1-5e-10;cap.step(.1);assert.equal(cap.trials,6,'rounding boundary still hard-capped at six');
  // Random non-boundary floating partitions checked against an independently summed duration.
  const f=aaHarness(source,{mock:true});f.click();let total=0;for(let i=0;i<10000;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;const dt=(state+.37)/4294967296*.1;total+=dt;f.step(dt);assert.ok(Math.abs(f.trials-Math.floor(total*60))<=1);assert.ok(f.perFrame.at(-1)<=6);}assert.equal(f.trials,Math.floor(total*60));
}
export function resetChecks(source) {
  const h=aaHarness(source,{mock:true,mode:'success'});h.click();h.step(1/120);assert.equal(h.trials,0,'half tick cannot emit');h.click();assert.equal(h.context.aaEmissionPhase,0,'off edge resets immediately');
  for(let i=0;i<5;i++)h.step(.1);assert.equal(h.trials,0,'disabled draws');h.click();h.step(1/120);assert.equal(h.trials,0,'no disabled fraction inheritance');h.step(1/120);assert.equal(h.trials,1);
  for(let i=0;i<5;i++){h.step(1/120);h.click();h.click();assert.equal(h.context.aaEmissionPhase,0,'off/on between callbacks');h.step(0);h.step(1/120);assert.equal(h.perFrame.at(-1),0);h.step(1/120);assert.equal(h.perFrame.at(-1),1);}
  h.step(1/120);h.context.aaDrillActive=false;h.step(.1);assert.equal(h.context.aaEmissionPhase,0,'direct disabled callback reset');h.context.aaDrillActive=true;h.step(1/120);assert.equal(h.perFrame.at(-1),0);
  // Execute the exact AA branch of the unchanged actual AI order function, using its actual button route.
  const ai=source.slice(source.indexOf('// 5. 25mm AA Barrage State'),source.indexOf('// 6. Fire 46cm Main Battery Broadside'));
  assert.ok(ai.includes("document.getElementById('btn-aa-barrage').click();"));h.elements.get('btn-aa-barrage').click=()=>h.click();h.context.cmd={activateAABarrage:false};vm.runInContext(ai,h.context);assert.equal(h.context.aaDrillActive,false);assert.equal(h.context.aaEmissionPhase,0);
  h.context.cmd={activateAABarrage:true};vm.runInContext(ai,h.context);h.step(1/120);assert.equal(h.perFrame.at(-1),0);
}
export function lifecycleChecks(source) {
  for(const kind of ['blur','hidden','pagehide']) {
    const h=aaHarness(source,{mock:true,mode:'failure'});h.click();h.step(1/120);h.window.dispatch('keydown',{key:'w',target:h.dom});h.dom.dispatch('mousedown',{button:2});
    if(kind==='hidden'){h.document.hidden=true;h.document.dispatch('visibilitychange');}else h.window.dispatch(kind);
    assert.ok(Object.values(h.state.keys).every(x=>!x));assert.equal(h.state.isPanning,false);assert.equal(h.context.aaDrillActive,true);assert.equal(h.context.aaEmissionPhase,.5,'lifecycle retains AA phase');
    h.step(1/120);assert.equal(h.trials,1,'eligible hidden callback keeps AA cadence');
    const before=h.draws.length,frames=h.stats.rafCalls;h.document.hidden=false;h.document.dispatch('visibilitychange');h.window.dispatch('focus');h.window.dispatch('pageshow');assert.equal(h.draws.length,before);assert.equal(h.stats.rafCalls,frames,'show creates no callback');
    h.step(10);assert.equal(h.perFrame.at(-1),6,'missing-callback raw gap accepts only .1');
    h.click();h.step(.1);assert.equal(h.perFrame.at(-1),0);assert.equal(h.context.aaEmissionPhase,0);
  }
}
function live(h){return h.context.aaTracers.map(t=>({id:t.mesh.geometry.id,age:t.age,pos:vector(t.mesh.position),dir:vector(t.dir)}));}
function events(h){return h.events.map(e=>[e.type,e.resource?.id,e.mesh?.geometry.id]);}
export function parityChecks(source,base) {
  for(const mode of ['seed','success','failure','threshold'])for(const mounts of [0,1,3]){
    const a=aaHarness(base,{mode,seed:42,mounts}),b=aaHarness(source,{mode,seed:42,mounts});a.click();b.click();
    for(let i=0;i<600;i++){a.step(1/60);b.step(1/60);assert.deepEqual(b.draws,a.draws,`60Hz ${mode}/${mounts} draw order frame ${i}`);assert.deepEqual(b.batches,a.batches);assert.deepEqual(live(b),live(a),'60Hz every-callback positions/directions/age');assert.deepEqual(events(b),events(a),'60Hz removal/disposal order');assert.deepEqual(b.resources.map(r=>r.disposeCount),a.resources.map(r=>r.disposeCount));}
    if(mode==='threshold'||mode==='failure')assert.equal(b.batches.length,0,'strict .45 threshold fails');
  }
}
export function ageChecks(source) {
  for(const dt of [1/30,1/60,1/120,.1]){
    const h=aaHarness(source,{mode:'success'});h.click();if(dt===1/120)h.step(dt);h.step(dt);
    const due=dt===1/120?1:Math.round(dt*60);assert.equal(h.batches.length,due,'all opportunities call real emitter');assert.equal(h.context.aaTracers.length,due*4);
    h.context.aaTracers.forEach((t,i)=>{const origin=h.batches[Math.floor(i/4)][i%4].origin;assert.equal(t.age,dt,'callback-start births advance full callback dt');vector(t.mesh.position).forEach((v,k)=>assert.equal(v,origin[k]+vector(t.dir)[k]*(dt*165)));});
    const mark=h.persistentResources.length;h.click();const targets=[...h.context.aaTracers];
    // Exact strict threshold independent of floating summation ambiguity.
    targets.forEach(t=>t.age=1.4);h.step(0);assert.equal(h.context.aaTracers.length,targets.length,'age ==1.4 survives');h.step(1e-6);assert.equal(h.context.aaTracers.length,0,'age >1.4 expires');h.step(.1);
    h.resources.slice(mark).forEach(r=>assert.equal(r.disposeCount,1,'private resources disposed exactly once'));h.persistentResources.forEach(r=>assert.equal(r.disposeCount,0,'shared resources untouched'));
  }
}
export function nonAAChecks(source,base){
  const a=aaHarness(base,{mode:'failure'}),b=aaHarness(source,{mode:'failure'});a.click();b.click();a.context.triggerMainSalvo();b.context.triggerMainSalvo();a.drainTimers();b.drainTimers();setDesired(a,DESIRED);setDesired(b,DESIRED);
  for(const dt of [0,1/120,1/60,1/30,.5,10,...Array(20).fill(.1)]){assert.deepEqual(b.step(dt),a.step(dt),'camera pose unchanged');assert.deepEqual(plain(b.context.shellEffects),plain(a.context.shellEffects),'shell outputs unchanged');}
  assert.deepEqual(b.stats,a.stats,'clock/RAF/render counts unchanged');assert.deepEqual(b.resources.map(r=>r.disposeCount),a.resources.map(r=>r.disposeCount));
}
export const checks={cadence:cadenceChecks,zero:zeroChecks,rational:rationalChecks,reset:resetChecks,lifecycle:lifecycleChecks,age:ageChecks};
