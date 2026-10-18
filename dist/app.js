const $=s=>document.querySelector(s);
const initial=`# A fresh page. A clear mind.

Welcome to **Folio**, your little corner of the internet for putting thoughts into words.

Start writing here, or import a Markdown file to pick up where you left off.

## Make it your own

- Create a new document for a fresh start
- Write in Markdown and watch your ideas take shape
- Save your work here, then export it anywhere

> You don't have to see the whole staircase. Just take the first step.

## A few helpful shortcuts

Use **bold** for the important bits, *italics* for a little emphasis, and \`inline code\` for the technical ones.

\`\`\`markdown
# A big idea
## A smaller thought
- One thing at a time
\`\`\`

---

Ready when you are.
`;
const files=FolioFiles.createFileSaving(window),drafts=FolioDrafts.createDrafts(window);
const state=doc=>doc.source?drafts.state(doc):files.state(doc);
const key='folio.documents.v1';let docs=[],active,dirty=false,timer;
let restored=false;try{const stored=JSON.parse(localStorage.getItem(key));if(Array.isArray(stored?.docs)&&stored.docs.every(d=>typeof d.id==='string'&&typeof d.name==='string'&&typeof d.text==='string')){docs=stored.docs;active=stored.active;restored=true}}catch{}
// Seed the welcome page only on a first visit, so closing every document leaves an empty state.
if(!docs.length&&!restored)docs=[{id:crypto.randomUUID(),name:'Welcome.md',text:initial}];if(!docs.some(d=>d.id===active))active=docs[0]?.id??null;
const current=()=>docs.find(d=>d.id===active);
const status=()=>{$('#saved').textContent=current()?state(current()):''};
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('visible'),3000)}
function persist(feedback=false){try{localStorage.setItem(key,JSON.stringify({docs,active}));dirty=false;status();if(feedback)notify('Saved in this browser')}catch{dirty=true;$('#saved').textContent='Not saved';notify('Browser storage is unavailable or full. Export your document to keep it.')}}
function list(){const nav=$('#documents');nav.replaceChildren();docs.forEach(d=>{const item=el('div','doc-item'),b=document.createElement('button');b.className=d.id===active?'selected':'';b.setAttribute('aria-current',d.id===active?'page':'false');const icon=document.createElement('span');icon.textContent='▤';const label=document.createElement('span');label.textContent=d.name;b.append(icon,label);b.onclick=()=>{active=d.id;render();persist()};const x=el('button','doc-close','×');x.title='Close';x.setAttribute('aria-label','Close '+d.name);x.onclick=()=>closeDoc(d.id);item.append(b,x);nav.append(item)});$('#doc-count').textContent=docs.length}
function preview(){const text=$('#editor').value;$('#preview').innerHTML=DOMPurify.sanitize(marked.parse(text),{FORBID_TAGS:['style','iframe','form','input'],FORBID_ATTR:['style']});$('#preview').querySelectorAll('a').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer'});$('#words').textContent=(text.trim()?text.trim().split(/\s+/).length:0)+' words';$('#chars').textContent=text.length.toLocaleString()+' characters';if(fmBlock)$('#preview').prepend(fmHeader())}
// Front matter is split off once per render and kept as the exact original bytes (fmBlock). The editor shows
// only the body; saving always stores fmBlock + body, so untouched YAML round-trips byte for byte.
let fmBlock='',fmOpen=true,fmEditing=false;
const FM_KNOWN=['title','subtitle','status','channel','due','version','updated','linear'];
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const pill=status=>{const p=el('span','fm-pill',status);p.dataset.status=status;return p};
function fmSummary(){
  const list=FolioFrontMatter.entries(fmBlock),known=new Map(list.filter(e=>FM_KNOWN.includes(e.key)).map(e=>[e.key,e])),dl=$('#fm-summary'),other=$('#fm-other');
  dl.replaceChildren();FM_KNOWN.filter(k=>known.has(k)&&k!=='status').forEach(k=>{const e=known.get(k),dd=el('dd');dd.textContent=e.nested?'(nested)':e.value||'—';dl.append(el('dt',k==='title'||k==='subtitle'?'wide':'',k),dd)});
  other.replaceChildren();const rest=list.filter(e=>!FM_KNOWN.includes(e.key));if(rest.length){other.append(el('span','fm-other-label','Other keys'));rest.forEach(e=>other.append(el('code','',e.nested||!e.value?e.key:e.key+': '+e.value)))}
}
function fmPanel(){
  const panel=$('#fm-panel');panel.hidden=!fmBlock;if(!fmBlock){fmEditing=false;return}
  const status=(FolioFrontMatter.fields(fmBlock).status||'');$('#fm-pill-slot').replaceChildren(...(status?[pill(status)]:[]));$('#fm-pill-slot').title='status';
  panel.classList.toggle('collapsed',!fmOpen);$('#fm-toggle').setAttribute('aria-expanded',String(fmOpen));
  $('#fm-edit').textContent=fmEditing?'Done':'Edit YAML';$('#fm-edit').setAttribute('aria-pressed',String(fmEditing));
  $('#fm-yaml').hidden=!fmEditing;$('#fm-summary').hidden=$('#fm-other').hidden=fmEditing;
  if(fmEditing&&document.activeElement!==$('#fm-yaml')){$('#fm-yaml').value=FolioFrontMatter.parts(fmBlock).yaml;$('#fm-yaml').classList.remove('invalid');$('#fm-error').textContent=''}
  fmSummary();
}
function fmHeader(){
  const f=FolioFrontMatter.fields(fmBlock),h=el('div','fm-header');
  const top=el('div','fm-header-top');if(f.status)top.append(pill(f.status));top.append(el('span','fm-header-label','Front matter'));h.append(top);
  if(f.title)h.append(el('p','fm-header-title',f.title));if(f.subtitle)h.append(el('p','fm-header-subtitle',f.subtitle));
  const meta=['channel','due','version','updated','linear'].filter(k=>f[k]).map(k=>(k==='version'?'v':k+' ')+f[k]);if(meta.length)h.append(el('p','fm-header-meta',meta.join(' · ')));
  return h
}
$('#fm-toggle').onclick=()=>{fmOpen=!fmOpen;fmPanel()};
$('#fm-edit').onclick=()=>{fmEditing=!fmEditing;if(fmEditing)fmOpen=true;fmPanel();if(fmEditing)$('#fm-yaml').focus()};
$('#fm-yaml').addEventListener('input',()=>{const next=FolioFrontMatter.withYaml(fmBlock,$('#fm-yaml').value);if(next===null){$('#fm-yaml').classList.add('invalid');$('#fm-error').textContent='A line containing only --- or ... would end the front matter early. Remove it to save.';return}
  $('#fm-yaml').classList.remove('invalid');$('#fm-error').textContent='';fmBlock=next;current().text=FolioFrontMatter.join(fmBlock,$('#editor').value);fmPanel();preview();persist()});
function render(){const empty=!current();$('main').classList.toggle('empty',empty);$('#empty').hidden=!empty;if(empty){fmBlock='';list();status();return}
  const {frontMatter,body}=FolioFrontMatter.split(current().text);fmBlock=frontMatter;fmEditing=false;$('#title').value=current().name;$('#editor').value=body;list();fmPanel();preview()}
function update(){if(!current())return;current().text=FolioFrontMatter.join(fmBlock,$('#editor').value);preview();persist()}
function create(name='Untitled.md',text=''){const d={id:crypto.randomUUID(),name,text};docs.unshift(d);active=d.id;render();persist();$('#editor').focus();return d}
$('#new').onclick=()=>{let i=1;while(docs.some(d=>d.name===`Untitled${i===1?'':' '+i}.md`))i++;create(`Untitled${i===1?'':' '+i}.md`)};
$('#editor').addEventListener('input',update);
$('#title').oninput=()=>{if(!current())return;current().name=$('#title').value;list();persist()};$('#title').onblur=()=>{if(!current())return;let n=$('#title').value.trim()||'Untitled.md';if(!/\.(md|markdown)$/i.test(n))n+='.md';current().name=n;$('#title').value=n;list();persist()};
function download(doc=current()) {
  const url=URL.createObjectURL(new Blob([doc.text],{type:'text/markdown;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=FolioFiles.filename(doc.name);
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  notify('Download requested. Check your browser downloads.');
}
// Replace a draft with GitHub's latest version, keeping the given local text as a separate local copy.
function loadLatestKeepingCopy(doc,mine,latest){
  const copy={id:crypto.randomUUID(),name:doc.source.slug+' (my edits).md',text:mine};docs.splice(docs.indexOf(doc)+1,0,copy);
  doc.text=latest.text;drafts.attach(doc,latest);if(active===doc.id)render();else list();
  notify('Loaded the latest '+doc.source.slug+'. Your edits are in "'+copy.name+'".');
}
async function saveDraft(doc) {
  try {
    const pending=drafts.save(doc);$('#saved').textContent=state(doc);const result=await pending;
    if(result.status==='saved')notify(doc.text===result.text?(result.overwrote?'Overwrote the newer version of ':'Committed ')+doc.source.slug:'Committed; newer edits still need saving.');
    if(result.status==='reloaded')loadLatestKeepingCopy(doc,result.mine,result.latest);
    persist();
  } catch(error) {notify(error.name==='DraftsUnavailable'?error.message:'Could not commit '+doc.source.slug+' ('+error.message+'). Your draft is still here.')}
  finally {if(!dirty)status()}
}
async function saveFile(saveAs=false) {
  const doc=current();if(!doc)return;if(doc.source&&!saveAs)return saveDraft(doc);
  try {
    const pending=files.save(doc,saveAs);
    if(!dirty)status();
    const result=await pending;
    if(result.status==='download'){download(doc);notify('Direct file saving is unavailable here. A copy was downloaded.');return}
    if(result.status!=='saved')return;
    if(doc.name===result.originalName)doc.name=result.name;
    if(active===doc.id)$('#title').value=doc.name;
    list();persist();
    notify(doc.text===result.text?'Saved to '+result.name:'File saved; newer edits still need saving.');
  } catch(error) {
    notify(error.name==='NotAllowedError'?'File permission was denied. Try Save As or Export.':'Could not save the file. Your draft is still open; try Save As or Export.');
  } finally {if(!dirty)status()}
}
$('#save').onclick=()=>saveFile();$('#save-as').onclick=()=>saveFile(true);
$('#export').onclick=()=>{if(current())download()};
// Close a document. A clean GitHub draft just drops its local copy (GitHub holds it); anything that would be lost asks first.
function closeDoc(id){
  const doc=docs.find(d=>d.id===id);if(!doc)return;
  const warning=FolioDocuments.closeWarning(doc,{draftDirty:!!doc.source&&drafts.dirty(doc),fileSaved:!doc.source&&files.state(doc)==='File saved',pristine:['',initial]});
  if(warning&&!confirm(warning))return;
  ({docs,active}=FolioDocuments.afterClose(docs,id,active));render();persist();
  notify('Closed '+doc.name+(doc.source?'. It is still in GitHub: use Open draft to reopen it.':''));
}
$('#close-doc').onclick=()=>{if(current())closeDoc(current().id)};
$('#empty-new').onclick=()=>$('#new').click();$('#empty-open').onclick=()=>$('#open-draft').click();
async function importFile(file,handle) {
  if(!/\.(md|markdown|txt)$/i.test(file.name))throw Error('Choose a .md, .markdown or .txt file');
  if(file.size>5*1024*1024)throw Error('Please choose a file smaller than 5 MB');
  const text=await file.text(),doc=create(file.name,text);
  if(handle){files.attach(doc.id,handle,text);persist()}
}
$('#import').onclick=async()=>{
  if(!files.canOpen){$('#file').click();return}
  try {const handles=await files.open();let count=0;for(const handle of handles){try{await importFile(await handle.getFile(),handle);count++}catch(error){notify(error.message);return}}if(count)notify('Opened '+count+' document'+(count===1?'':'s'))}
  catch(error){if(error.name!=='AbortError'){notify('Direct opening is unavailable. Import a copy instead.');$('#file').click()}}
};
// Open a draft from the folio-drafts repo. An already-open draft is checked against GitHub: unchanged, it is
// just selected; if GitHub is newer the user always chooses (load, review the diff, or keep editing).
$('#open-draft').onclick=async()=>{
  const dialog=$('#drafts-dialog'),ul=$('#drafts-list');ul.replaceChildren();
  try{const posts=await drafts.list();if(!posts.length)ul.textContent='No drafts yet.';
    posts.forEach(p=>{const li=document.createElement('li'),b=document.createElement('button');b.textContent=p.slug;b.onclick=()=>{dialog.close();openDraft(p.slug)};li.append(b);ul.append(li)});dialog.showModal()}
  catch(error){notify(error.name==='DraftsUnavailable'?error.message:'Could not list drafts ('+error.message+').')}
};
function choose(dialog){return new Promise(resolve=>{dialog.returnValue='';dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true});dialog.showModal()})}
function showDiff(mine,theirs){
  const view=$('#diff-view');view.replaceChildren();
  FolioDiff.review(mine,theirs).forEach(row=>{
    if(row.type==='skip'){view.append(el('div','diff-skip','⋯ '+row.count+' unchanged line'+(row.count===1?'':'s')));return}
    const line=el('div','diff-row '+row.type),text=el('span','diff-text');line.append(el('span','diff-sign',row.type==='del'?'−':row.type==='add'?'+':''),text);
    if(row.parts)row.parts.forEach(p=>text.append(p.type==='same'?document.createTextNode(p.text):el('mark','',p.text)));else text.textContent=row.text;
    view.append(line)});
}
function useLatest(doc,latest){doc.text=latest.text;drafts.attach(doc,latest);render();notify('Loaded the latest '+doc.source.slug+' from GitHub.')}
async function openDraft(slug){
  const existing=docs.find(d=>d.source?.slug===slug);let post;
  try{post=await drafts.open(slug)}
  catch(error){
    if(existing){active=existing.id;render();persist();notify('Could not check GitHub for a newer '+slug+'; showing your local copy.');return}
    notify(error.name==='DraftsUnavailable'?error.message:'Could not open '+slug+' ('+error.message+').');return}
  if(!existing){const doc=create(slug+'.md',post.text);drafts.attach(doc,post);persist();notify('Opened draft '+slug);return}
  active=existing.id;render();persist();const decision=FolioDrafts.reopenDecision(existing,post);
  if(decision==='switch'){notify(slug+' is already open and up to date.');return}
  if(decision==='sync'){drafts.attach(existing,post);persist();notify(slug+' already matches the latest version on GitHub.');return}
  const edits=drafts.dirty(existing);
  $('#refresh-text').textContent=edits?'You have unsaved edits to '+slug+'. Load latest keeps them as a separate copy.':'Your copy of '+slug+' has no unsaved edits.';
  let choice=await choose($('#refresh-dialog'));
  if(choice==='review'){$('#diff-title').textContent='Changes in '+slug;showDiff(existing.text,post.text);choice=await choose($('#diff-dialog'))}
  if(choice==='load'&&edits||choice==='both')loadLatestKeepingCopy(existing,existing.text,post);
  else if(choice==='load'||choice==='theirs')useLatest(existing,post);
  else notify('Kept your copy. Saving will ask before replacing the newer version on GitHub.');
  persist();
}
$('#file').onchange=async e=>{try{for(const file of e.target.files)await importFile(file);notify('Imported Markdown documents')}catch(error){notify(error.message)}finally{e.target.value=''}};
document.querySelectorAll('[data-mode]').forEach(b=>{if(b.tagName==='BUTTON')b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b))});$('.panes').dataset.mode=b.dataset.mode}});
// Block-level inserts start a new line when the cursor is mid-line, same as lists and quotes.
function format(kind){const t=$('#editor'),start=t.selectionStart,end=t.selectionEnd,selected=t.value.slice(start,end);const orderedBody=selected?selected.split('\n').map((line,i)=>i?`${i+1}. ${line}`:line).join('\n'):'List item';const formats={bold:['**',selected||'bold text','**'],italic:['*',selected||'italic text','*'],strike:['~~',selected||'deleted text','~~'],inline:['`',selected||'code','`'],h1:['# ',selected||'Heading',''],h2:['## ',selected||'Heading',''],h3:['### ',selected||'Heading',''],link:['[',selected||'link text','](https://example.com)'],list:['- ',selected?selected.replace(/\n/g,'\n- '):'List item',''],ordered:['1. ',orderedBody,''],quote:['> ',selected?selected.replace(/\n/g,'\n> '):'A thought worth keeping',''],code:['\n```\n',selected||'your code','\n```\n'],divider:['\n---\n','','']};let [before,value,after]=formats[kind];if(['h1','h2','h3','list','ordered','quote','divider','code'].includes(kind)&&start>0&&t.value[start-1]!=='\n')before='\n'+before;t.setRangeText(before+value+after,start,end,'end');t.focus();t.setSelectionRange(start+before.length,start+before.length+value.length);update()}
document.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>format(b.dataset.format));
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='s'){e.preventDefault();saveFile(e.shiftKey)}if(e.target===$('#editor')&&['b','i'].includes(e.key.toLowerCase())){e.preventDefault();format(e.key.toLowerCase()==='b'?'bold':'italic')}}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});render();persist();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'create_markdown_document',description:'Create and locally save a new Markdown document in the editor.',inputSchema:{type:'object',properties:{name:{type:'string'},markdown:{type:'string'}},required:['name','markdown'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input.name!=='string'||typeof input.markdown!=='string'||!input.name.trim())throw Error('A name and Markdown string are required');const d=create(input.name,input.markdown);return {id:d.id,name:d.name,saved:!dirty}}})).catch(()=>{})}catch{}}
