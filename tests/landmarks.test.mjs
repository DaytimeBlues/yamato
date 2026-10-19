import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {extractFunction} from './source-harness.mjs';
const source=readFileSync(process.env.YAMATO_SOURCE||new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html',import.meta.url),'utf8');
const code=extractFunction(source,'calloutRectsOverlap',true)+'\n'+extractFunction(source,'layoutCallouts',true);
function load(text=code){const c=vm.createContext({});vm.runInContext(text+'\nglobalThis.layout=layoutCallouts;',c);return (...args)=>JSON.parse(JSON.stringify(c.layout(...args)));}
const bounds={x:10,y:100,width:400,height:300};
const item=(id,x,y,extra={})=>({id,x,y,width:100,height:40,order:0,...extra});
const ids=r=>r.placed.map(x=>x.id);
function verifyPolicy(layout){
 assert.deepEqual(ids(layout([item('ordinary',150,160),item('selected',150,160,{selected:true,order:1})],bounds,[])),['selected']);
 assert.deepEqual(ids(layout([item('a',100,150),item('b',205,150,{order:1})],bounds,[])),['a'],'retain a gap between boxes');
 assert.deepEqual(ids(layout([item('blocked',150,160)],bounds,[{x:110,y:120,width:100,height:80}])),[],'visible HUD is excluded');
 assert.equal(layout([item('edge',12,105)],bounds,[]).placed[0].x,10);
}
test('actual callout policy gives selection priority, avoids pair collisions and HUD obstacles',()=>{
 const layout=load();verifyPolicy(layout);
 const a=[item('plain',150,160,{order:0}),item('selected',150,160,{selected:true,order:1})];
 assert.deepEqual(ids(layout(a,bounds,[])),ids(layout([...a].reverse(),bounds,[])));
 const snapshot=JSON.stringify(a);layout(a,bounds,[]);assert.equal(JSON.stringify(a),snapshot,'caller inputs unchanged');
});
test('callout bounds reject offscreen/invalid/oversized anchors and preserve focused control',()=>{
 const layout=load();
 assert.deepEqual(ids(layout([item('off',-1,160),item('huge',150,160,{width:401}),item('nan',NaN,150),item('bad',100,150,{height:0})],bounds,[])),[]);
 const r=layout([item('selected',150,160,{selected:true}),item('focused',150,160,{focused:true,order:1})],bounds,[]);
 assert.deepEqual(ids(r),['focused'],'keyboard focus has priority over selection');
 assert.equal(layout([item('focused',900,160,{focused:true})],bounds,[]).placed[0].x,310,'focused anchor stays inside safe rails');
 assert.deepEqual(layout([],bounds,[]),{placed:[],culled:[]});
 assert.deepEqual(ids(layout([item('a',100,150)],{...bounds,height:0},[])),[]);
});
test('callout declaration order is stable and every retained rectangle respects independent bounds',()=>{
 const layout=load(),items=[item('c',300,310,{order:2}),item('a',75,125,{order:0}),item('b',190,230,{order:1})];
 for(const permutation of [items,[...items].reverse(),[items[1],items[2],items[0]]]){
  const r=layout(permutation,bounds,[]);assert.deepEqual(ids(r),['a','b','c']);
  for(const p of r.placed){assert.ok(p.x>=10&&p.y>=100&&p.x+p.width<=410&&p.y+p.height<=400);}
 }
});
test('independent policy checks reject disabled collision, obstacle, clamp and priority guards',()=>{
 verifyPolicy(load());
 for(const [name,from,to] of [
  ['collision','placed.some(box => calloutRectsOverlap(candidate,box,8))','false'],
  ['obstacle','obstacles.some(box => calloutRectsOverlap(candidate,box,6))','false'],
  ['clamp','Math.min(Math.max(item.x-width/2,bounds.x),right-width)','item.x-width/2'],
  ['priority','(b.focused ? 2 : b.selected ? 1 : 0) - (a.focused ? 2 : a.selected ? 1 : 0)','0']
 ]){assert.ok(code.includes(from),name+' mutation binds actual production seam');assert.throws(()=>verifyPolicy(load(code.replace(from,to))),undefined,name+' mutation must be detected');}
});
