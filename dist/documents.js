// Pure rules for the local document list: when closing needs a confirmation, and what is selected after.
(function (root) {
  // Returns a confirmation message, or null when nothing would be lost by closing.
  // draftDirty: a GitHub draft has edits since its last save or load. fileSaved: a local file matches its document.
  function closeWarning(doc, { draftDirty = false, fileSaved = false, pristine = [] } = {}) {
    if (doc.source) return draftDirty ? `"${doc.name}" has edits that are not committed to GitHub. Close it and discard them?` : null;
    if (fileSaved || pristine.includes(doc.text)) return null;
    return `"${doc.name}" only exists in this browser. Close it and delete this copy? Export it first if you want to keep it.`;
  }

  // Removes the document. Closing the active one selects its neighbour (next, else previous), or nothing.
  function afterClose(docs, id, active) {
    const index = docs.findIndex(d => d.id === id);
    if (index === -1) return { docs, active };
    const rest = docs.filter(d => d.id !== id);
    if (active !== id) return { docs: rest, active };
    const next = rest[Math.min(index, rest.length - 1)];
    return { docs: rest, active: next ? next.id : null };
  }

  root.FolioDocuments = { closeWarning, afterClose };
  if (typeof module !== 'undefined') module.exports = root.FolioDocuments;
})(typeof window === 'undefined' ? globalThis : window);
