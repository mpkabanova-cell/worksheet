import type { WorksheetBlock } from '@/data/worksheet'
import {
  getBlockAnswerStyle,
  getChoiceDisplayOptions,
  getGapsSourceText,
  getGapsStudentText,
  getValidGapAnswers,
  isChoiceBlock,
  isOptionCorrect,
  isValidFillGapsBlock,
  markGapAnswersInText,
} from '@/data/blockUtils'
import { getBlockQuestion } from '@/data/taskContent'
import {
  getChoiceCheckboxCheckedPng,
  getChoiceCheckboxMarkerPng,
  getChoiceRadioCheckedPng,
  getChoiceRadioMarkerPng,
  getStarEmptyPng,
  getStarFilledPng,
} from '@/export/word/assets/uiAssets'
import { getGroupingLayoutSpec, getMatchingLayoutSpec, getOrderingLayoutSpec } from '@/export/word/layoutSpec'
import {
  COLORS,
  FONT_CSS,
  LAYOUT,
  SHEET_CONTENT_WIDTH_PX,
  SLOT_CONTENT_WIDTH_PX,
  TYPO,
  slotBodyTopSpacingPx,
} from '@/export/word/layoutTokens'
import { pngBytesToDataUrl } from '@/export/pdf/pngDataUrl'
import { captureDomToPng } from '@/export/word/rasterize/domToPng'
import { rasterizeAnswerArea } from '@/export/word/rasterize/renderAnswerAreaDom'
import { appendMathText, ensureKatexStyles } from '@/export/word/rasterize/renderMathHtml'
import { rasterizeGrouping } from '@/export/word/rasterize/renderGroupingDom'
import { rasterizeMatching } from '@/export/word/rasterize/renderMatchingDom'
import { rasterizeOrdering } from '@/export/word/rasterize/renderOrderingDom'
import type { DomImageResult, ExportContext } from '@/export/word/types'

function createTaskRoot(): HTMLDivElement {
  const root = document.createElement('div')
  root.style.width = `${SHEET_CONTENT_WIDTH_PX}px`
  root.style.boxSizing = 'border-box'
  root.style.fontFamily = FONT_CSS
  root.style.background = '#ffffff'
  return root
}

async function appendMarkerImg(
  parent: HTMLElement,
  png: Uint8Array,
  sizePx: number,
): Promise<void> {
  const img = document.createElement('img')
  img.src = pngBytesToDataUrl(png)
  img.width = sizePx
  img.height = sizePx
  img.style.width = `${sizePx}px`
  img.style.height = `${sizePx}px`
  img.style.flexShrink = '0'
  img.alt = ''
  parent.appendChild(img)
}

async function choiceMarkerPng(
  block: WorksheetBlock,
  showAnswer: boolean,
  correct: boolean,
  ctx: ExportContext,
): Promise<Uint8Array> {
  const size = LAYOUT.choiceMarkerSize
  const isSingle = block.type === 'single_choice'
  const showCorrect = showAnswer && correct
  if (isSingle) {
    return showCorrect
      ? await getChoiceRadioCheckedPng(ctx, size)
      : await getChoiceRadioMarkerPng(ctx, size)
  }
  return showCorrect
    ? await getChoiceCheckboxCheckedPng(ctx, size)
    : await getChoiceCheckboxMarkerPng(ctx, size)
}

async function appendDifficultyRow(
  root: HTMLDivElement,
  block: WorksheetBlock,
  ctx: ExportContext,
  topGapPx: number,
): Promise<void> {
  const row = document.createElement('div')
  row.style.display = 'flex'
  row.style.alignItems = 'center'
  row.style.gap = '4px'
  row.style.marginTop = `${topGapPx}px`
  row.style.marginLeft = `${LAYOUT.taskNumWidth}px`

  const label = document.createElement('span')
  label.textContent = 'Сложность:'
  label.style.fontSize = `${TYPO.difficulty.sizePx}px`
  label.style.lineHeight = `${TYPO.difficulty.linePx}px`
  label.style.color = `#${COLORS.textSecondary}`
  label.style.width = `${LAYOUT.diffLabelWidth}px`
  label.style.flexShrink = '0'
  row.appendChild(label)

  const stars = document.createElement('span')
  stars.style.display = 'inline-flex'
  stars.style.alignItems = 'center'
  stars.style.gap = `${LAYOUT.diffStarGapPx}px`
  for (let n = 1; n <= 3; n += 1) {
    const png =
      n <= (block.difficulty ?? 0)
        ? await getStarFilledPng(ctx, LAYOUT.diffStarSizePx)
        : await getStarEmptyPng(ctx, LAYOUT.diffStarSizePx)
    await appendMarkerImg(stars, png, LAYOUT.diffStarSizePx)
  }
  row.appendChild(stars)
  root.appendChild(row)
}

function appendEmbeddedPng(
  parent: HTMLElement,
  image: DomImageResult,
  displayWidthPx: number,
): void {
  const img = document.createElement('img')
  img.src = pngBytesToDataUrl(image.data)
  img.style.width = `${displayWidthPx}px`
  img.style.height = `${Math.max(1, Math.round(image.height * (displayWidthPx / image.width)))}px`
  img.style.display = 'block'
  img.alt = ''
  parent.appendChild(img)
}

