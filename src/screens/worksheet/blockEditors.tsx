import type { ReactNode } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
import {
  answerHeightOptionsForStyle,
  answerHeightFieldLabel,
  answerLabelFromStyle,
  answerStyleFromLabel,
  answerStyleOptionsForSubject,
  CHOICE_FORMAT_OPTIONS,
  CHOICE_OPTION_COUNT_DEFAULT,
  CHOICE_OPTION_COUNT_OPTIONS,
  choiceFormatFromLabel,
  choiceLabelFromFormat,
  clampAnswerHeight,
  clampChoiceOptionCount,
  clampMatchingCount,
  clampOrderCount,
  clampTableCols,
  clampTableRows,
  defaultAnswerHeight,
  getBlockAnswerStyle,
  MATCHING_PAIR_COUNT_DEFAULT,
  MATCHING_PAIR_COUNT_OPTIONS,
  ORDER_ITEM_COUNT_DEFAULT,
  ORDER_ITEM_COUNT_OPTIONS,
  resizeChoiceOptions,
  resizeGroupingTable,
  resizeMatchingPairs,
  resizeOrderItems,
  shuffleArray,
  TABLE_COLS_DEFAULT,
  TABLE_ROWS_DEFAULT,
} from '@/data/blockUtils'
import { Input, Select } from '@/components/ui'
import starFilled from '@/assets/worksheet/star-filled.svg'
import starEmpty from '@/assets/worksheet/star-empty.svg'

export function AnswerTaskSettingsPanel({
  block,
  subject,
  onChange,
}: {
  block: WorksheetBlock
  subject: string
  onChange: (block: WorksheetBlock) => void
}) {
  const style = getBlockAnswerStyle(block, subject)
  const styleOptions = answerStyleOptionsForSubject(subject)

  return (
    <section className="ws-task-settings-panel">
      <p className="side-section-heading">Настройки задания</p>
      <label className="side-field">
        <span>Тип ответов</span>
        <Select
          options={styleOptions}
          value={answerLabelFromStyle(style)}
          onChange={(e) => {
            const nextStyle = answerStyleFromLabel(e.target.value)
            onChange({
              ...block,
              answerAreaStyle: nextStyle,
              answerLines: clampAnswerHeight(
                nextStyle,
                block.answerLines ?? defaultAnswerHeight(nextStyle),
              ),
            })
          }}
        />
      </label>
      <label className="side-field">
        <span>{answerHeightFieldLabel(style)}</span>
        <Select
          options={answerHeightOptionsForStyle(style)}
          value={String(block.answerLines ?? defaultAnswerHeight(style))}
          onChange={(e) =>
            onChange({
              ...block,
              answerLines: clampAnswerHeight(style, Number(e.target.value) || defaultAnswerHeight(style)),
            })
          }
        />
      </label>
    </section>
  )
}

