// Fullscreen viewer with zoom + pan for rendered mermaid diagrams.
//
// mermaid.js calls addDiagramControls(figure, rendered) after each diagram
// renders. That adds a corner button; clicking it opens a single shared
// full-viewport overlay showing a clone of the SVG, with:
//   - wheel / pinch to zoom (toward the cursor / pinch midpoint)
//   - drag (mouse or one finger) to pan
//   - toolbar: zoom out / fit / zoom in / close
//   - keyboard: + - to zoom, 0 to fit, Esc to close
// No dependencies — transform math is done by hand.

const FS_ICON =
  '<svg class="control-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2H3a1 1 0 0 0-1 1v3M10 2h3a1 1 0 0 1 1 1v3M6 14H3a1 1 0 0 1-1-1v-3M10 14h3a1 1 0 0 0 1-1v-3"/></svg>';
const MINUS_ICON = '<svg class="control-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>';
const PLUS_ICON = '<svg class="control-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
const CLOSE_ICON = '<svg class="control-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>';

let overlay = null;
let stage = null;
let canvas = null;
let returnFocus = null;
let previousBodyOverflow = '';
const view = { scale: 1, tx: 0, ty: 0, natW: 1, natH: 1 };

const pointers = new Map();
let panLast = null;
let pinchLast = null;

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'diagram-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Diagram viewer');
  overlay.innerHTML = `
    <div class="diagram-overlay-stage"><div class="diagram-overlay-canvas"></div></div>
    <div class="diagram-overlay-toolbar">
      <button type="button" data-act="out" title="Zoom out (−)" aria-label="Zoom out">${MINUS_ICON}</button>
      <button type="button" data-act="fit" title="Fit (0)">Fit</button>
      <button type="button" data-act="in" title="Zoom in (+)" aria-label="Zoom in">${PLUS_ICON}</button>
      <button type="button" data-act="close" title="Close (Esc)" aria-label="Close diagram viewer">${CLOSE_ICON}</button>
    </div>`;
  document.body.appendChild(overlay);
  stage = overlay.querySelector('.diagram-overlay-stage');
  canvas = overlay.querySelector('.diagram-overlay-canvas');

  overlay.querySelector('[data-act="close"]').addEventListener('click', close);
  overlay.querySelector('[data-act="fit"]').addEventListener('click', fit);
  overlay.querySelector('[data-act="in"]').addEventListener('click', () => zoomAtCenter(1.25));
  overlay.querySelector('[data-act="out"]').addEventListener('click', () => zoomAtCenter(1 / 1.25));

  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  stage.addEventListener('dblclick', (e) => {
    const r = stage.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, 1.6);
  });

  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Tab') {
      const buttons = [...overlay.querySelectorAll('button')];
      const current = buttons.indexOf(document.activeElement);
      const next = e.shiftKey
        ? (current <= 0 ? buttons.length - 1 : current - 1)
        : (current + 1) % buttons.length;
      e.preventDefault();
      buttons[next].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === '+' || e.key === '=') zoomAtCenter(1.25);
    else if (e.key === '-' || e.key === '_') zoomAtCenter(1 / 1.25);
    else if (e.key === '0') fit();
  });
}

function apply() {
  canvas.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
}

function clampScale(k) {
  return Math.max(0.05, Math.min(40, k));
}

function fit() {
  const r = stage.getBoundingClientRect();
  const k = Math.min(r.width / view.natW, r.height / view.natH) * 0.92;
  view.scale = k;
  view.tx = (r.width - view.natW * k) / 2;
  view.ty = (r.height - view.natH * k) / 2;
  apply();
}

function zoomAt(cx, cy, factor) {
  const k0 = view.scale;
  const k1 = clampScale(k0 * factor);
  // keep the point under (cx, cy) fixed while scaling
  view.tx = cx - ((cx - view.tx) / k0) * k1;
  view.ty = cy - ((cy - view.ty) / k0) * k1;
  view.scale = k1;
  apply();
}

function zoomAtCenter(factor) {
  const r = stage.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, factor);
}

function onWheel(e) {
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
}

function pinchInfo() {
  const [a, b] = [...pointers.values()];
  return {
    dist: Math.hypot(a.x - b.x, a.y - b.y),
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
  };
}

function onPointerDown(e) {
  stage.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    panLast = { x: e.clientX, y: e.clientY };
    stage.classList.add('grabbing');
  } else if (pointers.size === 2) {
    pinchLast = pinchInfo();
    panLast = null;
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1 && panLast) {
    view.tx += e.clientX - panLast.x;
    view.ty += e.clientY - panLast.y;
    panLast = { x: e.clientX, y: e.clientY };
    apply();
  } else if (pointers.size === 2 && pinchLast) {
    const info = pinchInfo();
    const r = stage.getBoundingClientRect();
    zoomAt(info.cx - r.left, info.cy - r.top, info.dist / pinchLast.dist);
    pinchLast = info;
  }
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchLast = null;
  if (pointers.size === 1) {
    const p = [...pointers.values()][0];
    panLast = { x: p.x, y: p.y };
  }
  if (pointers.size === 0) {
    panLast = null;
    stage.classList.remove('grabbing');
  }
}

function open(svg, invoker) {
  ensureOverlay();
  returnFocus = invoker || document.activeElement;
  canvas.innerHTML = '';
  const clone = svg.cloneNode(true);

  let natW = 0;
  let natH = 0;
  const vb = clone.getAttribute('viewBox');
  if (vb) {
    const p = vb.split(/[\s,]+/).map(Number);
    natW = p[2];
    natH = p[3];
  }
  if (!natW || !natH) {
    const r = svg.getBoundingClientRect();
    natW = r.width || 800;
    natH = r.height || 600;
  }

  clone.removeAttribute('style');
  clone.setAttribute('width', natW);
  clone.setAttribute('height', natH);
  clone.style.width = `${natW}px`;
  clone.style.height = `${natH}px`;
  clone.style.maxWidth = 'none';
  canvas.style.width = `${natW}px`;
  canvas.style.height = `${natH}px`;
  canvas.appendChild(clone);

  view.natW = natW;
  view.natH = natH;
  overlay.hidden = false;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  fit();
  overlay.querySelector('[data-act="close"]').focus();
}

function close() {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  canvas.innerHTML = '';
  document.body.style.overflow = previousBodyOverflow;
  pointers.clear();
  panLast = null;
  pinchLast = null;
  returnFocus?.focus();
  returnFocus = null;
}

export function addDiagramControls(figure, rendered) {
  const svg = (rendered || figure).querySelector('svg');
  if (!svg || figure.querySelector('.diagram-fs-btn')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'diagram-fs-btn';
  btn.title = 'Full screen — zoom & pan';
  btn.setAttribute('aria-label', 'View diagram full screen');
  btn.innerHTML = FS_ICON;
  btn.addEventListener('click', () => open(svg, btn));
  figure.appendChild(btn);
}
