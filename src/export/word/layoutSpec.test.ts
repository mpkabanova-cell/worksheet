import { describe, expect, it } from 'vitest'
import {
  getMatchingLayoutSpec,
  getTaskBlockLayout,
  getTaskQuestionWidthPx,
  MATCHING_BORDER_PADDING_PX,
  MATCHING_CELL_MARGIN_PX,
  MATCHING_CONTENT_WIDTH_PX,
  TASK_QUESTION_WIDTH_PX,
} from '@/export/word/layoutSpec'

describe('layoutSpec', () => {
  it('computes matching capture and cell widths from one geometry', () => {
    const spec = getMatchingLayoutSpec()

    expect(spec.contentWidthPx).toBe(MATCHING_CONTENT_WIDTH_PX)
    expect(spec.captureWidthPx).toBe(MATCHING_CONTENT_WIDTH_PX + MATCHING_BORDER_PADDING_PX * 2)
    expect(spec.imageWidthPx).toBe(spec.captureWidthPx)
    expect(spec.cellWidthDxa).toBe((spec.captureWidthPx + MATCHING_CELL_MARGIN_PX * 2) * 15)
  })

  it('caps question width for matching blocks', () => {
    const layout = getTaskBlockLayout({ type: 'matching' })

    expect(layout.contentWidthCapDxa).toBe(getMatchingLayoutSpec().cellWidthDxa)
    expect(layout.widgetCellMarginPx).toBe(MATCHING_CELL_MARGIN_PX)
    expect(layout.questionWidthPx).toBeLessThanOrEqual(TASK_QUESTION_WIDTH_PX)
  })

  it('uses full question width when no cap is provided', () => {
    expect(getTaskQuestionWidthPx()).toBe(TASK_QUESTION_WIDTH_PX)
  })
})
