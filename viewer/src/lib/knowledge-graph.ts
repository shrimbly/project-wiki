import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type KnowledgeGraphNode = {
  id: string;
  title: string;
  href: string;
  kind: 'source' | 'wiki';
  pageType?: string;
  catalog: boolean;
};

export type KnowledgeGraphEdge = {
  id: string;
  source: string;
  target: string;
  relations: string[];
};

export type KnowledgeGraph = {
  version: 1;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};

const emptyGraph: KnowledgeGraph = { version: 1, nodes: [], edges: [] };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedFile = path.join(__dirname, 'knowledge-graph.generated.json');

export function getKnowledgeGraph(): KnowledgeGraph {
  try {
    if (!fs.existsSync(generatedFile)) return emptyGraph;
    const parsed = JSON.parse(fs.readFileSync(generatedFile, 'utf8')) as Partial<KnowledgeGraph>;
    if (parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return emptyGraph;
    }
    return parsed as KnowledgeGraph;
  } catch {
    return emptyGraph;
  }
}
