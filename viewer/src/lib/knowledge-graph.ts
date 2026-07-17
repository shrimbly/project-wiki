import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type KnowledgeGraphRelation = 'related' | 'parent' | 'source' | 'mention';

export type KnowledgeGraphNode = {
  id: string;
  title: string;
  href: string;
  kind: 'source' | 'wiki';
  category: string;
  pageType?: string;
  status?: string;
  catalog: boolean;
};

export type KnowledgeGraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: KnowledgeGraphRelation;
};

export type KnowledgeGraph = {
  version: 2;
  defaultFocusId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};

const emptyGraph: KnowledgeGraph = { version: 2, nodes: [], edges: [] };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedFile = path.join(__dirname, 'knowledge-graph.generated.json');

export function getKnowledgeGraph(): KnowledgeGraph {
  try {
    if (!fs.existsSync(generatedFile)) return emptyGraph;
    const parsed = JSON.parse(fs.readFileSync(generatedFile, 'utf8')) as Partial<KnowledgeGraph>;
    if (parsed.version !== 2 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return emptyGraph;
    }
    return parsed as KnowledgeGraph;
  } catch {
    return emptyGraph;
  }
}
