import type { DragEvent } from 'react'
import { useMemo, useState } from 'react'
import type { TaskType, WorksheetBlock, WorksheetDraft } from '@/data/worksheet'
import { GRADES, SUBJECTS, TASK_TYPE_META, formatSavedAgo, labelForType, uid } from '@/data/worksheet'
import { Button, Icon, Input, Select, Textarea } from '@/components/ui'
import { MathText } from '@/components/MathText'
import starFilled from '@/assets/worksheet/star-filled.svg'
import starEmpty from '@/assets/worksheet/star-empty.svg'
import plusIcon from '@/assets/worksheet/plus.svg'
import iconDrag from '@/assets/create/drag.svg'
import './Worksheet.css'
import './Loader.css'

type Mode = 'preview' | 'edit' | 'answers' | 'edit-widget' | 'add-block'

interface WorksheetScreenProps {
  draft: WorksheetDraft
  mode: Mode
  selectedBlockId?: string | null
  currentPage: number
  onPageChange: (page: number) => void
  onSelectBlock?: (id: string | null) => void
  onChangeBlock?: (block: WorksheetBlock) => void
  onChangeDraft?: (draft: WorksheetDraft) => void
  onAddBlock?: (type: TaskType, insertBeforeId?: string | null) => void
  onRemoveBlock?: (id: string) => void
  onMoveBlock?: (id: string, dir: -1 | 1) => void
  onReorderBlock?: (fromId: string, toId: string) => void
  onAddPage?: () => void
  onBack: () => void
  onMaterials?: () => void
  onEdit?: () => void
  onPreview?: () => void
  onConvert?: () => void
  onDownload?: () => void
  onMenu?: () => void
  onSettings?: () => void
  onShowAnswers?: () => void
  onAddBlockOpen?: () => void
  onCloseAddBlock?: () => void
  onGenerateTask?: () => void
  onSave?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onSoon?: (message: string) => void
}

