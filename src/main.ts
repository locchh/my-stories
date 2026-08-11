import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { lessons, loadLesson } from './data'
import { paginate, paginationItems } from './pagination'
import type { Lesson, LessonSummary, VocabularyEntry } from './types'
import './style.css'

const app = getAppRoot()

const sourceLabels = {
  youtube: 'YouTube',
  book: 'Book',
  article: 'Article',
  podcast: 'Podcast',
  course: 'Course',
  other: 'Source',
} as const

const allTags = Array.from(
  new Set(lessons.flatMap((lesson) => lesson.metadata.tags)),
).sort((a, b) => a.localeCompare(b))

const STORIES_PER_PAGE = 12

function getAppRoot(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>('#app')
  if (!element) throw new Error('App root was not found')
  return element
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)

  if (!element) {
    throw new Error(`Element #${id} was not found`)
  }

  return element as T
}

function storyPath(lesson: LessonSummary): string {
  return `/stories/${encodeURIComponent(lesson.id)}/`
}

function lessonIdFromPath(): string | undefined {
  const match = window.location.pathname.match(/^\/stories\/([^/]+)\/?$/)
  if (!match) return undefined

  return decodeURIComponent(match[1])
}

function randomLesson(excludeId?: string): LessonSummary {
  const alternatives = lessons.filter((lesson) => lesson.id !== excludeId)
  const pool = alternatives.length > 0 ? alternatives : lessons
  return pool[Math.floor(Math.random() * pool.length)]
}

function brandMarkup(): string {
  return `
    <a class="brand" href="/" aria-label="My Stories home">
      <span class="brand-mark" aria-hidden="true">MS</span>
      <span>
        <strong>My Stories</strong>
        <small>Words worth remembering</small>
      </span>
    </a>
  `
}

function sourceMarkup(lesson: LessonSummary): string {
  const { source } = lesson.metadata
  const creator = source.creator ? `<span>${escapeHtml(source.creator)}</span>` : ''
  const reference = source.reference ? `<small>${escapeHtml(source.reference)}</small>` : ''
  const content = `
    <span class="source-type">${escapeHtml(sourceLabels[source.type])}</span>
    <strong>${escapeHtml(source.title)}</strong>
    ${creator}
    ${reference}
  `

  if (!source.url) {
    return `<div class="source-content">${content}</div>`
  }

  return `
    <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
      <span class="source-content">${content}</span>
      <span class="source-arrow" aria-hidden="true">↗</span>
    </a>
  `
}

