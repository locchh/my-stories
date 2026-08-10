import type { Lesson, LessonMetadata, LessonSummary, VocabularyEntry } from './types'

const metadataModules = import.meta.glob('../data/*/metadata.json', {
  eager: true,
  import: 'default',
}) as Record<string, LessonMetadata>

const storyModules = import.meta.glob('../data/*/story.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

const vocabularyModules = import.meta.glob('../data/*/vocabulary.json', {
  eager: true,
  import: 'default',
}) as Record<string, VocabularyEntry[]>

function lessonIdFromPath(path: string): string {
  const match = path.match(/\/data\/([^/]+)\//)

  if (!match) {
    throw new Error(`Cannot determine lesson id from ${path}`)
  }

  return match[1]
}

function fileForLesson<T>(modules: Record<string, T>, id: string): T | undefined {
  const entry = Object.entries(modules).find(([path]) => lessonIdFromPath(path) === id)
  return entry?.[1]
}

function validateLessonSummary(lesson: LessonSummary): void {
  if (!lesson.metadata.title || !lesson.metadata.description) {
    throw new Error(`Lesson ${lesson.id} needs a title and description in metadata.json`)
  }

  if (!lesson.metadata.source?.type || !lesson.metadata.source.title) {
    throw new Error(`Lesson ${lesson.id} needs a valid source in metadata.json`)
  }

  if (
    !Array.isArray(lesson.metadata.tags) ||
    lesson.metadata.tags.length === 0 ||
    lesson.metadata.tags.some((tag) => typeof tag !== 'string' || !tag.trim())
  ) {
    throw new Error(`Lesson ${lesson.id} needs at least one valid tag in metadata.json`)
  }

  const uniqueTags = new Set(lesson.metadata.tags.map((tag) => tag.trim().toLocaleLowerCase()))
  if (uniqueTags.size !== lesson.metadata.tags.length) {
    throw new Error(`Lesson ${lesson.id} contains duplicate tags in metadata.json`)
  }

  for (const [index, entry] of lesson.vocabulary.entries()) {
    if (!entry.word || !entry.partOfSpeech || !entry.meaning) {
      throw new Error(`Lesson ${lesson.id} has an invalid vocabulary entry at index ${index}`)
    }
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export const lessons: LessonSummary[] = Object.entries(metadataModules)
  .map(([path, metadata]) => {
    const id = lessonIdFromPath(path)
    const vocabulary = fileForLesson(vocabularyModules, id)
    const storyLoader = fileForLesson(storyModules, id)

    if (storyLoader === undefined || vocabulary === undefined) {
      throw new Error(
        `Lesson ${id} must contain metadata.json, story.md, and vocabulary.json`,
      )
    }

    const lesson = { id, metadata, vocabulary }
    validateLessonSummary(lesson)
    return lesson
  })
  .sort((a, b) => collator.compare(a.id, b.id))

if (lessons.length === 0) {
  throw new Error('No lessons found in data/')
}

export async function loadLesson(id: string): Promise<Lesson | undefined> {
  const summary = lessons.find((lesson) => lesson.id === id)
  const storyLoader = fileForLesson(storyModules, id)

  if (!summary || !storyLoader) return undefined

  const story = await storyLoader()
  if (!story.trim()) throw new Error(`Lesson ${id} has an empty story.md`)

  return { ...summary, story }
}
