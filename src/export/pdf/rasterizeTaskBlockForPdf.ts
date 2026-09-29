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
import { fetchImageBytes } from '@/export/word/imageUtils'
import {
  COLORS,
  FONT_CSS,
  LAYOUT,
  SHEET_CONTENT_WIDTH_PX,
  SLOT_CONTENT_WIDTH_PX,
  TYPO,
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
  root.style.display = 'flex'
  root.style.flexDirection = 'column'
  root.style.gap = `${LAYOUT.taskGap}px`
  return root
}

function createTaskSlot(): HTMLDivElement {
  const slot = document.createElement('div')
  slot.style.width = '100%'
  slot.style.boxSizing = 'border-box'
  slot.style.padding = `${LAYOUT.slotPaddingTop}px ${LAYOUT.slotPaddingRight}px 0 ${LAYOUT.slotPaddingLeft}px`
  slot.style.display = 'flex'
  slot.style.flexDirection = 'column'
  slot.style.gap = `${LAYOUT.slotGap}px`
  return slot
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
  img.style.maxWidth = `${sizePx}px`
  img.style.maxHeight = `${sizePx}px`
  img.style.flexShrink = '0'
  img.alt = ''
  parent.appendChild(img)
}

const CHOICE_IMAGE_PX = 120

function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpeg' : 'png'
  return `data:image/${mime};base64,${btoa(binary)}`
}

async function appendChoiceImageOptions(
  slot: HTMLDivElement,
  block: WorksheetBlock,
  showAnswer: boolean,
  ctx: ExportContext,
): Promise<void> {
  const format = block.choiceOptionFormat ?? 'text'
  let options = getChoiceDisplayOptions(block, false, false)
  if (options.length === 0) {
    options = Array.from({ length: 4 }, (_, index) => ({
      id: `fallback_${index}`,
      text: `Ответ ${index + 1}`,
    }))
  }

  const grid = document.createElement('div')
  grid.style.display = 'grid'
  grid.style.gridTemplateColumns = `repeat(${Math.min(4, options.length)}, minmax(0, 1fr))`
  grid.style.gap = '8px'

  for (const opt of options) {
    const correct = isOptionCorrect(block, opt.id) && showAnswer
    const cell = document.createElement('div')
    cell.style.boxSizing = 'border-box'
    cell.style.padding = '8px'
    cell.style.border = `1px solid #${correct ? COLORS.borderPositive : COLORS.borderSecondary}`
    cell.style.borderRadius = '4px'
    cell.style.background = correct ? `#${COLORS.bgPositiveSoft}` : '#ffffff'

    const imageSource = opt.imageData ?? ''
    const imageBytes = imageSource ? await fetchImageBytes(imageSource, ctx) : null
    if (imageBytes) {
      const img = document.createElement('img')
      img.src = bytesToDataUrl(imageBytes)
      img.width = CHOICE_IMAGE_PX
      img.height = CHOICE_IMAGE_PX
      img.style.width = `${CHOICE_IMAGE_PX}px`
      img.style.height = `${CHOICE_IMAGE_PX}px`
      img.style.maxWidth = `${CHOICE_IMAGE_PX}px`
      img.style.maxHeight = `${CHOICE_IMAGE_PX}px`
      img.style.objectFit = 'contain'
      img.style.display = 'block'
      img.style.marginBottom = '6px'
      img.alt = ''
      cell.appendChild(img)
    }

    const captionRow = document.createElement('div')
    captionRow.style.display = 'flex'
    captionRow.style.alignItems = 'flex-start'
    captionRow.style.gap = `${LAYOUT.choiceMarkerTextGapPx}px`
    await appendMarkerImg(
      captionRow,
      await choiceMarkerPng(block, showAnswer, isOptionCorrect(block, opt.id), ctx),
      LAYOUT.choiceMarkerSize,
    )
    if (format === 'text_image' && opt.text) {
      const textWrap = document.createElement('div')
      textWrap.style.flex = '1'
      appendMathText(textWrap, opt.text, {
        fontSize: TYPO.option.sizePx,
        lineHeight: TYPO.option.linePx,
      })
      captionRow.appendChild(textWrap)
    } else if (!imageBytes) {
      const textWrap = document.createElement('div')
      textWrap.style.flex = '1'
      appendMathText(textWrap, opt.text || 'Ответ', {
        fontSize: TYPO.option.sizePx,
        lineHeight: TYPO.option.linePx,
      })
      captionRow.appendChild(textWrap)
    }
    cell.appendChild(captionRow)
    grid.appendChild(cell)
  }

  slot.appendChild(grid)
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
  parent: HTMLDivElement,
  block: WorksheetBlock,
  ctx: ExportContext,
): Promise<void> {
  const row = document.createElement('div')
  row.style.display = 'flex'
  row.style.alignItems = 'center'
  row.style.gap = '4px'
  row.style.marginTop = '0'
  row.style.marginLeft = '0'

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
  parent.appendChild(row)
}