function renderHome(): void {
  document.title = 'My Stories — Learn words in context'
  const searchParams = new URLSearchParams(window.location.search)
  const requestedTag = searchParams.get('tag')
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  let activeTag = allTags.find((tag) => normalize(tag) === normalize(requestedTag ?? '')) ?? ''
  let currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1

  app.innerHTML = `
    <header class="topbar home-topbar">
      ${brandMarkup()}
      <div class="global-search">
        <label class="sr-only" for="library-search">Search stories and vocabulary</label>
        <span class="search-icon" aria-hidden="true"></span>
        <input
          id="library-search"
          type="search"
          autocomplete="off"
          placeholder="Search stories, words, or meanings…"
        />
      </div>
      <button id="random-story" class="random-button" type="button">
        <span aria-hidden="true">↝</span>
        Random story
      </button>
    </header>

    <main class="home-page">
      <section class="home-hero">
        <p class="eyebrow">Read · Notice · Remember</p>
        <h1>Words make more sense<br /> inside a story.</h1>
        <p>
          Explore short stories built from vocabulary found in videos, articles, and books.
          Click a highlighted word whenever you need its meaning.
        </p>
      </section>

      <section class="story-library" aria-labelledby="library-title">
        <div class="story-library-heading">
          <div>
            <p class="eyebrow">The library</p>
            <h2 id="library-title">Choose a story</h2>
          </div>
          <span id="visible-story-count">${lessons.length} stories</span>
        </div>

        <div id="tag-filters" class="tag-filters" role="group" aria-label="Filter stories by tag">
          <button type="button" data-tag="" aria-pressed="${String(!activeTag)}" class="${!activeTag ? 'active' : ''}">All</button>
          ${allTags.map((tag) => `
            <button
              type="button"
              data-tag="${escapeHtml(tag)}"
              aria-pressed="${String(activeTag === tag)}"
              class="${activeTag === tag ? 'active' : ''}"
            >#${escapeHtml(tag)}</button>
          `).join('')}
        </div>

        <div id="story-grid" class="story-grid"></div>

        <div id="empty-library" class="library-empty" hidden>
          <span aria-hidden="true">○</span>
          <h3>No stories found</h3>
          <p>Try searching for another title, word, meaning, or part of speech.</p>
        </div>

        <nav id="pagination" class="pagination" aria-label="Story pages" hidden></nav>
      </section>

      <section class="method-banner">
        <span class="method-number">3W</span>
        <div>
          <p class="eyebrow">The learning loop</p>
          <h2>Watch. Write. Workout.</h2>
        </div>
        <p>Meet vocabulary in real material, reuse it in a story, and practise until it becomes yours.</p>
      </section>
    </main>

    <footer><p>Learn the word. Meet it in a story. Use it until it stays.</p></footer>
  `

  const search = getElement<HTMLInputElement>('library-search')
  const storyGrid = getElement<HTMLElement>('story-grid')
  const emptyLibrary = getElement<HTMLElement>('empty-library')
  const visibleStoryCount = getElement<HTMLElement>('visible-story-count')
  const tagFilters = getElement<HTMLElement>('tag-filters')
  const pagination = getElement<HTMLElement>('pagination')

  function syncLibraryUrl(): void {
    const url = new URL(window.location.href)
    if (activeTag) url.searchParams.set('tag', activeTag)
    else url.searchParams.delete('tag')
    if (currentPage > 1) url.searchParams.set('page', String(currentPage))
    else url.searchParams.delete('page')
    window.history.replaceState({}, '', url)
  }

  function lessonMatchesSearch(lesson: LessonSummary, query: string): boolean {
    if (!query) return true

    const searchable = [
      lesson.id,
      lesson.metadata.title,
      lesson.metadata.description,
      lesson.metadata.source.title,
      lesson.metadata.source.creator ?? '',
      ...lesson.metadata.tags,
      ...lesson.vocabulary.flatMap((entry) => [
        entry.word,
        entry.meaning,
        entry.partOfSpeech,
      ]),
    ].join(' ')

    return normalize(searchable).includes(query)
  }

  function applyLibraryFilters(updateUrl = false): void {
    const query = normalize(search.value)
    const matchingLessons = lessons.filter((lesson) => {
      const matchesTag = !activeTag || lesson.metadata.tags.some(
        (tag) => normalize(tag) === normalize(activeTag),
      )
      return matchesTag && lessonMatchesSearch(lesson, query)
    })
    const page = paginate(matchingLessons, currentPage, STORIES_PER_PAGE)
    currentPage = page.currentPage

    storyGrid.innerHTML = page.items.map(storyCardMarkup).join('')
    visibleStoryCount.textContent = `${matchingLessons.length} ${matchingLessons.length === 1 ? 'story' : 'stories'}`
    emptyLibrary.hidden = matchingLessons.length !== 0
    pagination.hidden = matchingLessons.length === 0 || page.totalPages === 1
    pagination.innerHTML = paginationMarkup(currentPage, page.totalPages)

    if (updateUrl) syncLibraryUrl()
  }

  search.addEventListener('input', () => {
    currentPage = 1
    applyLibraryFilters(true)
  })

  tagFilters.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tag]')
    if (!button) return

    activeTag = button.dataset.tag ?? ''
    currentPage = 1
    tagFilters.querySelectorAll<HTMLButtonElement>('[data-tag]').forEach((tagButton) => {
      const selected = (tagButton.dataset.tag ?? '') === activeTag
      tagButton.classList.toggle('active', selected)
      tagButton.setAttribute('aria-pressed', String(selected))
    })

    applyLibraryFilters(true)
  })

  pagination.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-page]')
    if (!button || button.disabled) return

    const page = Number.parseInt(button.dataset.page ?? '', 10)
    if (!Number.isFinite(page) || page < 1 || page === currentPage) return

    currentPage = page
    applyLibraryFilters(true)
    document.querySelector('.story-library-heading')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })

  getElement<HTMLButtonElement>('random-story').addEventListener('click', () => {
    window.location.href = storyPath(randomLesson())
  })

  applyLibraryFilters(true)
}

