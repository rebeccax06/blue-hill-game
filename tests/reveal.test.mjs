import test from 'node:test';
import assert from 'node:assert/strict';
import {beforeAfterStreet,createStreetReveal} from '../public/reveal.js';
import {street} from '../public/art.js';

test('before and after uses a starting street and actual final package in either view',()=>{
 for(const view of ['perspective','plan']){
  const html=beforeAfterStreet({option:'C',amendments:[6,7]},view,40);
  assert.match(html,/--reveal:40%/);assert.match(html,/Starting street/);assert.match(html,/Five years later · C/);
  assert.match(html,/Illustrative starting street/);assert.match(html,/Option C:/);assert.doesNotMatch(html,/tabindex="0"/);
  assert.match(html,/dots-A-before/);assert.match(html,/dots-C-after/);
 }
 assert.notEqual(street('A',[],'perspective',{before:true}),street('A'));
 assert.notEqual(beforeAfterStreet({option:'C',amendments:[]}),beforeAfterStreet({option:'C',amendments:[6,7]}));
});
function harness(reduced=false){
 let tick,reads=0,cancelled=0;const styleValues=[],values=[];
 const root={querySelector(selector){reads++;return selector==='#street-reveal'?{style:{setProperty(_key,value){styleValues.push(value);}}}:{set value(value){values.push(value);},setAttribute(){}};}};
 const controller=createStreetReveal({root,now:()=>0,requestFrame:fn=>{tick=fn;return 1;},cancelFrame:()=>cancelled++,reducedMotion:()=>reduced});
 return {controller,step:time=>tick(time),get reads(){return reads;},get cancelled(){return cancelled;},styleValues,values};
}
test('animation survives DOM resync, completes once, and scrubbing cancels playback',()=>{
 const h=harness();h.controller.play();assert.equal(h.controller.progress,0);
 h.step(1400);assert.equal(h.controller.progress,50);h.controller.sync();assert.equal(h.controller.progress,50);
 h.step(2800);assert.equal(h.controller.progress,100);assert.equal(h.styleValues.at(-1),'100%');
 h.controller.play();h.controller.set(30);assert.equal(h.controller.progress,30);assert.equal(h.cancelled,1);
 h.controller.set(-10);assert.equal(h.controller.progress,0);h.controller.set(200);assert.equal(h.controller.progress,100);
});
test('reduced motion shows the final design immediately and keeps manual scrubbing',()=>{
 const h=harness(true);h.controller.play();assert.equal(h.controller.progress,100);h.controller.set(45);assert.equal(h.controller.progress,45);
});
