import { useEffect, useMemo, useState } from 'react'
import type { TaskType, WorksheetBlock, WorksheetDraft } from '@/data/worksheet'
import { GRADES, SUBJECTS, breadcrumbLabel, formatSavedAgo, sheetTopicLabel } from '@/data/worksheet'
import { countTaskBlocksBefore, reconcileAnswerBlockStyle } from '@/data/blockUtils'
import { Button, FigmaIcon, Icon, Select } from '@/components/ui'
import { BlockCard } from '@/screens/worksheet/BlockCard'
import { AnswerTaskSettingsPanel, BlockEditorPanel, ChoiceTaskSettingsPanel, FillGapsTaskSettingsPanel, MatchingTaskSettingsPanel, OrderingTaskSettingsPanel } from '@/screens/worksheet/blockEditors'
import pageAddIcon from '@/assets/worksheet/tools/page-add.svg'
import toolText from '@/assets/worksheet/tools/tool-text.svg'
import toolMedia from '@/assets/worksheet/tools/tool-media.svg'
import toolPageBreak from '@/assets/worksheet/tools/tool-page-break.svg'
import toolShortAnswer from '@/assets/worksheet/tools/tool-short-answer.svg'
import toolSingleChoice from '@/assets/worksheet/tools/tool-single-choice.svg'
import toolMultipleChoice from '@/assets/worksheet/tools/tool-multiple-choice.svg'
import toolFillGaps from '@/assets/worksheet/tools/tool-fill-gaps.svg'
import toolMatching from '@/assets/worksheet/tools/tool-matching.svg'
import toolOrdering from '@/assets/worksheet/tools/tool-ordering.svg'
import toolTable from '@/assets/worksheet/tools/tool-table.svg'
import aiOrbBg from '@/assets/worksheet/tools/ai-orb-bg.png'
import iconUndo from '@/assets/worksheet/tools/undo.svg'
import iconRedo from '@/assets/worksheet/tools/redo.svg'
import iconThumbUp from '@/assets/worksheet/tools/thumb-up.svg'
import iconThumbDown from '@/assets/worksheet/tools/thumb-down.svg'
import iconGear from '@/assets/create/gear.svg'
import { MathText } from '@/components/MathText'
import './Worksheet.css'
import './Loader.css'

const TOOL_SECTIONS: {
  title: string
  items: { type: TaskType | 'generate'; label: string; icon?: string; ai?: boolean }[]
}[] = [
  {
    title: 'Инструменты',
    items: [
      { type: 'text', label: 'Текстовый блок', icon: toolText },
      { type: 'answer_field', label: 'Медиа задание', icon: toolMedia },
      { type: 'page_break', label: 'Разрыв страницы', icon: toolPageBreak },
    ],
  },
  {
    title: 'Готовые блоки',
    items: [
      { type: 'short_answer', label: 'Ввод ответа', icon: toolShortAnswer },
      { type: 'single_choice', label: 'Одиночный выбор', icon: toolSingleChoice },
      { type: 'multiple_choice', label: 'Множественный выбор', icon: toolMultipleChoice },
      { type: 'fill_gaps', label: 'Заполнение пропусков', icon: toolFillGaps },
      { type: 'matching', label: 'Сопоставление', icon: toolMatching },
      { type: 'ordering', label: 'Упорядочивание', icon: toolOrdering },
      { type: 'grouping', label: 'Группировка', icon: toolTable },
    ],
  },
  {
    title: 'Дополнительные возможности',
    items: [{ type: 'generate', label: 'Сгенерировать задание', ai: true }],
  },
]

