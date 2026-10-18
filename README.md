# Folio

A Markdown editor with document creation, file import, live preview, browser-local saving and Markdown export.

Run `npm ci`, then `npm start`, and open http://127.0.0.1:5173.

Documents autosave in the current browser and are not synced between devices.

- Save / Ctrl+S chooses a file on the first save, then writes back to it.
- Save As / Ctrl+Shift+S chooses a new destination.
- Opening files retains their handles in supported browsers, so Save updates the original.
- File connections last for the current page session. After reloading, choose a destination again or reopen the file.
- Browsers without the File System Access API download a copy instead. Export always downloads a copy.
- External edits are checked before writing back; cancellation keeps the disk file unchanged.
- Import accepts .md, .markdown and .txt files up to 5 MB each.

## Deploy to Cloudflare Workers

1. Install the dependencies with `npm ci` (Node.js 22 or later; Wrangler needs it).
2. In `wrangler.jsonc`, set `name` to the name you want for your Worker.
3. Authenticate with your own Cloudflare account using `npx wrangler login`.
4. Run `npx wrangler deploy`, or connect the repo to Workers Builds, which deploys on pushes to the production branch.

`assets.directory` points to `dist`, the complete static editor, which is served without invoking Worker code. Only `/api/*` runs the Worker in `src/worker.js`. Documents stay in each visitor's browser or chosen local files unless they are opened from a drafts repo. Browser storage is separate for localhost and the deployed URL, so export and import to move documents between them.

