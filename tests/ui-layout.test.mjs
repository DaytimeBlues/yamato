import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {extractFunction} from './source-harness.mjs';
import {createDemoHarness} from './demo-harness.mjs';
const source=readFileSync(process.env.YAMATO_SOURCE||new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html',import.meta.url),'utf8');
test('actual overview selection frames the full hull in desktop and narrow viewports',()=>{
 const h=createDemoHarness(source),block=/overview:\s*(\{[\s\S]*?\n\s*\}),\s*captain:/.exec(source)[1];
 vm.runInContext(`globalThis.STATIONS={overview:(${block})};globalThis.currentStationKey='overview';\n`+extractFunction(source,'overviewForViewport',true)+'\n'+extractFunction(source,'selectCameraPreset'),h.context);
 for(const [w,height] of [[1450,1223],[1280,720],[768,1024],[390,844]]){
  h.window.innerWidth=w;h.window.innerHeight=height;h.context.selectCameraPreset('overview');
  const s=h.context.camState.desiredSpherical,target=h.context.camState.desiredTarget;
  assert.ok(s.radius>=352&&s.radius<=440,'overview stays inside existing zoom range');
  if(w/height>=1.05)assert.equal(s.radius,352,'desktop keeps reviewed framing');
  const z=[Math.sin(s.phi)*Math.sin(s.theta),Math.cos(s.phi),Math.sin(s.phi)*Math.cos(s.theta)];
  const x=[z[2],0,-z[0]],len=Math.hypot(...x);x.forEach((v,i)=>x[i]=v/len);
  const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
  for(const px of [-131.5,131.5])for(const py of [-2,47])for(const pz of [-19.45,19.45]){
   const d=[px-target.x,py-target.y,pz-target.z],dot=a=>d.reduce((sum,v,i)=>sum+v*a[i],0),depth=s.radius-dot(z);
   assert.ok(depth>1,'hull in front of camera');
   assert.ok(Math.abs(dot(x)/depth/Math.tan(Math.PI/8)/(w/height))<=.86,`${w}x${height} horizontal hull margin`);
   assert.ok(Math.abs(dot(y)/depth/Math.tan(Math.PI/8))<=.86,`${w}x${height} vertical hull margin`);
  }
 }
});
