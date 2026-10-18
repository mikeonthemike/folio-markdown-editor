const {test}=require('node:test');
const assert=require('node:assert/strict');
const {closeWarning,afterClose}=require('../dist/documents.js');
const {reopenDecision}=require('../dist/drafts.js');

const draft=(text,base,sha='s1')=>({id:'d',name:'post.md',text,source:{slug:'post',sha,text:base}});

test('reopen: GitHub unchanged just switches, even with local edits', () => {
  assert.equal(reopenDecision(draft('a','a'),{sha:'s1',text:'a'}),'switch');
  assert.equal(reopenDecision(draft('mine','a'),{sha:'s1',text:'a'}),'switch');
});

test('reopen: GitHub newer always prompts, with or without local edits', () => {
  assert.equal(reopenDecision(draft('a','a'),{sha:'s2',text:'b'}),'prompt');
  assert.equal(reopenDecision(draft('mine','a'),{sha:'s2',text:'b'}),'prompt');
});

test('reopen: GitHub newer but identical to the local text syncs without a prompt', () => {
  assert.equal(reopenDecision(draft('b','a'),{sha:'s2',text:'b'}),'sync');
});

test('close: a clean GitHub draft closes without asking; a dirty one asks', () => {
  assert.equal(closeWarning(draft('a','a'),{draftDirty:false}),null);
  assert.match(closeWarning(draft('b','a'),{draftDirty:true}),/not committed to GitHub/);
});

test('close: a local-only document asks unless it is saved to a file or pristine', () => {
  const local={id:'l',name:'Notes.md',text:'my notes'};
  assert.match(closeWarning(local),/only exists in this browser/);
  assert.equal(closeWarning(local,{fileSaved:true}),null);
  assert.equal(closeWarning({...local,text:''},{pristine:['']}),null);
});

test('close: closing the active document selects the next, then the previous, then nothing', () => {
  const docs=[{id:'a'},{id:'b'},{id:'c'}];
  assert.deepEqual(afterClose(docs,'b','b'),{docs:[{id:'a'},{id:'c'}],active:'c'});
  assert.deepEqual(afterClose(docs,'c','c'),{docs:[{id:'a'},{id:'b'}],active:'b'});
  assert.deepEqual(afterClose([{id:'a'}],'a','a'),{docs:[],active:null});
});

test('close: closing another document keeps the selection', () => {
  assert.deepEqual(afterClose([{id:'a'},{id:'b'}],'a','b'),{docs:[{id:'b'}],active:'b'});
  assert.deepEqual(afterClose([{id:'a'}],'zzz','a'),{docs:[{id:'a'}],active:'a'});
});