Run the regression checks with `npm test` (Node's built-in test runner).

YAML front matter at the top of a document (between `---` lines) stays in the editor exactly as written. The preview shows a one-line summary (title, status, channel, due) and renders only the body.

## GitHub sync (optional)

### Overview

Folio can open and save Markdown drafts kept in a **separate, private GitHub repo**. Drafts never live in this public repo. The Worker holds the GitHub token, and the browser never sees it.

The drafts repo has one folder per post:

```
posts/
  <slug>/
    index.md      # YAML front matter, then the Markdown body
    hero.jpg      # images sit alongside, referenced relatively: ![Alt](hero.jpg)
```

A slug is lowercase letters, digits and single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`), for example `why-small-steps`. The Worker rejects any other slug. Folio lists only files matching `posts/<slug>/index.md`.

### 1. Set up the drafts repo

1. Create a new **private** repo on GitHub.
2. Add a README describing the layout and front matter (see [Front matter](#front-matter)), plus one example post at `posts/example/index.md`.
3. Point Folio at it with these `vars` in `wrangler.jsonc`:

| Var | Meaning |
|---|---|
| `GITHUB_OWNER` | User or organisation that owns the drafts repo |
| `GITHUB_REPO` | Drafts repo name |
| `GITHUB_BRANCH` | Branch to read and commit to, usually `main` |

### 2. Create fine-grained tokens

Use one token for the Folio Worker and **a separate token for each agent** that writes drafts. With separate tokens you can revoke one without affecting the others, and a leaked token exposes only that one repo.

Create each token at https://github.com/settings/personal-access-tokens/new:

1. **Token name and description:** say who uses it, for example `folio-worker` or `content-agent`.
2. **Resource owner:** the account that owns the drafts repo.
3. **Expiration:** set one. 90 days suits agent tokens. A year suits the Worker token, with a reminder, because the Folio API stops working when it expires.
4. **Repository access:** *Only select repositories*, then choose the drafts repo and nothing else.
5. **Permissions → Repository permissions:** **Contents: Read and write**. In the newer UI, choose *Add permissions* → *Contents* → *Read and write*. **Metadata: Read-only** is added automatically. Leave everything else at *No access*.
6. **Generate token** and copy it straight away. GitHub shows it only once.

Never commit a token to any repo, including the drafts repo, and never put one in `wrangler.jsonc`, `dist/` or a remote URL. For local development, put it in `.dev.vars`, which is gitignored (see `.dev.vars.example`).

### 3. Deploy, then set the secret

The order matters:

1. Merge to the production branch.
2. Deploy, either through Workers Builds (automatic on merge) or with `npx wrangler deploy` (Node.js 22 or later).
3. **Then** set the Worker token as the `GITHUB_TOKEN` secret, by either:
   - running `npx wrangler secret put GITHUB_TOKEN`, or
   - in the dashboard, going to **Workers & Pages → your Worker → Settings → Variables and Secrets → Add**, choosing type **Secret**, naming it `GITHUB_TOKEN`, then **Deploy**.

- Cloudflare can't attach variables or secrets to a Worker that is only static assets, so the Worker script must be deployed before the secret can be set.
- Until the secret is set, `/api/*` returns `500 {"error":"not_configured"}`. The editor itself works normally.
- Previews (`wrangler preview`, used by Workers Builds for non-production branches) don't inherit vars or secrets. `wrangler.jsonc` includes an empty `previews` block on purpose, so a Preview serves the editor but its `/api` refuses every request.

### 4. Cloudflare Access

Put the Worker's hostname, including its preview URLs, behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/), with a policy that allows only you. Apply the Access application to the whole hostname so it covers `/api/*`.

As a second check, the Worker validates the `Cf-Access-Jwt-Assertion` header on every `/api/*` request, using these `vars`:

| Var | Meaning |
|---|---|
| `TEAM_DOMAIN` | `https://<your-team>.cloudflareaccess.com` |
| `POLICY_AUD` | The Access application's Audience (AUD) tag |

Requests without a valid JWT for that application get `403`. For local development only, `SKIP_ACCESS_CHECK=true` in `.dev.vars` skips the check, and it is honoured only for `localhost` and `127.0.0.1` requests.

### 5. How the editor syncs

- **Open draft** lists the posts in the drafts repo. Choosing one loads its text together with the git blob `sha` it was read at. Opening a draft that is already open switches to it and never overwrites local edits.
- **Save** (Ctrl+S) on an opened draft commits the current text as `Folio edit: <slug>` on the configured branch, against that `sha`. **Save As** still writes a local file.
- **Conflicts.** If the file changed in the repo since you opened it, GitHub rejects the stale `sha` and Folio asks what to do:
  - **OK** overwrites the newer version with your document.
  - **Cancel** loads the latest version and keeps your edits as a separate local document, `<slug> (my edits).md`.
- **No background pull.** Folio doesn't refresh drafts on its own, and choosing a draft that is already open just switches to the local copy. To pick up someone else's changes, press **Save**: if the repo has moved on, the conflict prompt appears and **Cancel** loads the latest version. A draft that isn't open yet always loads fresh from the repo.
- **Front matter** is kept byte for byte. Folio never re-serialises the YAML, so unknown keys, comments and ordering survive a save.

## Agent interaction model

A content agent drafts and a person edits. The drafts repo is the shared record, so every change is a commit with a readable diff.

```mermaid
sequenceDiagram
    participant Q as Work queue (e.g. Linear)
    participant A as Agent
    participant R as Drafts repo (private)
    participant F as Folio (person)
    Q->>A: Issue: write <slug>
    A->>R: Commit posts/<slug>/index.md ("Agent draft: <slug>")
    A->>Q: Link the issue to posts/<slug>/index.md
    F->>R: Open draft (reads text + sha)
    F->>R: Save → commit "Folio edit: <slug>"
    A->>R: git pull; git log -p -- posts/<slug>/index.md
    A->>R: Commit revision ("Agent revision: <slug>")
```

- The agent commits **straight to the drafts repo's branch** (no PR per draft), using **its own fine-grained token** and its own author name so its commits stand out from Folio's.
- The person edits in Folio. Each save is a `Folio edit: <slug>` commit.
- The agent reads the person's edits as diffs with `git log -p -- posts/<slug>/index.md`.
- The agent should pull before editing. If it pushes while the person has the draft open, Folio's conflict prompt appears at their next save.
- The work queue (for example Linear) links each issue to the post's file path, and the post's `linear` key links back.

### Agent git setup (generic example)

Keep the token in a file readable only by its owner, and use it only for this one clone through a repo-local credential helper. Replace the placeholder paths and names:

```bash
mkdir -p /path/to/secrets && chmod 700 /path/to/secrets
( umask 077; cat > /path/to/secrets/drafts-token )   # paste the token, then Enter and Ctrl-D

HELPER='!f() { test "$1" = get && echo username=x-access-token && echo "password=$(cat /path/to/secrets/drafts-token)"; }; f'
git -c credential.helper= -c credential.helper="$HELPER" clone https://github.com/<owner>/<drafts-repo>.git /path/to/drafts
cd /path/to/drafts
git config credential.helper ''              # ignore any global helpers in this clone
git config --add credential.helper "$HELPER"
git config user.name "<Agent name>"
git config user.email "<email to attribute commits to>"

git pull
# write posts/<slug>/index.md and any images, then:
git add posts/<slug> && git commit -m "Agent draft: <slug>" && git push
```

File permissions keep out other OS users only. Anything running as the same user, such as other agents on a shared machine, can read the token file. Keep the token scoped to the drafts repo and revoke it if it is exposed.

### Front matter

YAML between `---` lines at the top of `index.md`:

```yaml
---
title: Why small steps win
subtitle: Notes from shipping in increments
linear: ABC-123
status: draft            # draft | in-review | final | published
channel: newsletter      # example values: newsletter | blog | site
due: 2026-12-31
version: 1
updated: 2026-10-18T15:00:00+13:00
---
```

| Key | Meaning |
|---|---|
| `title` | Post title |
| `subtitle` | Optional subtitle |
| `linear` | Work-queue issue key or URL |
| `status` | `draft`, `in-review`, `final` or `published` |
| `channel` | Where it will be published (values are up to you) |
| `due` | Due date, `YYYY-MM-DD` |
| `version` | Revision number |
| `updated` | Last update, ISO 8601 with offset |

Unknown keys are preserved: Folio keeps the front matter block byte for byte, so agents can add their own keys and comments.

## License

Folio is licensed under the [MIT License](LICENSE). Its bundled third-party libraries retain their own licenses.
