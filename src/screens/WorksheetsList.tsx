import { useMemo } from 'react'
import { Button } from '@/components/ui'
import { deleteWorksheet, formatSavedAgo, listSavedWorksheets } from '@/data/worksheet'
import type { SavedWorksheetMeta } from '@/data/worksheet'
import './WorksheetsList.css'

interface WorksheetsListProps {
  refreshKey: number
  onHome: () => void
  onCreate: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export function WorksheetsList({
  refreshKey,
  onHome,
  onCreate,
  onOpen,
  onDelete,
}: WorksheetsListProps) {
  const items = useMemo(() => listSavedWorksheets(), [refreshKey])

  return (
    <div className="ws-list page-pad">
      <nav className="ws-list-crumb" aria-label="Навигация">
        <button type="button" onClick={onHome}>
          Главная
        </button>
        <span>/</span>
        <span className="current">Рабочие листы</span>
      </nav>

      <div className="ws-list-head">
        <div>
          <h1>Рабочие листы</h1>
          <p>Сохранённые материалы для печати и выдачи ученикам</p>
        </div>
        <Button variant="brand" onClick={onCreate}>
          Создать рабочий лист
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="ws-list-empty">
          <p>Пока нет сохранённых рабочих листов. Создайте первый — его можно редактировать и распечатать.</p>
          <Button variant="brand" onClick={onCreate}>
            Создать рабочий лист
          </Button>
        </div>
      ) : (
        <div className="ws-list-grid">
          {items.map((item) => (
            <WorksheetCard
              key={item.id}
              item={item}
              onOpen={() => onOpen(item.id)}
              onDelete={() => {
                deleteWorksheet(item.id)
                onDelete(item.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WorksheetCard({
  item,
  onOpen,
  onDelete,
}: {
  item: SavedWorksheetMeta
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <article className="ws-list-card">
      <div className="ws-list-card-body">
        <h2>{item.title}</h2>
        <p>
          {item.subject || 'Предмет не указан'}
          {item.grade ? ` · ${item.grade} параллель` : ''}
        </p>
        <span className="ws-list-meta">{formatSavedAgo(item.savedAt)}</span>
      </div>
      <div className="ws-list-card-actions">
        <Button variant="brand" size="sm" onClick={onOpen}>
          Открыть
        </Button>
        <Button variant="secondary" size="sm" onClick={onDelete}>
          Удалить
        </Button>
      </div>
    </article>
  )
}