export async function rasterizeTaskBlockForPdf(
  block: WorksheetBlock,
  taskNumber: number | null,
  ctx: ExportContext,
  showAnswer: boolean,
): Promise<DomImageResult> {
  const root = createTaskRoot()
  ensureKatexStyles(root)

  const isAnswerBlock = block.type === 'short_answer' || block.type === 'extended_answer'
  const qStyle = isAnswerBlock ? TYPO.answerTaskQuestion : TYPO.taskQuestion
  const numStyle = isAnswerBlock ? TYPO.answerTaskNum : TYPO.taskNum
  const questionText = getBlockQuestion(block)

  const headRow = document.createElement('div')
  headRow.style.display = 'flex'
  headRow.style.alignItems = 'flex-start'
  headRow.style.gap = '0'

  const numCell = document.createElement('div')
  numCell.style.width = `${LAYOUT.taskNumWidth}px`
  numCell.style.flexShrink = '0'
  numCell.style.fontSize = `${numStyle.sizePx}px`
  numCell.style.lineHeight = `${numStyle.linePx}px`
  numCell.style.fontWeight = '500'
  numCell.textContent = taskNumber != null ? `${taskNumber}.` : ''
  headRow.appendChild(numCell)

  const questionCell = document.createElement('div')
  questionCell.style.flex = '1'
  questionCell.style.minWidth = '0'
  appendMathText(questionCell, questionText, {
    fontSize: qStyle.sizePx,
    lineHeight: qStyle.linePx,
    color: `#${COLORS.textDefault}`,
  })
  headRow.appendChild(questionCell)
  root.appendChild(headRow)

  const showDifficulty = ctx.options.showDifficulty && (isAnswerBlock || !!block.difficulty)
  if (showDifficulty) {
    const gap = isAnswerBlock ? LAYOUT.answerTaskMainGap : LAYOUT.taskMainGap
    await appendDifficultyRow(root, block, ctx, gap)
  }

  const body = document.createElement('div')
  body.style.marginLeft = `${LAYOUT.taskNumWidth}px`
  body.style.paddingLeft = `${LAYOUT.slotPaddingLeft}px`
  body.style.marginTop = `${slotBodyTopSpacingPx()}px`
  body.style.maxWidth = `${SLOT_CONTENT_WIDTH_PX}px`

  if (isChoiceBlock(block) && (block.choiceOptionFormat ?? 'text') === 'text') {
    let options = getChoiceDisplayOptions(block, false, false)
    if (options.length === 0) {
      options = Array.from({ length: 4 }, (_, index) => ({
        id: `fallback_${index}`,
        text: `Ответ ${index + 1}`,
      }))
    }
    for (const opt of options) {
      const row = document.createElement('div')
      row.style.display = 'flex'
      row.style.alignItems = 'flex-start'
      row.style.gap = '8px'
      row.style.marginBottom = `${LAYOUT.slotGap}px`
      const marker = document.createElement('span')
      marker.style.marginTop = '2px'
      await appendMarkerImg(
        marker,
        await choiceMarkerPng(block, showAnswer, isOptionCorrect(block, opt.id), ctx),
        LAYOUT.choiceMarkerSize,
      )
      row.appendChild(marker)
      const textWrap = document.createElement('div')
      textWrap.style.flex = '1'
      appendMathText(textWrap, opt.text || 'Ответ', {
        fontSize: TYPO.option.sizePx,
        lineHeight: TYPO.option.linePx,
      })
      row.appendChild(textWrap)
      body.appendChild(row)
    }
  }

  if (block.type === 'matching') {
    const image = await rasterizeMatching(block, showAnswer, ctx)
    appendEmbeddedPng(body, image, getMatchingLayoutSpec().imageWidthPx)
  } else if (block.type === 'ordering') {
    const image = await rasterizeOrdering(block, showAnswer, ctx)
    appendEmbeddedPng(body, image, getOrderingLayoutSpec().imageWidthPx)
  } else if (block.type === 'grouping') {
    const image = await rasterizeGrouping(block, showAnswer, ctx)
    appendEmbeddedPng(body, image, getGroupingLayoutSpec().imageWidthPx)
  }

  if (isAnswerBlock) {
    const style = getBlockAnswerStyle(block, ctx.subject)
    const image = await rasterizeAnswerArea(block, style, ctx.subject, showAnswer, ctx)
    appendEmbeddedPng(body, image, SLOT_CONTENT_WIDTH_PX)
  }

  if (block.type === 'fill_gaps') {
    const gapWords = getValidGapAnswers(block)
    const source = getGapsSourceText(block)
    const invalid = !isValidFillGapsBlock(block)
    const text = invalid
      ? source
      : showAnswer
        ? markGapAnswersInText(source, gapWords)
        : getGapsStudentText(block)
    appendMathText(body, text.trim() || 'Текст с пропусками', {
      fontSize: TYPO.gapsText.sizePx,
      lineHeight: TYPO.gapsText.linePx,
    })
  }

  if (body.childNodes.length > 0) {
    root.appendChild(body)
  }

  const gap = document.createElement('div')
  gap.style.height = `${LAYOUT.taskGap}px`
  root.appendChild(gap)

  return captureDomToPng(root, `pdf-task-${block.id}-${showAnswer ? 'a' : 's'}`, ctx, undefined, {
    fitContent: true,
  })
}
