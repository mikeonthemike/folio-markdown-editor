const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {split,join,fields}=require('../dist/front-matter.js');
// Real post from mikeonthemike/folio-drafts (posts/example/index.md), copied as a fixture.
const example=fs.readFileSync(path.join(__dirname,'fixtures/example-post.md'),'utf8');

const cases={
  'real example post':example,
  'no front matter':'# Title\n\nBody\n',
  'empty document':'',
  'CRLF line endings':'---\r\ntitle: A\r\nstatus: draft\r\n---\r\n\r\nBody\r\n',
  'byte order mark':'\uFEFF---\ntitle: A\n---\nBody',
  'dots terminator':'---\ntitle: A\n...\nBody',
  'empty block':'---\n---\nBody',
  'closing line at end of file':'---\ntitle: A\n---',
  'unterminated block is body':'---\ntitle: A\nno closing line\n',
  'thematic break later is not front matter':'Intro\n\n---\n\ntitle: no\n---\n',
  'body contains its own --- rule':'---\ntitle: A\n---\nPart one\n\n---\n\nPart two\n',
  'unicode and odd YAML':'---\ntitle: "Māori 🌱"\nlist: [a, b]\nnested:\n  deep: {x: 1}\nblock: |\n  keep\n   this\n# comment\n---\nBody',
};

for(const [name,text] of Object.entries(cases)){
  test(`join(split()) round-trips byte for byte: ${name}`,()=>{
    const {frontMatter,body}=split(text);
    assert.equal(join(frontMatter,body),text);
  });
}

test('editing the body leaves the front matter bytes untouched, including unknown keys and comments',()=>{
  const {frontMatter,body}=split(example);
  const edited=join(frontMatter,body.replace('Edit this paragraph','I edited this paragraph'));
  assert.equal(split(edited).frontMatter,frontMatter);
  assert.match(edited,/^# Unknown keys like this one, and this comment, must survive a Folio save\.$/m);
  assert.match(edited,/^april_notes:\n  tone: plain, concise$/m);
  assert.notEqual(edited,example);
});

test('the body excludes the front matter, so it is not rendered as Markdown',()=>{
  const {frontMatter,body}=split(example);
  assert.ok(frontMatter.startsWith('---\n')&&frontMatter.endsWith('---\n'));
  assert.ok(body.startsWith('\n# Example post'));
  assert.doesNotMatch(body,/status: draft/);
});

test('a document without front matter is all body',()=>{
  assert.deepEqual(split('# Hi\n'),{frontMatter:'',body:'# Hi\n'});
  assert.deepEqual(split('---\nnot closed'),{frontMatter:'',body:'---\nnot closed'});
});

test('fields reads the known top-level scalars for display',()=>{
  const f=fields(split(example).frontMatter);
  assert.equal(f.title,'Example post');
  assert.equal(f.status,'draft');
  assert.equal(f.channel,'site');
  assert.equal(f.linear,'');
  assert.equal(f.version,'1');
  assert.equal(f.tone,undefined,'nested keys are not top-level fields');
  assert.deepEqual(fields(''),{});
});

// The editor UI keeps the split-off block as-is and only ever rejoins it with the edited body,
// or swaps the YAML inside it via withYaml. These tests follow that exact path.
const {parts,withYaml,entries}=require('../dist/front-matter.js');
const uiEdit = (text, editBody = b => b, editYaml) => {
  let { frontMatter, body } = split(text);
  if (editYaml) frontMatter = withYaml(frontMatter, editYaml(parts(frontMatter).yaml));
  return join(frontMatter, editBody(body));
};

test('panel path: returns the example byte for byte when nothing is edited', () => {
  assert.equal(uiEdit(example), example);
});

test('panel path: keeps the front matter bytes when only the body changes', () => {
  const out = uiEdit(example, b => b + '\nNew line.\n');
  assert.equal(split(out).frontMatter, split(example).frontMatter);
  assert.ok(out.endsWith('\nNew line.\n'));
});

test('panel path: keeps the body and delimiters when only the YAML changes', () => {
  const out = uiEdit(example, undefined, y => y.replace('status: draft', 'status: in-review'));
  assert.equal(split(out).body, split(example).body);
  assert.equal(out, example.replace('status: draft', 'status: in-review'));
});

test('panel path: preserves CRLF, BOM and a ... closer through a YAML edit', () => {
  const text = '\uFEFF---\r\ntitle: A\r\n...\r\nBody\r\n';
  assert.equal(uiEdit(text, undefined, y => y + 'status: final'), '\uFEFF---\r\ntitle: A\r\nstatus: final\r\n...\r\nBody\r\n');
});

test('panel path: refuses YAML that would close the block early', () => {
  const { frontMatter } = split(example);
  assert.equal(withYaml(frontMatter, 'title: A\n---\nstatus: draft\n'), null);
  assert.equal(withYaml(frontMatter, 'title: A\n...\n'), null);
});

test('panel path: lists known and unknown keys, flagging nested values without parsing them', () => {
  const list = entries(split(example).frontMatter);
  assert.deepEqual(list.map(e => e.key), ['title', 'subtitle', 'linear', 'status', 'channel', 'due', 'version', 'updated', 'april_notes']);
  assert.deepEqual(list.find(e => e.key === 'april_notes'), { key: 'april_notes', value: '', nested: true });
  assert.equal(list.find(e => e.key === 'linear').value, '');
});