function storyCardMarkup(lesson: LessonSummary): string {
  return `
    <a
      class="story-preview"
      href="${storyPath(lesson)}"
    >
      <span class="story-preview-topline">
        <span>Lesson ${escapeHtml(lesson.id)}</span>
        <span>${escapeHtml(sourceLabels[lesson.metadata.source.type])}</span>
      </span>
      <span class="story-tags" aria-label="Tags">
        ${lesson.metadata.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}
      </span>
      <span class="story-preview-body">
        <h3>${escapeHtml(lesson.metadata.title)}</h3>
        <p>${escapeHtml(lesson.metadata.description)}</p>
      </span>
      <span class="word-chips" aria-label="Vocabulary">
        ${lesson.vocabulary
          .slice(0, 4)
          .map((entry) => `<span>${escapeHtml(entry.word)}</span>`)
          .join('')}
        ${lesson.vocabulary.length > 4 ? `<span>+${lesson.vocabulary.length - 4}</span>` : ''}
      </span>
      <span class="story-preview-footer">
        <span>${lesson.vocabulary.length} vocabulary words</span>
        <strong>Read story <i aria-hidden="true">→</i></strong>
      </span>
    </a>
  `
}

function paginationMarkup(currentPage: number, totalPages: number): string {
  const items = paginationItems(currentPage, totalPages)

  return `
    <button
      class="pagination-direction"
      type="button"
      data-page="${currentPage - 1}"
      ${currentPage === 1 ? 'disabled' : ''}
    ><span aria-hidden="true">←</span> Previous</button>
    <span class="pagination-pages">
      ${items.map((item) => item === 'ellipsis'
        ? '<span class="pagination-ellipsis" aria-hidden="true">…</span>'
        : `
          <button
            type="button"
            data-page="${item}"
            aria-label="Page ${item}"
            ${item === currentPage ? 'class="active" aria-current="page"' : ''}
          >${item}</button>
        `).join('')}
    </span>
    <button
      class="pagination-direction"
      type="button"
      data-page="${currentPage + 1}"
      ${currentPage === totalPages ? 'disabled' : ''}
    >Next <span aria-hidden="true">→</span></button>
  `
}

function renderReader(lesson: Lesson): void {
  document.title = `${lesson.metadata.title} — My Stories`
  const lessonIndex = lessons.findIndex((item) => item.id === lesson.id)
  const previous = lessonIndex > 0 ? lessons[lessonIndex - 1] : undefined
  const next = lessonIndex < lessons.length - 1 ? lessons[lessonIndex + 1] : undefined

  app.innerHTML = `
    <header class="topbar reader-topbar">
      ${brandMarkup()}
      <nav class="reader-actions" aria-label="Story actions">
        <a class="library-button" href="/">All stories</a>
        <button id="open-vocabulary" class="random-button" type="button" aria-expanded="false">
          Vocabulary <span class="vocabulary-badge">${lesson.vocabulary.length}</span>
        </button>
      </nav>
    </header>

    <main class="reader-page">
      <article class="blog-article">
        <a class="back-link" href="/"><span aria-hidden="true">←</span> Back to the library</a>

        <header class="blog-header">
          <p class="eyebrow">Lesson ${escapeHtml(lesson.id)}</p>
          <h1>${escapeHtml(lesson.metadata.title)}</h1>
          <p class="lesson-description">${escapeHtml(lesson.metadata.description)}</p>
          <div class="reading-details">
            <span>${lesson.vocabulary.length} vocabulary words</span>
            <span>Click highlighted words for their meaning</span>
          </div>
          <nav class="story-tags blog-tags" aria-label="Story tags">
            ${lesson.metadata.tags.map((tag) => `
              <a href="/?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>
            `).join('')}
          </nav>
          <div class="source-card">${sourceMarkup(lesson)}</div>
        </header>

        <div class="blog-divider">
          <span></span>
          <i aria-hidden="true">✦</i>
          <span></span>
        </div>

        <div id="story" class="story-content blog-content"></div>

        <footer class="article-footer">
          <p class="eyebrow">Keep practising</p>
          <h2>Make these words part of your story.</h2>
          <button id="article-vocabulary-button" class="article-button" type="button">
            Review ${lesson.vocabulary.length} words
          </button>
        </footer>

        <nav class="story-navigation" aria-label="Previous and next stories">
          ${previous ? navigationMarkup(previous, 'Previous') : '<span></span>'}
          ${next ? navigationMarkup(next, 'Next') : '<span></span>'}
        </nav>
      </article>
    </main>

    <div id="drawer-backdrop" class="drawer-backdrop" hidden></div>
    <aside id="vocabulary-drawer" class="vocabulary-drawer" aria-hidden="true" aria-labelledby="drawer-title">
      <div class="drawer-header">
        <div>
          <p class="eyebrow">Lesson ${escapeHtml(lesson.id)}</p>
          <h2 id="drawer-title">Vocabulary</h2>
        </div>
        <button id="close-vocabulary" class="icon-button" type="button" aria-label="Close vocabulary">×</button>
      </div>
      <label class="vocabulary-search">
        <span class="search-icon" aria-hidden="true"></span>
        <span class="sr-only">Filter vocabulary</span>
        <input id="vocabulary-search" type="search" placeholder="Filter words or meanings…" />
      </label>
      <div id="vocabulary-list" class="vocabulary-list drawer-list"></div>
    </aside>

    <aside id="word-popover" class="word-popover" role="dialog" aria-label="Word definition" hidden>
      <button id="close-popover" class="popover-close" type="button" aria-label="Close definition">×</button>
      <div class="word-topline">
        <h2 id="popover-word"></h2>
        <span id="popover-part-of-speech"></span>
      </div>
      <p id="popover-meaning" class="word-meaning"></p>
      <p id="popover-example" class="word-example"></p>
      <button id="popover-open-drawer" class="popover-drawer-button" type="button">View all vocabulary →</button>
    </aside>

    <footer><p>Learn the word. Meet it in a story. Use it until it stays.</p></footer>
  `

  const story = getElement<HTMLElement>('story')
  const renderedMarkdown = marked.parse(lesson.story, { async: false }) as string
  story.innerHTML = DOMPurify.sanitize(renderedMarkdown)
  highlightVocabulary(story, lesson.vocabulary)

  story.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
    link.target = '_blank'
    link.rel = 'noreferrer'
  })

  setupVocabularyInteractions(lesson, story)
}

