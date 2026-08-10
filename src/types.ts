export type SourceType =
  | 'youtube'
  | 'book'
  | 'article'
  | 'podcast'
  | 'course'
  | 'other'

export interface LessonSource {
  type: SourceType
  title: string
  creator?: string
  url?: string
  reference?: string
}

export interface LessonMetadata {
  title: string
  description: string
  tags: string[]
  source: LessonSource
}

export interface VocabularyEntry {
  word: string
  partOfSpeech: string
  meaning: string
  example?: string
}

export interface Lesson {
  id: string
  metadata: LessonMetadata
  story: string
  vocabulary: VocabularyEntry[]
}
