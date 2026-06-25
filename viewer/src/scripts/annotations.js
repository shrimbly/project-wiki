// Highlight-and-comment for the wiki viewer.
//
// Anchoring uses W3C-style text quotes: store the highlighted text plus a
// small prefix/suffix as the anchor. Robust to most markdown edits;
// orphans gracefully when the surrounding text changes too much.
//
// Storage lives at <repo>/annotations/<slug>.json — see the API plugin
// in astro.config.mjs.

const API = '/api/annotations';
const PREFIX_LEN = 40;
const SUFFIX_LEN = 40;

function getSlug() {
  return document.body.dataset.docSlug;
}

function getDocBody() {
  return document.querySelector('.doc-body');
}

async function fetchAnnotations(slug) {
  try {
    const r = await fetch(`${API}/${slug}`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.annotations || [];
  } catch {
    return [];
  }
}

async function saveAnnotation(slug, payload) {
  const r = await fetch(`${API}/${slug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`save failed (${r.status})`);
  return r.json();
}

async function deleteAnnotation(slug, id) {
  const r = await fetch(`${API}/${slug}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`delete failed (${r.status})`);
}

async function patchAnnotation(slug, id, payload) {
  const r = await fetch(`${API}/${slug}/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`patch failed (${r.status})`);
  return r.json();
}

// ---------- Text-index utilities ----------

function buildTextIndex(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let total = '';
  let n;
  while ((n = walker.nextNode())) {
    nodes.push({ node: n, start: total.length, end: total.length + n.nodeValue.length });
    total += n.nodeValue;
  }
  return { nodes, total };
}

function findOffsets(index, prefix, quote, suffix) {
  if (!quote) return null;
  const probe = prefix + quote + suffix;
  let idx = -1;
  if (probe !== quote) idx = index.total.indexOf(probe);
  if (idx < 0) {
    idx = index.total.indexOf(quote);
    if (idx < 0) return null;
    return { start: idx, end: idx + quote.length };
  }
  const start = idx + prefix.length;
  return { start, end: start + quote.length };
}

function nodeAt(index, offset) {
  for (const e of index.nodes) {
    if (offset >= e.start && offset <= e.end) {
      return { node: e.node, offset: offset - e.start };
    }
  }
  return null;
}

function makeRange(index, start, end) {
  const s = nodeAt(index, start);
  const e = nodeAt(index, end);
  if (!s || !e) return null;
  const range = document.createRange();
  try {
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
  } catch {
    return null;
  }
  return range;
}

function selectionOffsets(index, range) {
  let start = -1;
  let end = -1;
  for (const e of index.nodes) {
    if (e.node === range.startContainer) start = e.start + range.startOffset;
    if (e.node === range.endContainer) end = e.start + range.endOffset;
  }
  if (start < 0 || end < 0 || end <= start) return null;
  return { start, end };
}

function wrapRange(range, attrs) {
  const marks = [];
  if (range.collapsed) return marks;
  const root = range.commonAncestorContainer;
  const walker = document.createTreeWalker(
    root.nodeType === Node.TEXT_NODE ? root.parentNode : root,
    NodeFilter.SHOW_TEXT,
  );
  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) {
    if (range.intersectsNode(n)) textNodes.push(n);
  }
  for (const tn of textNodes) {
    let startOffset = 0;
    let endOffset = tn.nodeValue.length;
    if (tn === range.startContainer) startOffset = range.startOffset;
    if (tn === range.endContainer) endOffset = range.endOffset;
    if (startOffset === endOffset) continue;
    const text = tn.nodeValue;
    const before = text.slice(0, startOffset);
    const middle = text.slice(startOffset, endOffset);
    const after = text.slice(endOffset);
    if (!middle) continue;
    const mark = document.createElement('mark');
    for (const [k, v] of Object.entries(attrs)) mark.setAttribute(k, v);
    mark.textContent = middle;
    const parent = tn.parentNode;
    if (before) parent.insertBefore(document.createTextNode(before), tn);
    parent.insertBefore(mark, tn);
    if (after) parent.insertBefore(document.createTextNode(after), tn);
    parent.removeChild(tn);
    marks.push(mark);
  }
  return marks;
}

function unwrapAllMarks(root) {
  root.querySelectorAll('mark.annot').forEach((m) => {
    const parent = m.parentNode;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
  });
  root.normalize();
}

function applyAnnotations(annotations) {
  const docBody = getDocBody();
  if (!docBody) return;
  unwrapAllMarks(docBody);
  const index = buildTextIndex(docBody);

  let orphaned = 0;
  for (const ann of annotations) {
    const offsets = findOffsets(index, ann.prefix || '', ann.quote, ann.suffix || '');
    if (!offsets) {
      orphaned++;
      continue;
    }
    const range = makeRange(index, offsets.start, offsets.end);
    if (!range) {
      orphaned++;
      continue;
    }
    const marks = wrapRange(range, { class: 'annot', 'data-id': ann.id });
    marks.forEach((m) => {
      m.dataset.comment = ann.comment;
    });
  }

  updateOrphanIndicator(orphaned, annotations.length);
}

function updateOrphanIndicator(orphaned, total) {
  let indicator = document.querySelector('.annot-status');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'annot-status';
    document.body.appendChild(indicator);
  }
  if (total === 0) {
    indicator.style.display = 'none';
    return;
  }
  indicator.style.display = 'block';
  const visible = total - orphaned;
  indicator.textContent =
    orphaned > 0
      ? `${visible}/${total} comments shown · ${orphaned} orphaned`
      : `${total} comment${total === 1 ? '' : 's'}`;
}

// ---------- Selection → compose UI ----------

function setupSelectionUI() {
  const docBody = getDocBody();
  if (!docBody) return;

  const fab = document.createElement('button');
  fab.className = 'annot-fab';
  fab.type = 'button';
  fab.textContent = '+ Comment';
  fab.style.display = 'none';
  document.body.appendChild(fab);

  let pendingSelection = null;

  function hideFab() {
    fab.style.display = 'none';
    pendingSelection = null;
  }

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hideFab();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!docBody.contains(range.commonAncestorContainer)) {
      hideFab();
      return;
    }
    // Suppress when selection is inside an existing mark
    let n = range.commonAncestorContainer;
    while (n && n !== docBody) {
      if (n.nodeType === Node.ELEMENT_NODE && n.classList && n.classList.contains('annot')) {
        hideFab();
        return;
      }
      n = n.parentNode;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideFab();
      return;
    }
    pendingSelection = { range: range.cloneRange() };
    fab.style.display = 'block';
    fab.style.top = `${window.scrollY + rect.top - 36}px`;
    fab.style.left = `${window.scrollX + rect.left + rect.width / 2 - 50}px`;
  });

  fab.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });
  fab.addEventListener('click', () => {
    if (!pendingSelection) return;
    openComposePopover(pendingSelection);
    hideFab();
  });
}

function openComposePopover(selection) {
  closeAllPopovers();
  const docBody = getDocBody();
  const index = buildTextIndex(docBody);
  const offsets = selectionOffsets(index, selection.range);
  if (!offsets) return;

  const quote = index.total.slice(offsets.start, offsets.end);
  const prefix = index.total.slice(Math.max(0, offsets.start - PREFIX_LEN), offsets.start);
  const suffix = index.total.slice(offsets.end, offsets.end + SUFFIX_LEN);

  const rect = selection.range.getBoundingClientRect();
  const popover = document.createElement('div');
  popover.className = 'annot-popover compose';
  popover.innerHTML = `
    <div class="annot-popover-quote"></div>
    <textarea class="annot-popover-input" placeholder="Add comment…" rows="4"></textarea>
    <div class="annot-popover-actions">
      <button type="button" class="annot-cancel">Cancel</button>
      <button type="button" class="annot-save primary">Save</button>
    </div>
  `;
  document.body.appendChild(popover);
  popover.querySelector('.annot-popover-quote').textContent = quote;
  positionPopover(popover, rect);

  const textarea = popover.querySelector('textarea');
  textarea.focus();

  const close = () => {
    popover.remove();
    window.getSelection()?.removeAllRanges();
  };

  popover.querySelector('.annot-cancel').addEventListener('click', close);

  const save = async () => {
    const comment = textarea.value.trim();
    if (!comment) {
      close();
      return;
    }
    try {
      await saveAnnotation(getSlug(), { quote, prefix, suffix, comment });
      const annotations = await fetchAnnotations(getSlug());
      applyAnnotations(annotations);
    } catch (e) {
      alert('Failed to save comment: ' + e.message);
      return;
    }
    close();
  };

  popover.querySelector('.annot-save').addEventListener('click', save);
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save();
    if (e.key === 'Escape') close();
  });
}

function setupExistingMarkInteraction() {
  const docBody = getDocBody();
  document.addEventListener('click', (e) => {
    const mark = e.target.closest && e.target.closest('mark.annot');
    if (!mark || !docBody?.contains(mark)) return;
    e.preventDefault();
    openExistingPopover(mark);
  });
}

function openExistingPopover(mark) {
  closeAllPopovers();
  const id = mark.dataset.id;
  const comment = mark.dataset.comment || '';

  const rect = mark.getBoundingClientRect();
  const popover = document.createElement('div');
  popover.className = 'annot-popover existing';
  popover.innerHTML = `
    <div class="annot-popover-comment"></div>
    <textarea class="annot-popover-input" rows="4" style="display:none"></textarea>
    <div class="annot-popover-actions">
      <button type="button" class="annot-delete">Delete</button>
      <button type="button" class="annot-edit">Edit</button>
      <button type="button" class="annot-save primary" style="display:none">Save</button>
      <button type="button" class="annot-cancel" style="display:none">Cancel</button>
    </div>
  `;
  document.body.appendChild(popover);
  positionPopover(popover, rect);
  popover.querySelector('.annot-popover-comment').textContent = comment;

  const close = () => popover.remove();

  popover.querySelector('.annot-delete').addEventListener('click', async () => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteAnnotation(getSlug(), id);
      const annotations = await fetchAnnotations(getSlug());
      applyAnnotations(annotations);
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
    close();
  });

  popover.querySelector('.annot-edit').addEventListener('click', () => {
    const textarea = popover.querySelector('textarea');
    textarea.value = comment;
    textarea.style.display = 'block';
    popover.querySelector('.annot-popover-comment').style.display = 'none';
    popover.querySelector('.annot-edit').style.display = 'none';
    popover.querySelector('.annot-delete').style.display = 'none';
    popover.querySelector('.annot-save').style.display = 'inline-block';
    popover.querySelector('.annot-cancel').style.display = 'inline-block';
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });

  popover.querySelector('.annot-cancel').addEventListener('click', close);

  popover.querySelector('.annot-save').addEventListener('click', async () => {
    const newComment = popover.querySelector('textarea').value.trim();
    if (!newComment) return;
    try {
      await patchAnnotation(getSlug(), id, { comment: newComment });
      const annotations = await fetchAnnotations(getSlug());
      applyAnnotations(annotations);
    } catch (e) {
      alert('Failed to update: ' + e.message);
    }
    close();
  });

  // Click outside closes
  setTimeout(() => {
    const onDocClick = (e) => {
      if (!popover.contains(e.target) && !mark.contains(e.target)) {
        close();
        document.removeEventListener('click', onDocClick, true);
      }
    };
    document.addEventListener('click', onDocClick, true);
  }, 0);
}

function closeAllPopovers() {
  document.querySelectorAll('.annot-popover').forEach((p) => p.remove());
}

function positionPopover(popover, anchorRect) {
  const POPOVER_WIDTH = 320;
  const margin = 8;
  let left = window.scrollX + anchorRect.left;
  if (left + POPOVER_WIDTH > window.scrollX + document.documentElement.clientWidth - margin) {
    left = window.scrollX + document.documentElement.clientWidth - POPOVER_WIDTH - margin;
  }
  if (left < window.scrollX + margin) left = window.scrollX + margin;
  popover.style.top = `${window.scrollY + anchorRect.bottom + 8}px`;
  popover.style.left = `${left}px`;
}

// ---------- Init ----------

async function init() {
  const slug = getSlug();
  if (!slug || !getDocBody()) return;
  setupSelectionUI();
  setupExistingMarkInteraction();
  const annotations = await fetchAnnotations(slug);
  applyAnnotations(annotations);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
