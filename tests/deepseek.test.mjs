import test from 'node:test';
import assert from 'node:assert/strict';
import {requestDeepSeek,DEFAULT_MODEL} from '../deepseek.mjs';

test('DeepSeek uses chat messages, server-side bearer auth, and reads final content',async()=>{
 let request;
 const text=await requestDeepSeek({key:'test-key',instructions:'Follow the game rules.',input:{question:'How does this affect you?'},fetchImpl:async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return Response.json({choices:[{finish_reason:'stop',message:{content:'My bus trips matter.',reasoning_content:'Do not display this.'}}]});}});
 assert.equal(request.url,'https://api.deepseek.com/chat/completions');
 assert.equal(request.options.headers.Authorization,'Bearer test-key');
 assert.equal(request.body.model,DEFAULT_MODEL);
 assert.equal(request.body.messages[0].role,'system');
 assert.equal(request.body.messages[1].role,'user');
 assert.deepEqual(JSON.parse(request.body.messages[1].content),{question:'How does this affect you?'});
 assert.equal(request.body.thinking.type,'disabled');
 assert.equal(request.body.stream,false);
 assert.equal(text,'My bus trips matter.');
});
test('DeepSeek honors model overrides and reports auth, rate limits, empty and truncated responses',async()=>{
 await requestDeepSeek({key:'test',model:'custom-model',instructions:'Rules',input:{},fetchImpl:async(_url,options)=>{assert.equal(JSON.parse(options.body).model,'custom-model');return Response.json({choices:[{message:{content:'Response'}}]});}});
 for(const [status,message] of [[401,/DEEPSEEK_API_KEY/],[429,/rate limited/],[503,/unavailable/]])await assert.rejects(()=>requestDeepSeek({key:'test',fetchImpl:async()=>new Response('',{status})}),message);
 for(const [body,message] of [[{choices:[]},/No DeepSeek response/],[{choices:[{message:{content:' '}}]},/No DeepSeek response/],[{choices:[{finish_reason:'length',message:{content:'Incomplete'}}]},/cut short/]])await assert.rejects(()=>requestDeepSeek({key:'test',fetchImpl:async()=>Response.json(body)}),message);
});
