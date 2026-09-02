import type { Modal, Screen } from '@/data/worksheet'
import './PrototypeNav.css'

const SCREENS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'worksheets-list', label: 'Рабочие листы' },
  { id: 'coming-soon', label: 'Coming soon' },
  { id: 'create', label: 'Создание' },
  { id: 'create-advanced', label: 'Создание · расширенные' },
  { id: 'create-filled', label: 'Создание · заполнено' },
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

interface PrototypeNavProps {
  screen: Screen
  onScreen: (screen: Screen) => void
  onModal: (modal: Modal) => void
}

export function PrototypeNav({ screen, onScreen, onModal }: PrototypeNavProps) {
  return (
    <details className="proto-nav">
      <summary>Экраны макета</summary>
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
      </div>
    </details>
  )
}
