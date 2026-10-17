// Client for the Folio Worker's drafts API (/api/posts). The Worker holds the GitHub token
// and enforces Access; the browser only ever sees post text and the sha it was read at.
(function (root) {
  function createDrafts(environment) {
    const busy = new Set();
    async function call(path, init) {
      let res;
      try {
        res = await environment.fetch('/api/posts' + path, { credentials: 'same-origin', ...init });
      } catch {
        throw Object.assign(Error('Could not reach the drafts service. Your Access sign-in may have expired: reload the page.'), { name: 'DraftsUnavailable' });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(Error(body.error || 'HTTP ' + res.status), { name: 'DraftsError', status: res.status });
      return body;
    }
    return {
      async list() { return (await call('')).posts; },
      async open(slug) { return call('/' + encodeURIComponent(slug)); },
      // Remember what was read so state and later saves know the base version.
      attach(doc, post) { doc.source = { slug: post.slug, sha: post.sha, text: post.text }; },
      state(doc) {
        if (busy.has(doc.id)) return 'Committing…';
        return doc.text === doc.source.text ? 'Saved to drafts' : 'Draft has unsaved changes';
      },
      // Commit the document as it is now, on top of the sha it was opened at. If the draft changed
      // outside Folio, ask (same prompt as local files): OK overwrites, Cancel loads the latest version.
      async save(doc) {
        if (busy.has(doc.id)) return { status: 'busy' };
        busy.add(doc.id);
        const text = doc.text, slug = doc.source.slug;
        const put = sha => call('/' + encodeURIComponent(slug), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, sha }) });
        try {
          try {
            const out = await put(doc.source.sha);
            doc.source = { slug, sha: out.sha, text };
            return { status: 'saved', text };
          } catch (error) {
            if (error.status !== 409) throw error;
          }
          const latest = await call('/' + encodeURIComponent(slug));
          if (environment.confirm('This draft changed outside Folio. Replace its contents with this document? Choose Cancel to load the latest version instead; your edits will be kept as a separate local copy.')) {
            const out = await put(latest.sha);
            doc.source = { slug, sha: out.sha, text };
            return { status: 'saved', text, overwrote: true };
          }
          return { status: 'reloaded', mine: text, latest };
        } finally {
          busy.delete(doc.id);
        }
      },
    };
  }
  root.FolioDrafts = { createDrafts };
  if (typeof module !== 'undefined') module.exports = root.FolioDrafts;
})(typeof window === 'undefined' ? globalThis : window);
