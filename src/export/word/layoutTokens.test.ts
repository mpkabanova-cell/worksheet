import { describe, expect, it } from 'vitest'
import {
  LAYOUT,
  SHEET_CONTENT_WIDTH_PX,
  SLOT_CONTENT_WIDTH_PX,
  answerCellsColumnCount,
  answerCellsGridSizePx,
  answerCellsTopSpacingPx,
  slotBodyTopSpacingPx,
} from '@/export/word/layoutTokens'

describe('answerCellsColumnCount', () => {
  it('matches portal slot inner width (sheet minus left and right slot padding)', () => {
    expect(SLOT_CONTENT_WIDTH_PX).toBe(
      SHEET_CONTENT_WIDTH_PX - LAYOUT.slotPaddingLeft - LAYOUT.slotPaddingRight,
    )
  })

  it('fits the grid inside the export answer slot without clipping', () => {
    const cols = answerCellsColumnCount()
    const gridWidth = answerCellsGridSizePx(cols)

    expect(gridWidth).toBeLessThanOrEqual(SLOT_CONTENT_WIDTH_PX)
    expect(cols).toBe(42)
    expect(gridWidth).toBe(673)
  })
})

describe('slot spacing tokens', () => {
  it('matches portal vertical rhythm', () => {
    expect(slotBodyTopSpacingPx()).toBe(LAYOUT.taskGap + LAYOUT.slotPaddingTop)
    expect(slotBodyTopSpacingPx()).toBe(20)
    expect(answerCellsTopSpacingPx()).toBe(28)
    expect(LAYOUT.gapsTextToBankGapPx).toBe(16)
    expect(LAYOUT.gapsBankBottomPx).toBe(16)
  })
})
