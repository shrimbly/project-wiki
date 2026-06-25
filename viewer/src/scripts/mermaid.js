// Lazily render mermaid code blocks. Only loads the mermaid bundle when a
// page actually contains diagrams.

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

  mermaidLib.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    themeVariables: {
      fontSize: '14px',
      primaryColor: '#dceaff',
      primaryBorderColor: '#2c5fb8',
      primaryTextColor: '#1a1a1a',
      lineColor: '#6b6b6b',
      tertiaryColor: '#fff5c0',
      background: '#fafaf9',
    },
  });

  for (let i = 0; i < sources.length; i++) {
    const el = sources[i];
    const code = (el.textContent || '').trim();
    if (!code) continue;
    const id = `mermaid-${Date.now()}-${i}`;
    try {
      const { svg } = await mermaidLib.render(id, code);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-rendered';
      wrapper.innerHTML = svg;
      el.replaceWith(wrapper);
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
