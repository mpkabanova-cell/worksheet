import logoSign from '@/assets/logo-sign.svg'
import logoName from '@/assets/logo-name.svg'
import helperOrb from '@/assets/helper-orb.png'
import avatar from '@/assets/avatar.png'
import iconDesk from '@/assets/sidebar/desk.svg'
import iconMaterials from '@/assets/sidebar/materials.svg'
import iconCalendar from '@/assets/sidebar/calendar.svg'
import iconQuiz from '@/assets/sidebar/quiz.svg'
import iconAnalysis from '@/assets/sidebar/analysis.svg'
import iconResults from '@/assets/sidebar/results.svg'
import iconRatings from '@/assets/sidebar/ratings.svg'
import iconTools from '@/assets/sidebar/tools.svg'
import iconPlus from '@/assets/sidebar/plus.svg'
import iconArrowUpRight from '@/assets/sidebar/arrow-up-right.svg'
import iconExpand from '@/assets/sidebar/expand.svg'
import type { NavId } from '@/data/worksheet'
import { Button } from '@/components/ui'
import './Sidebar.css'

type NavItem = {
  id: NavId
  label: string
  icon?: string
  orb?: boolean
  trail?: 'plus' | 'external'
}

const PREP: NavItem[] = [
  { id: 'desk', label: 'Рабочий стол', icon: iconDesk },
  { id: 'ai', label: 'ИИ-помощник', orb: true },
  { id: 'materials', label: 'Библиотека заданий', icon: iconMaterials, trail: 'plus' },
]

const CONDUCT: NavItem[] = [
  { id: 'schedule', label: 'Расписание', icon: iconCalendar },
  { id: 'quiz', label: 'Викторины', icon: iconQuiz, trail: 'external' },
  { id: 'students', label: 'Мои ученики', icon: iconResults },
]

const ANALYSIS: NavItem[] = [
  { id: 'ai-check', label: 'ИИ-проверка заданий', icon: iconAnalysis },
  { id: 'results', label: 'Результаты учеников', icon: iconResults },
  { id: 'analysis', label: 'Анализ уроков', icon: iconAnalysis, trail: 'plus' },
  { id: 'stats', label: 'Статистика', icon: iconAnalysis },
  { id: 'ratings', label: 'Рейтинги', icon: iconRatings },
]

interface SidebarProps {
  activeId: NavId
  onNavigate: (id: NavId) => void
  onSoon?: (message: string) => void
}

export function Sidebar({ activeId, onNavigate, onSoon }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand">
          <img src={logoSign} alt="" className="brand-sign" width={32} height={32} />
          <img src={logoName} alt="Ассистент Преподавателя" className="brand-name" height={20} />
        </div>
        <button className="collapse-btn" aria-label="Свернуть меню" type="button">
          <img src={iconExpand} alt="" width={24} height={24} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <Section title="Подготовка к уроку" items={PREP} activeId={activeId} onNavigate={onNavigate} />
        <Section title="Проведение урока" items={CONDUCT} activeId={activeId} onNavigate={onNavigate} />
        <Section title="Анализ результатов" items={ANALYSIS} activeId={activeId} onNavigate={onNavigate} />
      </nav>

      <div className="sidebar-bottom">
        <div className="nav-section-spacer" />
        <button
          className={`nav-item tools ${activeId === 'tools' ? 'active' : ''}`}
          type="button"
          onClick={() => onNavigate('tools')}
        >
          <img src={iconTools} alt="" className="nav-ico-img" width={20} height={20} />
          <span className="nav-label">Инструменты</span>
          <span className="beta">beta</span>
        </button>

        <div className="tariff">
          <div className="tariff-row">
            <span>Генераций в день: 5/5</span>
            <div className="bar">
              <i style={{ width: '100%' }} />
            </div>
          </div>
          <div className="tariff-row">
            <span>Минут в месяц: 10/10</span>
            <div className="bar">
              <i style={{ width: '100%' }} />
            </div>
          </div>
          <Button variant="secondary" size="sm" className="tariff-btn" onClick={() => onSoon?.('Увеличение лимита скоро')}>
            Увеличить
          </Button>
        </div>

        <button className="profile" type="button">
          <img src={avatar} alt="" width={40} height={40} />
          <div>
            <strong>Павел Ларичев</strong>
            <span>Роль</span>
          </div>
        </button>
      </div>
    </aside>
  )
}

function Section({
  title,
  items,
  activeId,
  onNavigate,
}: {
  title: string
  items: NavItem[]
  activeId: NavId
  onNavigate: (id: NavId) => void
}) {
  return (
    <div className="nav-section">
      <div className="nav-section-title">{title}</div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-item ${activeId === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          {item.orb ? (
            <img src={helperOrb} alt="" className="nav-orb" width={20} height={20} />
          ) : item.icon ? (
            <img src={item.icon} alt="" className="nav-ico-img" width={20} height={20} />
          ) : null}
          <span className="nav-label">{item.label}</span>
          {item.trail === 'plus' ? (
            <img src={iconPlus} alt="" className="nav-trail" width={20} height={20} />
          ) : null}
          {item.trail === 'external' ? (
            <img src={iconArrowUpRight} alt="" className="nav-trail" width={20} height={20} />
          ) : null}
        </button>
      ))}
    </div>
  )
}
