/** Typography and spacing mirrored from Worksheet.css (px → docx units). */

/** Serif body font for DOCX export (harmonized with KaTeX); strong Cyrillic coverage. */
export const FONT = 'STIX Two Text'
/** Word fallback when STIX Two Text is not installed locally. */
export const FONT_FALLBACK = 'Times New Roman'

/** CSS font stack for off-screen export rasterization only. */
export const FONT_CSS = `'${FONT}', '${FONT_FALLBACK}', serif`

/** Portal sheet content width: 800px − 2×32px header padding. */
export const SHEET_CONTENT_WIDTH_PX = 736

/** A4 content width with portal-like margins (~29px each side). */
export const PAGE_MARGIN_TWIPS = 432

/** px → half-points (docx TextRun.size). */
export function pxToHalfPoints(px: number): number {
  return Math.round(px * 1.5)
}

/** px → twips (docx spacing/margins). */
export function pxToTwips(px: number): number {
  return Math.round(px * 15)
}

/** px → DXA (table cell width). */
export function pxToDxa(px: number): number {
  return Math.round(px * 15)
}

export function runFont(name: string = FONT) {
  return { ascii: name, hAnsi: name, cs: name, eastAsia: name }
}

export const COLORS = {
  textDefault: '161A33',
  textSecondary: '656C94',
  textTertiary: '9399BD',
  textPositive: '0DB56C',
  borderSecondary: 'E4E6F7',
  gridLine: 'C8CCE0',
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
  gapsText: { sizePx: 14, linePx: 20, weight: 400 },
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
  diffLabelWidth: 80,
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

/** Useful width inside a task slot (sheet content minus left/right slot padding). */
export const SLOT_CONTENT_WIDTH_PX =
  SHEET_CONTENT_WIDTH_PX - LAYOUT.slotPaddingLeft - LAYOUT.slotPaddingRight

/** Matching widget export width — slightly narrower than slot to avoid table edge clipping. */
export const MATCHING_EXPORT_WIDTH_PX = SLOT_CONTENT_WIDTH_PX - 16

/** Grid columns for answer cells matching portal AnswerCellsGrid logic. */
export function answerCellsColumnCount(contentWidthPx = SHEET_CONTENT_WIDTH_PX): number {
  const slotWidth = contentWidthPx - LAYOUT.slotPaddingLeft
  return Math.max(1, Math.floor((slotWidth - 1) / LAYOUT.answerCellSize))
}
