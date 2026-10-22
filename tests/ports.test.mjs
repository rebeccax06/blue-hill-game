import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {listenAvailable} from '../server.mjs';
class FakeServer extends EventEmitter{
 constructor(errors){super();this.errors=[...errors];this.ports=[];}
 listen(port,host){this.ports.push(port);assert.equal(host,'127.0.0.1');const code=this.errors.shift();queueMicrotask(()=>code?this.emit('error',Object.assign(new Error(code),{code})):this.emit('listening'));return this;}
 address(){return {port:this.ports.at(-1)};}
}
test('occupied ports advance to the next available port',async()=>{
 const server=new FakeServer(['EADDRINUSE','EADDRINUSE']);
 assert.equal(await listenAvailable(server,3000,{log:()=>{}}),3002);
 assert.deepEqual(server.ports,[3000,3001,3002]);
 assert.equal(server.listenerCount('error'),0);
});
test('other errors and exhausted retries fail without continuing',async()=>{
 const blocked=new FakeServer(['EPERM']);
 await assert.rejects(listenAvailable(blocked,3000),{code:'EPERM'});
 assert.deepEqual(blocked.ports,[3000]);
 const occupied=new FakeServer(['EADDRINUSE','EADDRINUSE']);
 await assert.rejects(listenAvailable(occupied,3000,{attempts:2,log:()=>{}}),{code:'EADDRINUSE'});
 assert.deepEqual(occupied.ports,[3000,3001]);
});