export function ChoiceTaskSettingsPanel({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  const format = block.choiceOptionFormat ?? 'text'
  const count = block.choiceOptionCount ?? block.options?.length ?? CHOICE_OPTION_COUNT_DEFAULT

  return (
    <section className="ws-task-settings-panel">
      <p className="side-section-heading">Настройки задания</p>
      <label className="side-field">
        <span>Тип ответов</span>
        <Select
          options={CHOICE_FORMAT_OPTIONS}
          value={choiceLabelFromFormat(format)}
          onChange={(e) => {
            const nextFormat = choiceFormatFromLabel(e.target.value)
            onChange({ ...block, choiceOptionFormat: nextFormat, choiceDisplayOrder: undefined })
          }}
        />
      </label>
      <label className="side-field">
        <span>Количество ответов</span>
        <Select
          options={CHOICE_OPTION_COUNT_OPTIONS}
          value={String(count)}
          onChange={(e) => {
            const nextCount = clampChoiceOptionCount(Number(e.target.value) || CHOICE_OPTION_COUNT_DEFAULT)
            const nextBlock = {
              ...block,
              choiceOptionCount: nextCount,
              choiceDisplayOrder: undefined,
            }
            onChange({
              ...nextBlock,
              options: resizeChoiceOptions(nextBlock, block.options ?? []),
            })
          }}
        />
      </label>
      <div className="side-switch-row">
        <span>Перемешать ответы</span>
        <button
          type="button"
          role="switch"
          aria-checked={block.choiceShuffle ?? false}
          className={`switch ${block.choiceShuffle ? 'on' : ''}`}
          onClick={() =>
            onChange({
              ...block,
              choiceShuffle: !block.choiceShuffle,
              choiceDisplayOrder: undefined,
            })
          }
        >
          <span className="knob" />
        </button>
      </div>
    </section>
  )
}

export function FillGapsTaskSettingsPanel({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  return (
    <section className="ws-task-settings-panel">
      <p className="side-section-heading">Настройки задания</p>
      <div className="side-switch-row">
        <span>Перемешать ответы</span>
        <button
          type="button"
          role="switch"
          aria-checked={block.gapsShuffleAnswers ?? false}
          className={`switch ${block.gapsShuffleAnswers ? 'on' : ''}`}
          onClick={() =>
            onChange({
              ...block,
              gapsShuffleAnswers: !block.gapsShuffleAnswers,
              gapsAnswers: block.gapsShuffleAnswers
                ? block.gapsAnswers
                : shuffleArray(block.gapsAnswers ?? []),
            })
          }
        >
          <span className="knob" />
        </button>
      </div>
    </section>
  )
}

export function MatchingTaskSettingsPanel({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  const count =
    block.matchingPairCount ?? block.leftItems?.length ?? MATCHING_PAIR_COUNT_DEFAULT
  const leftFormat = block.matchingLeftFormat ?? 'text'
  const rightFormat = block.matchingRightFormat ?? 'text'

  return (
    <section className="ws-task-settings-panel">
      <p className="side-section-heading">Настройки задания</p>
      <label className="side-field">
        <span>Количество пар</span>
        <Select
          options={MATCHING_PAIR_COUNT_OPTIONS}
          value={String(count)}
          onChange={(e) => {
            const nextCount = clampMatchingCount(Number(e.target.value) || MATCHING_PAIR_COUNT_DEFAULT)
            onChange(
              resizeMatchingPairs({
                ...block,
                matchingPairCount: nextCount,
              }),
            )
          }}
        />
      </label>
      <label className="side-field">
        <span>Левая колонка</span>
        <Select
          options={CHOICE_FORMAT_OPTIONS}
          value={choiceLabelFromFormat(leftFormat)}
          onChange={(e) =>
            onChange({ ...block, matchingLeftFormat: choiceFormatFromLabel(e.target.value) })
          }
        />
      </label>
      <label className="side-field">
        <span>Правая колонка</span>
        <Select
          options={CHOICE_FORMAT_OPTIONS}
          value={choiceLabelFromFormat(rightFormat)}
          onChange={(e) =>
            onChange({ ...block, matchingRightFormat: choiceFormatFromLabel(e.target.value) })
          }
        />
      </label>
      <div className="side-switch-row">
        <span>Перемешать правую колонку</span>
        <button
          type="button"
          role="switch"
          aria-checked={block.matchingShuffleRight ?? true}
          className={`switch ${block.matchingShuffleRight !== false ? 'on' : ''}`}
          onClick={() =>
            onChange({
              ...block,
              matchingShuffleRight: !(block.matchingShuffleRight ?? true),
              matchingDisplayRight: undefined,
            })
          }
        >
          <span className="knob" />
        </button>
      </div>
    </section>
  )
}

export function OrderingTaskSettingsPanel({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  const count = block.orderItems?.length ?? ORDER_ITEM_COUNT_DEFAULT

  return (
    <section className="ws-task-settings-panel">
      <p className="side-section-heading">Настройки задания</p>
      <label className="side-field">
        <span>Количество строк</span>
        <Select
          options={ORDER_ITEM_COUNT_OPTIONS}
          value={String(count)}
          onChange={(e) => {
            const nextCount = clampOrderCount(Number(e.target.value) || ORDER_ITEM_COUNT_DEFAULT)
            const items = [...(block.orderItems ?? [])]
            while (items.length < nextCount) items.push('')
            onChange(
              resizeOrderItems({
                ...block,
                orderItems: items.slice(0, nextCount),
              }),
            )
          }}
        />
      </label>
      <div className="side-switch-row">
        <span>Перемешать ответы</span>
        <button
          type="button"
          role="switch"
          aria-checked={block.orderShuffle !== false}
          className={`switch ${block.orderShuffle !== false ? 'on' : ''}`}
          onClick={() =>
            onChange({
              ...block,
              orderShuffle: block.orderShuffle === false,
              orderDisplayItems: undefined,
              orderDisplayOrder: undefined,
            })
          }
        >
          <span className="knob" />
        </button>
      </div>
    </section>
  )
}

export function BlockEditorPanel({
  block,
  subject: _subject,
  onChange,
  onClose,
  embedded = false,
}: {
  block: WorksheetBlock
  subject: string
  onChange: (block: WorksheetBlock) => void
  onClose: () => void
  embedded?: boolean
}) {
  const shell = (title: string, children: ReactNode) =>
    embedded ? (
      <section className="ws-task-settings-panel">
        <p className="side-section-heading">{title}</p>
        {children}
      </section>
    ) : (
      <aside className="ws-sidepanel ws-block-settings-panel">
        <div className="side-head ws-sidepanel-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="ws-sidepanel-scroll">{children}</div>
      </aside>
    )

  if (block.type === 'text') {
    return shell('Текстовый блок', <p className="side-hint">Редактируйте текст прямо на листе.</p>)
  }

  if (block.type === 'page_break') {
    return shell(
      'Разрыв страницы',
      <p className="side-hint">Добавляет перенос на следующую страницу. Виден только в режиме редактирования.</p>,
    )
  }

  if (block.type === 'answer_field') {
    return shell('Медиа / QR', <p className="side-hint">Введите ссылку или загрузите файл в блоке на листе.</p>)
  }

  if (block.type === 'fill_gaps') {
    return shell(
      'Заполнение пропусков',
      <>
        <p className="side-hint">Текст и пропуски редактируются на листе.</p>
        <div className="side-switch-row">
          <span>Перемешать ответы</span>
          <button
            type="button"
            role="switch"
            aria-checked={block.gapsShuffleAnswers ?? false}
            className={`switch ${block.gapsShuffleAnswers ? 'on' : ''}`}
            onClick={() =>
              onChange({
                ...block,
                gapsShuffleAnswers: !block.gapsShuffleAnswers,
                gapsAnswers: block.gapsShuffleAnswers
                  ? block.gapsAnswers
                  : shuffleArray(block.gapsAnswers ?? []),
              })
            }
          >
            <span className="knob" />
          </button>
        </div>
      </>,
    )
  }

  if (block.type === 'short_answer' || block.type === 'extended_answer') {
    return null
  }

  if (block.type === 'single_choice' || block.type === 'multiple_choice') {
    return null
  }

  if (block.type === 'matching' || block.type === 'ordering') {
    return null
  }

  if (block.type === 'grouping') {
    return shell(
      'Настройки задания',
      <>
        <GroupingTableEditor block={block} onChange={onChange} />
        <label className="side-field">
          <span>Сложность</span>
          <div className="diff-picker">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={(block.difficulty ?? 0) >= n ? 'on' : ''}
                onClick={() => onChange({ ...block, difficulty: n })}
              >
                <img
                  src={(block.difficulty ?? 0) >= n ? starFilled : starEmpty}
                  alt=""
                  width={16}
                  height={16}
                />
              </button>
            ))}
            <button
              type="button"
              className="diff-clear"
              onClick={() => onChange({ ...block, difficulty: undefined })}
            >
              Сбросить
            </button>
          </div>
        </label>
      </>,
    )
  }

  return shell(
    'Настройки задания',
    <>
      <label className="side-field">
        <span>Сложность</span>
        <div className="diff-picker">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={(block.difficulty ?? 0) >= n ? 'on' : ''}
              onClick={() => onChange({ ...block, difficulty: n })}
            >
              <img
                src={(block.difficulty ?? 0) >= n ? starFilled : starEmpty}
                alt=""
                width={16}
                height={16}
              />
            </button>
          ))}
          <button type="button" className="diff-clear" onClick={() => onChange({ ...block, difficulty: undefined })}>
            Сбросить
          </button>
        </div>
      </label>
    </>,
  )
}

