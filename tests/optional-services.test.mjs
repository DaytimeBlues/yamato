import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(process.env.YAMATO_SOURCE||new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html',import.meta.url),'utf8');

// Generic DOM/network/timer/audio doubles around the actual optional-service
// section and its registered UI handlers. No real endpoint or renderer runs.
function harness(input=source){
 const nodes=[],byId=new Map(),calls={fetch:[],timers:[],audio:0,objectUrls:0};
 class Element{
  constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs={...attrs};this.id=attrs.id||'';this.dataset={};this.children=[];this.parentElement=null;this.listeners={};this.style={};this._text='';this._html='';this.value=attrs.value||'';this.checked='checked'in attrs;this.disabled='disabled'in attrs;this.scrollHeight=0;this.scrollTop=0;this.selectorChildren={};
   for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;
   const classes=new Set((attrs.class||'').split(/\s+/));this.classList={add:(...v)=>v.forEach(c=>classes.add(c)),remove:(...v)=>v.forEach(c=>classes.delete(c)),contains:c=>classes.has(c),toggle:(c,force)=>{const on=force===undefined?!classes.has(c):!!force;on?classes.add(c):classes.delete(c);return on;}};nodes.push(this);if(this.id)byId.set(this.id,this);
  }
  appendChild(e){e.parentElement=this;this.children.push(e);return e;}
  append(...es){es.forEach(e=>this.appendChild(e));}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);}
  set textContent(s){this._text=String(s);this._html='';this.children=[];}get textContent(){return this._text+this.children.map(e=>e.textContent).join('');}
  set innerHTML(s){this._html=String(s);this._text=String(s).replace(/<[^>]*>/g,'');this.children=[];}get innerHTML(){return this._html;}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,f){(this.listeners[k]??=[]).push(f);}
  matches(q){if(q.startsWith('#'))return this.id===q.slice(1);if(q.startsWith('.'))return this.classList.contains(q.slice(1));const a=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(q);if(a)return a[1]in this.attrs&&(a[2]===undefined||this.attrs[a[1]]===a[2]);return this.tagName===q.toUpperCase();}
  contains(e){for(let p=e;p;p=p.parentElement)if(p===this)return true;return false;}
  closest(q){for(let p=this;p;p=p.parentElement)if(p.matches(q))return p;return null;}
  querySelector(q){return nodes.find(e=>this.contains(e)&&e!==this&&e.matches(q))||(this.selectorChildren[q]??=new Element('div'));}
  querySelectorAll(q){return nodes.filter(e=>this.contains(e)&&e!==this&&e.matches(q));}
 }
 const markup=input.split(/<script\s*>/i)[0],stack=[];let end=0;
 for(const m of markup.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)){
  if(stack.length)stack.at(-1)._text+=markup.slice(end,m.index);end=m.index+m[0].length;
  if(m[0].startsWith('</')){while(stack.length&&stack.pop().tagName!==m[1].toUpperCase()){}continue;}
  const attrs={};for(const a of m[2].matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=a[2]??a[3]??a[4]??'';
  const e=new Element(m[1],attrs);if(stack.length)stack.at(-1).appendChild(e);if(!['input','link','meta','img','br','hr','source'].includes(m[1].toLowerCase())&&!m[0].endsWith('/>'))stack.push(e);
 }
 const document={getElementById:id=>byId.get(id)||null,createElement:tag=>new Element(tag),querySelectorAll:q=>q.split(',').flatMap(s=>nodes.filter(e=>e.matches(s.trim()))),querySelector:q=>nodes.find(e=>e.matches(q))||null,activeElement:null};document.body=nodes.find(e=>e.tagName==='BODY');
 const c=vm.createContext({document,console:{log(){},warn(){},error(){}},lightingMode:0,aaDrillActive:false,selectCameraPreset(){},fetch:async(url,options)=>{calls.fetch.push({url,method:options?.method});return {ok:false,status:400,text:async()=> 'test boundary blocked'};},setTimeout:(f,ms)=>{calls.timers.push(ms);f();return 1;},clearTimeout(){},Audio:class{constructor(){calls.audio++;}play(){return Promise.resolve();}pause(){}},URL:{createObjectURL(){calls.objectUrls++;return'blob:test';},revokeObjectURL(){}}});
 const a=input.indexOf('// 13. GEMINI API'),b=input.indexOf('// 14.',a);assert.ok(a>=0&&b>a);vm.runInContext(input.slice(a,b)+'\nsetupAIControls();\nglobalThis.transport=fetchWithBackoff;',c);
 byId.get('slider-turret').value='0';byId.get('slider-elev').value='12';
 return {calls,document,c,byId,nodes,async activate(id,type='click',data={}){const e=typeof id==='string'?byId.get(id):id;assert.ok(e,'real markup contains action');document.activeElement=e;const results=(e.listeners[type]||[]).map(f=>f({target:e,key:undefined,preventDefault(){},...data}));await Promise.all(results);await new Promise(setImmediate);},status(){return nodes.filter(e=>e.getAttribute('role')==='status').map(e=>e.textContent).join(' ');}};
}

test('nonempty Send stays local, preserves input and reports unavailable without request or retry',async()=>{
 const h=harness(),input=h.byId.get('ai-chat-input'),log=h.byId.get('ai-chat-history');input.value='Local review phrase';const before=log.children.length;
 await h.activate('btn-ai-send');
 assert.equal(h.calls.fetch.length,0,'no optional request attempt');assert.equal(h.calls.timers.length,0,'no retry scheduled');assert.equal(input.value,'Local review phrase','blocked action does not consume input');assert.equal(log.children.length,before,'no fake user/transmitting conversation');assert.match(h.status(),/unavailable/i,'clear unavailable-state feedback');
});

