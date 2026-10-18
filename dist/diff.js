// A small line + word diff (LCS) for reviewing a local draft against GitHub's latest. No dependencies.
(function (root) {
  // Longest-common-subsequence diff of two token arrays -> [{type: 'same'|'del'|'add', text}].
  // Common prefix and suffix are trimmed first, so typical edits keep the DP table small.
  function diffTokens(a, b) {
    let start = 0, endA = a.length, endB = b.length;
    while (start < endA && start < endB && a[start] === b[start]) start++;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
    const x = a.slice(start, endA), y = b.slice(start, endB), n = x.length, m = y.length, middle = [];
    if (n * m > 4e6) { // too big to align: show it as a block replacement rather than freeze the page
      x.forEach(text => middle.push({ type: 'del', text })); y.forEach(text => middle.push({ type: 'add', text }));
    } else {
      const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
        lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (x[i] === y[j]) { middle.push({ type: 'same', text: x[i] }); i++; j++; }
        else if (lcs[i + 1][j] >= lcs[i][j + 1]) middle.push({ type: 'del', text: x[i++] });
        else middle.push({ type: 'add', text: y[j++] });
      }
      while (i < n) middle.push({ type: 'del', text: x[i++] });
      while (j < m) middle.push({ type: 'add', text: y[j++] });
    }
    const same = t => ({ type: 'same', text: t });
    return [...a.slice(0, start).map(same), ...middle, ...a.slice(endA).map(same)];
  }

  const lines = text => text.replace(/\r\n/g, '\n').split('\n');
  const diffLines = (a, b) => diffTokens(lines(a), lines(b));
  // Words and the whitespace between them, so joining the parts rebuilds each side exactly.
  const diffWords = (a, b) => diffTokens(a.split(/(\s+)/).filter(Boolean), b.split(/(\s+)/).filter(Boolean));

  // Rows for display. A run of deleted lines followed by added lines is paired line by line and
  // gets word-level parts; long unchanged runs collapse to { type: 'skip', count } around `context` lines.
  function review(mine, theirs, context = 2) {
    const ops = diffLines(mine, theirs), rows = [];
    for (let k = 0; k < ops.length;) {
      if (ops[k].type === 'same') { rows.push(ops[k++]); continue; }
      const del = [], add = [];
      while (k < ops.length && ops[k].type === 'del') del.push(ops[k++].text);
      while (k < ops.length && ops[k].type === 'add') add.push(ops[k++].text);
      const pairs = Math.min(del.length, add.length);
      del.forEach((text, i) => rows.push(i < pairs ? { type: 'del', text, parts: diffWords(text, add[i]).filter(p => p.type !== 'add') } : { type: 'del', text }));
      add.forEach((text, i) => rows.push(i < pairs ? { type: 'add', text, parts: diffWords(del[i], text).filter(p => p.type !== 'del') } : { type: 'add', text }));
    }
    const changed = rows.map(r => r.type !== 'same'), out = [];
    for (let i = 0; i < rows.length;) {
      if (rows[i].type !== 'same') { out.push(rows[i++]); continue; }
      let j = i; while (j < rows.length && rows[j].type === 'same') j++;
      const keep = new Set();
      for (let t = i; t < j; t++) if (changed.slice(Math.max(0, t - context), t + context + 1).some(Boolean)) keep.add(t);
      for (let t = i; t < j;) {
        if (keep.has(t)) { out.push(rows[t++]); continue; }
        let s = t; while (s < j && !keep.has(s)) s++;
        out.push({ type: 'skip', count: s - t }); t = s;
      }
      i = j;
    }
    return out;
  }

  root.FolioDiff = { diffTokens, diffLines, diffWords, review };
  if (typeof module !== 'undefined') module.exports = root.FolioDiff;
})(typeof window === 'undefined' ? globalThis : window);
