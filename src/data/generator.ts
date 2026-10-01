import type { DifficultyMode, PlanTask, TaskType, WorksheetBlock, WorksheetDraft } from './worksheet'
import { labelForType, uid } from './worksheet'
import { resizePlanToTaskCount } from './taskPlanOrchestration'
import { createDefaultGroupingTableFields, defaultAnswerHeight, defaultAnswerStyle, groupsToTableFields } from './blockUtils'
import { expectationToQuestion, fillGapsPayloadFromPlanBrief } from './taskContent'
import { fromSpecMechanic, normalizeDifficultyMode, planDifficultyToStars } from './planMechanics'

function starsForIndex(i: number, mode: DifficultyMode, total: number): 1 | 2 | 3 {
  return planDifficultyToStars(null, normalizeDifficultyMode(mode), i, total)
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
    case 'fill_gaps': {
      const gaps = fillGapsPayloadFromPlanBrief(expectation, topic)
      return {
        ...base,
        instruction: '',
        question: gaps.question,
        gapsText: gaps.gaps_text,
        gapsAnswers: gaps.gaps_answers,
      }
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
    case 'grouping': {
      const groups = [
        { title: 'Группа A', items: ['Пример 1', 'Пример 2'] },
        { title: 'Группа B', items: ['Пример 3', 'Пример 4'] },
      ]
      return {
        ...base,
        instruction: '',
        question: expectation || `Распределите элементы по группам в рамках темы «${topic}».`,
        ...groupsToTableFields(groups),
        tableShowAnswerBank: true,
        tableShuffleAnswers: true,
      }
    }
    case 'ordering':
      return {
        ...base,
        instruction: '',
        question: expectation || `Порядок действий по теме «${topic}».`,
        orderItems: ['Шаг 1', 'Шаг 2', 'Шаг 3', 'Шаг 4'],
        orderShuffle: true,
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
        type: 'grouping',
        question: expectation || `Распределите элементы по группам.`,
        ...createDefaultGroupingTableFields(),
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
  const count = Math.min(15, Math.max(1, draft.taskCount || draft.taskPlan.length || 5))
  const plan: PlanTask[] =
    draft.taskPlan.length === count
      ? draft.taskPlan
      : resizePlanToTaskCount(draft.taskPlan, count)

  const blocks = plan.map((p, i) =>
    blockForType(
      fromSpecMechanic(p.type ?? 'input', p.description),
      i,
      { ...draft, taskCount: count },
      p.userDescription,
    ),
  )

  const intro = draft.showIntro
    ? draft.intro ||
      `Тема «${draft.topic}» (${draft.subject}, ${draft.grade} класс). Задания расположены от простых к более сложным.`
    : ''

  return {
    ...draft,
    id: draft.id || uid('ws'),
    taskCount: count,
    taskPlan: plan,
    title: draft.topic.trim() || draft.title.trim() || 'Без названия',
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
        question: 'Распределите элементы по группам',
        ...createDefaultGroupingTableFields(),
      }
    case 'ordering':
      return {
        ...base,
        instruction: '',
        question: 'Восстанови последовательность',
        orderItems: ['', '', '', '', ''],
        orderShuffle: true,
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
        type: 'grouping',
        question: 'Распределите элементы по группам',
        ...createDefaultGroupingTableFields(),
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
