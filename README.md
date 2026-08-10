# my-stories

Learn English vocabulary through stories, context, and active recall. Each lesson connects a
source—such as a video, article, podcast, or book—to a Markdown story and a reusable vocabulary
list.

## Tech stack

- Bun and TypeScript
- Vite
- Vercel

```text
my-stories/
├── data/
│   ├── 01/
│   │   ├── metadata.json
│   │   ├── story.md
│   │   └── vocabulary.json
│   ├── 02/
│   │   ├── metadata.json
│   │   ├── story.md
│   │   └── vocabulary.json
│   └── .../
│       ├── metadata.json
│       ├── story.md
│       └── vocabulary.json
├── src/
├── index.html
├── package.json
└── vite.config.ts
```

Every numbered directory is a lesson:

- `metadata.json` describes the lesson and links to the material where its vocabulary was found.
- `story.md` contains the story in Markdown.
- `vocabulary.json` contains the words used and highlighted in the story.

The library page displays every lesson as a card. Each card links to a standalone blog page at
`/stories/{lesson-id}/`, such as `/stories/01/`. Production builds pre-render the story and its
vocabulary into that page's HTML, so search engines and AI tools can read it directly from its URL.

The library displays 12 cards per page and keeps the current page and tag in the URL, such as
`/?tag=environment&page=2`. Text searches and tag changes return to the first matching page. Story
Markdown is loaded only when its standalone page is opened, keeping the main library bundle small
as the collection grows. Production builds also generate `sitemap.xml` for every story URL.

On a story page, the vocabulary sidebar is hidden by default. Select a highlighted word to open a
small definition popover, or use the **Vocabulary** button to open the complete list.

### Metadata

```json
{
  "title": "The Five-Minute Voice",
  "description": "A short description of the lesson.",
  "tags": ["pronunciation", "speaking", "confidence"],
  "source": {
    "type": "youtube",
    "title": "The original video's title",
    "creator": "Channel or author",
    "url": "https://example.com",
    "reference": "Optional timestamp, chapter, or section"
  }
}
```

Supported source types are `youtube`, `book`, `article`, `podcast`, `course`, and `other`.
Tags are required, case-sensitive display labels. Keep them short and reuse the same spelling across
lessons so the library can group related stories correctly.

### Vocabulary

```json
[
  {
    "word": "reluctant",
    "partOfSpeech": "adjective",
    "meaning": "do dự, miễn cưỡng",
    "example": "She was reluctant to listen to the recording."
  }
]
```

## Development

```bash
bun install
bun run dev
```

Run `bun run build` to type-check the app and produce the static site in `dist/`.

## Related to

[my-nihongo](https://github.com/locchh/my-nihongo)

[my-english](https://github.com/locchh/my-english)

[How to learn?](https://locchh.github.io/blogs/blog/how_to_learn/)

[How to improve English?](https://github.com/locchh/my-english/blob/main/docs/how-to-improve.md)
