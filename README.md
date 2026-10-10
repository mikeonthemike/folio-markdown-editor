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

The `assets.directory` setting points to `dist`, the complete static editor. No server, database, or environment variables are required. Documents remain in each visitor's browser or chosen local files. Browser storage is separate for localhost and the deployed URL: export and import to move drafts.

Run file-saving regression checks with `node --test test/file-saving.test.cjs`.

## License

Folio is licensed under the [MIT License](LICENSE). Its bundled third-party libraries retain their own licenses.
