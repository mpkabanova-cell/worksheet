import { Button, Field, Select } from '@/components/ui'
import type { WorksheetDraft } from '@/data/worksheet'
import './Print.css'

interface PrintScreenProps {
  draft: WorksheetDraft
  onChangeDraft: (draft: WorksheetDraft) => void
  onBack: () => void
  onPrint: () => void
  onPdf: () => void
}

export function PrintScreen({ draft, onChangeDraft, onBack, onPrint, onPdf }: PrintScreenProps) {
  return (
    <div className="print-page">
      <header className="print-head">
        <nav className="print-crumb">
          <button type="button" onClick={onBack}>
            Назад к предпросмотру
          </button>
        </nav>
        <h1>Печать рабочего листа</h1>
        <p>«{draft.title || 'Без названия'}»</p>
      </header>

      <div className="print-settings">
        <label className="print-check">
          <input
            type="checkbox"
            checked={draft.print.answersSeparate}
            onChange={(e) =>
              onChangeDraft({
                ...draft,
                print: { ...draft.print, answersSeparate: e.target.checked },
              })
            }
          />
          Ответы на отдельном листе
        </label>

        <div className="print-row">
          <Field label="Количество копий">
            <Select
              options={['1', '2', '3', '4', '5']}
              value={String(draft.print.copies)}
              onChange={(e) =>
                onChangeDraft({
                  ...draft,
                  print: { ...draft.print, copies: Number(e.target.value) || 1 },
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
                    orientation: e.target.value === 'Книжная' ? 'portrait' : 'landscape',
                  },
                })
              }
            />
          </Field>
        </div>
      </div>

      <div className="print-preview-note">
        <p>Предпросмотр соответствует макету «Печать». PDF-экспорт пока недоступен.</p>
      </div>

      <div className="print-actions">
        <Button variant="secondary" onClick={onPdf}>
          Скачать PDF
        </Button>
        <Button variant="brand" onClick={onPrint}>
          Распечатать
        </Button>
      </div>
    </div>
  )
}
