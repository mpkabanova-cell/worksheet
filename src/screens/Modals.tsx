import { useEffect, useState } from 'react'
import { Button, Field, Icon, Input, ModalShell, Select, Textarea } from '@/components/ui'
import { ADDITIONAL_WISHES_MAX_LENGTH, GRADES, PLAN_TASK_TYPES, SUBJECTS, labelForType, worksheetDisplayName } from '@/data/worksheet'
import type { Modal, TaskType, WorksheetDraft } from '@/data/worksheet'
import './Modals.css'

interface ModalsProps {
  modal: Modal
  draft: WorksheetDraft
  generateTaskType: TaskType
  generateTaskHint: string
  generateTaskBusy?: boolean
  toastMessage?: string
  deletePageIndex?: number | null
  onClose: () => void
  onConfirmConvert: () => void
  onConfirmDelete: () => void
  onConfirmDeletePage: () => void
  onConfirmDuplicate: () => void
  onConfirmRegenerate: () => void
  onConfirmGenerateTask: () => void
  onChangeDraft: (draft: WorksheetDraft) => void
  onGenerateTaskType: (type: TaskType) => void
  onGenerateTaskHint: (hint: string) => void
  onPrint: () => void
  onSave: () => void
  onOpen: (modal: Modal) => void
  onExportDocx?: () => void
  onExportPdf?: () => void
  onSoon?: (message: string) => void
}

