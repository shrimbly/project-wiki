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
    marks.forEach((m, index) => {
      m.dataset.comment = ann.comment;
      m.tabIndex = index === 0 ? 0 : -1;
      m.setAttribute('role', 'button');
      m.setAttribute('aria-label', `Comment: ${ann.comment}`);
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

  function positionFab(rect) {
    const margin = 8;
    const gap = 8;
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
    const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
    const width = fab.offsetWidth;
    const height = fab.offsetHeight;
    const centered = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(Math.max(centered, viewportLeft + margin), viewportLeft + viewportWidth - width - margin);
    const above = rect.top - height - gap;
    const top = above >= viewportTop + margin ? above : Math.min(rect.bottom + gap, viewportTop + viewportHeight - height - margin);
    fab.style.left = `${window.scrollX + left}px`;
    fab.style.top = `${window.scrollY + top}px`;
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
    positionFab(rect);
  });

  fab.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });
  const repositionFab = () => {
    if (!pendingSelection || fab.style.display === 'none') return;
    positionFab(pendingSelection.range.getBoundingClientRect());
  };
  window.addEventListener('resize', repositionFab);
  window.visualViewport?.addEventListener('resize', repositionFab);
  window.visualViewport?.addEventListener('scroll', repositionFab);

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

  const popover = document.createElement('div');
  popover.className = 'annot-popover compose';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Add comment');
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
  trackPopover(popover, () => selection.range.getBoundingClientRect());

  const textarea = popover.querySelector('textarea');
  textarea.focus();

  const close = () => {
    popover._positionCleanup?.();
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
  document.addEventListener('keydown', (e) => {
    const mark = e.target.closest && e.target.closest('mark.annot');
    if (!mark || !docBody?.contains(mark) || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    openExistingPopover(mark);
  });
}

function openExistingPopover(mark) {
  closeAllPopovers();
  const id = mark.dataset.id;
  const comment = mark.dataset.comment || '';

  const popover = document.createElement('div');
  popover.className = 'annot-popover existing';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Comment');
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
  popover.querySelector('.annot-popover-comment').textContent = comment;
  trackPopover(popover, () => mark.getBoundingClientRect());
  popover.querySelector('.annot-edit').focus();

  const close = () => {
    popover._positionCleanup?.();
    popover.remove();
    mark.focus();
  };

  popover.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

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
    popover._positionUpdate?.();
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
  document.querySelectorAll('.annot-popover').forEach((popover) => {
    popover._positionCleanup?.();
    popover.remove();
  });
}

function trackPopover(popover, getAnchorRect) {
  const update = () => {
    if (!popover.isConnected) return;
    const anchorRect = getAnchorRect();
    const margin = 8;
    const gap = 8;
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
    const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const left = Math.min(
      Math.max(anchorRect.left, viewportLeft + margin),
      viewportLeft + viewportWidth - width - margin,
    );
    const below = anchorRect.bottom + gap;
    const above = anchorRect.top - height - gap;
    const top = below + height <= viewportTop + viewportHeight - margin || above < viewportTop + margin
      ? Math.min(below, viewportTop + viewportHeight - height - margin)
      : above;
    popover.style.left = `${window.scrollX + left}px`;
    popover.style.top = `${window.scrollY + Math.max(viewportTop + margin, top)}px`;
  };

  update();
  popover._positionUpdate = update;
  window.addEventListener('resize', update);
  window.addEventListener('scroll', update, true);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  popover._positionCleanup = () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('scroll', update, true);
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
    popover._positionUpdate = null;
  };
}

// ---------- Init ----------

async function init() {
  if (document.body.dataset.annotationsEnabled !== 'true') return;
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
