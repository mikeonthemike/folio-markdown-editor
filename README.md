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

1. Install the dependencies with `npm ci`.
2. In `wrangler.jsonc`, set `name` to the name you want for your Worker. The included name is an example; use a different name if needed in your account.
3. Authenticate with your own Cloudflare account using `npx wrangler login`.
4. Run `npx wrangler deploy` from the project directory. Wrangler prints your deployment URL when it succeeds.

The `assets.directory` setting points to `dist`, the complete static editor, served without invoking Worker code. Only `/api/*` runs the Worker in `src/worker.js`. Documents remain in each visitor's browser or chosen local files unless opened from the drafts repo. Browser storage is separate for localhost and the deployed URL: export and import to move drafts.

Wrangler needs Node.js 22 or later.

## Drafts repo (optional)

"Open draft" lists and opens `posts/<slug>/index.md` files from a GitHub repo (by default `mikeonthemike/folio-drafts`; see `vars` in `wrangler.jsonc`). The Worker holds the GitHub token; the browser never sees it.

- Set the token as a secret: `npx wrangler secret put GITHUB_TOKEN`. Use a fine-grained token limited to the drafts repo (Contents: read and write).
- `/api/*` requires a valid Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`) for the application in `TEAM_DOMAIN` / `POLICY_AUD`, in addition to Access itself.
- Local development: copy `.dev.vars.example` to `.dev.vars`, add a token, then `npx wrangler dev`. `SKIP_ACCESS_CHECK=true` is honoured only for `localhost` / `127.0.0.1` requests.

Run the regression checks with `npm test` (Node's built-in test runner).

YAML front matter at the top of a document (between `---` lines) is kept in the editor exactly as written. The preview shows a one-line summary (title, status, channel, due) and renders only the body. Folio never re-serialises the YAML, so unknown keys, comments and ordering survive a save byte for byte.

## License

Folio is licensed under the [MIT License](LICENSE). Its bundled third-party libraries retain their own licenses.
