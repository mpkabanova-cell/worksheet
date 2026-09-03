import type { DifficultyMode, PlanTask, TaskType, WorksheetBlock, WorksheetDraft } from './worksheet'
import { createPlan, labelForType, uid } from './worksheet'
import { defaultAnswerHeight, defaultAnswerStyle } from './blockUtils'
import { expectationToQuestion } from './taskContent'

function starsForIndex(i: number, mode: DifficultyMode, total: number): 1 | 2 | 3 {
  if (mode === 'starter') return 1
  if (mode === 'basic') return 2
  if (mode === 'advanced') return 3
  const t = Math.max(total - 1, 1)
  if (i / t < 0.34) return 1
  if (i / t < 0.67) return 2
  return 3
}

function makeOptions(texts: string[]): { id: string; text: string }[] {
  return texts.map((text, i) => ({ id: `option_${i + 1}`, text }))
}

function blockForType(
  type: TaskType,
  index: number,
  draft: WorksheetDraft,
  expectation: string,
): WorksheetBlock {
  const topic = draft.topic || 'тема'
  const subject = draft.subject || 'предмет'
  const n = index + 1
  const difficulty = starsForIndex(index, draft.difficulty, draft.taskCount)
  const base = {
    id: uid('task'),
    type,
    page: 0,
    title: `Задание ${n}`,
    difficulty,
  }

  switch (type) {
    case 'short_answer':
      return {
        ...base,
        instruction: '',
        question:
          expectation ||
          (subject === 'Математика'
            ? `Вычисли значение выражения по теме «${topic}».`
            : `Кратко ответь: что главное нужно запомнить по теме «${topic}»?`),
        correctAnswers: subject === 'Математика' ? ['2/3'] : ['Правило / термин'],
        answerAreaStyle: defaultAnswerStyle(subject),
        answerLines: defaultAnswerHeight(defaultAnswerStyle(subject)),
      }
    case 'single_choice':
      return {
        ...base,
        instruction: '',
        question: expectation || `Верное утверждение по теме «${topic}».`,
        options: makeOptions([
          'Вариант A — верный',
          'Вариант B',
          'Вариант C',
          'Вариант D',
        ]),
        correctOptionId: 'option_1',
        choiceOptionFormat: 'text',
        choiceOptionCount: 4,
        choiceShuffle: false,
      }
    case 'multiple_choice':
      return {
        ...base,
        instruction: '',
        question: expectation || `Верные утверждения по теме «${topic}».`,
        options: makeOptions([
          'Верное утверждение 1',
          'Неверное утверждение',
          'Верное утверждение 2',
          'Неверное утверждение 2',
        ]),
        correctOptionIds: ['option_1', 'option_3'],
        choiceOptionFormat: 'text',
        choiceOptionCount: 4,
        choiceShuffle: false,
      }
    case 'fill_gaps':
      return {
        ...base,
        instruction: '',
        question:
          expectationToQuestion(expectation) || `Заполните пропуски по теме «${topic}».`,
        gapsText: `По теме «${topic}» важно помнить: ___ — это основа, а ___ помогает проверить результат.`,
        gapsAnswers: ['правило', 'пример'],
      }
    case 'matching':
      return {
        ...base,
        instruction: '',
        question:
          expectationToQuestion(expectation) ||
          `Сопоставьте понятия и определения по теме «${topic}».`,
        leftItems: [
          { id: 'left_1', text: 'Понятие 1' },
          { id: 'left_2', text: 'Понятие 2' },
          { id: 'left_3', text: 'Понятие 3' },
        ],
        rightItems: [
          { id: 'right_1', text: 'Определение A' },
          { id: 'right_2', text: 'Определение B' },
          { id: 'right_3', text: 'Определение C' },
        ],
        correctAnswers: ['left_1→right_1', 'left_2→right_2', 'left_3→right_3'],
      }
    case 'grouping':
      return {
        ...base,
        instruction: '',
        question: expectation || `Примеры по группам в рамках темы «${topic}».`,
        groups: [
          { id: 'g1', title: 'Группа A', items: ['Пример 1', 'Пример 2'] },
          { id: 'g2', title: 'Группа B', items: ['Пример 3', 'Пример 4'] },
        ],
        correctAnswers: ['Группа A: Пример 1, Пример 2'],
      }
    case 'ordering':
      return {
        ...base,
        instruction: '',
        question: expectation || `Порядок действий по теме «${topic}».`,
        orderItems: ['Шаг 1', 'Шаг 2', 'Шаг 3', 'Шаг 4'],
        correctAnswers: ['Шаг 1 → Шаг 2 → Шаг 3 → Шаг 4'],
      }
    case 'extended_answer':
      return {
        ...base,
        instruction: '',
        question:
          expectation ||
          `Как применять знания по теме «${topic}». Привести пример.`,
        answerAreaStyle: defaultAnswerStyle(subject),
        answerLines: defaultAnswerHeight(defaultAnswerStyle(subject)),
        correctAnswers: ['Образец рассуждения преподавателя'],
      }
    case 'text':
      return {
        ...base,
        title: 'Текст',
        body: expectation || `Краткий текстовый блок по теме «${topic}».`,
      }
    case 'answer_field':
      return {
        ...base,
        title: 'Поле для ответа',
        question: 'Место для записи ответа ученика',
        answerLines: 4,
      }
    case 'table':
      return {
        ...base,
        title: 'Таблица',
        question: expectation || `Заполни таблицу по теме «${topic}».`,
        body: '3×3',
      }
    case 'page_break':
      return { ...base, title: 'Разрыв страницы' }
    default:
      return {
        ...base,
        question: `Задание по теме «${topic}»`,
        answerLines: defaultAnswerHeight('lines'),
      }
  }
}

