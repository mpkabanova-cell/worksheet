import type { WorksheetDraft } from '@/data/worksheet'

export interface ExportOptions {
  showAnswers: boolean
  showDifficulty: boolean
  answersSeparate: boolean
  orientation: 'portrait' | 'landscape'
}

export interface MathImageResult {
  data: Uint8Array
  width: number
  height: number
  baselineOffsetPx?: number
}

export interface DomImageResult {
  data: Uint8Array
  width: number
  height: number
}

export interface ExportContext {
  draft: WorksheetDraft
  options: ExportOptions
  subject: string
  mathCache: Map<string, MathImageResult>
  imageCache: Map<string, Uint8Array | null>
  domImageCache: Map<string, DomImageResult>
}

export interface TextStyleSpec {
  sizePx: number
  linePx: number
  color?: string
  bold?: boolean
  secondary?: boolean
}
