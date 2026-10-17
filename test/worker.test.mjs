import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import worker from '../src/worker.js';

const TEAM = 'https://team.cloudflareaccess.com', AUD = 'app-aud';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
const sign = (claims = {}) => new SignJWT({ email: 'm@example.com', ...claims }).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
  .setIssuer(claims.iss ?? TEAM).setAudience(claims.aud ?? AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);

const env = (extra = {}) => ({
  GITHUB_OWNER: 'o', GITHUB_REPO: 'r', GITHUB_BRANCH: 'main', GITHUB_TOKEN: 'secret-token',
  TEAM_DOMAIN: TEAM, POLICY_AUD: AUD,
  ASSETS: { fetch: async () => new Response('static') }, ...extra,
});
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
let files, calls;
beforeEach(() => {
  calls = [];
  files = { 'posts/example/index.md': { sha: 'sha1', text: '---\ntitle: Māori 🌱\n---\nBody\n' } };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url); calls.push({ url, init });
    if (url === `${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: [jwk] });
    const m = /^https:\/\/api\.github\.com\/repos\/o\/r\/(.*)$/.exec(url);
    if (!m) return new Response('unexpected', { status: 599 });
    if (m[1].startsWith('git/trees/main')) return Response.json({ tree: [
      { path: 'README.md', type: 'blob' }, { path: 'posts', type: 'tree' }, { path: 'posts/example', type: 'tree' },
      ...Object.keys(files).map(path => ({ path, type: 'blob' })), { path: 'posts/example/hero.jpg', type: 'blob' },
      { path: 'posts/Bad_Slug/index.md', type: 'blob' }, { path: 'posts/a/b/index.md', type: 'blob' },
    ] });
    const c = /^contents\/(.+?)(\?.*)?$/.exec(m[1]);
    if (c && files[c[1]]) return Response.json({ path: c[1], sha: files[c[1]].sha, content: b64(files[c[1]].text).replace(/(.{60})/g, '$1\n') });
    if (c) return Response.json({ message: 'Not Found' }, { status: 404 });
    return Response.json({ message: 'boom' }, { status: 500 });
  };
});
const req = (path, init = {}, host = 'folio.example.workers.dev') => new Request(`https://${host}${path}`, init);
const authed = async (path, init = {}) => req(path, { ...init, headers: { 'cf-access-jwt-assertion': await sign(), ...init.headers } });

test('non-API paths are served from static assets', async () => {
  assert.equal(await (await worker.fetch(req('/'), env())).text(), 'static');
});

test('API refuses requests without a valid Access JWT', async () => {
  assert.equal((await worker.fetch(req('/api/posts'), env())).status, 403);
  for (const claims of [{ aud: 'other-app' }, { iss: 'https://evil.cloudflareaccess.com' }]) {
    const r = await worker.fetch(req('/api/posts', { headers: { 'cf-access-jwt-assertion': await sign(claims) } }), env());
    assert.equal(r.status, 403, JSON.stringify(claims));
  }
  const forged = (await sign()).slice(0, -4) + 'AAAA';
  assert.equal((await worker.fetch(req('/api/posts', { headers: { 'cf-access-jwt-assertion': forged } }), env())).status, 403);
  assert.ok(!calls.some(c => c.url.includes('api.github.com')), 'GitHub is never called when unauthorised');
});

test('SKIP_ACCESS_CHECK only works on localhost', async () => {
  assert.equal((await worker.fetch(req('/api/posts'), env({ SKIP_ACCESS_CHECK: 'true' }))).status, 403);
  assert.equal((await worker.fetch(req('/api/posts', {}, 'localhost:8787'), env({ SKIP_ACCESS_CHECK: 'true' }))).status, 200);
});

test('GET /api/posts lists only posts/<slug>/index.md', async () => {
  const r = await worker.fetch(await authed('/api/posts'), env());
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { posts: [{ slug: 'example' }] });
  assert.equal(calls.at(-1).init.headers.authorization, 'Bearer secret-token');
});

test('GET /api/posts/:slug returns the decoded text and the sha it was read at', async () => {
  const r = await worker.fetch(await authed('/api/posts/example'), env());
  assert.deepEqual(await r.json(), { slug: 'example', path: 'posts/example/index.md', sha: 'sha1', text: files['posts/example/index.md'].text });
});

test('bad slugs are rejected before reaching GitHub', async () => {
  for (const slug of ['..%2Fsecrets', 'Bad_Slug', 'a.b', '-x']) {
    const r = await worker.fetch(await authed(`/api/posts/${slug}`), env());
    assert.equal(r.status, 400, slug);
  }
  assert.ok(!calls.some(c => c.url.includes('/contents/')));
});

test('missing posts are 404 and upstream errors do not leak details', async () => {
  assert.equal((await worker.fetch(await authed('/api/posts/nope'), env())).status, 404);
  globalThis.fetch = async url => String(url).includes('certs') ? Response.json({ keys: [jwk] }) : new Response('token secret-token rejected', { status: 401 });
  const r = await worker.fetch(await authed('/api/posts'), env());
  assert.equal(r.status, 502);
  assert.doesNotMatch(await r.text(), /secret-token/);
});

test('unsupported methods are refused', async () => {
  assert.equal((await worker.fetch(await authed('/api/posts', { method: 'POST' }), env())).status, 405);
  assert.equal((await worker.fetch(await authed('/api/posts/example', { method: 'DELETE' }), env())).status, 405);
});
