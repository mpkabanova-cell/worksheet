import {
  ImageRun,
  Paragraph,
  SpaceType,
  TextRun,
  type IParagraphOptions,
  type IRunOptions,
  type ParagraphChild,
} from 'docx'
import {
  COLORS,
  lineSpacingPx,
  pxToHalfPoints,
  pxToTwips,
  runFont,
} from '@/export/word/layoutTokens'
import { parseContent, type ContentSegment } from '@/export/word/richText/parseRichText'
import { normalizeExportText } from '@/export/word/richText/normalizeExportText'
import { mathSegmentToParagraphChild } from '@/export/word/richText/latexToWordMath'
import type { ExportContext, TextStyleSpec } from '@/export/word/types'

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

export interface SegmentsToParagraphChildrenResult {
  children: ParagraphChild[]
}

export async function segmentsToParagraphChildren(
  segments: ContentSegment[],
  style: TextStyleSpec,
  ctx: ExportContext,
): Promise<SegmentsToParagraphChildrenResult> {
  const children: ParagraphChild[] = []

  for (const segment of segments) {
    if (segment.kind === 'break') {
      children.push(new TextRun({ break: 1, ...baseRunOptions(style) }))
      continue
    }

    if (segment.kind === 'math') {
      const tex = segment.value.trim()
      if (!tex || /^[=,\.;:\-]+$/.test(tex)) {
        if (segment.value) {
          children.push(new TextRun({ ...baseRunOptions(style), text: segment.value }))
        }
        continue
      }
      children.push(await mathSegmentToParagraphChild(segment.value, segment.display, style, ctx))
      continue
    }

    if (!segment.value) continue

    const preserveSpace = /^\s/.test(segment.value) || /\s$/.test(segment.value)
    children.push(
      new TextRun({
        ...baseRunOptions(style),
        text: normalizeExportText(segment.value),
        ...(preserveSpace ? { space: SpaceType.PRESERVE } : {}),
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

  return { children }
}

/** @deprecated Use segmentsToParagraphChildren */
export async function segmentsToRuns(
  segments: ContentSegment[],
  style: TextStyleSpec,
  ctx: ExportContext,
): Promise<{ runs: ParagraphChild[]; maxInlineMathHeight: number }> {
  const { children } = await segmentsToParagraphChildren(segments, style, ctx)
  return { runs: children, maxInlineMathHeight: 0 }
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
  const { children } = await segmentsToParagraphChildren(segments, style, ctx)
  return new Paragraph({
    ...options,
    spacing: {
      after: pxToTwips(4),
      line: lineSpacingPx(style.linePx, style.sizePx),
      lineRule: 'atLeast',
      ...options.spacing,
    },
    children: children.length > 0 ? children : [new TextRun({ text: '', ...baseRunOptions(style) })],
  })
}

export async function richParagraphs(
  text: string,
  style: TextStyleSpec,
  ctx: ExportContext,
  options: IParagraphOptions & { topSpacingPx?: number } = {},
  segmentParser: (input: string) => ContentSegment[] = parseContent,
): Promise<Paragraph[]> {
  const { topSpacingPx, ...paragraphOptions } = options
  const segments = segmentParser(text)
  const paragraphs: Paragraph[] = []
  let inline: ContentSegment[] = []

  async function flushInline(): Promise<void> {
    if (inline.length === 0) return
    const { children } = await segmentsToParagraphChildren(inline, style, ctx)
    paragraphs.push(
      new Paragraph({
        ...paragraphOptions,
        spacing: {
          after: pxToTwips(4),
          line: lineSpacingPx(style.linePx, style.sizePx),
          lineRule: 'atLeast',
          ...(paragraphs.length === 0 && topSpacingPx != null
            ? { before: pxToTwips(topSpacingPx) }
            : {}),
          ...paragraphOptions.spacing,
        },
        children,
      }),
    )
    inline = []
  }

  for (const segment of segments) {
    if (segment.kind === 'math' && segment.display) {
      await flushInline()
      const { children } = await segmentsToParagraphChildren([segment], style, ctx)
      paragraphs.push(
        new Paragraph({
          ...paragraphOptions,
          alignment: 'center',
          spacing: {
            before: pxToTwips(6),
            after: pxToTwips(6),
            line: lineSpacingPx(style.linePx, style.sizePx),
            lineRule: 'atLeast',
          },
          children,
        }),
      )
      continue
    }
    inline.push(segment)
  }

  await flushInline()
  return paragraphs.length > 0
    ? paragraphs
    : [await richParagraph('', style, ctx, paragraphOptions)]
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
