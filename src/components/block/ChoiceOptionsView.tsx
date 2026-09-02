import { useRef } from 'react'
import type { ChoiceOption, ChoiceOptionFormat, WorksheetBlock } from '@/data/worksheet'
import {
  CHOICE_OPTION_MAX,
  clampText,
  getChoiceDisplayOptions,
  isOptionCorrect,
  toggleCorrectOption,
} from '@/data/blockUtils'
import { MathText } from '@/components/MathText'
import { FigmaIcon } from '@/components/ui'
import choiceCheckboxChecked from '@/assets/worksheet/choice-checkbox-checked.svg'
import choiceCheckboxCheckedLg from '@/assets/worksheet/choice-checkbox-checked-lg.svg'
import choiceRadioChecked from '@/assets/worksheet/choice-radio-checked.svg'
import choiceImagePlaceholder from '@/assets/worksheet/choice-image-placeholder.png'

interface ChoiceOptionsViewProps {
  block: WorksheetBlock
  format: ChoiceOptionFormat
  isEditing: boolean
  editable: boolean
  selected: boolean
  showAnswer: boolean
  onChangeBlock?: (block: WorksheetBlock) => void
}

function ChoiceMarker({
  block,
  correct,
  large = false,
  onToggle,
}: {
  block: WorksheetBlock
  correct: boolean
  large?: boolean
  onToggle?: () => void
}) {
  const isSingle = block.type === 'single_choice'
  const className = isSingle
    ? `choice-marker choice-marker--radio${correct ? ' is-correct' : ''}`
    : `choice-marker choice-marker--checkbox${correct ? ' is-correct' : ''}${large ? ' choice-marker--lg' : ''}`

  const icon = isSingle
    ? choiceRadioChecked
    : large
      ? choiceCheckboxCheckedLg
      : choiceCheckboxChecked

  const content =
    correct ? <FigmaIcon src={icon} size={large ? 20 : 16} /> : null

  if (onToggle) {
    return (
      <button
        type="button"
        className={className}
        aria-label={correct ? 'Снять отметку правильного' : 'Отметить как правильный'}
        aria-pressed={correct}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        {content}
      </button>
    )
  }

  return (
    <span className={className} aria-hidden>
      {content}
    </span>
  )
}

function ImageOptionCard({
  option,
  format,
  block,
  isEditing,
  showAnswer,
  correct,
  onToggleCorrect,
  onChangeOption,
}: {
  option: ChoiceOption
  format: ChoiceOptionFormat
  block: WorksheetBlock
  isEditing: boolean
  showAnswer: boolean
  correct: boolean
  onToggleCorrect?: () => void
  onChangeOption: (patch: Partial<ChoiceOption>) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const showCaption = format === 'text_image'
  const showCorrectUi = correct && (isEditing || showAnswer)

  const onFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onChangeOption({
        imageData: String(reader.result),
        imageFileName: file.name,
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      className={`choice-image-card${showCorrectUi ? ' is-correct' : ''}${isEditing ? ' choice-image-card--edit' : ''}${showCaption ? '' : ' choice-image-card--image-only'}`}
    >
      <div className="choice-image-card__media">
        {option.imageData ? (
          <img src={option.imageData} alt="" className="choice-image-card__img" />
        ) : (
          <img
            src={choiceImagePlaceholder}
            alt=""
            className="choice-image-card__placeholder-img"
          />
        )}
        <ChoiceMarker
          block={block}
          correct={showCorrectUi}
          large
          onToggle={isEditing ? onToggleCorrect : undefined}
        />
        {isEditing ? (
          <>
            <button
              type="button"
              className="choice-image-card__upload-btn"
              onClick={(e) => {
                e.stopPropagation()
                fileRef.current?.click()
              }}
            >
              Добавить картинку
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </>
        ) : null}
      </div>
      {showCaption ? (
        isEditing ? (
          <input
            className="choice-image-card__caption-input"
            value={option.text}
            maxLength={CHOICE_OPTION_MAX}
            placeholder="Подпись"
            onChange={(e) =>
              onChangeOption({ text: clampText(e.target.value, CHOICE_OPTION_MAX) })
            }
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="choice-image-card__caption">
            <MathText text={option.text || 'Ответ'} />
          </div>
        )
      ) : null}
    </div>
  )
}

export function ChoiceOptionsView({
  block,
  format,
  isEditing,
  editable,
  selected,
  showAnswer,
  onChangeBlock,
}: ChoiceOptionsViewProps) {
  const options = getChoiceDisplayOptions(block, editable, selected)

  const patchOption = (index: number, patch: Partial<ChoiceOption>) => {
    if (!onChangeBlock) return
    const next = options.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChangeBlock({ ...block, options: next })
  }

  const toggleCorrect = (optionId: string) => {
    onChangeBlock?.(toggleCorrectOption(block, optionId))
  }

  if (format === 'image' || format === 'text_image') {
    return (
      <div className="ws-task-slot choice-options-grid">
        {options.map((opt, index) => {
          const correct = isOptionCorrect(block, opt.id)
          return (
            <ImageOptionCard
              key={opt.id}
              option={opt}
              format={format}
              block={block}
              isEditing={isEditing}
              showAnswer={showAnswer}
              correct={correct}
              onToggleCorrect={() => toggleCorrect(opt.id)}
              onChangeOption={(patch) => patchOption(index, patch)}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="ws-task-slot options options--text">
      {options.map((opt, index) => {
        const correct = isOptionCorrect(block, opt.id)
        const showCorrectUi = correct && (isEditing || showAnswer)

        if (isEditing) {
          return (
            <label key={opt.id} className="option option-edit option--text">
              <ChoiceMarker
                block={block}
                correct={showCorrectUi}
                onToggle={() => toggleCorrect(opt.id)}
              />
              <input
                className="option-inline-input"
                value={opt.text}
                maxLength={CHOICE_OPTION_MAX}
                placeholder={`Вариант ${String.fromCharCode(65 + index)}`}
                onChange={(e) =>
                  patchOption(index, { text: clampText(e.target.value, CHOICE_OPTION_MAX) })
                }
                onClick={(e) => e.stopPropagation()}
              />
            </label>
          )
        }

        return (
          <label key={opt.id} className="option option--text">
            <ChoiceMarker block={block} correct={showCorrectUi} />
            <MathText text={opt.text} />
          </label>
        )
      })}
    </div>
  )
}