export function generateWorksheet(draft: WorksheetDraft): WorksheetDraft {
  const count = Math.min(15, Math.max(1, draft.taskCount || draft.plan.length || 5))
  const plan: PlanTask[] =
    draft.plan.length === count
      ? draft.plan
      : createPlan(
          count,
          draft.plan.map((p) => p.taskType),
        )

  const blocks = plan.map((p, i) =>
    blockForType(p.taskType, i, { ...draft, taskCount: count }, p.userExpectation),
  )

  const intro = draft.addIntro
    ? draft.intro ||
      `Тема «${draft.topic}» (${draft.subject}, ${draft.grade} класс). Задания расположены от простых к более сложным.`
    : ''

  return {
    ...draft,
    id: draft.id || uid('ws'),
    taskCount: count,
    plan,
    title: draft.topic || draft.title || 'Рабочий лист',
    intro,
    blocks,
    pages: 1,
    savedAt: undefined,
  }
}

export function generateSingleTask(
  draft: WorksheetDraft,
  taskType: TaskType,
  expectation = '',
): WorksheetBlock {
  const index = draft.blocks.filter((b) => b.type !== 'page_break' && b.type !== 'text').length
  return blockForType(taskType, index, draft, expectation)
}

export function createEmptyBlock(type: TaskType, page = 0, subject = ''): WorksheetBlock {
  const label = labelForType(type)
  const id = uid('block')
  const base: WorksheetBlock = { id, type, page, title: label }

  switch (type) {
    case 'short_answer':
      return {
        ...base,
        instruction: '',
        question: 'Введите условие…',
        correctAnswers: [''],
        answerAreaStyle: defaultAnswerStyle(subject),
        answerLines: defaultAnswerHeight(defaultAnswerStyle(subject)),
      }
    case 'single_choice':
      return {
        ...base,
        instruction: '',
        question: 'Введите вопрос…',
        options: makeOptions(['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4']),
        correctOptionId: 'option_1',
        choiceOptionFormat: 'text',
        choiceOptionCount: 4,
        choiceShuffle: false,
      }
    case 'multiple_choice':
      return {
        ...base,
        instruction: '',
        question: 'Введите вопрос…',
        options: makeOptions(['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4']),
        correctOptionIds: ['option_1'],
        choiceOptionFormat: 'text',
        choiceOptionCount: 4,
        choiceShuffle: false,
      }
    case 'fill_gaps':
      return {
        ...base,
        instruction: '',
        question: 'Приведите линейное уравнение к виду y = kx + b, заполнив пропуски:',
        gapsSourceText:
          'Наступило теплое лето. Яркое солнце согревает землю своими лучами. В лесу громко поют птицы, а на полянах распускаются дикие цветы. Дети весело бегут к реке, чтобы искупаться в прохладной воде. Они строят большие замки из песка и собирают красивые ракушки у берега.',
        gapsAnswers: ['лето', 'землю', 'птицы', 'цветы', 'реке', 'воде', 'песка'],
        gapsShuffleAnswers: false,
      }
    case 'matching':
      return {
        ...base,
        instruction: '',
        question: 'Сопоставь элементы',
        leftItems: [
          { id: 'left_1', text: '' },
          { id: 'left_2', text: '' },
        ],
        rightItems: [
          { id: 'right_1', text: '' },
          { id: 'right_2', text: '' },
        ],
        matchingPairCount: 2,
        matchingLeftFormat: 'text',
        matchingRightFormat: 'text',
        matchingShuffleRight: true,
      }
    case 'grouping':
      return {
        ...base,
        instruction: '',
        question: 'Раздели на группы',
        groups: [
          { id: 'g1', title: 'Группа 1', items: ['Элемент A'] },
          { id: 'g2', title: 'Группа 2', items: ['Элемент B'] },
        ],
      }
    case 'ordering':
      return {
        ...base,
        instruction: '',
        question: 'Восстанови последовательность',
        orderItems: ['Первый', 'Второй', 'Третий'],
      }
    case 'extended_answer':
      return {
        ...base,
        instruction: '',
        question: 'Введите вопрос…',
        answerAreaStyle: defaultAnswerStyle(subject),
        answerLines: defaultAnswerHeight(defaultAnswerStyle(subject)),
      }
    case 'text':
      return { ...base, body: 'Введите текст…' }
    case 'answer_field':
      return {
        ...base,
        mediaKind: 'link',
      }
    case 'table':
      return {
        ...base,
        question: 'Заполни таблицу',
        tableRows: 3,
        tableCols: 3,
        tableCells: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')),
        tableHeaders: ['Группа 1', 'Группа 2', 'Группа 3'],
        tableAnswerBank: [],
        tableShowAnswerBank: false,
        tableShuffleAnswers: false,
      }
    case 'page_break':
      return { ...base, title: 'Разрыв страницы' }
    default:
      return base
  }
}

export function createManualWorksheet(draft: WorksheetDraft): WorksheetDraft {
  return {
    ...draft,
    id: draft.id || uid('ws'),
    title: draft.topic || 'Новый рабочий лист',
    intro: '',
    blocks: [
      createEmptyBlock('text', 0, draft.subject),
      createEmptyBlock('short_answer', 0, draft.subject),
    ],
    pages: 1,
  }
}
