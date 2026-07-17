import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { fromMarkdown } from 'mdast-util-from-markdown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const projectRoot = path.resolve(root, '..');
const sourcesDir = path.resolve(projectRoot, 'sources');
const wikiDir = path.resolve(projectRoot, 'wiki');
const targetMd = path.join(root, 'src', 'content', 'sources');
const targetAssets = path.join(root, 'public', 'assets');
const sidebarFile = path.join(root, 'src', 'lib', 'sidebar.generated.json');
const graphFile = path.join(root, 'src', 'lib', 'knowledge-graph.generated.json');

if (!fs.existsSync(sourcesDir)) {
  console.error(`sources/ not found at ${sourcesDir}`);
  process.exit(1);
}

fs.rmSync(targetMd, { recursive: true, force: true });
fs.rmSync(targetAssets, { recursive: true, force: true });
fs.mkdirSync(targetMd, { recursive: true });
fs.mkdirSync(targetAssets, { recursive: true });

// ---------- Document parsing ----------
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function parseDocument(content, repoPath) {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return { data: {}, body: content };

  try {
    const data = parseYaml(match[1]) ?? {};
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('frontmatter must be a mapping');
    }
    return { data, body: content.slice(match[0].length) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid frontmatter in ${repoPath}: ${message}`);
  }
}

function stringValue(data, key) {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(data, key) {
  const value = data[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function stringList(data, key) {
  const value = data[key];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
}

function markdownLinks(body) {
  const tree = fromMarkdown(body);
  const definitions = new Map();
  const links = [];

  function walk(node, callback) {
    callback(node);
    if (!Array.isArray(node.children)) return;
    for (const child of node.children) walk(child, callback);
  }

  walk(tree, (node) => {
    if (node.type === 'definition' && typeof node.identifier === 'string' && typeof node.url === 'string') {
      definitions.set(node.identifier.toLowerCase(), node.url);
    }
  });

  walk(tree, (node) => {
    if (node.type === 'link' && typeof node.url === 'string') {
      links.push(node.url);
    } else if (node.type === 'linkReference' && typeof node.identifier === 'string') {
      const url = definitions.get(node.identifier.toLowerCase());
      if (url) links.push(url);
    }
  });

  return links;
}

// ---------- Sync documents ----------
const sourceEntries = []; // { slug, label, badge, order, isIndex }
const wikiEntries = []; // { slug, dir, base, label, badge, order }
const documents = [];
const documentsBySlug = new Map();
let sourcesCount = 0;
let wikiCount = 0;
let assetCount = 0;

function registerDocument(document) {
  const existing = documentsBySlug.get(document.slug);
  if (existing) {
    throw new Error(
      `Duplicate viewer slug "${document.slug}" from ${existing.repoPath} and ${document.repoPath}`,
    );
  }
  documents.push(document);
  documentsBySlug.set(document.slug, document);
}

// ---------- Sync sources/*.md (flat) — preserve filenames, INDEX.md → index.md ----------
for (const name of fs.readdirSync(sourcesDir)) {
  const src = path.join(sourcesDir, name);
  if (!fs.statSync(src).isFile() || !name.endsWith('.md')) continue;

  const isIndex = name === 'INDEX.md';
  const targetName = isIndex ? 'index.md' : name;
  const slug = isIndex ? 'index' : name.replace(/\.md$/, '');
  const repoPath = `sources/${name}`;
  let content = fs.readFileSync(src, 'utf8');
  if (!content.startsWith('---\n')) {
    const title = isIndex ? 'Sources Index' : slug;
    content = `---\ntitle: "${title}"\n---\n\n` + content;
  }

  const parsed = parseDocument(content, repoPath);
  const title = stringValue(parsed.data, 'title') || (isIndex ? 'Sources Index' : slug);
  const badge = stringValue(parsed.data, 'badge');
  const order = numberValue(parsed.data, 'order');
  const pageType = stringValue(parsed.data, 'type');
  const status = stringValue(parsed.data, 'status');

  registerDocument({
    slug,
    href: isIndex ? '/' : `/${slug}/`,
    title,
    kind: 'source',
    pageType,
    status,
    catalog: isIndex || pageType === 'index',
    repoPath,
    contentPath: name,
    contentDir: '',
    data: parsed.data,
    body: parsed.body,
  });

  fs.writeFileSync(path.join(targetMd, targetName), content);
  sourceEntries.push({ slug, label: title, badge, order, isIndex });
  sourcesCount++;
}

// ---------- Sync wiki/**/*.md (recursive) → flat namespaced slugs (`wiki-<dir>-<file>`) ----------
// Also copies any `assets/` directories under wiki/ to public/assets/<wiki-relpath>/
// and rewrites `./assets/X` → `/assets/<wiki-relpath>/X` in synced markdown.
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
    const contentPath = relPath ? `${relPath}/${name}` : name;
    const repoPath = `wiki/${contentPath}`;
    let content = fs.readFileSync(full, 'utf8');
    if (!content.startsWith('---\n')) {
      content = `---\ntitle: "${baseName}"\n---\n\n` + content;
    }

    // Rewrite ./assets/X → /assets/<relPath>/X for markdown + html image refs.
    const assetPrefix = relPath ? `/assets/${relPath}/` : '/assets/';
    content = content.replace(/\]\(\.\/assets\//g, `](${assetPrefix}`);
    content = content.replace(/src="\.\/assets\//g, `src="${assetPrefix}`);

    const parsed = parseDocument(content, repoPath);
    const title = stringValue(parsed.data, 'title') || baseName;
    const badge = stringValue(parsed.data, 'badge');
    const order = numberValue(parsed.data, 'order');
    const pageType = stringValue(parsed.data, 'type');
    const status = stringValue(parsed.data, 'status');

    registerDocument({
      slug,
      href: `/${slug}/`,
      title,
      kind: 'wiki',
      pageType,
      status,
      catalog: baseName === 'index' || pageType === 'index',
      repoPath,
      contentPath,
      contentDir: relPath,
      data: parsed.data,
      body: parsed.body,
    });

    fs.writeFileSync(path.join(targetMd, targetName), content);
    wikiEntries.push({ slug, dir: relPath, base: baseName, label: title, badge, order });
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

// ---------- Build the knowledge graph ----------
const documentsByRepoPath = new Map(documents.map((document) => [document.repoPath, document]));
const unresolvedReferences = [];
const edgeMap = new Map();

function cleanReference(value) {
  return value.split(/[?#]/, 1)[0].trim().replace(/\\/g, '/');
}

function viewerRoute(value) {
  if (!value.startsWith('/')) return { handled: false };
  const pathname = cleanReference(value);
  if (!pathname || pathname.startsWith('/assets/')) return { handled: true, ignored: true };
  const slug = pathname === '/' ? 'index' : pathname.replace(/^\/+|\/+$/g, '');
  return { handled: true, target: documentsBySlug.get(slug) };
}

function markdownPath(value) {
  const cleaned = cleanReference(value).replace(/^\.\//, '').replace(/^\/+/, '');
  if (!cleaned) return '';
  return cleaned.endsWith('.md') ? cleaned : `${cleaned}.md`;
}

function repoDocument(candidate) {
  const normalized = path.posix.normalize(candidate);
  if (normalized === '..' || normalized.startsWith('../')) return undefined;
  return documentsByRepoPath.get(normalized);
}

function resolveSourceReference(value) {
  const route = viewerRoute(value);
  if (route.handled) return route;

  const cleaned = markdownPath(value).replace(/^sources\//, '');
  const target = repoDocument(`sources/${cleaned}`);
  return { handled: true, target };
}

function resolveContentReference(document, value) {
  const route = viewerRoute(value);
  if (route.handled) return route;

  const cleaned = markdownPath(value);
  if (!cleaned) return { handled: true };

  if (cleaned.startsWith('sources/')) {
    return { handled: true, target: repoDocument(cleaned) };
  }
  if (cleaned.startsWith('wiki/')) {
    return { handled: true, target: repoDocument(cleaned) };
  }

  if (document.kind === 'wiki') {
    const candidates = [];
    if (document.contentDir) candidates.push(`wiki/${document.contentDir}/${cleaned}`);
    candidates.push(`wiki/${cleaned}`);
    for (const candidate of candidates) {
      const target = repoDocument(candidate);
      if (target) return { handled: true, target };
    }
    return { handled: true };
  }

  return { handled: true, target: repoDocument(`sources/${cleaned}`) };
}

function observe(document, target, relation) {
  if (!target || target.slug === document.slug) return;

  let source = document.slug;
  let destination = target.slug;
  let separator = '->';
  if (relation === 'related') {
    [source, destination] = [source, destination].sort((a, b) => a.localeCompare(b));
    separator = '::';
  }

  const id = `${relation}:${source}${separator}${destination}`;
  if (!edgeMap.has(id)) {
    edgeMap.set(id, { id, source, target: destination, relation });
  }
}

function resolveAndObserve(document, value, relation, resolver) {
  const result = resolver(value);
  if (result.ignored) return;
  if (result.target) {
    observe(document, result.target, relation);
    return;
  }
  unresolvedReferences.push({ from: document.repoPath, relation, value });
}

for (const document of documents) {
  if (document.catalog) continue;

  for (const value of stringList(document.data, 'sources')) {
    resolveAndObserve(document, value, 'source', resolveSourceReference);
  }
  for (const value of stringList(document.data, 'related')) {
    resolveAndObserve(document, value, 'related', (reference) =>
      resolveContentReference(document, reference),
    );
  }

  const parent = stringValue(document.data, 'parent');
  if (parent) {
    resolveAndObserve(document, parent, 'parent', (reference) =>
      resolveContentReference(document, reference),
    );
  }

  for (const value of new Set(markdownLinks(document.body))) {
    if (!value.startsWith('/')) continue;
    const result = viewerRoute(value);
    if (result.ignored) continue;
    if (result.target) {
      observe(document, result.target, 'mention');
    } else {
      unresolvedReferences.push({ from: document.repoPath, relation: 'mention', value });
    }
  }
}

function graphCategory(document) {
  if (document.kind === 'source') return 'source';
  if (document.catalog) return 'catalog';
  if (document.pageType) return document.pageType.toLowerCase();
  return document.contentDir.split('/')[0] || 'wiki';
}

const defaultFocus =
  documentsBySlug.get('wiki-overview') ||
  documents.find((document) => document.kind === 'wiki' && !document.catalog) ||
  documents.find((document) => !document.catalog) ||
  documents[0];

const graph = {
  version: 2,
  defaultFocusId: defaultFocus?.slug,
  nodes: documents
    .map((document) => ({
      id: document.slug,
      title: document.title,
      href: document.href,
      kind: document.kind,
      category: graphCategory(document),
      ...(document.pageType ? { pageType: document.pageType } : {}),
      ...(document.status ? { status: document.status } : {}),
      catalog: document.catalog,
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  edges: [...edgeMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
};

fs.mkdirSync(path.dirname(graphFile), { recursive: true });
fs.writeFileSync(graphFile, JSON.stringify(graph, null, 2) + '\n');

if (unresolvedReferences.length > 0) {
  const preview = unresolvedReferences
    .slice(0, 5)
    .map((reference) => `${reference.from}: ${reference.relation} → ${reference.value}`)
    .join('\n  ');
  console.warn(
    `knowledge graph: ${unresolvedReferences.length} unresolved reference(s)${preview ? `\n  ${preview}` : ''}`,
  );
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
for (const entry of wikiEntries) {
  const key = entry.dir.split('/')[0]; // '' for top-level
  if (!byGroup.has(key)) byGroup.set(key, []);
  byGroup.get(key).push(entry);
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
    .map((entry) => ({
      slug: entry.slug,
      label: entry.label,
      ...(entry.badge ? { badge: entry.badge } : {}),
    }));
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
for (const dir of [...byGroup.keys()].filter((dir) => !seenGroups.has(dir)).sort()) {
  sections.push({ title: sectionLabel(dir), items: sortItems(byGroup.get(dir), false) });
}

// Sources section last. Index first, then the rest by order/label.
if (sourceEntries.length > 0) {
  const index = sourceEntries.find((entry) => entry.isIndex);
  const rest = sourceEntries
    .filter((entry) => !entry.isIndex)
    .sort((a, b) => {
      const ra = a.order ?? 990;
      const rb = b.order ?? 990;
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label);
    });
  const items = [...(index ? [index] : []), ...rest].map((entry) => ({
    slug: entry.slug,
    label: entry.label,
    ...(entry.badge ? { badge: entry.badge } : {}),
  }));
  sections.push({ title: 'Sources', items });
}

fs.mkdirSync(path.dirname(sidebarFile), { recursive: true });
fs.writeFileSync(sidebarFile, JSON.stringify(sections, null, 2) + '\n');

console.log(
  `synced: ${sourcesCount} source(s), ${wikiCount} wiki page(s), ${assetCount} asset(s); ` +
    `sidebar: ${sections.length} section(s); graph: ${graph.nodes.length} node(s), ${graph.edges.length} edge(s)`,
);
