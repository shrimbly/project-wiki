// Lazily render mermaid code blocks. Only loads the mermaid bundle when a
// page actually contains diagrams.

import { addDiagramControls } from './diagram-zoom.js';

async function renderAll() {
  const sources = document.querySelectorAll('.mermaid-source');
  if (sources.length === 0) return;

  let mermaidLib;
  try {
    mermaidLib = (await import('mermaid')).default;
  } catch (e) {
    console.error('Failed to load mermaid:', e);
    return;
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const token = (name) => rootStyles.getPropertyValue(name).trim();

  mermaidLib.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily: token('--font-sans'),
    themeVariables: {
      fontSize: '14px',
      primaryColor: token('--accent-soft'),
      primaryBorderColor: token('--accent'),
      primaryTextColor: token('--text'),
      lineColor: token('--text-muted'),
      tertiaryColor: token('--warn-bg'),
      background: token('--bg'),
    },
  });

  for (let i = 0; i < sources.length; i++) {
    const el = sources[i];
    const code = (el.textContent || '').trim();
    if (!code) continue;
    const id = `mermaid-${Date.now()}-${i}`;
    try {
      const { svg } = await mermaidLib.render(id, code);
      // figure (positioning context, no scroll) wraps the scrollable rendered
      // box so the fullscreen button can sit in a fixed corner.
      const figure = document.createElement('div');
      figure.className = 'mermaid-figure';
      const rendered = document.createElement('div');
      rendered.className = 'mermaid-rendered';
      rendered.innerHTML = svg;
      figure.appendChild(rendered);
      el.replaceWith(figure);
      addDiagramControls(figure, rendered);
    } catch (err) {
      console.error('Mermaid render failed:', err);
      const wrapper = document.createElement('pre');
      wrapper.className = 'mermaid-error';
      wrapper.textContent = `Mermaid error: ${err.message}\n\n${code}`;
      el.replaceWith(wrapper);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderAll);
} else {
  renderAll();
}
