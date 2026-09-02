import type { WorksheetBlock } from '@/data/worksheet'
import {
  ANSWER_STYLE_OPTIONS,
  answerHeightRange,
  answerLabelFromStyle,
  answerStyleFromLabel,
  clampAnswerHeight,
  clampMatchingCount,
  clampOrderCount,
  clampTableCols,
  clampTableRows,
  defaultAnswerHeight,
  defaultAnswerStyle,
  getBlockAnswerStyle,
  getCorrectAnswerText,
  MATCHING_PAIRS_MAX,
  MATCHING_PAIRS_MIN,
  ORDER_ITEMS_MAX,
  ORDER_ITEMS_MIN,
  shuffleArray,
} from '@/data/blockUtils'
import { Button, Input, Select } from '@/components/ui'
import { uid } from '@/data/worksheet'
import starFilled from '@/assets/worksheet/star-filled.svg'
import starEmpty from '@/assets/worksheet/star-empty.svg'

export function BlockEditorPanel({
  block,
  subject,
  onChange,
  onClose,
}: {
  block: WorksheetBlock
  subject: string
  onChange: (block: WorksheetBlock) => void
  onClose: () => void
}) {
  if (block.type === 'text') {
    return (
      <aside className="ws-sidepanel">
        <div className="side-head ws-sidepanel-head">
          <h3>Текстовый блок</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="ws-sidepanel-scroll">
          <p className="side-hint">Редактируйте текст прямо на листе.</p>
        </div>
      </aside>
    )
  }

  if (block.type === 'page_break') {
    return (
      <aside className="ws-sidepanel">
        <div className="side-head">
          <h3>Разрыв страницы</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <p className="side-hint">Добавляет перенос на следующую страницу. Виден только в режиме редактирования.</p>
      </aside>
    )
  }

  if (block.type === 'answer_field') {
    return (
      <aside className="ws-sidepanel">
        <div className="side-head">
          <h3>Медиа / QR</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <p className="side-hint">Введите ссылку или загрузите файл в блоке на листе.</p>
      </aside>
    )
  }

  if (block.type === 'fill_gaps') {
    return (
      <aside className="ws-sidepanel">
        <div className="side-head ws-sidepanel-head">
          <h3>Заполнение пропусков</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="ws-sidepanel-scroll">
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
        </div>
      </aside>
    )
  }

  return (
    <aside className="ws-sidepanel">
      <div className="side-head ws-sidepanel-head">
        <h3>
          {block.type === 'short_answer' || block.type === 'extended_answer'
            ? 'Настройки задания'
            : 'Настройки блока'}
        </h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      <div className="ws-sidepanel-scroll">
      {(block.type === 'short_answer' || block.type === 'extended_answer') && (
        <>
          <label className="side-field">
            <span>Тип ответов</span>
            <Select
              options={ANSWER_STYLE_OPTIONS}
              value={answerLabelFromStyle(block.answerAreaStyle ?? defaultAnswerStyle(subject))}
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
            <span>Высота блока</span>
            <Input
              type="number"
              min={answerHeightRange(getBlockAnswerStyle(block, subject)).min}
              max={answerHeightRange(getBlockAnswerStyle(block, subject)).max}
              value={
                block.answerLines ??
                defaultAnswerHeight(getBlockAnswerStyle(block, subject))
              }
              onChange={(e) => {
                const style = getBlockAnswerStyle(block, subject)
                onChange({
                  ...block,
                  answerLines: clampAnswerHeight(style, Number(e.target.value) || defaultAnswerHeight(style)),
                })
              }}
            />
          </label>
        </>
      )}

      {block.type === 'matching' ? <MatchingEditor block={block} onChange={onChange} /> : null}
      {block.type === 'ordering' ? <OrderingEditor block={block} onChange={onChange} /> : null}
      {block.type === 'table' ? <TableEditor block={block} onChange={onChange} /> : null}

      {(block.type === 'short_answer' || block.type === 'extended_answer') ? (
        <label className="side-field">
          <span>Правильный ответ</span>
          <textarea
            className="side-field-textarea"
            rows={6}
            value={getCorrectAnswerText(block)}
            placeholder="Эталонный ответ для учителя…"
            onChange={(e) =>
              onChange({
                ...block,
                correctAnswers: e.target.value ? [e.target.value] : [],
              })
            }
          />
        </label>
      ) : block.type === 'grouping' ||
        block.type === 'ordering' ||
        block.type === 'matching' ||
        block.type === 'table' ? (
        <label className="side-field">
          <span>Правильный ответ</span>
          <Input
            value={block.correctAnswers?.join(', ') ?? ''}
            onChange={(e) =>
              onChange({
                ...block,
                correctAnswers: e.target.value.split(',').map((s) => s.trim()),
              })
            }
          />
        </label>
      ) : null}

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
      </div>
    </aside>
  )
}

