import { useEffect, useMemo, useRef, useState } from 'react'
import iconGear from '@/assets/create/gear.svg'
import iconSparkle from '@/assets/create/sparkle.svg'
import iconDrag from '@/assets/create/drag.svg'
import iconClose from '@/assets/create/close.svg'
import iconClear from '@/assets/create/clear.svg'
import { Button, Field, FigmaIcon, Input, Select, Textarea } from '@/components/ui'
import { MarkdownPreview } from '@/components/MarkdownPreview'
import { generatePlanAIWithMeta } from '@/data/ai'
import { extractContextFile } from '@/data/contextFile'
import { runTechnicalProbe } from '@/data/technicalProbe'
import {
  labelForSpecMechanic,
  PLAN_SPEC_MECHANICS,
  planItemDifficultyLabel,
  normalizeDifficultyMode,
  type SpecMechanic,
} from '@/data/planMechanics'
import { resizePlanToTaskCount, withGenerationBaseline } from '@/data/taskPlanOrchestration'
import type { DifficultyMode, WorksheetDraft } from '@/data/worksheet'
import {
  ADDITIONAL_WISHES_MAX_LENGTH,
  DIFFICULTY_OPTIONS,
  GRADES,
  SUBJECTS,
  TASK_COUNTS,
  TOPIC_MAX_LENGTH,
  USER_DESCRIPTION_MAX_LENGTH,
} from '@/data/worksheet'
import './Create.css'

type CreateMode = 'generate' | 'manual' | 'probe'

interface CreateProps {
  draft: WorksheetDraft
  onChange: (updater: WorksheetDraft | ((prev: WorksheetDraft) => WorksheetDraft)) => void
  onClose: () => void
  onSubmit: (mode: 'generate' | 'manual') => void
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
  const [fileBusy, setFileBusy] = useState(false)
  const [probeBusy, setProbeBusy] = useState(false)
  const [probeError, setProbeError] = useState('')
  const [probeStatus, setProbeStatus] = useState('')
  const [probeMarkdown, setProbeMarkdown] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isGenerateLike = mode === 'generate' || mode === 'probe'

  useEffect(() => {
    setAdvanced(advancedOpen)
  }, [advancedOpen])

  const canSubmit = useMemo(
    () => Boolean(draft.subject && draft.grade && draft.topic.trim()),
    [draft],
  )

  const syncTaskCount = (countStr: string) => {
    const count = Number(countStr) || 5
    onChange((prev) => ({
      ...prev,
      taskCount: count,
      taskPlan: resizePlanToTaskCount(prev.taskPlan, count),
    }))
  }

  const updatePlan = (index: number, patch: Partial<(typeof draft.taskPlan)[number]>) => {
    onChange({
      ...draft,
      taskPlan: draft.taskPlan.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    })
  }

  const reorderPlan = (from: number, to: number) => {
    if (from === to) return
    const next = [...draft.taskPlan]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange({ ...draft, taskPlan: next })
  }

  const generatePlan = async () => {
    if (!draft.subject || !draft.grade || !draft.topic.trim()) {
      setPlanError('Сначала заполните предмет, параллель и тему')
      return
    }
    setPlanBusy(true)
    setPlanError('')
    try {
      const { plan, meta } = await generatePlanAIWithMeta(draft)
      const next = withGenerationBaseline({ ...draft, taskPlan: plan }, plan)
      onChange(next)
      if (meta.source === 'cached') {
        setPlanError('')
      }
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Не удалось сгенерировать план')
    } finally {
      setPlanBusy(false)
    }
  }

  const pickFile = async (file: File | null) => {
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
    setFileBusy(true)
    try {
      const extracted = await extractContextFile(file)
      onChange((prev) => ({
        ...prev,
        contextFileName: extracted.name,
        contextFileText: extracted.text || undefined,
        contextFileNote: extracted.note,
      }))
    } catch (err) {
      onSoon?.(err instanceof Error ? err.message : 'Не удалось обработать файл')
      onChange((prev) => ({
        ...prev,
        contextFileName: file.name,
        contextFileText: undefined,
        contextFileNote: `Файл «${file.name}» приложён, но текст не извлечён.`,
      }))
    } finally {
      setFileBusy(false)
    }
  }

