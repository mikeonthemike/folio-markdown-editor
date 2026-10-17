// Client for the Folio Worker's drafts API (/api/posts). The Worker holds the GitHub token
// and enforces Access; the browser only ever sees post text and the sha it was read at.
(function (root) {
  function createDrafts(environment) {
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
      state(doc) { return doc.text === doc.source.text ? 'Saved to drafts' : 'Draft has unsaved changes'; },
    };
  }
  root.FolioDrafts = { createDrafts };
  if (typeof module !== 'undefined') module.exports = root.FolioDrafts;
})(typeof window === 'undefined' ? globalThis : window);
