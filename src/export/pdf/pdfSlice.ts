import type { DomImageResult } from '@/export/word/types'

export type PdfSlice =
  | { kind: 'pageBreak' }
  | { kind: 'image'; image: DomImageResult; gapAfterPx?: number }
