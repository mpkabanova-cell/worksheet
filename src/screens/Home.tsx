import { useState } from 'react'
import helperOrb from '@/assets/helper-orb.png'
import cardTask from '@/assets/card-create-task.png'
import cardWorksheet from '@/assets/card-worksheet.png'
import cardTest from '@/assets/card-test.png'
import cardPlan from '@/assets/card-plan.png'
import quiz1 from '@/assets/quiz-thumb-1.png'
import quiz2 from '@/assets/quiz-thumb-2.png'
import arrowUpRight from '@/assets/arrow-up-right.svg'
import arrowRight from '@/assets/arrow-right.svg'
import { Button } from '@/components/ui'
import './Home.css'

const MAIN_TABS = ['Подготовка к уроку', 'Проведение урока', 'Анализ результатов'] as const

const MATERIAL_CARDS = [
  { title: 'Задание', img: cardTask },
  { title: 'Презентация', img: cardPlan },
  { title: 'Рабочий лист', img: cardWorksheet, action: 'worksheet' as const },
  { title: 'Мотивирующее задание', img: cardTest },
]

const PROMPTS = [
  'Подготовь сценарий урока',
  'Объясни материал простыми словами',
  'Найди межпредметные связи',
  'Составь план первого занятия',
]

const EXPERIMENTS = [
  'Текст с ошибками',
  'Интерактивные карточки',
  'Образовательная инфографика',
  'План урока',
  'Конспект / синопсис',
]

const QUIZZES = [
  { title: 'Уроки со всего света', count: '10 вопросов', img: quiz1 },
  {
    title: 'Физика вокруг нас: проверь свои знания (автор Семенова С.Н.)',
    count: '9 вопросов',
    img: quiz2,
  },
  { title: 'Атомный ледокольный флот России', count: '8 вопросов', img: quiz1 },
]

interface HomeProps {
  onCreateWorksheet: () => void
  onSoon?: (message: string) => void
}

export function Home({ onCreateWorksheet, onSoon }: HomeProps) {
  const [tab, setTab] = useState<(typeof MAIN_TABS)[number]>('Подготовка к уроку')

  const soon = (msg = 'Скоро') => onSoon?.(msg)

  return (
    <div className="home page-pad">
      <section className="hero">
        <div className="hero-input-wrap">
          <img src={helperOrb} alt="" className="hero-orb" width={32} height={32} />
          <input
            className="hero-input"
            placeholder="Например, подготовь тест по теме русский авангард"
            onFocus={() => soon('ИИ-помощник на главной скоро')}
          />
          <button type="button" className="hero-send" aria-label="Отправить" onClick={() => soon()}>
            <img src={arrowRight} alt="" width={20} height={20} />
          </button>
        </div>

        <div className="main-tabs">
          {MAIN_TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`main-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {tab === 'Подготовка к уроку' ? (
        <>
          <section className="block">
            <div className="block-head">
              <h2>Создание материалов для урока</h2>
            </div>
            <div className="material-cards">
              {MATERIAL_CARDS.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  className="material-card"
                  onClick={() => (card.action === 'worksheet' ? onCreateWorksheet() : soon())}
                >
                  <div className="material-img">
                    <img src={card.img} alt="" />
                  </div>
                  <span>{card.title}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="home-widgets">
            <section className="prompt-widget">
              <h3>Библиотека промптов</h3>
              <ul>
                {PROMPTS.map((text) => (
                  <li key={text}>
                    <button type="button" onClick={() => soon()}>
                      {text}
                      <img src={arrowUpRight} alt="" width={16} height={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="experiment-widget">
              <h3>Пространство экспериментов</h3>
              <ul>
                {EXPERIMENTS.map((text) => (
                  <li key={text}>
                    <button type="button" onClick={() => soon()}>
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : null}

      {tab === 'Проведение урока' ? (
        <section className="block">
          <div className="block-head">
            <h2>Викторины</h2>
            <p>Используйте готовые или создавайте новые викторины для проведения интересных уроков</p>
          </div>
          <div className="quiz-widget wide">
            <div className="widget-head">
              <span />
              <button type="button" className="link-btn" onClick={() => soon()}>
                Все викторины
              </button>
            </div>
            <div className="quiz-list">
              {QUIZZES.map((q) => (
                <div key={q.title} className="quiz-row">
                  <div className="quiz-row-main">
                    <img src={q.img} alt="" />
                    <div>
                      <strong>{q.title}</strong>
                      <span>{q.count}</span>
                    </div>
                  </div>
                  <button type="button" className="quiz-ext" aria-label="Открыть" onClick={() => soon()}>
                    <img src={arrowUpRight} alt="" width={20} height={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'Анализ результатов' ? (
        <section className="block">
          <div className="analysis-placeholder">
            <p>Здесь появятся результаты учеников, статистика и рейтинги.</p>
            <Button variant="secondary" onClick={() => soon()}>
              Перейти к аналитике
            </Button>
          </div>
        </section>
      ) : null}

      <footer className="home-footer">
        <div className="home-footer-legals">
          <button type="button" onClick={() => soon()}>
            Политика обработки персональных данных
          </button>
          <button type="button" onClick={() => soon()}>
            Пользовательское соглашение
          </button>
          <span>© 2026, ООО «СберОбразование»</span>
        </div>
        <div className="home-footer-support">
          <p>Есть вопрос или что‑то сломалось?</p>
        </div>
      </footer>
    </div>
  )
}