function AiOrb({ size = 24 }: { size?: number }) {
  const scale = size / 24
  return (
    <span className="ai-orb" style={{ width: size, height: size }}>
      <img src={aiOrbBg} alt="" className="ai-orb-bg" />
      <span
        className="ai-orb-eye"
        style={{
          width: 2.297 * scale,
          height: 5.836 * scale,
          left: 7.99 * scale,
          top: 6.98 * scale,
        }}
      />
      <span
        className="ai-orb-eye"
        style={{
          width: 2.297 * scale,
          height: 5.836 * scale,
          left: 13.71 * scale,
          top: 6.98 * scale,
        }}
      />
    </span>
  )
}

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
  onDuplicateBlock?: (id: string) => void
  onMoveBlock?: (id: string, dir: -1 | 1) => void
  onReorderBlock?: (fromId: string, toId: string, position?: 'before' | 'after') => void
  onAddPage?: () => void
  onRemovePage?: (page: number) => void
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
  onRegenerate?: () => void
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
  onDuplicateBlock,
  onMoveBlock,
  onReorderBlock,
  onAddPage,
  onRemovePage,
  onBack,
  onMaterials,
  onEdit,
  onPreview,
  onConvert: _onConvert,
  onDownload,
  onMenu,
  onShowAnswers: _onShowAnswers,
  onAddBlockOpen: _onAddBlockOpen,
  onCloseAddBlock: _onCloseAddBlock,
  onGenerateTask,
  onRegenerate,
  onSave: _onSave,
  onUndo,
  onRedo,
  onSoon,
}: WorksheetScreenProps) {
  const selected = draft.blocks.find((b) => b.id === selectedBlockId) ?? null
  const isEdit = mode === 'edit' || mode === 'edit-widget' || mode === 'add-block'
  const minimalManualSheet = Boolean(draft.createdManually)
  const materialTitle = breadcrumbLabel(draft)
  const sheetTopic = sheetTopicLabel(draft)
  const showAnswers = mode === 'answers' || draft.showAnswers
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [sheetSettingsOpen, setSheetSettingsOpen] = useState(true)
  const [sidebarDragType, setSidebarDragType] = useState<TaskType | null>(null)

  const pageBlocks = useMemo(
    () => draft.blocks.filter((b) => b.page === currentPage),
    [draft.blocks, currentPage],
  )

  useEffect(() => {
    if (pageBlocks.length > 0 || draft.blocks.length === 0) return
    const firstPageWithBlocks = draft.blocks.reduce(
      (min, block) => Math.min(min, block.page),
      Number.POSITIVE_INFINITY,
    )
    if (Number.isFinite(firstPageWithBlocks) && firstPageWithBlocks !== currentPage) {
      onPageChange(firstPageWithBlocks)
    }
  }, [pageBlocks.length, draft.blocks, currentPage, onPageChange])

  const pageCount = Math.max(draft.pages, 1)
  const hasSidePanel = mode === 'edit' || mode === 'edit-widget' || mode === 'add-block'
  const showToolsSidebar = isEdit
  const isAnswerBlockSelected =
    selected?.type === 'short_answer' || selected?.type === 'extended_answer'
  const isChoiceBlockSelected =
    selected?.type === 'single_choice' || selected?.type === 'multiple_choice'
  const isFillGapsBlockSelected = selected?.type === 'fill_gaps'
  const isMatchingBlockSelected = selected?.type === 'matching'
  const isOrderingBlockSelected = selected?.type === 'ordering'
  const hasTaskSettings = Boolean(selected && onChangeBlock && isEdit)

  useEffect(() => {
    if (hasTaskSettings) setSheetSettingsOpen(false)
    else setSheetSettingsOpen(true)
  }, [selected?.id, hasTaskSettings])

  const taskSettingsPanel =
    selected && onChangeBlock
      ? (() => {
          if (isAnswerBlockSelected) {
            return (
              <AnswerTaskSettingsPanel
                block={selected}
                subject={draft.subject}
                onChange={onChangeBlock}
              />
            )
          }
          if (isChoiceBlockSelected) {
            return <ChoiceTaskSettingsPanel block={selected} onChange={onChangeBlock} />
          }
          if (isFillGapsBlockSelected) {
            return <FillGapsTaskSettingsPanel block={selected} onChange={onChangeBlock} />
          }
          if (isMatchingBlockSelected) {
            return <MatchingTaskSettingsPanel block={selected} onChange={onChangeBlock} />
          }
          if (isOrderingBlockSelected) {
            return <OrderingTaskSettingsPanel block={selected} onChange={onChangeBlock} />
          }
          return (
            <BlockEditorPanel
              block={selected}
              subject={draft.subject}
              onChange={onChangeBlock}
              onClose={() => onSelectBlock?.(null)}
              embedded
            />
          )
        })()
      : null

  const handleDropOnBlock = (targetId: string) => {
    if (sidebarDragType) {
      onAddBlock?.(sidebarDragType, targetId === '__end__' ? null : targetId)
      setSidebarDragType(null)
      setDropTargetId(null)
      return
    }
    if (dragBlockId) {
      if (targetId === '__end__') {
        const last = pageBlocks[pageBlocks.length - 1]
        if (last && dragBlockId !== last.id) {
          onReorderBlock?.(dragBlockId, last.id, 'after')
        }
      } else if (dragBlockId !== targetId) {
        onReorderBlock?.(dragBlockId, targetId, 'before')
      }
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
            <span className="current">{materialTitle}</span>
          </nav>
          <span className="ws-saved">{formatSavedAgo(draft.savedAt)}</span>
        </div>

        <div className="ws-actions">
          <button type="button" className="icon-btn" onClick={onMenu} aria-label="Ещё">
            <Icon name="more" size={20} />
          </button>

          {isEdit ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => onSoon?.('Интерактивный режим скоро')}>
                Сделать интерактивным
              </Button>
              <Button variant="secondary" size="sm" onClick={onPreview}>
                <Icon name="eye" size={20} /> Предпросмотр
              </Button>
              <Button variant="brand" size="sm" onClick={onDownload}>
                Распечатать
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => onSoon?.('Интерактивный режим скоро')}>
                Сделать интерактивным
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

      <div className={`ws-body-layout ${hasSidePanel ? 'with-side' : ''} ${showToolsSidebar ? 'with-tools' : ''}`}>
        {showToolsSidebar ? (
          <WorksheetToolsSidebar
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={onPageChange}
            onAddPage={onAddPage}
            onRemovePage={onRemovePage}
            onAddBlock={(type) => onAddBlock?.(type)}
            onGenerateTask={onGenerateTask}
            onSoon={onSoon}
            sidebarDragType={sidebarDragType}
            setSidebarDragType={setSidebarDragType}
            onSidebarDragEnd={() => setDropTargetId(null)}
          />
        ) : (
          <PageRail
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={onPageChange}
            onAddPage={onAddPage}
          />
        )}

        <main className="ws-canvas">
          <div className={`ws-sheet ${isEdit ? 'editing' : ''} ${draft.print.orientation}`}>
            <div className={`sheet-header ${minimalManualSheet ? 'sheet-header--manual-only' : ''}`}>
              <div className="student-line">
                <span>Ученик:</span>
                <i />
              </div>

              {isEdit ? (
                <input
                  className="sheet-title-input"
                  value={draft.topic}
                  placeholder="Тема рабочего листа"
                  onChange={(e) => {
                    const topic = e.target.value
                    onChangeDraft?.({ ...draft, topic, title: topic })
                  }}
                />
              ) : (
                <h1 className="sheet-title">{sheetTopic}</h1>
              )}
            </div>

            <div
              className={`sheet-content ${isEdit ? 'editing' : ''}`}
              onDragOver={(e) => {
                if (sidebarDragType || dragBlockId) e.preventDefault()
              }}
            >
              {isEdit && !minimalManualSheet ? (
                <div className="sheet-intro-widget">
                  <textarea
                    className="sheet-intro-input"
                    value={draft.intro}
                    rows={2}
                    placeholder="Вводная часть (необязательно)"
                    onChange={(e) => onChangeDraft?.({ ...draft, intro: e.target.value })}
                  />
                </div>
              ) : !minimalManualSheet && draft.intro ? (
                <div className="sheet-intro-widget">
                  <MathText as="p" className="sheet-intro" text={draft.intro} />
                </div>
              ) : null}

              {pageBlocks.length === 0 && draft.blocks.length > 0 ? (
                <p className="sheet-empty-hint">
                  На этой странице нет блоков. Перейдите на другую страницу в колонке слева.
                </p>
              ) : null}

              {pageBlocks.length === 0 && draft.blocks.length === 0 && isEdit && !minimalManualSheet ? (
                <p className="sheet-empty-hint">
                  Добавьте блок из панели инструментов слева или сгенерируйте задание.
                </p>
              ) : null}

              {pageBlocks.map((block, index) => {
                const taskNumber =
                  block.type === 'page_break' ||
                  block.type === 'text' ||
                  block.type === 'answer_field'
                    ? 0
                    : countTaskBlocksBefore(draft.blocks, currentPage, index) + 1
                return (
                <div
                  key={block.id}
                  className="block-drop-zone"
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTargetId(block.id)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDropOnBlock(block.id)
                  }}
                >
                  {dropTargetId === block.id && (sidebarDragType || dragBlockId) ? (
                    <div className="drop-indicator" aria-hidden />
                  ) : null}
                  <BlockCard
                    block={block}
                    taskNumber={taskNumber}
                    subject={draft.subject}
                    editable={isEdit}
                    selected={selectedBlockId === block.id}
                    showAnswer={showAnswers}
                    showDifficulty={draft.showDifficulty}
                    previewState={null}
                    dragging={dragBlockId === block.id}
                    onSelect={() => onSelectBlock?.(block.id)}
                    onChangeBlock={isEdit ? onChangeBlock : undefined}
                    onRemove={() => onRemoveBlock?.(block.id)}
                    onMoveUp={() => onMoveBlock?.(block.id, -1)}
                    onMoveDown={() => onMoveBlock?.(block.id, 1)}
                    onDuplicate={() => onDuplicateBlock?.(block.id)}
                    onRegenerateBlock={() => onGenerateTask?.()}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', block.id)
                      setDragBlockId(block.id)
                    }}
                    onDragEnd={() => {
                      setDragBlockId(null)
                      setDropTargetId(null)
                    }}
                  />
                </div>
                )
              })}

              {isEdit && (sidebarDragType || dragBlockId) ? (
                <div
                  className="block-drop-zone block-drop-zone--end"
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTargetId('__end__')
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDropOnBlock('__end__')
                  }}
                >
                  {dropTargetId === '__end__' ? <div className="drop-indicator" aria-hidden /> : null}
                </div>
              ) : null}

            </div>
            {pageCount > 1 ? (
              <div className="sheet-page-footer" aria-hidden>
                {currentPage + 1}
              </div>
            ) : null}
          </div>
        </main>

        {hasSidePanel ? (
          <aside className={`ws-sidepanel ws-right-sidebar ${hasTaskSettings ? 'has-task-settings' : ''}`}>
            {hasTaskSettings && taskSettingsPanel ? (
              <div className="ws-task-settings-scroll">{taskSettingsPanel}</div>
            ) : null}

            {hasTaskSettings ? <div className="ws-right-divider" aria-hidden /> : null}

            <div className={`ws-sheet-settings-block ${sheetSettingsOpen ? 'is-open' : 'is-collapsed'}`}>
              {hasTaskSettings ? (
                <button
                  type="button"
                  className="ws-sheet-settings-toggle"
                  onClick={() => setSheetSettingsOpen((open) => !open)}
                  aria-expanded={sheetSettingsOpen}
                >
                  <span>Настройки рабочего листа</span>
                  <FigmaIcon src={iconGear} size={20} />
                </button>
              ) : (
                <p className="side-section-heading ws-sheet-settings-heading">Настройки рабочего листа</p>
              )}

              {sheetSettingsOpen || !hasTaskSettings ? (
              <div className="ws-sidepanel-scroll ws-sheet-settings-scroll">
                  <label className="side-field">
                    <span>Предмет</span>
                    <Select
                      options={SUBJECTS}
                      placeholder="Выберите предмет"
                      value={draft.subject}
                      onChange={(e) => {
                        const subject = e.target.value
                        onChangeDraft?.({
                          ...draft,
                          subject,
                          blocks: draft.blocks.map((block) =>
                            block.type === 'short_answer' || block.type === 'extended_answer'
                              ? reconcileAnswerBlockStyle(block, subject)
                              : block,
                          ),
                        })
                      }}
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
                  <div className="side-switch-row">
                    <span>Показать ответы</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.showAnswers}
                      className={`switch ${draft.showAnswers ? 'on' : ''}`}
                      onClick={() => onChangeDraft?.({ ...draft, showAnswers: !draft.showAnswers })}
                    >
                      <span className="knob" />
                    </button>
                  </div>
                  <div className="side-switch-row">
                    <span>Показывать сложность</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.showDifficulty}
                      className={`switch ${draft.showDifficulty ? 'on' : ''}`}
                      onClick={() => onChangeDraft?.({ ...draft, showDifficulty: !draft.showDifficulty })}
                    >
                      <span className="knob" />
                    </button>
                  </div>
                  {!draft.createdManually ? (
                    <>
                      <div className="settings-divider" />
                      <div className="side-switch-row">
                        <span>Оценить генерацию</span>
                        <div className="settings-rate-icons">
                          <button type="button" className="rate-icon-btn" onClick={() => onSoon?.('Спасибо за оценку')} aria-label="Нравится">
                            <FigmaIcon src={iconThumbUp} size={20} />
                          </button>
                          <button type="button" className="rate-icon-btn" onClick={() => onSoon?.('Спасибо за оценку')} aria-label="Не нравится">
                            <FigmaIcon src={iconThumbDown} size={20} />
                          </button>
                        </div>
                      </div>
                      <button type="button" className="side-switch-row settings-regenerate" onClick={onRegenerate}>
                        <span>Перегенерировать</span>
                        <AiOrb size={24} />
                      </button>
                    </>
                  ) : null}
              </div>
              ) : null}
            </div>

            <div className="settings-actions">
              <button type="button" className="history-btn" onClick={onUndo} aria-label="Отменить">
                <FigmaIcon src={iconUndo} size={20} />
              </button>
              <button type="button" className="history-btn" onClick={onRedo} aria-label="Повторить">
                <FigmaIcon src={iconRedo} size={20} />
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

