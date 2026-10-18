// Folio Worker. Static assets are served directly by Cloudflare; only /api/* reaches this code
// (see run_worker_first in wrangler.jsonc). Every guard lives here, at the boundary.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POST = /^posts\/([a-z0-9]+(?:-[a-z0-9]+)*)\/index\.md$/;
const jwks = new Map();

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Defence in depth behind Cloudflare Access: require a valid Access JWT for this application.
// SKIP_ACCESS_CHECK is honoured only for localhost requests, so it cannot open production.
async function authorise(request, env) {
  const host = new URL(request.url).hostname;
  if (env.SKIP_ACCESS_CHECK === 'true' && (host === 'localhost' || host === '127.0.0.1')) return true;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token || !env.TEAM_DOMAIN || !env.POLICY_AUD) return false;
  if (!jwks.has(env.TEAM_DOMAIN)) jwks.set(env.TEAM_DOMAIN, createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`)));
  try {
    await jwtVerify(token, jwks.get(env.TEAM_DOMAIN), { issuer: env.TEAM_DOMAIN, audience: env.POLICY_AUD });
    return true;
  } catch {
    return false;
  }
}

function github(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'user-agent': 'folio-markdown-editor',
      'x-github-api-version': '2022-11-28',
      ...init.headers,
    },
  });
}

const decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

async function listPosts(env) {
  const res = await github(env, `git/trees/${encodeURIComponent(env.GITHUB_BRANCH)}?recursive=1`);
  if (!res.ok) return upstream(res);
  const { tree } = await res.json();
  const posts = tree.map(item => item.type === 'blob' && POST.exec(item.path)).filter(Boolean).map(m => ({ slug: m[1] }));
  return json({ posts });
}

async function getPost(env, slug) {
  const res = await github(env, `contents/posts/${slug}/index.md?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`);
  if (!res.ok) return upstream(res);
  const file = await res.json();
  return json({ slug, path: file.path, sha: file.sha, text: decode(file.content) });
}

function upstream(res) {
  if (res.status === 404) return json({ error: 'not_found' }, 404);
  return json({ error: 'upstream', status: res.status }, 502);
}

async function api(request, env) {
  if (!(await authorise(request, env))) return json({ error: 'forbidden' }, 403);
  if (!env.GITHUB_TOKEN) return json({ error: 'not_configured' }, 500);
  const path = new URL(request.url).pathname;
  if (path === '/api/posts') return request.method === 'GET' ? listPosts(env) : json({ error: 'method_not_allowed' }, 405);
  const m = /^\/api\/posts\/([^/]+)$/.exec(path);
  if (!m) return json({ error: 'not_found' }, 404);
  if (!SLUG.test(m[1])) return json({ error: 'bad_slug' }, 400);
  if (request.method === 'GET') return getPost(env, m[1]);
  return json({ error: 'method_not_allowed' }, 405);
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/')) return api(request, env);
    return env.ASSETS.fetch(request);
  },
};
