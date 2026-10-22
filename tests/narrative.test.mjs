import test from 'node:test';
import assert from 'node:assert/strict';
import {endingNarrative,endingTransition} from '../public/narrative.js';
import {feedbackQuestions} from '../public/engine.js';
const prompt=feedbackQuestions[0];
const prose='Bus trips are more reliable. Some drivers experience longer trips.\n\nHousing pressures remain.';

test('ending question is owned by the form, even when AI prose repeats it',()=>{
 const cleaned=endingNarrative(`${prose}\n\n${prompt}`);
 assert.equal(cleaned,prose);
 assert.equal((`${cleaned}\n${prompt}`.match(/would you make the same decision again/g)||[]).length,1);
 assert.equal(endingNarrative(prose),prose);
});
test('saved Markdown and line-wrapped ending prompts are removed without losing outcomes',()=>{
 for(const suffix of [`**${prompt}**`,`### Final Reflection\n\n${prompt}`,`**Question 1 — Reconsider Your Decision**\n\n${prompt}`,`> ${prompt}`,prompt.replace('Why or why not?','\n\nWhy or why not?')])assert.equal(endingNarrative(`${prose}\n\n${suffix}`),prose);
 assert.equal(endingNarrative(`${prose}\n\n${prompt}\n\n${prompt}`),prose);
});


test('construction transition appears once, including in saved endings with both repeated UI prompts',()=>{
 for(const intro of [endingTransition,`**${endingTransition}**`,endingTransition.replaceAll('. ','.\n\n'),`> ${endingTransition}`]){
  const cleaned=endingNarrative(`${intro}\n\n${prose}\n\n${prompt}`);
  assert.equal(cleaned,prose);
  const screen=`${endingTransition}\n${cleaned}\n${prompt}`;
  assert.equal(screen.split(endingTransition).length-1,1);
  assert.equal(screen.split(prompt).length-1,1);
 }
});