function PageRail({
  pageCount,
  currentPage,
  editable,
  onPageChange,
  onAddPage,
  onRemovePage,
}: {
  pageCount: number
  currentPage: number
  editable?: boolean
  onPageChange: (page: number) => void
  onAddPage?: () => void
  onRemovePage?: (page: number) => void
}) {
  const canDelete = Boolean(editable && onRemovePage && pageCount > 1)

  return (
    <div className="page-rail">
      {Array.from({ length: pageCount }, (_, i) => (
        <div key={i} className={`page-thumb-wrap ${currentPage === i ? 'active' : ''}`}>
          <button
            type="button"
            className={`page-thumb ${currentPage === i ? 'active' : ''}`}
            onClick={() => onPageChange(i)}
          >
            {i + 1}
          </button>
          {canDelete ? (
            <button
              type="button"
              className="page-thumb-delete"
              aria-label={`Удалить страницу ${i + 1}`}
              onClick={() => onRemovePage!(i)}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      {editable && onAddPage ? (
        <button type="button" className="page-add" onClick={onAddPage} aria-label="Добавить страницу">
          <img src={pageAddIcon} alt="" width={20} height={20} />
        </button>
      ) : null}
    </div>
  )
}

function WorksheetToolsSidebar({
  pageCount,
  currentPage,
  onPageChange,
  onAddPage,
  onRemovePage,
  onAddBlock,
  onGenerateTask,
  onSoon: _onSoon,
  sidebarDragType: _sidebarDragType,
  setSidebarDragType,
  onSidebarDragEnd,
}: {
  pageCount: number
  currentPage: number
  onPageChange: (page: number) => void
  onAddPage?: () => void
  onRemovePage?: (page: number) => void
  onAddBlock: (type: TaskType) => void
  onGenerateTask?: () => void
  onSoon?: (message: string) => void
  sidebarDragType: TaskType | null
  setSidebarDragType: (type: TaskType | null) => void
  onSidebarDragEnd?: () => void
}) {
  const handleClick = (type: TaskType | 'generate') => {
    if (type === 'generate') {
      onGenerateTask?.()
      return
    }
    onAddBlock(type)
  }

  return (
    <aside className="ws-tools-sidebar">
      <PageRail
        pageCount={pageCount}
        currentPage={currentPage}
        editable
        onPageChange={onPageChange}
        onAddPage={onAddPage}
        onRemovePage={onRemovePage}
      />
      <div className="ws-tools-menu">
        {TOOL_SECTIONS.map((section) => (
          <div key={section.title} className="ws-tools-section">
            <div className="ws-tools-section-title">{section.title}</div>
            {section.items.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`ws-tools-item ${item.ai ? 'ai' : ''}`}
                draggable={item.type !== 'generate'}
                onDragStart={(e) => {
                  if (item.type === 'generate' || !item.icon) return
                  setSidebarDragType(item.type)
                  const ghost = document.createElement('div')
                  ghost.className = 'ws-drag-ghost'
                  ghost.innerHTML = `<img src="${item.icon}" width="20" height="20" alt="" /><span>${item.label}</span>`
                  document.body.appendChild(ghost)
                  e.dataTransfer.setDragImage(ghost, 16, 20)
                  e.dataTransfer.effectAllowed = 'copy'
                  window.setTimeout(() => ghost.remove(), 0)
                }}
                onDragEnd={() => {
                  setSidebarDragType(null)
                  onSidebarDragEnd?.()
                }}
                onClick={() => handleClick(item.type)}
              >
                {item.ai ? (
                  <AiOrb size={24} />
                ) : (
                  <FigmaIcon src={item.icon!} size={20} className="ws-tools-item-icon" />
                )}
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