function MatchingEditor({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  const left = block.leftItems ?? []
  const right = block.rightItems ?? []
  const updateLeft = (index: number, text: string) => {
    onChange({ ...block, leftItems: left.map((item, i) => (i === index ? { ...item, text } : item)) })
  }
  const updateRight = (index: number, text: string) => {
    onChange({ ...block, rightItems: right.map((item, i) => (i === index ? { ...item, text } : item)) })
  }
  const addPair = () => {
    if (left.length >= clampMatchingCount(10)) return
    onChange({
      ...block,
      leftItems: [...left, { id: uid('left'), text: 'Новый элемент' }],
      rightItems: [...right, { id: uid('right'), text: 'Новый элемент' }],
    })
  }
  const removePair = (index: number) => {
    if (left.length <= MATCHING_PAIRS_MIN) return
    onChange({
      ...block,
      leftItems: left.filter((_, i) => i !== index),
      rightItems: right.filter((_, i) => i !== index),
    })
  }
  return (
    <>
      <p className="side-section-label">Пары ({MATCHING_PAIRS_MIN}–{MATCHING_PAIRS_MAX})</p>
      {left.map((item, i) => (
        <div key={item.id} className="matching-editor-row">
          <Input value={item.text} placeholder="Слева" onChange={(e) => updateLeft(i, e.target.value)} />
          <Input
            value={right[i]?.text ?? ''}
            placeholder="Справа"
            onChange={(e) => updateRight(i, e.target.value)}
          />
          <button type="button" className="icon-btn" onClick={() => removePair(i)} aria-label="Удалить пару">
            ×
          </button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addPair} disabled={left.length >= MATCHING_PAIRS_MAX}>
        + Пара
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange({
            ...block,
            matchingDisplayRight: shuffleArray(block.rightItems ?? []),
          })
        }
      >
        Перемешать правую колонку
      </Button>
    </>
  )
}

function OrderingEditor({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  const items = block.orderItems ?? []
  return (
    <>
      <label className="side-field">
        <span>Элементы ({ORDER_ITEMS_MIN}–{ORDER_ITEMS_MAX})</span>
        <textarea
          className="side-field-textarea"
          rows={5}
          value={items.join('\n')}
          onChange={(e) => {
            const next = e.target.value.split('\n').filter(Boolean).slice(0, ORDER_ITEMS_MAX)
            onChange({ ...block, orderItems: next, orderDisplayItems: undefined })
          }}
        />
      </label>
      <label className="side-field inline">
        <span>Количество строк</span>
        <Input
          type="number"
          min={ORDER_ITEMS_MIN}
          max={ORDER_ITEMS_MAX}
          value={items.length}
          onChange={(e) => {
            const count = clampOrderCount(Number(e.target.value) || ORDER_ITEMS_MIN)
            const next = [...items]
            while (next.length < count) next.push(`Элемент ${next.length + 1}`)
            onChange({ ...block, orderItems: next.slice(0, count), orderDisplayItems: undefined })
          }}
        />
      </label>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange({ ...block, orderDisplayItems: shuffleArray(items) })}
      >
        Перемешать ответы
      </Button>
    </>
  )
}

function TableEditor({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  const rows = block.tableRows ?? 3
  const cols = block.tableCols ?? 3
  const cells =
    block.tableCells ?? Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))
  const headers = block.tableHeaders ?? Array.from({ length: cols }, (_, i) => `Группа ${i + 1}`)

  const resize = (newRows: number, newCols: number) => {
    const r = clampTableRows(newRows)
    const c = clampTableCols(newCols)
    const next = Array.from({ length: r }, (_, ri) =>
      Array.from({ length: c }, (_, ci) => cells[ri]?.[ci] ?? ''),
    )
    const nextHeaders = Array.from({ length: c }, (_, i) => headers[i] ?? `Группа ${i + 1}`)
    onChange({ ...block, tableRows: r, tableCols: c, tableCells: next, tableHeaders: nextHeaders })
  }

  const setCell = (r: number, c: number, value: string) => {
    const next = cells.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? value : cell)))
    onChange({ ...block, tableCells: next })
  }

  return (
    <>
      <div className="table-size-row">
        <FieldInline label="Строк" value={rows} min={2} max={10} onChange={(n) => resize(n, cols)} />
        <FieldInline label="Столбцов" value={cols} min={2} max={6} onChange={(n) => resize(rows, n)} />
      </div>
      <p className="side-section-label">Заголовки групп</p>
      {headers.slice(0, cols).map((h, i) => (
        <Input
          key={i}
          value={h}
          onChange={(e) => {
            const next = [...headers]
            next[i] = e.target.value
            onChange({ ...block, tableHeaders: next })
          }}
        />
      ))}
      <div className="table-editor-grid">
        {cells.map((row, r) =>
          row.map((cell, c) => (
            <input
              key={`${r}-${c}`}
              className="table-cell-input"
              value={cell}
              onChange={(e) => setCell(r, c, e.target.value)}
            />
          )),
        )}
      </div>
      <label className="side-field">
        <span>Ответы для распределения (через запятую)</span>
        <Input
          value={(block.tableAnswerBank ?? []).join(', ')}
          onChange={(e) =>
            onChange({
              ...block,
              tableAnswerBank: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      </label>
      <div className="side-switch-row">
        <span>Показывать ответы</span>
        <button
          type="button"
          role="switch"
          aria-checked={block.tableShowAnswerBank ?? false}
          className={`switch ${block.tableShowAnswerBank ? 'on' : ''}`}
          onClick={() => onChange({ ...block, tableShowAnswerBank: !block.tableShowAnswerBank })}
        >
          <span className="knob" />
        </button>
      </div>
      <div className="side-switch-row">
        <span>Перемешать ответы</span>
        <button
          type="button"
          role="switch"
          aria-checked={block.tableShuffleAnswers ?? false}
          className={`switch ${block.tableShuffleAnswers ? 'on' : ''}`}
          onClick={() => onChange({ ...block, tableShuffleAnswers: !block.tableShuffleAnswers })}
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
