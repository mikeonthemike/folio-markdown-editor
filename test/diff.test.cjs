const {test}=require('node:test');
const assert=require('node:assert/strict');
const {diffLines,diffWords,review}=require('../dist/diff.js');

const side=(ops,keep)=>ops.filter(o=>o.type==='same'||o.type===keep).map(o=>o.text);

test('diffLines: identical text is all unchanged', () => {
  assert.ok(diffLines('a\nb\n','a\nb\n').every(o=>o.type==='same'));
});

test('diffLines: each side can be rebuilt from its ops', () => {
  const a='---\ntitle: T\nstatus: draft\n---\n\nOne\nTwo\nThree\n', b='---\ntitle: T\nstatus: final\n---\n\nOne\nThree\nFour\n';
  const ops=diffLines(a,b);
  assert.equal(side(ops,'del').join('\n'),a);
  assert.equal(side(ops,'add').join('\n'),b);
  assert.deepEqual(ops.filter(o=>o.type!=='same'),[{type:'del',text:'status: draft'},{type:'add',text:'status: final'},{type:'del',text:'Two'},{type:'add',text:'Four'}]);
});

test('diffLines: CRLF and LF compare as the same lines', () => {
  assert.ok(diffLines('a\r\nb','a\nb').every(o=>o.type==='same'));
});

test('diffWords: marks only the changed words and keeps spacing', () => {
  const ops=diffWords('the date wins','the date always wins');
  assert.deepEqual(ops.filter(o=>o.type!=='same').map(o=>o.type+':'+o.text),['add:always','add: ']);
  assert.equal(side(ops,'add').join(''),'the date always wins');
});

test('review: pairs changed lines with word parts and collapses distant unchanged lines', () => {
  const a=['---','status: draft','---','',...'abcdefghij'.split(''),'end old'].join('\n');
  const b=['---','status: in-review','---','',...'abcdefghij'.split(''),'end new','extra'].join('\n');
  const rows=review(a,b);
  const del=rows.find(r=>r.type==='del'&&r.text==='status: draft');
  assert.deepEqual(del.parts.filter(p=>p.type==='del').map(p=>p.text),['draft']);
  assert.ok(rows.some(r=>r.type==='skip'&&r.count>0));
  assert.deepEqual(rows.filter(r=>r.type==='add').map(r=>r.text),['status: in-review','end new','extra']);
  assert.ok(!rows.find(r=>r.text==='extra').parts);
});

test('review: very large unrelated texts fall back to a block replacement', () => {
  const a=Array.from({length:2500},(_, i)=>'a'+i).join('\n'), b=Array.from({length:2500},(_, i)=>'b'+i).join('\n');
  const rows=review(a,b);
  assert.equal(rows.filter(r=>r.type==='del').length,2500);
  assert.equal(rows.filter(r=>r.type==='add').length,2500);
});
