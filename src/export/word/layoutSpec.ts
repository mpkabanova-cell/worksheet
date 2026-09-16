import type { WorksheetBlock } from '@/data/worksheet'
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
}

export type OrderingLayoutSpec = MatchingLayoutSpec

export type GroupingLayoutSpec = MatchingLayoutSpec

export type TaskBlockLayout = {
  questionWidthPx: number
  widgetWidthPx?: number
  contentWidthCapDxa?: number
  widgetCellMarginPx?: number
}

export function getMatchingLayoutSpec(): MatchingLayoutSpec {
  const contentWidthPx = MATCHING_CONTENT_WIDTH_PX
  const borderPaddingPx = MATCHING_BORDER_PADDING_PX
  const cellMarginPx = MATCHING_CELL_MARGIN_PX
  const captureWidthPx = contentWidthPx + borderPaddingPx * 2
  const imageWidthPx = captureWidthPx
  const cellWidthDxa = pxToDxa(captureWidthPx + cellMarginPx * 2)

  return {
    contentWidthPx,
    borderPaddingPx,
    cellMarginPx,
    captureWidthPx,
    imageWidthPx,
    cellWidthDxa,
  }
}

export function getOrderingLayoutSpec(): OrderingLayoutSpec {
  return getMatchingLayoutSpec()
}

export function getGroupingLayoutSpec(): GroupingLayoutSpec {
  return getMatchingLayoutSpec()
}

/** Question line budget in px; respects widget cap when provided. */
export function getTaskQuestionWidthPx(contentWidthCapDxa?: number): number {
  if (contentWidthCapDxa == null) return TASK_QUESTION_WIDTH_PX
  return Math.min(TASK_QUESTION_WIDTH_PX, Math.round(contentWidthCapDxa / 15))
}

export function getTaskBlockLayout(block: Pick<WorksheetBlock, 'type'>): TaskBlockLayout {
  if (block.type === 'matching') {
    const matching = getMatchingLayoutSpec()
    return {
      questionWidthPx: getTaskQuestionWidthPx(matching.cellWidthDxa),
      widgetWidthPx: matching.contentWidthPx,
      contentWidthCapDxa: matching.cellWidthDxa,
      widgetCellMarginPx: matching.cellMarginPx,
    }
  }

  if (block.type === 'ordering') {
    const ordering = getOrderingLayoutSpec()
    return {
      questionWidthPx: getTaskQuestionWidthPx(ordering.cellWidthDxa),
      widgetWidthPx: ordering.contentWidthPx,
      contentWidthCapDxa: ordering.cellWidthDxa,
      widgetCellMarginPx: ordering.cellMarginPx,
    }
  }

  if (block.type === 'grouping') {
    const grouping = getGroupingLayoutSpec()
    return {
      questionWidthPx: getTaskQuestionWidthPx(grouping.cellWidthDxa),
      widgetWidthPx: grouping.contentWidthPx,
      contentWidthCapDxa: grouping.cellWidthDxa,
      widgetCellMarginPx: grouping.cellMarginPx,
    }
  }

  if (block.type === 'single_choice' || block.type === 'multiple_choice') {
    return {
      questionWidthPx: TASK_QUESTION_WIDTH_PX,
      widgetWidthPx: SLOT_CONTENT_WIDTH_PX,
    }
  }

  return { questionWidthPx: TASK_QUESTION_WIDTH_PX }
}
