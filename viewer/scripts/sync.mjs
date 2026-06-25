import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const projectRoot = path.resolve(root, '..');
const sourcesDir = path.resolve(projectRoot, 'sources');
const wikiDir = path.resolve(projectRoot, 'wiki');
const targetMd = path.join(root, 'src', 'content', 'sources');
const targetAssets = path.join(root, 'public', 'assets');
const sidebarFile = path.join(root, 'src', 'lib', 'sidebar.generated.json');

if (!fs.existsSync(sourcesDir)) {
  console.error(`sources/ not found at ${sourcesDir}`);
  process.exit(1);
}

fs.rmSync(targetMd, { recursive: true, force: true });
fs.rmSync(targetAssets, { recursive: true, force: true });
fs.mkdirSync(targetMd, { recursive: true });
fs.mkdirSync(targetAssets, { recursive: true });

// ---------- Frontmatter parsing (lightweight; avoids a YAML dependency) ----------
function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---', 4);
  if (end < 0) return {};
  const block = content.slice(4, end);
  const get = (key) => {
    const m = block.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
    if (!m) return undefined;
    return m[1].replace(/^["']|["']$/g, '');
  };
  const order = get('order');
  return {
    title: get('title'),
    badge: get('badge'),
    order: order !== undefined && order !== '' ? Number(order) : undefined,
  };
}

// ---------- Sync sources/*.md (flat) — preserve filenames, INDEX.md → index.md ----------
const sourceEntries = []; // { slug, label, badge, order, isIndex }
let sourcesCount = 0;
for (const name of fs.readdirSync(sourcesDir)) {
  const src = path.join(sourcesDir, name);
  if (!fs.statSync(src).isFile() || !name.endsWith('.md')) continue;

  const isIndex = name === 'INDEX.md';
  const targetName = isIndex ? 'index.md' : name;
  const slug = isIndex ? 'index' : name.replace(/\.md$/, '');
  let content = fs.readFileSync(src, 'utf8');
  if (!content.startsWith('---\n')) {
    const title = isIndex ? 'Sources Index' : slug;
    content = `---\ntitle: "${title}"\n---\n\n` + content;
  }
  const fm = parseFrontmatter(content);
  fs.writeFileSync(path.join(targetMd, targetName), content);
  sourceEntries.push({
    slug,
    label: fm.title || (isIndex ? 'Sources Index' : slug),
    badge: fm.badge,
    order: fm.order,
    isIndex,
  });
  sourcesCount++;
}

// ---------- Sync wiki/**/*.md (recursive) → flat namespaced slugs (`wiki-<dir>-<file>`) ----------
// Also copies any `assets/` directories under wiki/ to public/assets/<wiki-relpath>/
// and rewrites `./assets/X` → `/assets/<wiki-relpath>/X` in synced markdown.
const wikiEntries = []; // { slug, dir, base, label, badge, order }
let wikiCount = 0;
let assetCount = 0;
function syncWiki(dir, prefix, relPath = '') {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'assets') {
        const destDir = relPath ? path.join(targetAssets, relPath) : targetAssets;
        fs.mkdirSync(destDir, { recursive: true });
        for (const assetName of fs.readdirSync(full)) {
          const assetSrc = path.join(full, assetName);
          if (fs.statSync(assetSrc).isFile()) {
            fs.copyFileSync(assetSrc, path.join(destDir, assetName));
            assetCount++;
          }
        }
        continue;
      }
      syncWiki(full, `${prefix}-${name}`, relPath ? `${relPath}/${name}` : name);
      continue;
    }
    if (!stat.isFile() || !name.endsWith('.md')) continue;
    const baseName = name.replace(/\.md$/, '');
    const targetName = `${prefix}-${baseName}.md`;
    const slug = `${prefix}-${baseName}`;
    let content = fs.readFileSync(full, 'utf8');
    if (!content.startsWith('---\n')) {
      content = `---\ntitle: "${baseName}"\n---\n\n` + content;
    }
    // Rewrite ./assets/X → /assets/<relPath>/X for markdown + html image refs
    const assetPrefix = relPath ? `/assets/${relPath}/` : '/assets/';
    content = content.replace(/\]\(\.\/assets\//g, `](${assetPrefix}`);
    content = content.replace(/src="\.\/assets\//g, `src="${assetPrefix}`);
    fs.writeFileSync(path.join(targetMd, targetName), content);
    const fm = parseFrontmatter(content);
    wikiEntries.push({
      slug,
      dir: relPath, // '' for top-level wiki files
      base: baseName,
      label: fm.title || baseName,
      badge: fm.badge,
      order: fm.order,
    });
    wikiCount++;
  }
}
if (fs.existsSync(wikiDir)) {
  syncWiki(wikiDir, 'wiki');
}

// ---------- Sync sources/assets/* (flat) ----------
const assetsSrc = path.join(sourcesDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  for (const name of fs.readdirSync(assetsSrc)) {
    const src = path.join(assetsSrc, name);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(targetAssets, name));
      assetCount++;
    }
  }
}

// ---------- Build the sidebar ----------
// Preferred section order + display labels for known wiki subdirectories.
// '' is the top-level wiki bucket (overview / index / open-questions / etc.).
const WIKI_SECTION_ORDER = ['', 'diagrams', 'concepts', 'entities', 'decisions', 'references'];
const WIKI_SECTION_LABEL = {
  '': 'Wiki',
  diagrams: 'Wiki · Diagrams',
  concepts: 'Wiki · Concepts',
  entities: 'Wiki · Entities',
  decisions: 'Wiki · Decisions',
  references: 'Wiki · References',
};
const TOP_LEVEL_PRIORITY = { overview: 0, index: 1, 'open-questions': 2 };

function titleCase(s) {
  return s
    .split(/[-/]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function sectionLabel(dir) {
  if (dir in WIKI_SECTION_LABEL) return WIKI_SECTION_LABEL[dir];
  return `Wiki · ${titleCase(dir.split('/')[0])}`;
}

// Group wiki entries by their first path segment.
const byGroup = new Map();
for (const e of wikiEntries) {
  const key = e.dir.split('/')[0]; // '' for top-level
  if (!byGroup.has(key)) byGroup.set(key, []);
  byGroup.get(key).push(e);
}

function sortItems(items, topLevel) {
  return items
    .slice()
    .sort((a, b) => {
      const ra = topLevel
        ? (a.base in TOP_LEVEL_PRIORITY ? TOP_LEVEL_PRIORITY[a.base] : 10 + (a.order ?? 990))
        : (a.order ?? 990);
      const rb = topLevel
        ? (b.base in TOP_LEVEL_PRIORITY ? TOP_LEVEL_PRIORITY[b.base] : 10 + (b.order ?? 990))
        : (b.order ?? 990);
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label);
    })
    .map((e) => ({ slug: e.slug, label: e.label, ...(e.badge ? { badge: e.badge } : {}) }));
}

const sections = [];

// Known wiki groups first, in preferred order.
const seenGroups = new Set();
for (const dir of WIKI_SECTION_ORDER) {
  if (!byGroup.has(dir)) continue;
  seenGroups.add(dir);
  sections.push({
    title: sectionLabel(dir),
    items: sortItems(byGroup.get(dir), dir === ''),
  });
}
// Any unknown wiki groups, alphabetically.
for (const dir of [...byGroup.keys()].filter((d) => !seenGroups.has(d)).sort()) {
  sections.push({ title: sectionLabel(dir), items: sortItems(byGroup.get(dir), false) });
}

// Sources section last. Index first, then the rest by order/label.
if (sourceEntries.length > 0) {
  const index = sourceEntries.find((e) => e.isIndex);
  const rest = sourceEntries
    .filter((e) => !e.isIndex)
    .sort((a, b) => {
      const ra = a.order ?? 990;
      const rb = b.order ?? 990;
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label);
    });
  const items = [...(index ? [index] : []), ...rest].map((e) => ({
    slug: e.slug,
    label: e.label,
    ...(e.badge ? { badge: e.badge } : {}),
  }));
  sections.push({ title: 'Sources', items });
}

fs.mkdirSync(path.dirname(sidebarFile), { recursive: true });
fs.writeFileSync(sidebarFile, JSON.stringify(sections, null, 2) + '\n');

console.log(
  `synced: ${sourcesCount} source(s), ${wikiCount} wiki page(s), ${assetCount} asset(s); ` +
    `sidebar: ${sections.length} section(s)`,
);