function appendEmbeddedPng(
  parent: HTMLElement,
  image: DomImageResult,
  displayWidthPx: number,
): void {
  const displayHeightPx = Math.max(1, Math.round(image.height * (displayWidthPx / image.width)))
  const img = document.createElement('img')
  img.src = pngBytesToDataUrl(image.data)
  img.width = displayWidthPx
  img.height = displayHeightPx
  img.style.width = `${displayWidthPx}px`
  img.style.height = `${displayHeightPx}px`
  img.style.maxWidth = `${displayWidthPx}px`
  img.style.maxHeight = `${displayHeightPx}px`
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
  headRow.style.width = '100%'

  const numCell = document.createElement('div')
  numCell.style.width = `${LAYOUT.taskNumWidth}px`
  numCell.style.flexShrink = '0'
  numCell.style.fontSize = `${numStyle.sizePx}px`
  numCell.style.lineHeight = `${numStyle.linePx}px`
  numCell.style.fontWeight = '500'
  numCell.textContent = taskNumber != null ? `${taskNumber}.` : ''
  headRow.appendChild(numCell)

  const mainCol = document.createElement('div')
  mainCol.style.flex = '1'
  mainCol.style.minWidth = '0'
  mainCol.style.display = 'flex'
  mainCol.style.flexDirection = 'column'
  mainCol.style.gap = isAnswerBlock ? `${LAYOUT.answerTaskMainGap}px` : `${LAYOUT.taskMainGap}px`

  const questionCell = document.createElement('div')
  questionCell.style.minWidth = '0'
  appendMathText(questionCell, questionText, {
    fontSize: qStyle.sizePx,
    lineHeight: qStyle.linePx,
    color: `#${COLORS.textDefault}`,
  })
  mainCol.appendChild(questionCell)

  const showDifficulty = ctx.options.showDifficulty && (isAnswerBlock || !!block.difficulty)
  if (showDifficulty) {
    await appendDifficultyRow(mainCol, block, ctx)
  }

  headRow.appendChild(mainCol)
  root.appendChild(headRow)

  const slot = createTaskSlot()

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
      row.style.gap = `${LAYOUT.choiceMarkerTextGapPx}px`
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
      slot.appendChild(row)
    }
  } else if (isChoiceBlock(block)) {
    await appendChoiceImageOptions(slot, block, showAnswer, ctx)
  }

  if (block.type === 'matching') {
    const image = await rasterizeMatching(block, showAnswer, ctx)
    appendEmbeddedPng(slot, image, getMatchingLayoutSpec().contentWidthPx)
  } else if (block.type === 'ordering') {
    const image = await rasterizeOrdering(block, showAnswer, ctx)
    appendEmbeddedPng(slot, image, getOrderingLayoutSpec().contentWidthPx)
  } else if (block.type === 'grouping') {
    const image = await rasterizeGrouping(block, showAnswer, ctx)
    appendEmbeddedPng(slot, image, getGroupingLayoutSpec().contentWidthPx)
  }

  if (isAnswerBlock) {
    const style = getBlockAnswerStyle(block, ctx.subject)
    const image = await rasterizeAnswerArea(block, style, ctx.subject, showAnswer, ctx)
    appendEmbeddedPng(slot, image, SLOT_CONTENT_WIDTH_PX)
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
    appendMathText(slot, text.trim() || 'Текст с пропусками', {
      fontSize: TYPO.gapsText.sizePx,
      lineHeight: TYPO.gapsText.linePx,
    })
  }

  if (slot.childNodes.length > 0) {
    root.appendChild(slot)
  }

  return captureDomToPng(root, `pdf-task-${block.id}-${showAnswer ? 'a' : 's'}`, ctx, undefined, {
    fitContent: false,
  })
}
