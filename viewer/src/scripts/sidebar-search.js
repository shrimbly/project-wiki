// Client-side filter for the left sidebar. Matches the typed query against each
// page label; a section stays visible if any of its items match, or if the
// section title itself matches. No index/deps — it just filters the rendered nav.
//
// Keyboard: "/" focuses the box from anywhere; "Escape" clears + blurs it.

function init() {
  const input = document.querySelector('.sidebar-search');
  const nav = document.querySelector('.sidebar nav');
  if (!input || !nav) return;

  const noResults = nav.querySelector('.sidebar-no-results');
  const sections = Array.from(nav.querySelectorAll('.nav-section')).map((section) => ({
    section,
    title: (section.querySelector('.nav-section-title')?.textContent || '').toLowerCase(),
    items: Array.from(section.querySelectorAll('.nav-link')).map((link) => ({
      li: link.closest('li'),
      // Label only — exclude the badge span from the match text.
      text: (link.querySelector('span:not(.nav-badge)')?.textContent || link.textContent || '')
        .toLowerCase(),
    })),
  }));

  function apply() {
    const q = input.value.trim().toLowerCase();
    let anyVisible = false;

    for (const { section, title, items } of sections) {
      const sectionMatch = q.length > 0 && title.includes(q);
      let sectionVisible = false;
      for (const { li, text } of items) {
        const match = q.length === 0 || sectionMatch || text.includes(q);
        if (li) li.hidden = !match;
        if (match) sectionVisible = true;
      }
      section.hidden = !sectionVisible;
      if (sectionVisible) anyVisible = true;
    }

    if (noResults) noResults.hidden = anyVisible || q.length === 0;
  }

  input.addEventListener('input', apply);

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      input.focus();
      input.select();
    } else if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      apply();
      input.blur();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