export function WorksheetScreen({
  draft,
  mode,
  selectedBlockId,
  currentPage,
  onPageChange,
  onSelectBlock,
  onChangeBlock,
  onChangeDraft,
  onAddBlock,
  onRemoveBlock,
  onMoveBlock,
  onReorderBlock,
  onAddPage,
  onBack,
  onMaterials,
  onEdit,
  onPreview,
  onConvert,
  onDownload,
  onMenu,
  onShowAnswers: _onShowAnswers,
  onAddBlockOpen,
  onCloseAddBlock,
  onGenerateTask,
  onSave,
  onUndo,
  onRedo,
  onSoon,
}: WorksheetScreenProps) {
  const selected = draft.blocks.find((b) => b.id === selectedBlockId) ?? null
  const isEdit = mode === 'edit' || mode === 'edit-widget' || mode === 'add-block'
  const showAnswers = mode === 'answers' || draft.showAnswers
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [sidebarDragType, setSidebarDragType] = useState<TaskType | null>(null)

  const pageBlocks = useMemo(
    () => draft.blocks.filter((b) => b.page === currentPage),
    [draft.blocks, currentPage],
  )

  const pageCount = Math.max(draft.pages, 1)
  const hasSidePanel = mode === 'edit' || mode === 'edit-widget' || mode === 'add-block'

  const handleDropOnBlock = (targetId: string) => {
    if (sidebarDragType) {
      onAddBlock?.(sidebarDragType, targetId)
      setSidebarDragType(null)
      setDropTargetId(null)
      return
    }
    if (dragBlockId && dragBlockId !== targetId) {
      onReorderBlock?.(dragBlockId, targetId)
    }
    setDragBlockId(null)
    setDropTargetId(null)
  }

  return (
    <div className="ws-page">
      <header className="ws-navbar">
        <div className="ws-navbar-left">
          <nav className="breadcrumbs" aria-label="Навигация">
            <button type="button" onClick={onBack}>
              Главная
            </button>
            <span>/</span>
            <button type="button" onClick={onMaterials ?? onBack}>
              Материалы
            </button>
            <span>/</span>
            <span className="current">{draft.title || 'Без названия'}</span>
          </nav>
          <span className="ws-saved">{formatSavedAgo(draft.savedAt)}</span>
        </div>

        <div className="ws-actions">
          <button type="button" className="icon-btn" onClick={onMenu} aria-label="Ещё">
            <Icon name="more" size={20} />
          </button>

          {isEdit ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => onSoon?.('Интерактивный режим скоро')}>
                Сделать интерактивным
              </Button>
              <Button variant="ghost" size="sm" onClick={onGenerateTask}>
                <Icon name="refresh" size={20} /> Сгенерировать задание
              </Button>
              <Button variant="secondary" size="sm" onClick={onPreview}>
                Предпросмотр
              </Button>
              <Button variant="brand" size="sm" onClick={onDownload}>
                Распечатать
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onConvert}>
                Преобразовать
              </Button>
              <Button variant="secondary" size="sm" onClick={onEdit}>
                <Icon name="edit" size={20} /> Редактировать
              </Button>
              <Button variant="brand" size="sm" onClick={onDownload}>
                Распечатать
              </Button>
            </>
          )}
        </div>
      </header>

      <div className={`ws-body-layout ${hasSidePanel ? 'with-side' : ''}`}>
        <aside className="page-rail">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`page-thumb ${currentPage === i ? 'active' : ''}`}
              onClick={() => onPageChange(i)}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" className="page-add" onClick={onAddPage} aria-label="Добавить страницу">
            <img src={plusIcon} alt="" width={20} height={20} />
          </button>
        </aside>

        <main className="ws-canvas">
          <div className={`ws-sheet ${isEdit ? 'editing' : ''} ${draft.print.orientation}`}>
            <div className="sheet-header">
              <div className="student-line">
                <span>Ученик:</span>
                <i />
              </div>

              {isEdit ? (
                <input
                  className="sheet-title-input"
                  value={draft.title}
                  onChange={(e) => onChangeDraft?.({ ...draft, title: e.target.value })}
                />
              ) : (
                <h1 className="sheet-title">{draft.title}</h1>
              )}
            </div>

            <div className="sheet-divider" />

            <div
              className="sheet-content"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (sidebarDragType) {
                  onAddBlock?.(sidebarDragType)
                  setSidebarDragType(null)
                }
              }}
            >
              {isEdit ? (
                <div className="sheet-intro-widget">
                  <textarea
                    className="sheet-intro-input"
                    value={draft.intro}
                    rows={2}
                    placeholder="Вводная часть (необязательно)"
                    onChange={(e) => onChangeDraft?.({ ...draft, intro: e.target.value })}
                  />
                </div>
              ) : draft.intro ? (
                <div className="sheet-intro-widget">
                  <MathText as="p" className="sheet-intro" text={draft.intro} />
                </div>
              ) : null}

              {pageBlocks.map((block, index) => (
                <div key={block.id}>
                  {dropTargetId === block.id && dragBlockId ? (
                    <div className="drop-indicator" aria-hidden />
                  ) : null}
                  <BlockCard
                    block={block}
                    index={index}
                    editable={isEdit}
                    selected={selectedBlockId === block.id}
                    showAnswer={showAnswers}
                    showDifficulty={draft.showDifficulty}
                    dragging={dragBlockId === block.id}
                    onSelect={() => onSelectBlock?.(block.id)}
                    onRemove={() => onRemoveBlock?.(block.id)}
                    onMoveUp={() => onMoveBlock?.(block.id, -1)}
                    onMoveDown={() => onMoveBlock?.(block.id, 1)}
                    onDragStart={() => setDragBlockId(block.id)}
                    onDragEnd={() => {
                      setDragBlockId(null)
                      setDropTargetId(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDropTargetId(block.id)
                    }}
                    onDrop={() => handleDropOnBlock(block.id)}
                  />
                </div>
              ))}

              {isEdit ? (
                <div className="edit-actions-row">
                  <button type="button" className="add-inline" onClick={onAddBlockOpen}>
                    <Icon name="plus" size={20} /> Добавить блок
                  </button>
                  <button type="button" className="add-inline ghost" onClick={onGenerateTask}>
                    <Icon name="refresh" size={20} /> Сгенерировать задание
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </main>

        {mode === 'edit' ? (
          <aside className="ws-sidepanel ws-settings-panel">
            <h3>Настройки рабочего листа</h3>
            <label className="side-field">
              <span>Предмет</span>
              <Select
                options={SUBJECTS}
                placeholder="Выберите предмет"
                value={draft.subject}
                onChange={(e) => onChangeDraft?.({ ...draft, subject: e.target.value })}
              />
            </label>
            <label className="side-field">
              <span>Параллель</span>
              <Select
                options={GRADES}
                placeholder="Выберите параллель"
                value={draft.grade}
                onChange={(e) => onChangeDraft?.({ ...draft, grade: e.target.value })}
              />
            </label>
            <label className="switch-row side-switch">
              <button
                type="button"
                role="switch"
                aria-checked={draft.showAnswers}
                className={`switch ${draft.showAnswers ? 'on' : ''}`}
                onClick={() => onChangeDraft?.({ ...draft, showAnswers: !draft.showAnswers })}
              >
                <span className="knob" />
              </button>
              <span>Показать ответы</span>
            </label>
            <label className="switch-row side-switch">
              <button
                type="button"
                role="switch"
                aria-checked={draft.showDifficulty}
                className={`switch ${draft.showDifficulty ? 'on' : ''}`}
                onClick={() => onChangeDraft?.({ ...draft, showDifficulty: !draft.showDifficulty })}
              >
                <span className="knob" />
              </button>
              <span>Показывать сложность</span>
            </label>
            <div className="settings-actions">
              <Button variant="secondary" size="sm" onClick={onUndo}>
                ↶
              </Button>
              <Button variant="secondary" size="sm" onClick={onRedo}>
                ↷
              </Button>
              <Button variant="brand" size="sm" onClick={onSave}>
                Сохранить
              </Button>
            </div>
          </aside>
        ) : null}

        {mode === 'edit-widget' && selected ? (
          <BlockEditorPanel
            block={selected}
            onChange={onChangeBlock!}
            onClose={() => onSelectBlock?.(null)}
            onMoveUp={() => onMoveBlock?.(selected.id, -1)}
            onMoveDown={() => onMoveBlock?.(selected.id, 1)}
            onRemove={() => onRemoveBlock?.(selected.id)}
          />
        ) : null}

        {mode === 'add-block' ? (
          <aside className="ws-sidepanel">
            <div className="side-head">
              <h3>Добавить блок</h3>
              <button type="button" className="icon-btn" onClick={onCloseAddBlock} aria-label="Закрыть">
                <Icon name="close" size={18} />
              </button>
            </div>
            <p className="side-section-label">Готовые блоки заданий</p>
            <div className="add-grid">
              {TASK_TYPE_META.filter((b) => b.category === 'task').map((b) => (
                <button
                  key={b.type}
                  type="button"
                  className="add-type"
                  draggable
                  onDragStart={() => setSidebarDragType(b.type)}
                  onDragEnd={() => setSidebarDragType(null)}
                  onClick={() => onAddBlock?.(b.type)}
                >
                  <strong>{b.label}</strong>
                  <span>{b.hint}</span>
                </button>
              ))}
            </div>
            <p className="side-section-label">Инструменты</p>
            <div className="add-grid">
              {TASK_TYPE_META.filter((b) => b.category === 'element').map((b) => (
                <button
                  key={b.type}
                  type="button"
                  className="add-type"
                  draggable
                  onDragStart={() => setSidebarDragType(b.type)}
                  onDragEnd={() => setSidebarDragType(null)}
                  onClick={() => onAddBlock?.(b.type)}
                >
                  <strong>{b.label}</strong>
                  <span>{b.hint}</span>
                </button>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

function BlockEditorPanel({
  block,
  onChange,
  onClose,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
  onClose: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  return (
    <aside className="ws-sidepanel">
      <div className="side-head">
        <h3>Редактирование блока</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" size={18} />
        </button>
      </div>
      <label className="side-field">
        <span>Тип</span>
        <strong>{labelForType(block.type)}</strong>
      </label>
      <label className="side-field">
        <span>Заголовок</span>
        <Input value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} />
      </label>
      {block.instruction !== undefined ? (
        <label className="side-field">
          <span>Инструкция</span>
          <Input
            value={block.instruction ?? ''}
            onChange={(e) => onChange({ ...block, instruction: e.target.value })}
          />
        </label>
      ) : null}

      {block.type !== 'table' ? (
        <label className="side-field">
          <span>{block.type === 'text' ? 'Текст' : 'Вопрос / текст'}</span>
          <Textarea
            rows={4}
            value={block.question ?? block.body ?? block.gapsText ?? ''}
            onChange={(e) => {
              if (block.type === 'fill_gaps') {
                onChange({ ...block, gapsText: e.target.value, question: e.target.value })
              } else if (block.type === 'text') {
                onChange({ ...block, body: e.target.value })
              } else {
                onChange({ ...block, question: e.target.value })
              }
            }}
          />
        </label>
      ) : null}

      {(block.type === 'single_choice' || block.type === 'multiple_choice') && (
        <>
          <label className="side-field">
            <span>Варианты (каждый с новой строки)</span>
            <Textarea
              rows={4}
              value={(block.options ?? []).map((o) => o.text).join('\n')}
              onChange={(e) => {
                const texts = e.target.value.split('\n').filter(Boolean)
                const options = texts.map((text, i) => ({
                  id: block.options?.[i]?.id ?? `option_${i + 1}`,
                  text,
                }))
                onChange({
                  ...block,
                  options,
                  correctOptionId: block.correctOptionId ?? options[0]?.id,
                })
              }}
            />
          </label>
          <label className="side-field">
            <span>Правильный ответ</span>
            {block.type === 'single_choice' ? (
              <Select
                options={(block.options ?? []).map((o) => o.text)}
                value={block.options?.find((o) => o.id === block.correctOptionId)?.text ?? ''}
                onChange={(e) => {
                  const opt = block.options?.find((o) => o.text === e.target.value)
                  if (opt) onChange({ ...block, correctOptionId: opt.id })
                }}
              />
            ) : (
              <Input
                placeholder="Варианты через запятую"
                value={(block.correctOptionIds ?? [])
                  .map((id) => block.options?.find((o) => o.id === id)?.text)
                  .filter(Boolean)
                  .join(', ')}
                onChange={(e) => {
                  const texts = e.target.value.split(',').map((s) => s.trim())
                  const ids = texts
                    .map((t) => block.options?.find((o) => o.text === t)?.id)
                    .filter(Boolean) as string[]
                  onChange({ ...block, correctOptionIds: ids })
                }}
              />
            )}
          </label>
        </>
      )}

      {block.type === 'matching' ? (
        <MatchingEditor block={block} onChange={onChange} />
      ) : null}

      {block.type === 'grouping' ? (
        <GroupingEditor block={block} onChange={onChange} />
      ) : null}

      {block.type === 'ordering' ? (
        <OrderingEditor block={block} onChange={onChange} />
      ) : null}

      {block.type === 'fill_gaps' ? (
        <label className="side-field">
          <span>Ответы к пропускам (через запятую)</span>
          <Input
            value={(block.gapsAnswers ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                ...block,
                gapsAnswers: e.target.value.split(',').map((s) => s.trim()),
              })
            }
          />
        </label>
      ) : null}

      {block.type === 'table' ? (
        <TableEditor block={block} onChange={onChange} />
      ) : null}

      {(block.correctAnswers || block.type === 'short_answer' || block.type === 'extended_answer') &&
      block.type !== 'single_choice' &&
      block.type !== 'multiple_choice' ? (
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
              className={(block.difficulty ?? 1) >= n ? 'on' : ''}
              onClick={() => onChange({ ...block, difficulty: n })}
            >
              <img
                src={(block.difficulty ?? 1) >= n ? starFilled : starEmpty}
                alt=""
                width={16}
                height={16}
              />
            </button>
          ))}
        </div>
      </label>
      <div className="side-actions">
        <Button variant="secondary" onClick={onMoveUp}>
          ↑ Выше
        </Button>
        <Button variant="secondary" onClick={onMoveDown}>
          ↓ Ниже
        </Button>
      </div>
      <Button variant="danger-soft" onClick={onRemove}>
        Удалить блок
      </Button>
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
    const next = left.map((item, i) => (i === index ? { ...item, text } : item))
    onChange({ ...block, leftItems: next })
  }
  const updateRight = (index: number, text: string) => {
    const next = right.map((item, i) => (i === index ? { ...item, text } : item))
    onChange({ ...block, rightItems: next })
  }
  return (
    <>
      <p className="side-section-label">Левая колонка</p>
      {left.map((item, i) => (
        <Input key={item.id} value={item.text} onChange={(e) => updateLeft(i, e.target.value)} />
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange({
            ...block,
            leftItems: [...left, { id: uid('left'), text: 'Новый элемент' }],
          })
        }
      >
        + Слева
      </Button>
      <p className="side-section-label">Правая колонка</p>
      {right.map((item, i) => (
        <Input key={item.id} value={item.text} onChange={(e) => updateRight(i, e.target.value)} />
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange({
            ...block,
            rightItems: [...right, { id: uid('right'), text: 'Новый элемент' }],
          })
        }
      >
        + Справа
      </Button>
    </>
  )
}

function GroupingEditor({
  block,
  onChange,
}: {
  block: WorksheetBlock
  onChange: (block: WorksheetBlock) => void
}) {
  const groups = block.groups ?? []
  return (
    <>
      {groups.map((g, gi) => (
        <div key={g.id} className="group-editor">
          <Input
            value={g.title}
            onChange={(e) => {
              const next = groups.map((group, i) =>
                i === gi ? { ...group, title: e.target.value } : group,
              )
              onChange({ ...block, groups: next })
            }}
          />
          <Textarea
            rows={3}
            value={g.items.join('\n')}
            onChange={(e) => {
              const next = groups.map((group, i) =>
                i === gi ? { ...group, items: e.target.value.split('\n').filter(Boolean) } : group,
              )
              onChange({ ...block, groups: next })
            }}
          />
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange({
            ...block,
            groups: [...groups, { id: uid('group'), title: 'Новая группа', items: ['Элемент'] }],
          })
        }
      >
        + Группа
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
  return (
    <label className="side-field">
      <span>Элементы (каждый с новой строки)</span>
      <Textarea
        rows={5}
        value={(block.orderItems ?? []).join('\n')}
        onChange={(e) =>
          onChange({
            ...block,
            orderItems: e.target.value.split('\n').filter(Boolean),
          })
        }
      />
    </label>
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
    block.tableCells ??
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))

  const resize = (newRows: number, newCols: number) => {
    const next = Array.from({ length: newRows }, (_, r) =>
      Array.from({ length: newCols }, (_, c) => cells[r]?.[c] ?? ''),
    )
    onChange({ ...block, tableRows: newRows, tableCols: newCols, tableCells: next })
  }

  const setCell = (r: number, c: number, value: string) => {
    const next = cells.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? value : cell)))
    onChange({ ...block, tableCells: next })
  }

  return (
    <>
      <div className="table-size-row">
        <FieldInline label="Строк" value={rows} onChange={(n) => resize(n, cols)} />
        <FieldInline label="Столбцов" value={cols} onChange={(n) => resize(rows, n)} />
      </div>
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
    </>
  )
}

function FieldInline({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="side-field inline">
      <span>{label}</span>
      <Input
        type="number"
        min={1}
        max={8}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
      />
    </label>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`Сложность ${value} из 3`}>
      {[1, 2, 3].map((n) => (
        <img
          key={n}
          src={n <= value ? starFilled : starEmpty}
          alt=""
          width={16}
          height={16}
          className={n <= value ? 'filled' : ''}
        />
      ))}
    </span>
  )
}

function BlockCard({
  block,
  index,
  editable,
  selected,
  showAnswer,
  showDifficulty,
  dragging,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  block: WorksheetBlock
  index: number
  editable: boolean
  selected: boolean
  showAnswer: boolean
  showDifficulty: boolean
  dragging?: boolean
  onSelect: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent) => void
  onDrop: () => void
}) {
  if (block.type === 'page_break') {
    return (
      <div
        className={`page-break-block ${selected ? 'selected' : ''} ${editable ? 'editable' : ''} ${dragging ? 'dragging' : ''}`}
        onClick={editable ? onSelect : undefined}
        onDragOver={editable ? onDragOver : undefined}
        onDrop={editable ? onDrop : undefined}
      >
        — Разрыв страницы —
      </div>
    )
  }

  const number = index + 1
  const question = block.question ?? block.body ?? block.gapsText ?? ''
  const isPlainText = block.type === 'text'
  const rows = block.tableRows ?? 3
  const cols = block.tableCols ?? 3
  const cells = block.tableCells

  return (
    <article
      className={`ws-task ${selected ? 'selected' : ''} ${editable ? 'editable' : ''} ${isPlainText ? 'plain' : ''} ${dragging ? 'dragging' : ''}`}
      onClick={editable ? onSelect : undefined}
      onDragOver={editable ? onDragOver : undefined}
      onDrop={editable ? onDrop : undefined}
    >
      <div className="ws-task-head">
        {!isPlainText ? <span className="ws-task-num">{number}.</span> : null}
        <div className="ws-task-main">
          <p className="ws-task-text">
            {block.instruction ? (
              <>
                <MathText className="instruction" text={block.instruction} />{' '}
              </>
            ) : null}
            <MathText text={question} />
          </p>
          {showDifficulty && !isPlainText ? (
            <div className="ws-task-meta">
              <span className="diff-label">Сложность:</span>
              <Stars value={block.difficulty ?? 1} />
            </div>
          ) : null}
        </div>
        {editable ? (
          <div className="block-tools" onClick={(e) => e.stopPropagation()}>
            <span
              className="block-drag-handle"
              draggable
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              aria-label="Перетащить"
            >
              <img src={iconDrag} alt="" width={20} height={20} />
            </span>
            <button type="button" className="icon-btn tiny" onClick={onMoveUp} aria-label="Выше">
              ↑
            </button>
            <button type="button" className="icon-btn tiny" onClick={onMoveDown} aria-label="Ниже">
              ↓
            </button>
            <button type="button" className="icon-btn tiny" onClick={onRemove} aria-label="Удалить">
              <Icon name="trash" size={16} />
            </button>
          </div>
        ) : null}
      </div>

      {block.type === 'single_choice' || block.type === 'multiple_choice' ? (
        <div className="ws-task-slot options">
          {(block.options ?? []).map((opt) => {
            const correct =
              block.type === 'single_choice'
                ? opt.id === block.correctOptionId
                : (block.correctOptionIds ?? []).includes(opt.id)
            return (
              <label key={opt.id} className={`option ${showAnswer && correct ? 'correct' : ''}`}>
                <span className="checkbox" />
                <MathText text={opt.text} />
              </label>
            )
          })}
        </div>
      ) : null}

      {block.type === 'short_answer' || block.type === 'extended_answer' || block.type === 'answer_field' ? (
        <div className="ws-task-slot lines">
          {Array.from({
            length: block.answerLines ?? (block.type === 'extended_answer' ? 5 : 2),
          }).map((_, i) => (
            <i key={i} />
          ))}
        </div>
      ) : null}

      {block.type === 'fill_gaps' ? (
        <div className="ws-task-slot">
          <p className="gaps-preview">
            {(block.gapsText ?? '').split('___').map((part, i, arr) => (
              <span key={i}>
                <MathText text={part} />
                {i < arr.length - 1 ? <span className="gap-blank">______</span> : null}
              </span>
            ))}
          </p>
        </div>
      ) : null}

      {block.type === 'matching' ? (
        <div className="ws-task-slot match-grid">
          <div>
            {(block.leftItems ?? []).map((item) => (
              <div key={item.id} className="match-item">
                <MathText text={item.text} />
              </div>
            ))}
          </div>
          <div>
            {(block.rightItems ?? []).map((item) => (
              <div key={item.id} className="match-item">
                <MathText text={item.text} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {block.type === 'grouping' ? (
        <div className="ws-task-slot group-grid">
          {(block.groups ?? []).map((g) => (
            <div key={g.id} className="group-card">
              <strong>
                <MathText text={g.title} />
              </strong>
              <ul>
                {g.items.map((item) => (
                  <li key={item}>
                    <MathText text={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {block.type === 'ordering' ? (
        <ol className="ws-task-slot order-list">
          {(block.orderItems ?? []).map((item) => (
            <li key={item}>
              <MathText text={item} />
            </li>
          ))}
        </ol>
      ) : null}

      {block.type === 'table' ? (
        <div className="ws-task-slot">
          <table className="ws-table">
            <tbody>
              {Array.from({ length: rows }).map((_, r) => (
                <tr key={r}>
                  {Array.from({ length: cols }).map((_, c) => (
                    <td key={c}>{cells?.[r]?.[c] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showAnswer && (block.correctAnswers?.length || block.correctOptionId) ? (
        <div className="ws-task-slot">
          <div className="answer-pill">
            Ответ:{' '}
            <MathText
              text={
                block.correctAnswers?.join(', ') ||
                block.options?.find((o) => o.id === block.correctOptionId)?.text ||
                (block.correctOptionIds ?? [])
                  .map((id) => block.options?.find((o) => o.id === id)?.text)
                  .filter(Boolean)
                  .join(', ') ||
                ''
              }
            />
          </div>
        </div>
      ) : null}
    </article>
  )
}
