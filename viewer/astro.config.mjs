import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const annotationsDir = path.resolve(__dirname, '..', 'annotations');

// Rewrite markdown image URLs:
//   assets/foo.png         → /assets/foo.png
//   sources/assets/foo.png → /assets/foo.png
function remarkRewriteAssets() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'image' && typeof node.url === 'string') {
        if (node.url.startsWith('sources/assets/')) {
          node.url = '/' + node.url.slice('sources/'.length);
        } else if (node.url.startsWith('assets/')) {
          node.url = '/' + node.url;
        }
      }
      if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(tree);
  };
}

// Convert ```mermaid code blocks into placeholder divs that the client
// renders into SVG via mermaid.js. Avoids Shiki processing the source.
function remarkMermaid() {
  return (tree) => {
    const escapeHtml = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const visit = (node) => {
      if (!Array.isArray(node.children)) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'code' && child.lang === 'mermaid') {
          node.children[i] = {
            type: 'html',
            value: `<div class="mermaid-source">${escapeHtml(child.value)}</div>`,
          };
        } else {
          visit(child);
        }
      }
    };
    visit(tree);
  };
}

// Annotation API — Vite middleware. Runs in `astro dev` only; static
// builds will not include this. Annotations are stored as JSON files at
// <repo>/annotations/<slug>.json.
const SLUG_RE = /^[a-z0-9_-]+$/i;
const ID_RE = /^ann_[a-z0-9_]+$/i;

function readAnnotations(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(raw.annotations) ? raw.annotations : [];
  } catch {
    return [];
  }
}

function writeAnnotations(file, slug, annotations) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = { doc: slug, annotations };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  if (body === undefined || body === null) {
    res.end();
    return;
  }
  res.setHeader('content-type', 'application/json');
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function annotationApiPlugin() {
  return {
    name: 'annotation-api',
    configureServer(server) {
      server.middlewares.use('/api/annotations', async (req, res, next) => {
        try {
          const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
          const segments = url.pathname.replace(/^\//, '').split('/').filter(Boolean);
          const slug = segments[0];
          const annotationId = segments[1];

          if (!slug) return send(res, 400, { error: 'missing slug' });
          if (!SLUG_RE.test(slug)) return send(res, 400, { error: 'invalid slug' });

          const file = path.join(annotationsDir, `${slug}.json`);

          if (req.method === 'GET') {
            return send(res, 200, { doc: slug, annotations: readAnnotations(file) });
          }

          if (req.method === 'POST' && !annotationId) {
            const body = await readBody(req);
            let payload;
            try {
              payload = JSON.parse(body);
            } catch {
              return send(res, 400, { error: 'invalid json' });
            }
            if (typeof payload?.quote !== 'string' || !payload.quote) {
              return send(res, 400, { error: 'missing quote' });
            }
            if (typeof payload?.comment !== 'string' || !payload.comment) {
              return send(res, 400, { error: 'missing comment' });
            }
            const annotation = {
              id: 'ann_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
              createdAt: new Date().toISOString(),
              quote: payload.quote,
              prefix: typeof payload.prefix === 'string' ? payload.prefix : '',
              suffix: typeof payload.suffix === 'string' ? payload.suffix : '',
              comment: payload.comment,
            };
            const list = readAnnotations(file);
            list.push(annotation);
            writeAnnotations(file, slug, list);
            return send(res, 201, annotation);
          }

          if (annotationId) {
            if (!ID_RE.test(annotationId)) return send(res, 400, { error: 'invalid id' });
            const list = readAnnotations(file);
            const idx = list.findIndex((a) => a.id === annotationId);
            if (idx < 0) return send(res, 404, { error: 'not found' });

            if (req.method === 'DELETE') {
              list.splice(idx, 1);
              writeAnnotations(file, slug, list);
              return send(res, 204);
            }

            if (req.method === 'PATCH') {
              const body = await readBody(req);
              let payload;
              try {
                payload = JSON.parse(body);
              } catch {
                return send(res, 400, { error: 'invalid json' });
              }
              if (typeof payload?.comment === 'string' && payload.comment) {
                list[idx].comment = payload.comment;
              }
              list[idx].updatedAt = new Date().toISOString();
              writeAnnotations(file, slug, list);
              return send(res, 200, list[idx]);
            }
          }

          next();
        } catch (e) {
          send(res, 500, { error: e.message });
        }
      });
    },
  };
}

// Dev-only content sync. The wiki/ and sources/ trees live OUTSIDE the viewer,
// so Astro/Vite don't watch them — edits wouldn't show up without restarting the
// server (which is what re-runs `npm run sync`). This watches those trees and
// re-runs the sync script on any change, then triggers a full reload so both the
// synced page content and the regenerated sidebar refresh live. `astro dev` only.
function contentSyncPlugin() {
  const projectRoot = path.resolve(__dirname, '..');
  const syncScript = path.resolve(__dirname, 'scripts', 'sync.mjs');
  const watched = [path.join(projectRoot, 'sources'), path.join(projectRoot, 'wiki')];
  return {
    name: 'project-wiki-content-sync',
    apply: 'serve',
    configureServer(server) {
      let timer = null;
      const resync = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            execFileSync(process.execPath, [syncScript], { cwd: __dirname, stdio: 'pipe' });
          } catch (e) {
            server.config.logger.error(`[content-sync] sync failed: ${e.message}`);
            return;
          }
          server.ws.send({ type: 'full-reload' });
        }, 80);
      };
      for (const p of watched) server.watcher.add(p);
      server.watcher.on('all', (_event, file) => {
        if (typeof file !== 'string') return;
        if (watched.some((w) => file === w || file.startsWith(w + path.sep))) resync();
      });
    },
  };
}

export default defineConfig({
  markdown: {
    shikiConfig: { theme: 'github-light' },
    remarkPlugins: [remarkRewriteAssets, remarkMermaid],
  },
  vite: {
    plugins: [annotationApiPlugin(), contentSyncPlugin()],
    // Mermaid is heavy; pre-bundle it at dev startup so the first request
    // doesn't time out the optimizer.
    optimizeDeps: {
      include: ['mermaid'],
    },
    server: {
      // Give the optimizer headroom for first-request bundling of large deps.
      warmup: { clientFiles: ['./src/scripts/mermaid.js'] },
    },
  },
});