function navigationMarkup(lesson: LessonSummary, direction: string): string {
  return `
    <a href="${storyPath(lesson)}" class="story-navigation-link ${direction.toLowerCase()}">
      <small>${escapeHtml(direction)} story</small>
      <strong>${escapeHtml(lesson.metadata.title)}</strong>
    </a>
  `
}

function vocabularyCardMarkup(entry: VocabularyEntry): string {
  return `
    <article class="word-card">
      <div class="word-topline">
        <h3>${escapeHtml(entry.word)}</h3>
        <span>${escapeHtml(entry.partOfSpeech)}</span>
      </div>
      <p class="word-meaning">${escapeHtml(entry.meaning)}</p>
      ${entry.example ? `<p class="word-example">“${escapeHtml(entry.example)}”</p>` : ''}
    </article>
  `
}

function setupVocabularyInteractions(lesson: Lesson, story: HTMLElement): void {
  const drawer = getElement<HTMLElement>('vocabulary-drawer')
  const backdrop = getElement<HTMLElement>('drawer-backdrop')
  const list = getElement<HTMLElement>('vocabulary-list')
  const filter = getElement<HTMLInputElement>('vocabulary-search')
  const popover = getElement<HTMLElement>('word-popover')
  const openButton = getElement<HTMLButtonElement>('open-vocabulary')

  function renderVocabularyList(): void {
    const query = normalize(filter.value)
    const entries = lesson.vocabulary.filter((entry) => {
      const text = `${entry.word} ${entry.partOfSpeech} ${entry.meaning} ${entry.example ?? ''}`
      return !query || normalize(text).includes(query)
    })

    list.innerHTML = entries.length
      ? entries.map(vocabularyCardMarkup).join('')
      : `<div class="empty-state"><span>○</span><strong>No matching words</strong></div>`
  }

  function openDrawer(): void {
    closePopover()
    drawer.classList.add('open')
    drawer.setAttribute('aria-hidden', 'false')
    openButton.setAttribute('aria-expanded', 'true')
    backdrop.hidden = false
    document.body.classList.add('drawer-open')
    window.setTimeout(() => getElement<HTMLButtonElement>('close-vocabulary').focus(), 220)
  }

  function closeDrawer(): void {
    drawer.classList.remove('open')
    drawer.setAttribute('aria-hidden', 'true')
    openButton.setAttribute('aria-expanded', 'false')
    backdrop.hidden = true
    document.body.classList.remove('drawer-open')
  }

  function closePopover(): void {
    popover.hidden = true
  }

  function showPopover(mark: HTMLElement, entry: VocabularyEntry): void {
    getElement<HTMLElement>('popover-word').textContent = entry.word
    getElement<HTMLElement>('popover-part-of-speech').textContent = entry.partOfSpeech
    getElement<HTMLElement>('popover-meaning').textContent = entry.meaning

    const example = getElement<HTMLElement>('popover-example')
    example.textContent = entry.example ? `“${entry.example}”` : ''
    example.hidden = !entry.example
    popover.hidden = false

    const markBox = mark.getBoundingClientRect()
    const width = Math.min(330, window.innerWidth - 24)
    const estimatedHeight = entry.example ? 210 : 170
    const left = Math.min(
      Math.max(12, markBox.left + markBox.width / 2 - width / 2),
      window.innerWidth - width - 12,
    )
    const below = markBox.bottom + 12
    const top = below + estimatedHeight < window.innerHeight
      ? below
      : Math.max(12, markBox.top - estimatedHeight - 12)

    popover.style.width = `${width}px`
    popover.style.left = `${left}px`
    popover.style.top = `${top}px`
    getElement<HTMLButtonElement>('close-popover').focus({ preventScroll: true })
  }

  story.addEventListener('click', (event) => {
    const mark = (event.target as HTMLElement).closest<HTMLElement>('mark[data-vocabulary-index]')
    if (!mark?.dataset.vocabularyIndex) return

    const entry = lesson.vocabulary[Number(mark.dataset.vocabularyIndex)]
    if (entry) showPopover(mark, entry)
  })

  story.addEventListener('keydown', (event) => {
    const mark = (event.target as HTMLElement).closest<HTMLElement>('mark[data-vocabulary-index]')
    if (!mark || (event.key !== 'Enter' && event.key !== ' ')) return

    event.preventDefault()
    mark.click()
  })

  openButton.addEventListener('click', openDrawer)
  getElement<HTMLButtonElement>('article-vocabulary-button').addEventListener('click', openDrawer)
  getElement<HTMLButtonElement>('popover-open-drawer').addEventListener('click', openDrawer)
  getElement<HTMLButtonElement>('close-vocabulary').addEventListener('click', closeDrawer)
  getElement<HTMLButtonElement>('close-popover').addEventListener('click', closePopover)
  backdrop.addEventListener('click', closeDrawer)
  filter.addEventListener('input', renderVocabularyList)

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (!target.closest('#word-popover') && !target.closest('mark[data-vocabulary-index]')) {
      closePopover()
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    closePopover()
    closeDrawer()
  })

  renderVocabularyList()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightVocabulary(container: HTMLElement, entries: VocabularyEntry[]): void {
  const terms = entries
    .map((entry, index) => ({ word: entry.word, index }))
    .sort((a, b) => b.word.length - a.word.length)

  if (terms.length === 0) return

  const expression = new RegExp(
    `(?<![\\p{L}\\p{N}])(${terms.map(({ word }) => escapeRegExp(word)).join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  )
  const entryByWord = new Map(terms.map(({ word, index }) => [normalize(word), index]))
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const parent = node.parentElement
    if (parent && !parent.closest('a, code, pre, mark')) textNodes.push(node)
  }

  for (const node of textNodes) {
    const text = node.textContent ?? ''
    expression.lastIndex = 0
    if (!expression.test(text)) continue

    expression.lastIndex = 0
    const fragment = document.createDocumentFragment()
    let cursor = 0

    for (const match of text.matchAll(expression)) {
      const matchedWord = match[0]
      const matchIndex = match.index
      const vocabularyIndex = entryByWord.get(normalize(matchedWord))

      fragment.append(text.slice(cursor, matchIndex))
      const mark = document.createElement('mark')
      mark.textContent = matchedWord

      if (vocabularyIndex !== undefined) {
        mark.dataset.vocabularyIndex = String(vocabularyIndex)
        mark.title = entries[vocabularyIndex].meaning
        mark.tabIndex = 0
        mark.setAttribute('role', 'button')
        mark.setAttribute('aria-label', `${matchedWord}: show definition`)
      }

      fragment.append(mark)
      cursor = matchIndex + matchedWord.length
    }

    fragment.append(text.slice(cursor))
    node.replaceWith(fragment)
  }
}

const lessonId = lessonIdFromPath()

if (lessonId) {
  const lesson = await loadLesson(lessonId)
  if (lesson) renderReader(lesson)
  else renderHome()
} else {
  renderHome()
}
