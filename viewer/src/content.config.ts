import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// YAML parses bare dates (`2026-05-08`) into Date objects, so accept either
// and normalize to a display string.
const dateOrString = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));

const sources = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/sources' }),
  schema: z
    .object({
      title: z.string().optional(),
      url: z.string().optional(),
      type: z.string().optional(),
      fetched: dateOrString.optional(),
      status: z.string().optional(),
      mvp_status: z.string().optional(),
      parent: z.string().optional(),
      badge: z.string().optional(),
      fileKey: z.string().optional(),
      nodeId: z.string().optional(),
      notion_status: z.string().optional(),
      notion_last_updated: dateOrString.optional(),
      notion_category: z.string().optional(),
    })
    .passthrough(),
});

export const collections = { sources };