  const clearFile = () => {
    setAttachedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onChange((prev) => ({
      ...prev,
      contextFileName: undefined,
      contextFileText: undefined,
      contextFileNote: undefined,
    }))
  }

  const runProbe = async () => {
    if (!draft.subject || !draft.grade || !draft.topic.trim()) {
      setProbeError('Сначала заполните предмет, параллель и тему')
      return
    }
    setProbeBusy(true)
    setProbeError('')
    setProbeStatus('Подготовка…')
    setProbeMarkdown('')

    let workingDraft = {
      ...draft,
      title: draft.topic.trim() || draft.title,
      taskPlan: resizePlanToTaskCount(draft.taskPlan, draft.taskCount),
    }

    let extractTruncated: boolean | undefined

    try {
      if (attachedFile && !workingDraft.contextFileText) {
        setProbeStatus('Extract…')
        const extracted = await extractContextFile(attachedFile)
        extractTruncated = extracted.truncated
        workingDraft = {
          ...workingDraft,
          contextFileName: extracted.name,
          contextFileText: extracted.text,
          contextFileNote: extracted.note,
        }
        onChange(workingDraft)
      }

      const fileSizeMb = attachedFile
        ? (attachedFile.size / (1024 * 1024)).toFixed(2)
        : undefined

      const { markdown } = await runTechnicalProbe(
        workingDraft,
        (progress) => {
          setProbeStatus(progress.message)
        },
        { fileSizeMb, truncated: extractTruncated },
      )

      setProbeMarkdown(markdown)
      setProbeStatus('')
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : 'Не удалось выполнить прогон')
      setProbeStatus('')
    } finally {
      setProbeBusy(false)
    }
  }

  const handleSubmit = () => {
    if (mode === 'probe') {
      void runProbe()
      return
    }
    onSubmit(mode)
  }

  return (
    <div
      className={`create-page ${overlay ? 'create-page--overlay' : ''} ${overlay && advanced ? 'create-page--expanded' : ''} ${probeMarkdown ? 'create-page--probe' : ''}`}
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
                onClick={() => {
                  setMode('generate')
                  setProbeMarkdown('')
                  setProbeError('')
                }}
              >
                Сгенерировать
              </button>
              <button
                type="button"
                className={mode === 'manual' ? 'active' : ''}
                onClick={() => {
                  setMode('manual')
                  setProbeMarkdown('')
                  setProbeError('')
                }}
              >
                Создать вручную
              </button>
              <button
                type="button"
                className={mode === 'probe' ? 'active' : ''}
                onClick={() => setMode('probe')}
              >
                Технический прогон
              </button>
            </div>
          </aside>

          <div className="create-form">
            <div className="create-form-scroll">
            <div className="create-main">
              <div className={isGenerateLike ? 'row-3' : 'row-2'}>
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
                {isGenerateLike ? (
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
                    maxLength={TOPIC_MAX_LENGTH}
                    onChange={(e) => {
                      const topic = e.target.value
                      onChange({ ...draft, topic, title: topic })
                    }}
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

              {isGenerateLike ? (
                <>
                  <Field label="Пожелания">
                    <Textarea
                      className="wishes-textarea"
                      placeholder="Особенности группы, акценты, ограничение по времени, опорный материал…"
                      value={draft.additionalWishes}
                      maxLength={ADDITIONAL_WISHES_MAX_LENGTH}
                      counter={`${draft.additionalWishes.length}/${ADDITIONAL_WISHES_MAX_LENGTH}`}
                      onChange={(e) => onChange({ ...draft, additionalWishes: e.target.value })}
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
                        {attachedFile?.name || draft.contextFileName
                          ? attachedFile?.name || draft.contextFileName
                          : 'Перетащите сюда файл или выберите на компьютере'}
                      </strong>
                      {!attachedFile && !draft.contextFileName ? (
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
                      disabled={fileBusy}
                    >
                      {fileBusy ? 'Обработка…' : attachedFile || draft.contextFileName ? 'Заменить файл' : 'Выбрать файл'}
                    </button>
                    {attachedFile || draft.contextFileName ? (
                      <button type="button" className="file-clear-btn" onClick={clearFile}>
                        Удалить файл
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            {isGenerateLike ? (
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
                          disabled={planBusy || fileBusy}
                        >
                          <FigmaIcon src={iconSparkle} size={20} />
                          {planBusy ? 'Генерация…' : 'Сгенерировать план'}
                        </button>
                      </div>
                      {planError ? <p className="plan-error">{planError}</p> : null}

                      <div className="plan-rows">
                        {draft.taskPlan.map((row, index) => (
                          <div key={row.id} className="plan-row-wrap">
                            <div
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
                                placeholder="—"
                                options={PLAN_SPEC_MECHANICS.map((t) => t.label)}
                                value={row.type ? labelForSpecMechanic(row.type) : ''}
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    updatePlan(index, { type: null })
                                    return
                                  }
                                  const found = PLAN_SPEC_MECHANICS.find((t) => t.label === e.target.value)
                                  if (found) updatePlan(index, { type: found.type as SpecMechanic })
                                }}
                              />
                              <Input
                                className="plan-hint"
                                placeholder="Например, записать общую формулу квадратного уравнения"
                                maxLength={USER_DESCRIPTION_MAX_LENGTH}
                                value={row.userDescription}
                                onChange={(e) =>
                                  updatePlan(index, { userDescription: e.target.value })
                                }
                              />
                              {row.difficulty && draft.showDifficulty ? (
                                <span className="plan-difficulty-badge">
                                  {planItemDifficultyLabel(row.difficulty)}
                                </span>
                              ) : null}
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
                            {row.description ? (
                              <p className="plan-description">{row.description}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Field label="Сложность" className="difficulty-field">
                      <Select
                        options={DIFFICULTY_OPTIONS.map((d) => d.label)}
                        value={
                          DIFFICULTY_OPTIONS.find(
                            (d) => d.value === normalizeDifficultyMode(draft.difficulty),
                          )?.label ?? 'Дифференцированная'
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
                        aria-checked={draft.showIntro}
                        className={`switch ${draft.showIntro ? 'on' : ''}`}
                        onClick={() => onChange({ ...draft, showIntro: !draft.showIntro })}
                      >
                        <span className="knob" />
                      </button>
                      <span>Добавить вводную часть перед заданиями</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {mode === 'probe' && (probeStatus || probeError || probeMarkdown) ? (
              <div className="probe-output">
                <div className="probe-output-header">
                  <h3>Результат прогона</h3>
                  {probeStatus ? <span className="probe-status">{probeStatus}</span> : null}
                </div>
                {probeError ? <p className="plan-error">{probeError}</p> : null}
                {probeMarkdown ? <MarkdownPreview markdown={probeMarkdown} /> : null}
              </div>
            ) : null}
            </div>

            <footer className="create-footer">
              {!canSubmit ? (
                <p className="create-footer-hint">Заполните предмет, параллель и тему, чтобы создать лист.</p>
              ) : fileBusy ? (
                <p className="create-footer-hint">Обработка файла…</p>
              ) : null}
              <Button variant="secondary" size="lg" className="footer-btn" onClick={onClose}>
                Отменить
              </Button>
              <Button
                variant="brand"
                size="lg"
                className="footer-btn"
                disabled={!canSubmit || probeBusy || planBusy || fileBusy}
                onClick={handleSubmit}
              >
                {mode === 'probe' ? (probeBusy ? 'Прогон…' : 'Создать') : 'Создать'}
              </Button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
