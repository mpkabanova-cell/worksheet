import type { BlockPreviewState, Modal, Screen } from '@/data/worksheet'
import './PrototypeNav.css'

const SCREENS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'worksheets-list', label: 'Рабочие листы' },
  { id: 'coming-soon', label: 'Coming soon' },
  { id: 'create', label: 'Создание' },
  { id: 'create-advanced', label: 'Создание · расширенные' },
  { id: 'create-filled', label: 'Создание · заполненное' },
  { id: 'loader', label: 'Лоадер' },
  { id: 'preview', label: 'Предпросмотр' },
  { id: 'edit', label: 'Редактирование' },
  { id: 'edit-widget', label: 'Редактор блока' },
  { id: 'add-block', label: 'Добавить блок' },
  { id: 'show-answers', label: 'Показать ответы' },
  { id: 'print', label: 'Печать' },
]

const MODALS: { id: Exclude<Modal, null>; label: string }[] = [
  { id: 'convert', label: 'Преобразовать' },
  { id: 'convert-success', label: 'Задание создано' },
  { id: 'settings', label: 'Настройки' },
  { id: 'menu', label: 'Меню ···' },
  { id: 'download', label: 'Скачать / печать' },
  { id: 'generate-task', label: 'Сгенерировать задание' },
  { id: 'duplicate', label: 'Дублировать' },
  { id: 'delete', label: 'Удалить' },
  { id: 'delete-page', label: 'Удалить страницу' },
  { id: 'regenerate', label: 'Перегенерация' },
  { id: 'regenerate-empty-topic', label: 'Переген. без темы' },
]

const BLOCK_PREVIEW_STATES: { id: BlockPreviewState; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'active', label: 'Active' },
  { id: 'show-answer', label: 'Show answer' },
  { id: 'issued', label: 'Выдано' },
]

interface PrototypeNavProps {
  screen: Screen
  onScreen: (screen: Screen) => void
  onModal: (modal: Modal) => void
  blockPreviewState: BlockPreviewState | null
  onBlockPreviewState: (state: BlockPreviewState | null) => void
  hidden?: boolean
}

export function PrototypeNav({
  screen,
  onScreen,
  onModal,
  blockPreviewState,
  onBlockPreviewState,
  hidden = false,
}: PrototypeNavProps) {
  if (hidden) return null

  const worksheetScreen =
    screen === 'preview' ||
    screen === 'edit' ||
    screen === 'edit-widget' ||
    screen === 'add-block' ||
    screen === 'show-answers'

  return (
    <details className="proto-nav">
      <summary aria-label="Экраны макета">
        <span className="proto-nav-icon" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
        <span className="proto-nav-title">Экраны макета</span>
      </summary>
      <div className="proto-body">
        <p>Экраны</p>
        <div className="proto-list">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={screen === s.id ? 'active' : ''}
              onClick={() => onScreen(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p>Модалки</p>
        <div className="proto-list">
          {MODALS.map((m) => (
            <button key={m.id} type="button" onClick={() => onModal(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {worksheetScreen ? (
          <>
            <p>Блок «Ввод ответа»</p>
            <label className="proto-select-row">
              <span>Состояние</span>
              <select
                value={blockPreviewState ?? ''}
                onChange={(e) =>
                  onBlockPreviewState(
                    e.target.value ? (e.target.value as BlockPreviewState) : null,
                  )
                }
              >
                <option value="">Авто</option>
                {BLOCK_PREVIEW_STATES.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>
    </details>
  )
}