function GroupingTableEditor({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  const rows = block.tableRows ?? TABLE_ROWS_DEFAULT
  const cols = block.tableCols ?? TABLE_COLS_DEFAULT

  return (
    <>
      <label className="side-field">
        <span>Количество столбцов</span>
        <Input
          type="number"
          min={2}
          max={6}
          value={cols}
          onChange={(e) => {
            const nextCols = clampTableCols(Number(e.target.value) || TABLE_COLS_DEFAULT)
            onChange(resizeGroupingTable(block, rows, nextCols))
          }}
        />
      </label>
      <label className="side-field">
        <span>Количество строк</span>
        <Input
          type="number"
          min={2}
          max={10}
          value={rows}
          onChange={(e) => {
            const nextRows = clampTableRows(Number(e.target.value) || TABLE_ROWS_DEFAULT)
            onChange(resizeGroupingTable(block, nextRows, cols))
          }}
        />
      </label>
      <label className="side-field">
        <span>Элементы для распределения</span>
        <Input
          value={(block.tableAnswerBank ?? []).join(', ')}
          placeholder="Слово 1, Слово 2, …"
          onChange={(e) =>
            onChange({
              ...block,
              tableAnswerBank: e.target.value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <div className="side-switch-row">
        <span>Показывать ответы</span>
        <button
          type="button"
          role="switch"
          aria-checked={block.tableShowAnswerBank ?? true}
          className={`switch ${block.tableShowAnswerBank !== false ? 'on' : ''}`}
          onClick={() =>
            onChange({ ...block, tableShowAnswerBank: !(block.tableShowAnswerBank ?? true) })
          }
        >
          <span className="knob" />
        </button>
      </div>
      <div className="side-switch-row">
        <span>Перемешать ответы</span>
        <button
          type="button"
          role="switch"
          aria-checked={block.tableShuffleAnswers ?? true}
          className={`switch ${block.tableShuffleAnswers !== false ? 'on' : ''}`}
          onClick={() =>
            onChange({
              ...block,
              tableShuffleAnswers: !(block.tableShuffleAnswers ?? true),
            })
          }
        >
          <span className="knob" />
        </button>
      </div>
    </>
  )
}

function FieldInline({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <label className="side-field inline">
      <span>{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      />
    </label>
  )
}
