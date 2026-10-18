import assert from 'node:assert/strict';
import {readTracked,stripApprovedAADelta} from './aa-scope.mjs';
import {cadenceChecks,zeroChecks,rationalChecks,resetChecks,lifecycleChecks,ageChecks} from './aa-checks.mjs';
const source=readTracked('src/ijn_battleship_yamato_1_1_scale_3d_simulation.html');
const replace=(before,after)=>{assert.equal(source.split(before).length,2,before);return source.replace(before,after);};
const cases=[
 ['old-frame-trial',()=>stripApprovedAADelta(source),cadenceChecks],
 ['single-dt-bernoulli',()=>replace('advanceAAEmission(dt);','if (aaDrillActive && Math.random() < 1 - Math.pow(1 - 0.45, dt * 60)) spawnAATracers();'),cadenceChecks],
 ['omit-remainder',()=>replace('aaEmissionPhase = ticks - due;','aaEmissionPhase = 0;'),cadenceChecks],
 ['omit-60',()=>replace('aaEmissionPhase + dt * 60','aaEmissionPhase + dt'),cadenceChecks],
 ['predraw-probabilities',()=>replace('for (let i = 0; i < due; i++) {\n                    if (Math.random() < 0.45) spawnAATracers();\n                }','const rolls = Array.from({length: due}, () => Math.random());\n                for (const roll of rolls) if (roll < 0.45) spawnAATracers();'),cadenceChecks],
 ['omit-zero-guard',()=>replace('if (dt === 0) return;',''),zeroChecks],
 ['retain-toggle-phase',()=>replace('aaDrillActive = !aaDrillActive;\n                    aaEmissionPhase = 0;','aaDrillActive = !aaDrillActive;'),resetChecks],
 ['omit-disabled-reset',()=>replace('if (!aaDrillActive || !Number.isFinite(dt) || dt < 0) {','if (!aaDrillActive) return;\n                if (!Number.isFinite(dt) || dt < 0) {'),resetChecks],
 ['raw-uncapped-time',()=>replace('Math.min(clock.getDelta(), 0.1)','clock.getDelta()'),rationalChecks],
 ['omit-hard-six-cap',()=>replace('Math.min(6, Math.max(0, Math.floor(ticks + 1e-9)))','Math.max(0, Math.floor(ticks + 1e-9))'),rationalChecks],
 ['clamp-signed-deficit',()=>replace('aaEmissionPhase = ticks - due;','aaEmissionPhase = Math.max(0, ticks - due);'),rationalChecks],
 ['hidden-suspension',()=>replace('if (dt === 0) return;','if (dt === 0 || document.hidden) return;'),lifecycleChecks],
 ['alter-birth-aging',()=>replace('tr.age += dt;','tr.age += dt / 2;'),ageChecks]
];
export function runAAMutations(){const rows=[];for(const [name,mutate,check]of cases){let failure;try{check(mutate());}catch(e){failure=e;}assert.equal(failure?.code,'ERR_ASSERTION',`${name} must fail behavior, not missing helper or syntax`);rows.push({name,detected:true,assertion:failure.message.slice(0,200)});}return rows;}
if(process.argv[1]?.endsWith('aa-mutations.mjs'))console.log(JSON.stringify(runAAMutations()));
