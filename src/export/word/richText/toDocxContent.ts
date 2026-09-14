import {
  ImageRun,
  Paragraph,
  TextRun,
  type IParagraphOptions,
  type IRunOptions,
} from 'docx'
import {
  COLORS,
  FONT,
  FONT_FALLBACK,
  lineSpacingPx,
  pxToHalfPoints,
  pxToTwips,
} from '@/export/word/layoutTokens'
import { parseContent, type ContentSegment } from '@/export/word/richText/parseRichText'
import { renderMathToPng } from '@/export/word/richText/mathToImage'
import type { ExportContext, TextStyleSpec } from '@/export/word/types'

function resolveColor(style: TextStyleSpec): string {
  if (style.color) return style.color
  if (style.secondary) return COLORS.textSecondary
  return COLORS.textDefault
}

function baseRunOptions(style: TextStyleSpec): IRunOptions {
  return {
    font: { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT },
    size: pxToHalfPoints(style.sizePx),
    bold: style.bold,
    color: resolveColor(style),
  }
}

export async function segmentsToRuns(
  segments: ContentSegment[],
  style: TextStyleSpec,
  ctx: ExportContext,
): Promise<(TextRun | ImageRun)[]> {
  const runs: (TextRun | ImageRun)[] = []

  for (const segment of segments) {
    if (segment.kind === 'break') {
      runs.push(new TextRun({ break: 1, ...baseRunOptions(style) }))
      continue
    }

    if (segment.kind === 'math') {
      const img = await renderMathToPng(segment.value, segment.display, style.sizePx, ctx)
      runs.push(
        new ImageRun({
          type: 'png',
          data: img.data,
          transformation: {
            width: img.width,
            height: img.height,
          },
        }),
      )
      continue
    }

    if (!segment.value) continue

    runs.push(
      new TextRun({
        ...baseRunOptions(style),
        text: segment.value,
        bold: style.bold || segment.bold,
        italics: segment.italic,
        strike: segment.strike,
        underline: segment.underline ? {} : undefined,
        font: segment.code
          ? { ascii: 'Courier New', hAnsi: 'Courier New' }
          : { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT, hint: FONT_FALLBACK },
      }),
    )
  }

  return runs
}

export async function richParagraph(
  text: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  options: IParagraphOptions = {},
): Promise<Paragraph> {
  const segments = parseContent(text)
  const runs = await segmentsToRuns(segments, style, ctx)
  return new Paragraph({
    ...options,
    spacing: {
      after: pxToTwips(4),
      line: lineSpacingPx(style.linePx, style.sizePx),
      lineRule: 'atLeast',
      ...options.spacing,
    },
    children: runs.length > 0 ? runs : [new TextRun({ text: '', ...baseRunOptions(style) })],
  })
}

export async function richParagraphs(
  text: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  options: IParagraphOptions = {},
): Promise<Paragraph[]> {
  const segments = parseContent(text)
  const paragraphs: Paragraph[] = []
  let inline: ContentSegment[] = []

  async function flushInline(): Promise<void> {
    if (inline.length === 0) return
    const runs = await segmentsToRuns(inline, style, ctx)
    paragraphs.push(
      new Paragraph({
        ...options,
        spacing: {
          after: pxToTwips(4),
          line: lineSpacingPx(style.linePx, style.sizePx),
          lineRule: 'atLeast',
          ...options.spacing,
        },
        children: runs,
      }),
    )
    inline = []
  }

  for (const segment of segments) {
    if (segment.kind === 'math' && segment.display) {
      await flushInline()
      const runs = await segmentsToRuns([segment], style, ctx)
      paragraphs.push(
        new Paragraph({
          ...options,
          alignment: 'center',
          spacing: {
            before: pxToTwips(6),
            after: pxToTwips(6),
            line: lineSpacingPx(style.linePx, style.sizePx),
            lineRule: 'atLeast',
          },
          children: runs,
        }),
      )
      continue
    }
    inline.push(segment)
  }

  await flushInline()
  return paragraphs.length > 0
    ? paragraphs
    : [await richParagraph('', style, ctx, options)]
}

export function plainParagraph(
  text: string,
  style: TextStyleSpec,
  options: IParagraphOptions = {},
): Paragraph {
  return new Paragraph({
    ...options,
    spacing: {
      after: pxToTwips(4),
      line: lineSpacingPx(style.linePx, style.sizePx),
      lineRule: 'atLeast',
      ...options.spacing,
    },
    children: [
      new TextRun({
        ...baseRunOptions(style),
        text,
      }),
    ],
  })
}

export function spacerParagraph(heightPx: number): Paragraph {
  return new Paragraph({
    spacing: { after: pxToTwips(heightPx) },
    children: [new TextRun({ text: '' })],
  })
}

export function starsText(value: number): string {
  return `${'★'.repeat(Math.min(3, Math.max(0, value)))}${'☆'.repeat(Math.max(0, 3 - value))}`
}
