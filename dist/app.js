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
try{const stored=JSON.parse(localStorage.getItem(key));if(Array.isArray(stored?.docs)&&stored.docs.every(d=>typeof d.id==='string'&&typeof d.name==='string'&&typeof d.text==='string')){docs=stored.docs;active=stored.active}}catch{}
if(!docs.length)docs=[{id:crypto.randomUUID(),name:'Welcome.md',text:initial}];if(!docs.some(d=>d.id===active))active=docs[0].id;
const current=()=>docs.find(d=>d.id===active);
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('visible'),3000)}
function persist(feedback=false){try{localStorage.setItem(key,JSON.stringify({docs,active}));dirty=false;$('#saved').textContent=state(current());if(feedback)notify('Saved in this browser')}catch{dirty=true;$('#saved').textContent='Not saved';notify('Browser storage is unavailable or full. Export your document to keep it.')}}
function list(){const nav=$('#documents');nav.replaceChildren();docs.forEach(d=>{const b=document.createElement('button');b.className=d.id===active?'selected':'';b.setAttribute('aria-current',d.id===active?'page':'false');const icon=document.createElement('span');icon.textContent='▤';const label=document.createElement('span');label.textContent=d.name;b.append(icon,label);b.onclick=()=>{active=d.id;render();persist()};nav.append(b)});$('#doc-count').textContent=docs.length}
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
function render(){const {frontMatter,body}=FolioFrontMatter.split(current().text);fmBlock=frontMatter;fmEditing=false;$('#title').value=current().name;$('#editor').value=body;list();fmPanel();preview()}
function update(){current().text=FolioFrontMatter.join(fmBlock,$('#editor').value);preview();persist()}
function create(name='Untitled.md',text=''){const d={id:crypto.randomUUID(),name,text};docs.unshift(d);active=d.id;render();persist();$('#editor').focus();return d}
$('#new').onclick=()=>{let i=1;while(docs.some(d=>d.name===`Untitled${i===1?'':' '+i}.md`))i++;create(`Untitled${i===1?'':' '+i}.md`)};
$('#editor').addEventListener('input',update);
$('#title').oninput=()=>{current().name=$('#title').value;list();persist()};$('#title').onblur=()=>{let n=$('#title').value.trim()||'Untitled.md';if(!/\.(md|markdown)$/i.test(n))n+='.md';current().name=n;$('#title').value=n;list();persist()};
function download(doc=current()) {
  const url=URL.createObjectURL(new Blob([doc.text],{type:'text/markdown;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=FolioFiles.filename(doc.name);
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  notify('Download requested. Check your browser downloads.');
}
async function saveDraft(doc) {
  try {
    const pending=drafts.save(doc);$('#saved').textContent=state(doc);const result=await pending;
    if(result.status==='saved')notify(doc.text===result.text?(result.overwrote?'Overwrote the newer version of ':'Committed ')+doc.source.slug:'Committed; newer edits still need saving.');
    if(result.status==='reloaded'){
      const copy={id:crypto.randomUUID(),name:doc.source.slug+' (my edits).md',text:result.mine};docs.splice(docs.indexOf(doc)+1,0,copy);
      doc.text=result.latest.text;drafts.attach(doc,result.latest);if(active===doc.id)render();else list();
      notify('Loaded the latest '+doc.source.slug+'. Your edits are in "'+copy.name+'".');
    }
    persist();
  } catch(error) {notify(error.name==='DraftsUnavailable'?error.message:'Could not commit '+doc.source.slug+' ('+error.message+'). Your draft is still here.')}
  finally {if(!dirty)$('#saved').textContent=state(current())}
}
async function saveFile(saveAs=false) {
  const doc=current();if(doc.source&&!saveAs)return saveDraft(doc);
  try {
    const pending=files.save(doc,saveAs);
    if(!dirty)$('#saved').textContent=state(current());
    const result=await pending;
    if(result.status==='download'){download(doc);notify('Direct file saving is unavailable here. A copy was downloaded.');return}
    if(result.status!=='saved')return;
    if(doc.name===result.originalName)doc.name=result.name;
    if(active===doc.id)$('#title').value=doc.name;
    list();persist();
    notify(doc.text===result.text?'Saved to '+result.name:'File saved; newer edits still need saving.');
  } catch(error) {
    notify(error.name==='NotAllowedError'?'File permission was denied. Try Save As or Export.':'Could not save the file. Your draft is still open; try Save As or Export.');
  } finally {if(!dirty)$('#saved').textContent=state(current())}
}
$('#save').onclick=()=>saveFile();$('#save-as').onclick=()=>saveFile(true);
$('#export').onclick=()=>download();
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
// Open a draft from the folio-drafts repo. An already-open draft is reused, so local edits are never overwritten.
$('#open-draft').onclick=async()=>{
  const dialog=$('#drafts-dialog'),ul=$('#drafts-list');ul.replaceChildren();
  try{const posts=await drafts.list();if(!posts.length)ul.textContent='No drafts yet.';
    posts.forEach(p=>{const li=document.createElement('li'),b=document.createElement('button');b.textContent=p.slug;b.onclick=()=>{dialog.close();openDraft(p.slug)};li.append(b);ul.append(li)});dialog.showModal()}
  catch(error){notify(error.name==='DraftsUnavailable'?error.message:'Could not list drafts ('+error.message+').')}
};
async function openDraft(slug){
  const existing=docs.find(d=>d.source?.slug===slug);if(existing){active=existing.id;render();persist();notify('Already open: '+slug);return}
  try{const post=await drafts.open(slug),doc=create(slug+'.md',post.text);drafts.attach(doc,post);persist();notify('Opened draft '+slug)}
  catch(error){notify(error.name==='DraftsUnavailable'?error.message:'Could not open '+slug+' ('+error.message+').')}
}
$('#file').onchange=async e=>{try{for(const file of e.target.files)await importFile(file);notify('Imported Markdown documents')}catch(error){notify(error.message)}finally{e.target.value=''}};
document.querySelectorAll('[data-mode]').forEach(b=>{if(b.tagName==='BUTTON')b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b))});$('.panes').dataset.mode=b.dataset.mode}});
// Block-level inserts start a new line when the cursor is mid-line, same as lists and quotes.
function format(kind){const t=$('#editor'),start=t.selectionStart,end=t.selectionEnd,selected=t.value.slice(start,end);const orderedBody=selected?selected.split('\n').map((line,i)=>i?`${i+1}. ${line}`:line).join('\n'):'List item';const formats={bold:['**',selected||'bold text','**'],italic:['*',selected||'italic text','*'],strike:['~~',selected||'deleted text','~~'],inline:['`',selected||'code','`'],h1:['# ',selected||'Heading',''],h2:['## ',selected||'Heading',''],h3:['### ',selected||'Heading',''],link:['[',selected||'link text','](https://example.com)'],list:['- ',selected?selected.replace(/\n/g,'\n- '):'List item',''],ordered:['1. ',orderedBody,''],quote:['> ',selected?selected.replace(/\n/g,'\n> '):'A thought worth keeping',''],code:['\n```\n',selected||'your code','\n```\n'],divider:['\n---\n','','']};let [before,value,after]=formats[kind];if(['h1','h2','h3','list','ordered','quote','divider','code'].includes(kind)&&start>0&&t.value[start-1]!=='\n')before='\n'+before;t.setRangeText(before+value+after,start,end,'end');t.focus();t.setSelectionRange(start+before.length,start+before.length+value.length);update()}
document.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>format(b.dataset.format));
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='s'){e.preventDefault();saveFile(e.shiftKey)}if(e.target===$('#editor')&&['b','i'].includes(e.key.toLowerCase())){e.preventDefault();format(e.key.toLowerCase()==='b'?'bold':'italic')}}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});render();persist();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'create_markdown_document',description:'Create and locally save a new Markdown document in the editor.',inputSchema:{type:'object',properties:{name:{type:'string'},markdown:{type:'string'}},required:['name','markdown'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input.name!=='string'||typeof input.markdown!=='string'||!input.name.trim())throw Error('A name and Markdown string are required');const d=create(input.name,input.markdown);return {id:d.id,name:d.name,saved:!dirty}}})).catch(()=>{})}catch{}}