async function verifyAction(input,id,type='click',event={}){
 const h=harness(input);h.byId.get('ai-chat-input').value='Local chat phrase';h.byId.get('ai-scenario-input').value='Local scenario phrase';
 const log=h.byId.get('ai-chat-history'),badge=h.byId.get('ai-director-badge'),before={children:log.children.length,badge:badge.textContent};h.byId.get('ai-status-note').textContent='';
 const action=typeof id==='number'?h.nodes.filter(e=>e.matches('.ai-quick-scen'))[id]:id;
 await h.activate(action,type,event);
 assert.equal(h.calls.fetch.length,0,'no optional request attempt');assert.equal(h.calls.timers.length,0,'no retry scheduled');assert.equal(h.calls.audio,0,'no audio constructed');assert.equal(h.calls.objectUrls,0,'no audio object URL');
 assert.equal(h.byId.get('ai-chat-input').value,'Local chat phrase');assert.equal(h.byId.get('ai-scenario-input').value,'Local scenario phrase','quick action must not rewrite input');assert.equal(log.children.length,before.children,'no fake conversation');assert.equal(badge.textContent,before.badge,'no computing/solution badge');assert.match(h.status(),/unavailable/i);
}
test('registered Enter, Analyze, Execute and every quick scenario remain local without pending side effects',async()=>{
 await verifyAction(source,'ai-chat-input','keydown',{key:'Enter'});
 await verifyAction(source,'btn- inspect-station-ai');
 await verifyAction(source,'btn-ai-director');
 await verifyAction(source,'ai-scenario-input','keydown',{key:'Enter'});
 const count=harness().nodes.filter(e=>e.matches('.ai-quick-scen')).length;assert.ok(count>0,'real quick-scenario markup');
 for(let i=0;i<count;i++)await verifyAction(source,i);
});

test('Speak explains unavailability before both retained text and empty-response early return',async()=>{
 await verifyAction(source,'btn-tts-speak');
 const h=harness();vm.runInContext('lastAIResponseText="";',h.c);h.byId.get('ai-status-note').textContent='';await h.activate('btn-tts-speak');assert.equal(h.calls.fetch.length,0);assert.equal(h.calls.timers.length,0);assert.equal(h.calls.audio,0);assert.match(h.status(),/unavailable/i);
});
async function verifyTransport(input){
 const h=harness(input);let rejected=false;
 try{await h.c.transport('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST'});}catch{rejected=true;}
 assert.equal(h.calls.fetch.length,0,'transport fails before request');assert.equal(h.calls.timers.length,0,'transport fails before retry timer');assert.equal(rejected,true,'disabled transport rejects');
}
test('actual transport fails closed before any request or retry independent of UI',()=>verifyTransport(source));

test('unavailable controls expose a reason, keep explanatory activation reachable and disable search',async()=>{
 const h=harness(),controls=['btn-ai-send','btn-ai-director','btn- inspect-station-ai','btn-tts-speak'].map(id=>h.byId.get(id)).concat(h.nodes.filter(e=>e.matches('.ai-quick-scen')));
 for(const e of controls){assert.equal(e.getAttribute('aria-disabled'),'true');assert.equal(e.getAttribute('aria-describedby'),'ai-status-note');assert.equal(e.disabled,false,'activation can explain unavailable state');}
 assert.equal(h.byId.get('chk-google-search').disabled,true);assert.equal(h.byId.get('chk-google-search').checked,false);
 for(const id of ['ai-chat-input','ai-scenario-input']){h.byId.get(id).value='';h.byId.get('ai-status-note').textContent='';await h.activate(id,'keydown',{key:'Enter'});assert.match(h.status(),/unavailable/i,'empty Enter explains unavailable state too');}
 assert.equal(h.calls.fetch.length,0);assert.equal(h.calls.timers.length,0);
});

test('guard-removal and late-guard mutants fail on traffic or premature local side effects',async()=>{
 const send='async function sendPersonaChat(userPromptText) {\n                if (blockOptionalAI()) return;';
 const quick="btn.addEventListener('click', () => {\n                        if (blockOptionalAI()) return;\n                        const scen = btn.dataset.scen;";
 const transport="                if (!OPTIONAL_AI_ENABLED) throw new Error('OPTIONAL_AI_DISABLED');";
 for(const marker of [send,quick,transport,'const OPTIONAL_AI_ENABLED = false;'])assert.ok(source.includes(marker),'mutation binds actual source');
 const variants=[
  ['send entry',source.replace(send,'async function sendPersonaChat(userPromptText) {'),s=>verifyAction(s,'btn-ai-send')],
  ['quick listener',source.replace(quick,"btn.addEventListener('click', () => {\n                        const scen = btn.dataset.scen;"),s=>verifyAction(s,0)],
  ['transport',source.replace(transport,''),verifyTransport],
  ['policy flip',source.replace('const OPTIONAL_AI_ENABLED = false;','const OPTIONAL_AI_ENABLED = true;'),s=>verifyAction(s,'btn-ai-send')],
  ['late Send guard',source.replace(send,'async function sendPersonaChat(userPromptText) {').replace('if (userPromptText === undefined) inputEl.value = "";','if (userPromptText === undefined) inputEl.value = "";\n                if (blockOptionalAI()) return;'),s=>verifyAction(s,'btn-ai-send')]
 ];
 for(const [name,mutant,verify]of variants)await assert.rejects(()=>verify(mutant),e=>e.code==='ERR_ASSERTION',name+' must fail behaviorally');
});
