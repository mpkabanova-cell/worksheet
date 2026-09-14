/** Typography and spacing mirrored from Worksheet.css (px → docx units). */

export const FONT = 'Onest'
export const FONT_FALLBACK = 'Calibri'

/** px → half-points (docx TextRun.size). */
export function pxToHalfPoints(px: number): number {
  return Math.round(px * 1.5)
}

/** px → twips (docx spacing/margins). */
export function pxToTwips(px: number): number {
  return Math.round(px * 15)
}

/** px → EMU (docx ImageRun dimensions). */
export function pxToEmu(px: number): number {
  return Math.round(px * 9525)
}

/** px → DXA (table cell width). */
export function pxToDxa(px: number): number {
  return Math.round(px * 15)
}

export const COLORS = {
  textDefault: '161A33',
  textSecondary: '656C94',
  textTertiary: '9399BD',
  textPositive: '0DB56C',
  borderSecondary: 'E4E6F7',
  borderPositive: '0DB56C',
  bgTertiary: 'E4E6F7',
  bgPositiveSoft: 'E8F8F0',
  bgBrandSoft: 'ECE8FF',
  white: 'FFFFFF',
} as const

export const TYPO = {
  sheetTitle: { sizePx: 20, linePx: 26, weight: 500 },
  sheetIntro: { sizePx: 14, linePx: 20, weight: 400 },
  studentLine: { sizePx: 14, linePx: 20, weight: 400 },
  taskNum: { sizePx: 18, linePx: 24, weight: 500 },
  taskQuestion: { sizePx: 18, linePx: 24, weight: 500 },
  answerTaskNum: { sizePx: 16, linePx: 24, weight: 500 },
  answerTaskQuestion: { sizePx: 16, linePx: 24, weight: 500 },
  plainBody: { sizePx: 14, linePx: 20, weight: 400 },
  option: { sizePx: 14, linePx: 20, weight: 400 },
  answerLabel: { sizePx: 14, linePx: 20, weight: 400 },
  answerValue: { sizePx: 14, linePx: 28, weight: 400 },
  difficulty: { sizePx: 12, linePx: 16, weight: 400 },
  gapsBank: { sizePx: 14, linePx: 20, weight: 400 },
  mediaTitle: { sizePx: 16, linePx: 24, weight: 500 },
} as const

export const LAYOUT = {
  sheetPaddingX: 32,
  sheetPaddingTop: 24,
  sheetContentPaddingX: 16,
  sheetContentPaddingBottom: 32,
  taskPaddingY: 12,
  taskPaddingX: 8,
  taskGap: 12,
  taskMainGap: 8,
  answerTaskMainGap: 4,
  slotPaddingTop: 8,
  slotPaddingRight: 24,
  slotPaddingLeft: 32,
  slotGap: 8,
  taskNumWidth: 32,
  answerLineHeight: 28,
  answerLineGap: 4,
  choiceMarkerSize: 16,
  answerCellSize: 16,
  qrSize: 160,
  pageFooterBottom: 16,
} as const

export function lineSpacingPx(linePx: number, sizePx: number): number {
  return pxToTwips(linePx - sizePx)
}
