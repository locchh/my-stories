import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { marked } from 'marked'

const projectRoot = process.cwd()
const dataRoot = join(projectRoot, 'data')
const outputRoot = join(projectRoot, 'dist')
const storiesPerPage = 12
const siteUrl = (process.env.SITE_URL ?? 'https://my-stories-gamma.vercel.app').replace(/\/$/, '')
const template = await readFile(join(outputRoot, 'index.html'), 'utf8')
const lessonDirectories = (await readdir(dataRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

const lessons = await Promise.all(
  lessonDirectories.map(async (id) => {
    const lessonRoot = join(dataRoot, id)
    const [metadata, story, vocabulary] = await Promise.all([
      readFile(join(lessonRoot, 'metadata.json'), 'utf8').then(JSON.parse),
      readFile(join(lessonRoot, 'story.md'), 'utf8'),
      readFile(join(lessonRoot, 'vocabulary.json'), 'utf8').then(JSON.parse),
    ])

    return { id, metadata, story, vocabulary }
  }),
)

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function withDocumentMetadata(html, title, description, tags = []) {
  const document = html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    )

  return tags.length
    ? document.replace('</head>', `<meta name="keywords" content="${escapeHtml(tags.join(', '))}" />\n  </head>`)
    : document
}

function homeFallback() {
  return `
    <main class="home-page static-page">
      <section class="home-hero">
        <p class="eyebrow">Read · Notice · Remember</p>
        <h1>Words make more sense<br /> inside a story.</h1>
        <p>Short English stories built from vocabulary found in videos, articles, and books.</p>
      </section>
      <section class="story-library" aria-labelledby="static-library-title">
        <div class="story-library-heading">
          <div><p class="eyebrow">The library</p><h2 id="static-library-title">Choose a story</h2></div>
          <span>${lessons.length} stories</span>
        </div>
        <div class="story-grid">
          ${lessons.slice(0, storiesPerPage).map((lesson) => `
            <a class="story-preview" href="/stories/${encodeURIComponent(lesson.id)}/">
              <span class="story-preview-topline"><span>Lesson ${escapeHtml(lesson.id)}</span><span>${escapeHtml(lesson.metadata.source.type)}</span></span>
              <span class="story-tags">${lesson.metadata.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</span>
              <span class="story-preview-body"><h3>${escapeHtml(lesson.metadata.title)}</h3><p>${escapeHtml(lesson.metadata.description)}</p></span>
              <span class="word-chips">${lesson.vocabulary.map((entry) => `<span>${escapeHtml(entry.word)}</span>`).join('')}</span>
              <span class="story-preview-footer"><span>${lesson.vocabulary.length} vocabulary words</span><strong>Read story →</strong></span>
            </a>
          `).join('')}
        </div>
      </section>
    </main>
  `
}

function storyFallback(lesson) {
  const source = lesson.metadata.source
  const sourceTitle = source.url
    ? `<a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a>`
    : escapeHtml(source.title)

  return `
    <main class="reader-page static-page">
      <article class="blog-article">
        <a class="back-link" href="/">← Back to the library</a>
        <header class="blog-header">
          <p class="eyebrow">Lesson ${escapeHtml(lesson.id)}</p>
          <h1>${escapeHtml(lesson.metadata.title)}</h1>
          <p class="lesson-description">${escapeHtml(lesson.metadata.description)}</p>
          <nav class="story-tags blog-tags" aria-label="Story tags">${lesson.metadata.tags.map((tag) => `<a href="/?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join('')}</nav>
          <p class="static-source">Source: ${sourceTitle}${source.creator ? ` by ${escapeHtml(source.creator)}` : ''}${source.reference ? ` — ${escapeHtml(source.reference)}` : ''}</p>
        </header>
        <div class="story-content blog-content">${marked.parse(lesson.story)}</div>
        <section class="static-vocabulary" aria-labelledby="static-vocabulary-title">
          <h2 id="static-vocabulary-title">Vocabulary</h2>
          <dl>
            ${lesson.vocabulary.map((entry) => `
              <div>
                <dt>${escapeHtml(entry.word)} <small>${escapeHtml(entry.partOfSpeech)}</small></dt>
                <dd>${escapeHtml(entry.meaning)}${entry.example ? `<br /><em>${escapeHtml(entry.example)}</em>` : ''}</dd>
              </div>
            `).join('')}
          </dl>
        </section>
      </article>
    </main>
  `
}

const homeHtml = template.replace('<div id="app"></div>', `<div id="app">${homeFallback()}</div>`)
await writeFile(join(outputRoot, 'index.html'), homeHtml)

for (const lesson of lessons) {
  const storyDirectory = join(outputRoot, 'stories', lesson.id)
  await mkdir(storyDirectory, { recursive: true })

  const page = withDocumentMetadata(
    template.replace('<div id="app"></div>', `<div id="app">${storyFallback(lesson)}</div>`),
    `${lesson.metadata.title} — My Stories`,
    lesson.metadata.description,
    lesson.metadata.tags,
  )

  await writeFile(join(storyDirectory, 'index.html'), page)
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc></url>
${lessons.map((lesson) => `  <url><loc>${siteUrl}/stories/${encodeURIComponent(lesson.id)}/</loc></url>`).join('\n')}
</urlset>
`

await writeFile(join(outputRoot, 'sitemap.xml'), sitemap)
await writeFile(
  join(outputRoot, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`,
)

console.log(`Generated the library, sitemap, and ${lessons.length} standalone story pages.`)
