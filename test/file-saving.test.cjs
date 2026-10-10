const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createFileSaving}=require('../dist/file-saving.js');
function fixture(){
 let disk='original',writes=0;
 const handle={name:'notes.md',getFile:async()=>({text:async()=>disk}),createWritable:async()=>({write:async text=>{disk=text;writes++},close:async()=>{},abort:async()=>{}})};
 return {handle,read:()=>disk,writes:()=>writes,external:text=>disk=text};
}
test('Save chooses a file once then updates it, preserving Unicode and newlines',async()=>{
 const f=fixture();let picks=0;
 const fs=createFileSaving({showSaveFilePicker:async()=>{picks++;return f.handle},confirm:()=>true});
 const doc={id:'a',name:'notes.md',text:'# Māori\n\nHello 🌱'};
 assert.equal((await fs.save(doc)).status,'saved');assert.equal(f.read(),doc.text);
 doc.text+='\nAgain';assert.equal(fs.state(doc),'File has unsaved changes');
 await fs.save(doc);assert.equal(picks,1);assert.equal(f.read(),doc.text);assert.equal(fs.state(doc),'File saved');
 await fs.save(doc,true);assert.equal(picks,2);
});
test('Import retains the original handle and protects external edits',async()=>{
 const f=fixture();const fs=createFileSaving({showSaveFilePicker:async()=>{throw Error('Unexpected picker')},confirm:()=>false});
 fs.attach('a',f.handle,'original');const doc={id:'a',name:'notes.md',text:'edited'};
 f.external('edited outside');assert.equal((await fs.save(doc)).status,'cancelled');assert.equal(f.writes(),0);
});
test('Cancelled picker leaves document unlinked; failed writes never report saved',async()=>{
 const f=fixture();let cancel=true;
 const fs=createFileSaving({showSaveFilePicker:async()=>{if(cancel)throw Object.assign(Error(),{name:'AbortError'});return f.handle}});
 const doc={id:'a',name:'notes.md',text:'text'};
 assert.equal((await fs.save(doc)).status,'cancelled');assert.equal(fs.state(doc),'Browser copy');
 cancel=false;f.handle.createWritable=async()=>{throw Object.assign(Error('denied'),{name:'NotAllowedError'})};
 await assert.rejects(fs.save(doc));assert.equal(fs.state(doc),'Browser copy');
});
test('Save captures the initiating document and keeps subsequent edits unsaved',async()=>{
 const f=fixture();let release;
 const fs=createFileSaving({showSaveFilePicker:()=>new Promise(resolve=>release=resolve)});
 const doc={id:'a',name:'notes.md',text:'first'};const save=fs.save(doc);doc.text='second';
 assert.equal((await fs.save(doc)).status,'busy');release(f.handle);await save;
 assert.equal(f.read(),'first');assert.equal(fs.state(doc),'File has unsaved changes');
});
test('Unsupported browsers request download fallback',async()=>{
 const fs=createFileSaving({});assert.equal(fs.supported,false);
 assert.equal((await fs.save({id:'a',name:'notes.md',text:''})).status,'download');
});
