const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDrafts}=require('../dist/drafts.js');

// A fake drafts API with the same contract as the Worker: PUT must name the current sha.
function server(initial){
  const repo={sha:'a'.repeat(40),text:initial,commits:0};
  const fetch=async(url,init={})=>{
    if(init.method==='PUT'){const b=JSON.parse(init.body);if(b.sha!==repo.sha)return Response.json({error:'conflict'},{status:409});repo.text=b.text;repo.sha=String(++repo.commits).padStart(40,'0');return Response.json({slug:'example',sha:repo.sha})}
    if(url==='/api/posts/example')return Response.json({slug:'example',sha:repo.sha,text:repo.text});
    return Response.json({error:'not_found'},{status:404});
  };
  return {repo,fetch,externalEdit(text){repo.text=text;repo.sha='e'.repeat(40)}};
}
async function opened(s,confirm=()=>{throw Error('unexpected prompt')}){
  const drafts=createDrafts({fetch:s.fetch,confirm});const doc={id:'d',name:'example.md',text:''};
  const post=await drafts.open('example');doc.text=post.text;drafts.attach(doc,post);return {drafts,doc};
}

test('Save commits the edit and the next save builds on the new version',async()=>{
  const s=server('v1');const {drafts,doc}=await opened(s);
  doc.text='v2 Māori 🌱';assert.equal(drafts.state(doc),'Draft has unsaved changes');
  assert.equal((await drafts.save(doc)).status,'saved');assert.equal(s.repo.text,'v2 Māori 🌱');assert.equal(drafts.state(doc),'Saved to drafts');
  doc.text='v3';await drafts.save(doc);assert.equal(s.repo.text,'v3');assert.equal(s.repo.commits,2);
});

test('An outside change prompts; OK overwrites it with this document',async()=>{
  const s=server('v1');let prompts=0;const {drafts,doc}=await opened(s,()=>{prompts++;return true});
  s.externalEdit('April changed this');doc.text='mine';
  const r=await drafts.save(doc);
  assert.equal(prompts,1);assert.equal(r.status,'saved');assert.equal(r.overwrote,true);assert.equal(s.repo.text,'mine');assert.equal(drafts.state(doc),'Saved to drafts');
});

test('An outside change prompts; Cancel leaves the repo alone and returns both versions',async()=>{
  const s=server('v1');const {drafts,doc}=await opened(s,()=>false);
  s.externalEdit('April changed this');doc.text='mine';
  const r=await drafts.save(doc);
  assert.equal(r.status,'reloaded');assert.equal(r.mine,'mine');assert.equal(r.latest.text,'April changed this');
  assert.equal(s.repo.text,'April changed this');assert.equal(s.repo.commits,0);
});

test('Save commits the text as it was when Save was pressed; later edits stay unsaved',async()=>{
  const s=server('v1');const {drafts,doc}=await opened(s);
  doc.text='at save';const p=drafts.save(doc);assert.equal(drafts.state(doc),'Committing…');
  assert.equal((await drafts.save(doc)).status,'busy');doc.text='typed during save';await p;
  assert.equal(s.repo.text,'at save');assert.equal(drafts.state(doc),'Draft has unsaved changes');
});

test('Network failure explains how to recover and never reports saved',async()=>{
  const drafts=createDrafts({fetch:async()=>{throw TypeError('Failed to fetch')}});
  const doc={id:'d',text:'x',source:{slug:'example',sha:'a'.repeat(40),text:''}};
  await assert.rejects(drafts.save(doc),{name:'DraftsUnavailable'});assert.equal(drafts.state(doc),'Draft has unsaved changes');
});
