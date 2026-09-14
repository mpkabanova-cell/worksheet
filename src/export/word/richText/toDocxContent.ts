import {
  ImageRun,
  Paragraph,
  TextRun,
  type IParagraphOptions,
  type IRunOptions,
} from 'docx'
import {
  COLORS,
  lineSpacingPx,
  pxToHalfPoints,
  pxToTwips,
  runFont,
} from '@/export/word/layoutTokens'
import { parseContent, type ContentSegment } from '@/export/word/richText/parseRichText'
import { renderMathToPng } from '@/export/word/richText/mathToImage'
import type { ExportContext, MathImageResult, TextStyleSpec } from '@/export/word/types'

function resolveColor(style: TextStyleSpec): string {
  if (style.color) return style.color
  if (style.secondary) return COLORS.textSecondary
  return COLORS.textDefault
}

function baseRunOptions(style: TextStyleSpec): IRunOptions {
  return {
    font: runFont(),
    size: pxToHalfPoints(style.sizePx),
    bold: style.bold,
    color: resolveColor(style),
  }
}

function inlineMathImageRun(img: MathImageResult): ImageRun {
  return new ImageRun({
    type: 'png',
    data: img.data,
    transformation: {
      width: img.width,
      height: img.height,
    },
  })
}

export interface SegmentsToRunsResult {
  runs: (TextRun | ImageRun)[]
  maxInlineMathHeight: number
}

export async function segmentsToRuns(
  segments: ContentSegment[],
  style: TextStyleSpec,
  ctx: ExportContext,
): Promise<SegmentsToRunsResult> {
  const runs: (TextRun | ImageRun)[] = []
  let maxInlineMathHeight = 0

  for (const segment of segments) {
    if (segment.kind === 'break') {
      runs.push(new TextRun({ break: 1, ...baseRunOptions(style) }))
      continue
    }

    if (segment.kind === 'math') {
      const tex = segment.value.trim()
      if (!tex || /^[=,\.;:\-]+$/.test(tex)) {
        if (segment.value) {
          runs.push(new TextRun({ ...baseRunOptions(style), text: segment.value }))
        }
        continue
      }
      const img = await renderMathToPng(segment.value, segment.display, style.sizePx, ctx)
      if (!segment.display) {
        maxInlineMathHeight = Math.max(maxInlineMathHeight, img.height)
      }
      runs.push(inlineMathImageRun(img))
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
          : runFont(),
      }),
    )
  }

  return { runs, maxInlineMathHeight }
}

/** Keep gap underscore runs as literal `_` characters (matches portal, avoids Word underline artifacts). */
export function parseGapsContent(input: string): ContentSegment[] {
  const segments = parseContent(input)
  const result: ContentSegment[] = []

  for (const segment of segments) {
    if (segment.kind !== 'text') {
      result.push(segment)
      continue
    }

    const parts = segment.value.split(/(_{3,})/g)
    for (const part of parts) {
      if (!part) continue
      if (/^_{3,}$/.test(part)) {
        result.push({
          kind: 'text',
          value: part,
        })
      } else {
        result.push({ ...segment, value: part })
      }
    }
  }

  return result
}

export async function richParagraph(
  text: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  options: IParagraphOptions = {},
): Promise<Paragraph> {
  const segments = parseContent(text)
  const { runs } = await segmentsToRuns(segments, style, ctx)
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
  segmentParser: (input: string) => ContentSegment[] = parseContent,
): Promise<Paragraph[]> {
  const segments = segmentParser(text)
  const paragraphs: Paragraph[] = []
  let inline: ContentSegment[] = []

  async function flushInline(): Promise<void> {
    if (inline.length === 0) return
    const { runs, maxInlineMathHeight } = await segmentsToRuns(inline, style, ctx)
    const linePx = Math.max(style.linePx, maxInlineMathHeight)
    paragraphs.push(
      new Paragraph({
        ...options,
        spacing: {
          after: pxToTwips(4),
          line: lineSpacingPx(linePx, style.sizePx),
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
      const { runs } = await segmentsToRuns([segment], style, ctx)
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

export async function imageRunFromPng(
  data: Uint8Array,
  sizePx: number,
): Promise<ImageRun> {
  return imageRunFromPngSized(data, sizePx, sizePx)
}

export function imageRunFromPngSized(
  data: Uint8Array,
  widthPx: number,
  heightPx: number,
): ImageRun {
  return new ImageRun({
    type: 'png',
    data,
    transformation: {
      width: Math.max(1, Math.round(widthPx)),
      height: Math.max(1, Math.round(heightPx)),
    },
  })
}
