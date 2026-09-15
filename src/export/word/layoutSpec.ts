import { LAYOUT, SHEET_CONTENT_WIDTH_PX, SLOT_CONTENT_WIDTH_PX, pxToDxa } from '@/export/word/layoutTokens'

/** Task number column width (px). */
export const TASK_NUM_WIDTH_PX = LAYOUT.taskNumWidth

/** Default question/content width beside the task number. */
export const TASK_QUESTION_WIDTH_PX = SHEET_CONTENT_WIDTH_PX - TASK_NUM_WIDTH_PX

/** Matching widget: full slot width, no ad-hoc −16px fudge. */
export const MATCHING_CONTENT_WIDTH_PX = SLOT_CONTENT_WIDTH_PX

/** Inner padding so 1px borders + border-radius are not clipped at capture edge. */
export const MATCHING_BORDER_PADDING_PX = 4

/** Word table cell margin around matching PNG. */
export const MATCHING_CELL_MARGIN_PX = 8

export type MatchingLayoutSpec = {
  contentWidthPx: number
  borderPaddingPx: number
  cellMarginPx: number
  captureWidthPx: number
  imageWidthPx: number
  cellWidthDxa: number
  cellWidthCapDxa: number
}

export function getMatchingLayoutSpec(): MatchingLayoutSpec {
  const contentWidthPx = MATCHING_CONTENT_WIDTH_PX
  const borderPaddingPx = MATCHING_BORDER_PADDING_PX
  const cellMarginPx = MATCHING_CELL_MARGIN_PX
  const captureWidthPx = contentWidthPx + borderPaddingPx * 2
  const imageWidthPx = captureWidthPx
  const cellWidthDxa = pxToDxa(captureWidthPx + cellMarginPx * 2)
  const cellWidthCapDxa = pxToDxa(TASK_QUESTION_WIDTH_PX)

  return {
    contentWidthPx,
    borderPaddingPx,
    cellMarginPx,
    captureWidthPx,
    imageWidthPx,
    cellWidthDxa,
    cellWidthCapDxa,
  }
}

/** Question line budget in px; respects widget cap when provided. */
export function getTaskQuestionWidthPx(contentWidthCapDxa?: number): number {
  if (contentWidthCapDxa == null) return TASK_QUESTION_WIDTH_PX
  return Math.min(TASK_QUESTION_WIDTH_PX, Math.round(contentWidthCapDxa / 15))
}
