import { sheetTopicLabel } from '@/data/worksheet'
import {
  COLORS,
  FONT_CSS,
  SHEET_CONTENT_WIDTH_PX,
  TYPO,
  resolveTextColorCss,
} from '@/export/word/layoutTokens'
import { captureDomToPng } from '@/export/word/rasterize/domToPng'
import { appendMathText, ensureKatexStyles } from '@/export/word/rasterize/renderMathHtml'
import type { DomImageResult, ExportContext } from '@/export/word/types'

function createBlock(widthPx: number): HTMLDivElement {
  const root = document.createElement('div')
  root.style.width = `${widthPx}px`
  root.style.boxSizing = 'border-box'
  root.style.fontFamily = FONT_CSS
  root.style.background = '#ffffff'
  root.style.color = `#${COLORS.textDefault}`
  return root
}

export async function rasterizeExportHeader(ctx: ExportContext): Promise<DomImageResult | null> {
  const { draft } = ctx
  const minimal = draft.createdManually === true
  const title = sheetTopicLabel(draft)
  const root = createBlock(SHEET_CONTENT_WIDTH_PX)
  ensureKatexStyles(root)

  if (!minimal) {
    const student = document.createElement('div')
    student.style.display = 'flex'
    student.style.alignItems = 'flex-end'
    student.style.gap = '8px'
    student.style.width = '100%'
    student.style.minHeight = '20px'
    student.style.fontSize = `${TYPO.studentLine.sizePx}px`
    student.style.lineHeight = `${TYPO.studentLine.linePx}px`
    student.style.color = `#${COLORS.textSecondary}`
    student.style.marginBottom = '24px'
    student.appendChild(document.createTextNode('Ученик:'))
    const line = document.createElement('i')
    line.style.flex = '1'
    line.style.height = '1px'
    line.style.marginBottom = '5px'
    line.style.background = `#${COLORS.borderSecondary}`
    line.style.border = 'none'
    line.style.fontStyle = 'normal'
    student.appendChild(line)
    root.appendChild(student)
  }

  const titleEl = document.createElement('div')
  titleEl.style.fontSize = `${TYPO.sheetTitle.sizePx}px`
  titleEl.style.lineHeight = `${TYPO.sheetTitle.linePx}px`
  titleEl.style.fontWeight = '500'
  titleEl.style.marginBottom = minimal ? '8px' : '24px'
  titleEl.textContent = title
  root.appendChild(titleEl)

  if (!minimal && draft.intro.trim()) {
    const intro = document.createElement('div')
    intro.style.fontSize = `${TYPO.sheetIntro.sizePx}px`
    intro.style.lineHeight = `${TYPO.sheetIntro.linePx}px`
    intro.style.color = resolveTextColorCss({ ...TYPO.sheetIntro, secondary: true })
    intro.style.marginBottom = '8px'
    appendMathText(intro, draft.intro, {
      fontSize: TYPO.sheetIntro.sizePx,
      lineHeight: TYPO.sheetIntro.linePx,
      color: resolveTextColorCss({ ...TYPO.sheetIntro, secondary: true }),
    })
    root.appendChild(intro)
  }

  const spacer = document.createElement('div')
  spacer.style.height = '8px'
  root.appendChild(spacer)

  return captureDomToPng(root, `pdf-header-${draft.id}`, ctx, undefined, { fitContent: false })
}

export async function rasterizeRichTextBlock(
  text: string,
  ctx: ExportContext,
  cacheKey: string,
  style: { sizePx: number; linePx: number; secondary?: boolean },
): Promise<DomImageResult | null> {
  if (!text.trim()) return null
  const root = createBlock(SHEET_CONTENT_WIDTH_PX)
  ensureKatexStyles(root)
  const body = document.createElement('div')
  body.style.fontSize = `${style.sizePx}px`
  body.style.lineHeight = `${style.linePx}px`
  body.style.color = resolveTextColorCss({ secondary: style.secondary })
  appendMathText(body, text, {
    fontSize: style.sizePx,
    lineHeight: style.linePx,
    color: resolveTextColorCss({ secondary: style.secondary }),
  })
  root.appendChild(body)
  return captureDomToPng(root, cacheKey, ctx, undefined, { fitContent: false })
}
