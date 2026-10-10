(function (root) {
  function filename(name) {
    const clean = (name.trim() || 'Untitled.md').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    return /\.(md|markdown|txt)$/i.test(clean) ? clean : clean + '.md';
  }

  function createFileSaving(environment) {
    const links = new Map();
    const busy = new Set();
    const types = [{ description: 'Markdown documents', accept: { 'text/plain': ['.md', '.markdown', '.txt'] } }];
    return {
      supported: typeof environment.showSaveFilePicker === 'function',
      canOpen: typeof environment.showOpenFilePicker === 'function',
      attach(id, handle, text) { links.set(id, { handle, text }); },
      state(doc) {
        const link = links.get(doc.id);
        if (busy.has(doc.id)) return 'Saving file…';
        if (!link) return 'Browser copy';
        return link.text === doc.text && link.handle.name === doc.name ? 'File saved' : 'File has unsaved changes';
      },
      async open() {
        return environment.showOpenFilePicker({ multiple: true, types });
      },
      async save(doc, saveAs = false) {
        if (busy.has(doc.id)) return { status: 'busy' };
        if (!this.supported) return { status: 'download' };
        busy.add(doc.id);
        let writable;
        try {
          const snapshot = { ...doc };
          const link = links.get(doc.id);
          const choose = saveAs || !link || link.handle.name !== snapshot.name;
          const handle = choose
            ? await environment.showSaveFilePicker({ suggestedName: filename(snapshot.name), types })
            : link.handle;
          if (!choose) {
            const diskText = await (await handle.getFile()).text();
            if (diskText !== link.text && !environment.confirm('This file changed outside Folio. Replace its contents with this document? Choose Cancel to keep it, then use Save As for a separate copy.')) {
              return { status: 'cancelled' };
            }
          }
          writable = await handle.createWritable();
          await writable.write(snapshot.text);
          await writable.close();
          writable = undefined;
          links.set(doc.id, { handle, text: snapshot.text });
          return { status: 'saved', name: handle.name, originalName: snapshot.name, text: snapshot.text };
        } catch (error) {
          if (writable) { try { await writable.abort(); } catch {} }
          if (error.name === 'AbortError') return { status: 'cancelled' };
          throw error;
        } finally {
          busy.delete(doc.id);
        }
      }
    };
  }
  root.FolioFiles = { createFileSaving, filename };
  if (typeof module !== 'undefined') module.exports = root.FolioFiles;
})(typeof window === 'undefined' ? globalThis : window);
