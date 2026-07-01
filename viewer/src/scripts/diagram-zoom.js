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
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';

let overlay = null;
let stage = null;
let canvas = null;
const view = { scale: 1, tx: 0, ty: 0, natW: 1, natH: 1 };

const pointers = new Map();
let panLast = null;
let pinchLast = null;

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'diagram-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="diagram-overlay-stage"><div class="diagram-overlay-canvas"></div></div>
    <div class="diagram-overlay-toolbar">
      <button type="button" data-act="out" title="Zoom out (−)">−</button>
      <button type="button" data-act="fit" title="Fit (0)">Fit</button>
      <button type="button" data-act="in" title="Zoom in (+)">+</button>
      <button type="button" data-act="close" title="Close (Esc)">✕</button>
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
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') zoomAtCenter(1.25);
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

function open(svg) {
  ensureOverlay();
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
  document.body.style.overflow = 'hidden';
  fit();
}

function close() {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  canvas.innerHTML = '';
  document.body.style.overflow = '';
  pointers.clear();
  panLast = null;
  pinchLast = null;
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
  btn.addEventListener('click', () => open(svg));
  figure.appendChild(btn);
}
