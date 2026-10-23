import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const home = defineCollection({
  loader: glob({ pattern: "home.md", base: "./vault" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tagline: z.string(),
    jobhunt: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: ["*.md", "!home.md"], base: "./vault" }),
  schema: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      publish: z.boolean().default(false),
      // Overrides the filename-derived slug. The page is served as HTML at
      // /<slug>/ and as Markdown at /<slug>.md. A trailing `.md` is a
      // legacy of the old file-style URLs and is ignored.
      permalink: z
        .string()
        .regex(
          /^[a-z0-9][a-z0-9-]*(\.md)?$/,
          "permalink muss ein kebab-case Slug sein, optional mit .md-Endung",
        )
        .optional(),
      // Page template. "sidebar" renders the content with a table-of-contents
      // sidebar linking to every h2 (extracted at build time by Astro's
      // markdown pipeline, see src/pages/[slug].astro). "projects" renders
      // every h2 section as a card (see src/lib/rehypeProjectCards.js).
      template: z.enum(["default", "sidebar", "projects"]).default("default"),
    })
    .superRefine((data, ctx) => {
      if (data.publish && !data.title) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "title ist Pflicht, wenn publish: true",
        });
      }
    }),
});

export const collections = { home, pages };
