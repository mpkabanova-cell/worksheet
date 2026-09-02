import { useEffect, useMemo, useRef, useState } from 'react'
import iconGear from '@/assets/create/gear.svg'
import iconSparkle from '@/assets/create/sparkle.svg'
import iconDrag from '@/assets/create/drag.svg'
import iconClose from '@/assets/create/close.svg'
import iconClear from '@/assets/create/clear.svg'
import { Button, Field, FigmaIcon, Input, Select, Textarea } from '@/components/ui'
import { generatePlanAI } from '@/data/ai'
import { createPlan } from '@/data/worksheet'
import type { DifficultyMode, TaskType, WorksheetDraft } from '@/data/worksheet'
import {
  DIFFICULTY_OPTIONS,
  GRADES,
  PLAN_TASK_TYPES,
  SUBJECTS,
  TASK_COUNTS,
} from '@/data/worksheet'
import './Create.css'

type CreateMode = 'generate' | 'manual'

interface CreateProps {
  draft: WorksheetDraft
  onChange: (draft: WorksheetDraft) => void
  onClose: () => void
  onSubmit: (mode: CreateMode) => void
  advancedOpen?: boolean
  overlay?: boolean
  onSoon?: (message: string) => void
}

export function Create({
  draft,
  onChange,
  onClose,
  onSubmit,
  advancedOpen = false,
  overlay = false,
  onSoon,
}: CreateProps) {
  const [mode, setMode] = useState<CreateMode>('generate')
  const [advanced, setAdvanced] = useState(advancedOpen)
  const [planBusy, setPlanBusy] = useState(false)
  const [planError, setPlanError] = useState('')
  const [dragPlanIdx, setDragPlanIdx] = useState<number | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAdvanced(advancedOpen)
  }, [advancedOpen])

  const canSubmit = useMemo(
    () => Boolean(draft.subject && draft.grade && draft.topic.trim()),
    [draft],
  )

  const syncTaskCount = (countStr: string) => {
    const count = Number(countStr) || 5
    onChange({
      ...draft,
      taskCount: count,
      plan: createPlan(
        count,
        draft.plan.map((p) => p.taskType),
      ),
    })
  }

  const updatePlan = (index: number, patch: Partial<(typeof draft.plan)[number]>) => {
    onChange({
      ...draft,
      plan: draft.plan.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    })
  }

  const reorderPlan = (from: number, to: number) => {
    if (from === to) return
    const next = [...draft.plan]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange({ ...draft, plan: next })
  }

  const generatePlan = async () => {
    if (!draft.subject || !draft.grade || !draft.topic.trim()) {
      setPlanError('Сначала заполните предмет, параллель и тему')
      return
    }
    setPlanBusy(true)
    setPlanError('')
    try {
      const plan = await generatePlanAI(draft)
      onChange({ ...draft, plan })
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Не удалось сгенерировать план')
    } finally {
      setPlanBusy(false)
    }
  }

  const pickFile = (file: File | null) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      onSoon?.('Файл не должен весить больше 10 Мб')
      return
    }
    const allowed = ['.docx', '.pdf', '.jpg', '.jpeg', '.png']
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowed.includes(ext)) {
      onSoon?.('Формат — docx, pdf, jpg, png')
      return
    }
    setAttachedFile(file)
  }

  return (
    <div
      className={`create-page ${overlay ? 'create-page--overlay' : ''} ${overlay && advanced ? 'create-page--expanded' : ''}`}
    >
      <button type="button" className="create-close" onClick={onClose} aria-label="Закрыть">
        <FigmaIcon src={iconClose} size={20} />
      </button>

      <div className="create-inner">
        {!overlay ? (
          <header className="create-header">
            <h1>Создание рабочего листа</h1>
            <p>
              Сгенерируйте рабочий лист — его можно будет редактировать и конвертировать в задание
              для выдачи ученикам
            </p>
          </header>
        ) : null}

        <div className="create-shell">
          <aside className="create-sidemenu">
            {overlay ? (
              <div className="create-sidemenu-title">Создание рабочего листа</div>
            ) : null}
            <div className="create-sidemenu-nav">
              <button
                type="button"
                className={mode === 'generate' ? 'active' : ''}
                onClick={() => setMode('generate')}
              >
                Сгенерировать
              </button>
              <button
                type="button"
                className={mode === 'manual' ? 'active' : ''}
                onClick={() => setMode('manual')}
              >
                Создать вручную
              </button>
            </div>
          </aside>

          <div className="create-form">
            <div className="create-main">
              <div className={mode === 'generate' ? 'row-3' : 'row-2'}>
                <Field label="Предмет" required>
                  <Select
                    options={SUBJECTS}
                    placeholder="Выберите предмет"
                    value={draft.subject}
                    onChange={(e) => onChange({ ...draft, subject: e.target.value })}
                  />
                </Field>
                <Field label="Параллель" required>
                  <Select
                    options={GRADES}
                    placeholder="Выберите параллель"
                    value={draft.grade}
                    onChange={(e) => onChange({ ...draft, grade: e.target.value })}
                  />
                </Field>
                {mode === 'generate' ? (
                  <Field label="Количество заданий" required>
                    <Select
                      options={TASK_COUNTS}
                      value={String(draft.taskCount)}
                      onChange={(e) => syncTaskCount(e.target.value)}
                    />
                  </Field>
                ) : null}
              </div>

              <Field label="Тема рабочего листа" required>
                <div className="input-with-clear">
                  <Input
                    placeholder="Например, умножение дробей"
                    value={draft.topic}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        topic: e.target.value,
                        title: e.target.value || draft.title,
                      })
                    }
                  />
                  {draft.topic ? (
                    <button
                      type="button"
                      className="clear-btn"
                      aria-label="Очистить"
                      onClick={() => onChange({ ...draft, topic: '', title: '' })}
                    >
                      <FigmaIcon src={iconClear} size={20} />
                    </button>
                  ) : null}
                </div>
              </Field>

              {mode === 'generate' ? (
                <>
                  <Field label="Пожелания">
                    <Textarea
                      className="wishes-textarea"
                      placeholder="Особенности группы, акценты, ограничение по времени, опорный материал…"
                      value={draft.wishes}
                      maxLength={2000}
                      counter={`${draft.wishes.length}/2000`}
                      onChange={(e) => onChange({ ...draft, wishes: e.target.value })}
                    />
                  </Field>

                  <div
                    className="file-dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      pickFile(e.dataTransfer.files[0] ?? null)
                    }}
                  >
                    <div className="file-dropzone-copy">
                      <strong>
                        {attachedFile
                          ? attachedFile.name
                          : 'Перетащите сюда файл или выберите на компьютере'}
                      </strong>
                      {!attachedFile ? (
                        <p>
                          файл не должен весить больше 10 Мб.
                          <br />
                          Формат — docx, pdf, jpg, png
                        </p>
                      ) : null}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      accept=".docx,.pdf,.jpg,.jpeg,.png"
                      onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      className="file-pick-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {attachedFile ? 'Заменить файл' : 'Выбрать файл'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            {mode === 'generate' ? (
              <div className="create-advanced-wrap">
                <button
                  type="button"
                  className="advanced-link"
                  onClick={() => setAdvanced((v) => !v)}
                >
                  <FigmaIcon src={iconGear} size={20} />
                  {advanced ? 'Скрыть расширенные настройки' : 'Показать расширенные настройки'}
                </button>

                {advanced ? (
                  <div className="advanced-settings">
                    <div className="plan-block">
                      <div className="plan-header">
                        <h3>Порядок заданий</h3>
                        <button
                          type="button"
                          className="gen-plan"
                          onClick={generatePlan}
                          disabled={planBusy}
                        >
                          <FigmaIcon src={iconSparkle} size={20} />
                          {planBusy ? 'Генерация…' : 'Сгенерировать план'}
                        </button>
                      </div>
                      {planError ? <p className="plan-error">{planError}</p> : null}

                      <div className="plan-rows">
                        {draft.plan.map((row, index) => (
                          <div
                            key={row.id}
                            className={`plan-row ${dragPlanIdx === index ? 'dragging' : ''}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragPlanIdx !== null) reorderPlan(dragPlanIdx, index)
                              setDragPlanIdx(null)
                            }}
                          >
                            <span className="plan-index">{index + 1}.</span>
                            <Select
                              className="plan-type"
                              options={PLAN_TASK_TYPES.map((t) => t.label)}
                              value={
                                PLAN_TASK_TYPES.find((t) => t.type === row.taskType)?.label ??
                                row.taskType
                              }
                              onChange={(e) => {
                                const found = PLAN_TASK_TYPES.find((t) => t.label === e.target.value)
                                if (found) updatePlan(index, { taskType: found.type as TaskType })
                              }}
                            />
                            <Input
                              className="plan-hint"
                              placeholder="Например, записать общую формулу квадратного уравнения"
                              maxLength={200}
                              value={row.userExpectation}
                              onChange={(e) =>
                                updatePlan(index, { userExpectation: e.target.value })
                              }
                            />
                            <span
                              className="drag-handle"
                              draggable
                              onDragStart={() => setDragPlanIdx(index)}
                              onDragEnd={() => setDragPlanIdx(null)}
                              aria-hidden
                            >
                              <FigmaIcon src={iconDrag} size={20} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Field label="Сложность" className="difficulty-field">
                      <Select
                        options={DIFFICULTY_OPTIONS.map((d) => d.label)}
                        value={
                          DIFFICULTY_OPTIONS.find((d) => d.value === draft.difficulty)?.label ??
                          'Дифференцированная'
                        }
                        onChange={(e) => {
                          const found = DIFFICULTY_OPTIONS.find((d) => d.label === e.target.value)
                          if (found) {
                            onChange({ ...draft, difficulty: found.value as DifficultyMode })
                          }
                        }}
                      />
                    </Field>

                    <div className="switch-row">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draft.showDifficulty}
                        className={`switch ${draft.showDifficulty ? 'on' : ''}`}
                        onClick={() =>
                          onChange({ ...draft, showDifficulty: !draft.showDifficulty })
                        }
                      >
                        <span className="knob" />
                      </button>
                      <span>Показывать сложность</span>
                    </div>

                    <div className="switch-row">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draft.addIntro}
                        className={`switch ${draft.addIntro ? 'on' : ''}`}
                        onClick={() => onChange({ ...draft, addIntro: !draft.addIntro })}
                      >
                        <span className="knob" />
                      </button>
                      <span>Добавить вводную часть перед заданиями</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <footer className="create-footer">
              <Button variant="secondary" size="lg" className="footer-btn" onClick={onClose}>
                Отменить
              </Button>
              <Button
                variant="brand"
                size="lg"
                className="footer-btn"
                disabled={!canSubmit}
                onClick={() => onSubmit(mode)}
              >
                Создать
              </Button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
