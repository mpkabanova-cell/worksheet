/** Typography and spacing mirrored from Worksheet.css (px → docx units). */

/** Body font for DOCX export. */
export const FONT = 'Arial'
/** Fallback for off-screen rasterization when Arial is unavailable. */
export const FONT_FALLBACK = 'Helvetica'

/** Native Word math font for OMML (built-up fractions, scripts). */
export const FONT_MATH = 'Cambria Math'
/** Fallback for math rasterization when Cambria Math is unavailable. */
export const FONT_MATH_FALLBACK = 'Latin Modern Math'

/** CSS font stack for off-screen export rasterization only. */
export const FONT_CSS = `'${FONT}', '${FONT_FALLBACK}', sans-serif`
/** CSS font stack for math PNG fallback rasterization. */
export const FONT_MATH_CSS = `'${FONT_MATH}', '${FONT_MATH_FALLBACK}', serif`

/** Sup/sub script size relative to base math (matches Word defaults). */
export const MATH_SCRIPT_SCALE = 0.65

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

export function runMathFont(name: string = FONT_MATH) {
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

/** Docx text/math color from style (hex without #). */
export function resolveTextColor(style: { color?: string; secondary?: boolean }): string {
  if (style.color) return style.color.replace(/^#/, '')
  if (style.secondary) return COLORS.textSecondary
  return COLORS.textDefault
}

/** CSS color for off-screen math rasterization. */
export function resolveTextColorCss(style: { color?: string; secondary?: boolean }): string {
  return `#${resolveTextColor(style)}`
}

export const TYPO = {
  sheetTitle: { sizePx: 20, linePx: 26, weight: 500 },
  sheetIntro: { sizePx: 14, linePx: 20, weight: 400 },
  studentLine: { sizePx: 14, linePx: 20, weight: 400 },
  taskNum: { sizePx: 18, linePx: 24, weight: 500 },
  taskQuestion: { sizePx: 18, linePx: 24, weight: 500 },
  answerTaskNum: { sizePx: 18, linePx: 24, weight: 500 },
  answerTaskQuestion: { sizePx: 18, linePx: 24, weight: 500 },
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
  /** .ws-task.answer-task .ws-task-main { gap: 4px } — question → difficulty */
  answerTaskMainGap: 4,
  /** .ws-task { gap: 12px } + .ws-task-slot { padding-top: 8px } */
  slotBodyTopPx: 20,
  /** .answer-cells-slot { padding-top: 8px } on top of slot padding */
  answerCellsSlotPaddingTopPx: 8,
  /** .gaps-student { gap: 16px } */
  gapsTextToBankGapPx: 16,
  /** .gaps-words-bank { padding-bottom: 16px } */
  gapsBankBottomPx: 16,
  /** .option--text { gap: 6px } between marker and text */
  choiceMarkerTextGapPx: 6,
  slotPaddingTop: 8,
  slotPaddingRight: 24,
  slotPaddingLeft: 32,
  slotGap: 8,
  taskNumWidth: 32,
  diffLabelWidth: 80,
  /** .stars img — Figma / Worksheet.css */
  diffStarSizePx: 16,
  /** .stars { gap: 4px } and .ws-task-meta { gap: 4px } */
  diffStarGapPx: 4,
  answerLineHeight: 28,
  answerLineGap: 4,
  choiceMarkerSize: 16,
  answerCellSize: 16,
  qrSize: 160,
  pageFooterBottom: 16,
} as const

/** Head → slot body top inset (lines, block, gaps, choices). */
export function slotBodyTopSpacingPx(): number {
  return LAYOUT.slotBodyTopPx
}

/** Head → cells answer label (adds .answer-cells-slot padding). */
export function answerCellsTopSpacingPx(): number {
  return LAYOUT.slotBodyTopPx + LAYOUT.answerCellsSlotPaddingTopPx
}

export function lineSpacingPx(linePx: number, sizePx: number): number {
  return pxToTwips(linePx - sizePx)
}

/** Useful width inside a task slot (sheet content minus left/right slot padding). */
export const SLOT_CONTENT_WIDTH_PX =
  SHEET_CONTENT_WIDTH_PX - LAYOUT.slotPaddingLeft - LAYOUT.slotPaddingRight

/** Grid pixel width for N columns (+1px so right/bottom outer lines are not clipped). */
export function answerCellsGridSizePx(cols: number): number {
  return cols * LAYOUT.answerCellSize + 1
}

/** Grid columns for answer cells — matches portal AnswerCellsGrid (wrap clientWidth). */
export function answerCellsColumnCount(slotContentWidthPx = SLOT_CONTENT_WIDTH_PX): number {
  return Math.max(1, Math.floor((slotContentWidthPx - 1) / LAYOUT.answerCellSize))
}
