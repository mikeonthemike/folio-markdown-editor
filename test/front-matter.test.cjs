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
