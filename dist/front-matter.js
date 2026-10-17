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

  root.FolioFrontMatter = { split, join, fields };
  if (typeof module !== 'undefined') module.exports = root.FolioFrontMatter;
})(typeof window === 'undefined' ? globalThis : window);