export function Modals({
  modal,
  draft,
  generateTaskType,
  generateTaskHint,
  generateTaskBusy,
  toastMessage,
  deletePageIndex,
  onClose,
  onConfirmConvert,
  onConfirmDelete,
  onConfirmDeletePage,
  onConfirmDuplicate,
  onConfirmRegenerate,
  onConfirmGenerateTask,
  onChangeDraft,
  onGenerateTaskType,
  onGenerateTaskHint,
  onPrint,
  onSave,
  onOpen,
  onExportDocx,
  onExportPdf,
  onSoon,
}: ModalsProps) {
  const [convertTitle, setConvertTitle] = useState('')
  const [convertGrade, setConvertGrade] = useState('')
  const [convertDue, setConvertDue] = useState('')

  const materialName = worksheetDisplayName(draft)

  useEffect(() => {
    if (modal === 'convert') {
      setConvertTitle(draft.topic.trim() || draft.title.trim())
      setConvertGrade(draft.grade ? `${draft.grade} класс` : '')
      setConvertDue('')
    }
  }, [modal, draft.topic, draft.title, draft.grade])

  const canConvert = convertTitle.trim().length > 0

  return (
    <>
      <ModalShell open={modal === 'convert'} onClose={onClose} width={560}>
        <div className="modal-pad">
          <div className="modal-title-row">
            <h2>Преобразовать в задание</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>
          <p className="modal-desc">
            Рабочий лист «{materialName}» станет заданием для выдачи ученикам.
          </p>
          <Field label="Название задания" required>
            <Input value={convertTitle} onChange={(e) => setConvertTitle(e.target.value)} />
          </Field>
          <div className="modal-row">
            <Field label="Класс">
              <Select
                options={GRADES.map((g) => `${g} класс`)}
                value={convertGrade}
                onChange={(e) => setConvertGrade(e.target.value)}
              />
            </Field>
            <Field label="Срок сдачи">
              <Input type="date" value={convertDue} onChange={(e) => setConvertDue(e.target.value)} />
            </Field>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="brand" size="lg" disabled={!canConvert} onClick={onConfirmConvert}>
              Преобразовать
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={modal === 'convert-success'} onClose={onClose} width={440}>
        <div className="modal-pad center">
          <div className="success-ico">
            <Icon name="check" size={28} />
          </div>
          <h2>Задание создано</h2>
          <p className="modal-desc">Рабочий лист преобразован в задание.</p>
          <div className="modal-actions center">
            <Button variant="brand" size="lg" onClick={onClose}>
              Готово
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={modal === 'settings'} onClose={onClose} width={520}>
        <div className="modal-pad">
          <div className="modal-title-row">
            <h2>Настройки рабочего листа</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>
          <Field label="Тема рабочего листа">
            <Input
              value={draft.topic}
              onChange={(e) => {
                const topic = e.target.value
                onChangeDraft({ ...draft, topic, title: topic })
              }}
            />
          </Field>
          <div className="modal-row">
            <Field label="Предмет">
              <Select
                options={SUBJECTS}
                value={draft.subject}
                onChange={(e) => onChangeDraft({ ...draft, subject: e.target.value })}
              />
            </Field>
            <Field label="Параллель">
              <Select
                options={GRADES}
                value={draft.grade}
                onChange={(e) => onChangeDraft({ ...draft, grade: e.target.value })}
              />
            </Field>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={draft.showDifficulty}
              onChange={(e) => onChangeDraft({ ...draft, showDifficulty: e.target.checked })}
            />
            Показывать уровень сложности заданий
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={draft.showAnswers}
              onChange={(e) => onChangeDraft({ ...draft, showAnswers: e.target.checked })}
            />
            Показывать правильные ответы
          </label>
          <div className="modal-actions">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="brand" size="lg" onClick={onClose}>
              Сохранить
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={modal === 'download'} onClose={onClose} width={520} className="download-modal">
        <div className="modal-pad">
          <div className="modal-title-row">
            <h2>Подготовка к печати</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>

          <div className="print-section">
            <h3>Размещение</h3>
            <label className="radio-row">
              <input
                type="radio"
                name="placement"
                checked={!draft.print.answersSeparate}
                onChange={() =>
                  onChangeDraft({
                    ...draft,
                    print: { ...draft.print, answersSeparate: false },
                  })
                }
              />
              Печать всех материалов на одном листе
            </label>
            <label className="radio-row">
              <input
                type="radio"
                name="placement"
                checked={draft.print.answersSeparate}
                onChange={() =>
                  onChangeDraft({
                    ...draft,
                    print: { ...draft.print, answersSeparate: true },
                  })
                }
              />
              Вынести ответы на отдельный лист
            </label>
          </div>

          <div className="modal-row">
            <Field label="Количество копий">
              <Input
                type="number"
                min={1}
                max={50}
                value={draft.print.copies}
                onChange={(e) =>
                  onChangeDraft({
                    ...draft,
                    print: { ...draft.print, copies: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
              />
            </Field>
            <Field label="Ориентация">
              <Select
                options={['Книжная', 'Альбомная']}
                value={draft.print.orientation === 'portrait' ? 'Книжная' : 'Альбомная'}
                onChange={(e) =>
                  onChangeDraft({
                    ...draft,
                    print: {
                      ...draft.print,
                      orientation: e.target.value === 'Альбомная' ? 'landscape' : 'portrait',
                    },
                  })
                }
              />
            </Field>
          </div>

          <div className="modal-actions">
            <Button variant="secondary" size="lg" onClick={() => onExportPdf?.()}>
              PDF
            </Button>
            <Button variant="secondary" size="lg" onClick={() => onExportDocx?.()}>
              DOCX
            </Button>
            <Button variant="secondary" size="lg" onClick={onSave}>
              Сохранить
            </Button>
            <Button variant="brand" size="lg" onClick={onPrint}>
              Распечатать
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={modal === 'menu'} onClose={onClose} width={360} className="menu-modal">
        <div className="menu-list">
          <button type="button" onClick={() => onOpen('settings')}>
            <Icon name="gear" /> Настройки
          </button>
          <button type="button" onClick={() => onOpen('regenerate')}>
            <Icon name="refresh" /> Перегенерировать
          </button>
          <button type="button" onClick={() => onOpen('duplicate')}>
            <Icon name="copy" /> Дублировать
          </button>
          <button type="button" onClick={() => onOpen('download')}>
            <Icon name="download" /> Скачать / печать
          </button>
          <button type="button" className="danger" onClick={() => onOpen('delete')}>
            <Icon name="trash" /> Удалить
          </button>
        </div>
      </ModalShell>

      <ModalShell open={modal === 'duplicate'} onClose={onClose} width={440}>
        <div className="modal-pad">
          <div className="modal-title-row">
            <h2>Дублировать рабочий лист?</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>
          <p className="modal-desc">Будет создана копия «{materialName}».</p>
          <div className="modal-actions">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="brand" size="lg" onClick={onConfirmDuplicate}>
              Дублировать
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={modal === 'delete'} onClose={onClose} width={440}>
        <div className="modal-pad">
          <div className="modal-title-row">
            <h2>Удалить рабочий лист?</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>
          <p className="modal-desc">«{materialName}» будет удалён безвозвратно.</p>
          <div className="modal-actions">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="danger" size="lg" onClick={onConfirmDelete}>
              Удалить
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={modal === 'delete-page'} onClose={onClose} width={440}>
        <div className="modal-pad">
          <div className="modal-title-row">
            <h2>Удалить страницу {deletePageIndex !== null && deletePageIndex !== undefined ? deletePageIndex + 1 : ''}?</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>
          <p className="modal-desc">
            На странице есть блоки. Страница и всё её содержимое будут удалены безвозвратно.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="danger" size="lg" onClick={onConfirmDeletePage}>
              Удалить страницу
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={modal === 'regenerate' || modal === 'regenerate-empty-topic'}
        onClose={onClose}
        width={432}
      >
        <div className="modal-pad">
          <div className="modal-title-row">
            <h2>Перегенерация рабочего листа</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>
          <p className="modal-desc">Текущее содержимое будет заменено новой генерацией.</p>
          <Field label="Тема" required>
            <Input
              value={draft.topic}
              placeholder="Укажите тему"
              onChange={(e) => onChangeDraft({ ...draft, topic: e.target.value, title: e.target.value })}
            />
          </Field>
          <Field label="Пожелания">
            <Textarea
              value={draft.additionalWishes}
              placeholder="Что изменить: сложность, типы заданий, акценты..."
              maxLength={ADDITIONAL_WISHES_MAX_LENGTH}
              counter={`${draft.additionalWishes.length}/${ADDITIONAL_WISHES_MAX_LENGTH}`}
              onChange={(e) => onChangeDraft({ ...draft, additionalWishes: e.target.value })}
            />
          </Field>
          {!draft.topic.trim() ? (
            <p className="error-note">Укажите тему, чтобы запустить перегенерацию</p>
          ) : null}
          <div className="modal-actions">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="brand" size="lg" disabled={!draft.topic.trim()} onClick={onConfirmRegenerate}>
              Перегенерировать
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={modal === 'generate-task'} onClose={onClose} width={480}>
        <div className="modal-pad">
          <div className="modal-title-row">
            <h2>Сгенерировать задание</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>
          <p className="modal-desc">
            Добавит одно новое задание в текущий рабочий лист без полной перегенерации.
          </p>
          <Field label="Тип задания">
            <Select
              options={PLAN_TASK_TYPES.map((t) => t.label)}
              value={labelForType(generateTaskType)}
              onChange={(e) => {
                const found = PLAN_TASK_TYPES.find((t) => t.label === e.target.value)
                if (found) onGenerateTaskType(found.type)
              }}
            />
          </Field>
          <Field label="Пожелание к заданию">
            <Textarea
              value={generateTaskHint}
              placeholder="Решить квадратное уравнение / проверить типичные ошибки"
              maxLength={200}
              counter={`${generateTaskHint.length}/200`}
              onChange={(e) => onGenerateTaskHint(e.target.value)}
            />
          </Field>
          <div className="modal-actions">
            <Button variant="secondary" size="lg" onClick={onClose} disabled={generateTaskBusy}>
              Отмена
            </Button>
            <Button variant="brand" size="lg" onClick={onConfirmGenerateTask} disabled={generateTaskBusy}>
              {generateTaskBusy ? 'Генерация…' : 'Сгенерировать'}
            </Button>
          </div>
        </div>
      </ModalShell>

      {modal === 'toast' && toastMessage ? (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      ) : null}
    </>
  )
}
