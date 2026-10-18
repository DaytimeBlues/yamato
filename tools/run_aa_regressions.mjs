// Compact receipts, in-memory source controls, no duplicated baseline/source/log files.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readTracked,sha256,stripApprovedAADelta} from '../tests/aa-scope.mjs';
import {runAAMutations} from '../tests/aa-mutations.mjs';
const root=new URL('..',import.meta.url),source=readTracked('src/ijn_battleship_yamato_1_1_scale_3d_simulation.html');
function run(file,text=source,pattern){const args=['--test-reporter=tap'];if(pattern)args.push('--test-name-pattern',pattern);args.push(file);const p=spawnSync(process.execPath,args,{cwd:root,input:text,encoding:'utf8',maxBuffer:4*1024*1024,env:{...process.env,YAMATO_SOURCE_STDIN:'1'}});if(p.error)throw p.error;const pass=[...p.stdout.matchAll(/^ok \d+ - (.+)$/gm)].map(x=>x[1]),fail=[...p.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(x=>x[1]);return {status:p.status,pass:pass.length,fail:fail.length,failed:fail,detail:p.status&&!fail.length?p.stderr.slice(0,800):undefined};}
const results={};
for(const [file,count]of [['aa.test.mjs',9],['regression.test.mjs',10],['input.test.mjs',16],['camera.test.mjs',7]]){const result=run('tests/'+file);assert.equal(result.status,0,JSON.stringify(result));assert.equal(result.pass,count);results[file]=result;}
const old=readTracked('baseline/recovered-original.html'),geometry=readTracked('baseline/geometry-cleanup-3aec708.html');
const original=run('tests/regression.test.mjs',old);
const expectedGeometry=['teakDeck actual procedural triangles all face upward and remain single-sided','nonSlipGrey actual procedural triangles all face upward and remain single-sided','salvo resources remain live before expiry then are removed and disposed exactly once','tracer resources obey disabled/enabled drill and expire with exactly-once cleanup','staggered effects preserve newer allocations while older effects expire','100 repeated mixed cycles release all private effect resources and preserve shared hull assets'];
assert.equal(original.status,1);assert.equal(original.pass,4);assert.deepEqual([...original.failed].sort(),expectedGeometry.sort());results.originalGeometry=original;
const expectedInput=['editable event targets and active controls cannot claim camera keyboard input','modifier shortcuts and IME key events cannot latch movement','focus transfer to editable controls immediately clears held movement and pan','window blur cancels held movement and pointer ownership without resuming on focus','hidden documents cancel input while visible visibility changes preserve a live key','pagehide cancels input and pageshow does not synthesize a new hold','unfocused documents reject new keyboard mouse touch and wheel input','composition lifecycle clears held input and requires a fresh post-composition keydown','new mouse presses replace stale pan/drag and no-button move cancels missed mouseup','touchcancel and focus loss reject stale pinch moves until a fresh touchstart','touchend discards pinch ownership and zero-distance gestures cannot jump zoom'];
for(const [name,text]of [['geometry',geometry],['original',old]]){const result=run('tests/input.test.mjs',text);assert.equal(result.status,1);assert.equal(result.pass,5);assert.deepEqual([...result.failed].sort(),[...expectedInput].sort());results[name+'Input']=result;}
const baseline=stripApprovedAADelta(source);
for(const name of ['cadence','zero']){const result=run('tests/aa.test.mjs',baseline,'AA '+name+'$');assert.equal(result.status,1);assert.deepEqual(result.failed,['AA '+name]);results['baselineAA'+name]=result;}
const inputMutations=[
 ['omit-blur',"window.addEventListener('blur', cancelCameraInput);",'', 'window blur cancels'],
 ['omit-pagehide',"window.addEventListener('pagehide', cancelCameraInput);",'', 'pagehide cancels'],
 ['omit-visibility','if (document.hidden) cancelCameraInput();','', 'hidden documents cancel'],
 ['omit-focus-clear','if (isEditableTarget(e.target)) clearCameraInput();','', 'focus transfer to editable'],
 ['disable-editable-guard','return target && (target.isContentEditable','return false && (target.isContentEditable','editable event targets'],
 ['omit-ctrl-guard','e.ctrlKey || e.altKey || e.metaKey','e.altKey || e.metaKey','modifier shortcuts'],
 ['omit-composition-state','|| inputComposing;',';','composition lifecycle'],
 ['omit-touchcancel',"dom.addEventListener('touchcancel', clearCameraInput);",'', 'touchcancel and focus loss'],
 ['omit-touch-ownership','if (!touchActive) return;','', 'touchcancel and focus loss'],
 ['omit-no-button-clear','if (e.buttons === 0) { clearPointerInput(); return; }','', 'new mouse presses'],
 ['allow-repeat-rearm','&& (!e.repeat || camState.keys[k])','', 'window blur cancels'],
 ['allow-zero-distance','touchPrevDist > 0 && dist > 0','touchPrevDist > 0','touchend discards pinch']
];
const inputRows=[];for(const [name,before,after,pattern]of inputMutations){assert.equal(source.split(before).length,2);const result=run('tests/input.test.mjs',source.replace(before,after),pattern);assert.equal(result.status,1,JSON.stringify({name,result}));assert.equal(result.fail,1);inputRows.push({name,detected:true,behavioral_test:result.failed[0]});}
const camera=spawnSync(process.execPath,['tools/probe_camera_mutations.mjs'],{cwd:root,encoding:'utf8'});assert.equal(camera.status,0,camera.stderr);const cameraRows=JSON.parse(camera.stdout).rows;
const aaRows=runAAMutations();
const whitespace=spawnSync('git',['diff','--check'],{cwd:root,encoding:'utf8'});assert.equal(whitespace.status,0,whitespace.stdout+whitespace.stderr);
console.log(JSON.stringify({status:'AUTHOR_CHECKS_PASS_NOT_INDEPENDENT_ACCEPTANCE',source_sha256:sha256(source),node:process.version,results,mutations:{aa:aaRows,input:inputRows,camera:cameraRows},suites:{aa:9,geometry_disposal:10,input:16,camera:7},limitations:['Actual extracted functions with dependency-free Three/DOM doubles','Sparse omitted tracked historical fixtures read from existing Git objects; no network','No browser/GPU/visual density/whole-simulation physics acceptance','Suite counts overlap; not unique issue counts']},null,2));
