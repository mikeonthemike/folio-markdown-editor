// Splits a Markdown document into its YAML front matter block and body without parsing or
// re-serialising the YAML, so join(split(text)) is always the original text, byte for byte.
(function (root) {
  const OPEN = /^(\uFEFF?)---[ \t]*\r?\n/;
  const CLOSE = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m;

  function split(text) {
    const open = OPEN.exec(text);
    if (!open) return { frontMatter: '', body: text };
    const rest = text.slice(open[0].length);
    const close = CLOSE.exec(rest);
    if (!close) return { frontMatter: '', body: text };
    const end = open[0].length + close.index + close[0].length;
    return { frontMatter: text.slice(0, end), body: text.slice(end) };
  }

  function join(frontMatter, body) {
    return frontMatter + body;
  }

  // The block's pieces: opening line, raw YAML, closing line. open + yaml + close === frontMatter.
  function parts(frontMatter) {
    const open = OPEN.exec(frontMatter);
    if (!open) return null;
    const rest = frontMatter.slice(open[0].length);
    const close = CLOSE.exec(rest);
    return { open: open[0], yaml: rest.slice(0, close.index), close: rest.slice(close.index) };
  }

  // Replace only the raw YAML inside an existing block, keeping its delimiters. Returns null if the
  // new YAML contains a line that would end the block early, so the caller can refuse the edit.
  function withYaml(frontMatter, yaml) {
    const p = parts(frontMatter);
    if (!p || /^(?:---|\.\.\.)[ \t]*$/m.test(yaml)) return null;
    const newline = p.open.endsWith('\r\n') ? '\r\n' : '\n';
    if (yaml && !yaml.endsWith('\n')) yaml += newline;
    return p.open + yaml + p.close;
  }

  // Display-only list of top-level keys in order; nested values are flagged, never parsed.
  function entries(frontMatter) {
    const lines = frontMatter.split(/\r?\n/).slice(1, -1), out = [];
    lines.forEach((line, i) => {
      const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
      if (!m) return;
      let value = m[2].replace(/(^|[ \t]+)#.*$/, '').trim();
      if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
      const nested = !value && /^[ \t]+\S|^-[ \t]/.test(lines[i + 1] || '');
      out.push({ key: m[1], value, nested });
    });
    return out;
  }

  // Display-only reading of simple top-level `key: value` lines. Never used to write.
  function fields(frontMatter) {
    const out = {};
    const lines = frontMatter.split(/\r?\n/).slice(1, -1);
    for (const line of lines) {
      const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
      if (!m) continue;
      let value = m[2].replace(/[ \t]+#.*$/, '').trim();
      if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
      out[m[1]] = value;
    }
    return out;
  }

  root.FolioFrontMatter = { split, join, fields, parts, withYaml, entries };
  if (typeof module !== 'undefined') module.exports = root.FolioFrontMatter;
})(typeof window === 'undefined' ? globalThis : window);
