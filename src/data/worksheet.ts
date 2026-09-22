export type NavId =
  | 'desk'
  | 'ai'
  | 'materials'
  | 'schedule'
  | 'quiz'
  | 'students'
  | 'ai-check'
  | 'analysis'
  | 'results'
  | 'stats'
  | 'ratings'
  | 'tools'

export type Screen =
  | 'home'
  | 'worksheets-list'
  | 'coming-soon'
  | 'create'
  | 'create-advanced'
  | 'create-filled'
  | 'loader'
  | 'preview'
  | 'edit'
  | 'edit-widget'
  | 'add-block'
  | 'show-answers'
  | 'print'

/** Состояния блока «Ввод ответа» для UI и прототипа. */
export type BlockPreviewState = 'default' | 'hover' | 'active' | 'show-answer' | 'issued'

export type Modal =
  | null
  | 'convert'
  | 'convert-success'
  | 'settings'
  | 'menu'
  | 'download'
  | 'duplicate'
  | 'delete'
  | 'regenerate'
  | 'regenerate-empty-topic'
  | 'generate-task'
  | 'delete-page'
  | 'toast'

/** Типы заданий из спецификации */
export type TaskType =
  | 'short_answer'
  | 'single_choice'
  | 'multiple_choice'
  | 'fill_gaps'
  | 'matching'
  | 'grouping'
  | 'ordering'
  | 'extended_answer'
  | 'text'
  | 'answer_field'
  | 'table'
  | 'page_break'

export type DifficultyMode = 'basic' | 'medium' | 'advanced' | 'differentiated'

/** Уровень сложности одного элемента плана (spec: basic | medium | advanced). */
export type PlanItemDifficulty = 'basic' | 'medium' | 'advanced'

export type AnswerAreaStyle = 'lines' | 'cells' | 'block' | 'axes' | 'number_line' | 'ray'

export type MediaKind = 'link' | 'audio' | 'video' | 'image'

export interface MatchPair {
  id: string
  text: string
  imageData?: string
  imageFileName?: string
}

export type ChoiceOptionFormat = 'text' | 'image' | 'text_image'

export interface ChoiceOption {
  id: string
  text: string
  imageData?: string
  imageFileName?: string
}

export interface WorksheetBlock {
  id: string
  type: TaskType
  page: number
  title: string
  instruction?: string
  question?: string
  body?: string
  options?: ChoiceOption[]
  correctOptionId?: string
  correctOptionIds?: string[]
  /** Формат вариантов: текст, картинка или текст+картинка. */
  choiceOptionFormat?: ChoiceOptionFormat
  /** Количество вариантов (по умолчанию 4). */
  choiceOptionCount?: number
  /** Перемешивать варианты при показе ученику. */
  choiceShuffle?: boolean
  /** Кэш порядка id для student view при shuffle. */
  choiceDisplayOrder?: string[]
  correctAnswers?: string[]
  answerLines?: number
  leftItems?: MatchPair[]
  rightItems?: MatchPair[]
  groups?: { id: string; title: string; items: string[] }[]
  orderItems?: string[]
  /** Перемешивать элементы при показе ученику (после выхода из редактирования). */
  orderShuffle?: boolean
  gapsText?: string
  gapsSourceText?: string
  gapsAnswers?: string[]
  gapsShuffleAnswers?: boolean
  tableRows?: number
  tableCols?: number
  tableCells?: string[][]
  tableHeaders?: string[]
  tableAnswerBank?: string[]
  tableShowAnswerBank?: boolean
  tableShuffleAnswers?: boolean
  orderDisplayItems?: string[]
  /** Индексы orderItems в порядке показа ученику. */
  orderDisplayOrder?: number[]
  matchingDisplayRight?: MatchPair[]
  /** Количество пар сопоставления (2–10). */
  matchingPairCount?: number
  matchingLeftFormat?: ChoiceOptionFormat
  matchingRightFormat?: ChoiceOptionFormat
  /** Перемешивать правую колонку при показе ученику. */
  matchingShuffleRight?: boolean
  answerAreaStyle?: AnswerAreaStyle
  mediaUrl?: string
  mediaFileData?: string
  mediaFileName?: string
  mediaKind?: MediaKind
  difficulty?: 1 | 2 | 3
  /** Задание выдано ученику — блок только для чтения. */
  issued?: boolean
}

export interface PlanTask {
  id: string
  taskType: TaskType
  /** user_description — краткий замысел (учитель или агент планирования). */
  userExpectation: string
  /** Нормализованное описание для агента генерации (заполняет агент планирования). */
  description?: string | null
  /** Индивидуальная сложность элемента плана. */
  planDifficulty?: PlanItemDifficulty | null
}

export interface PrintSettings {
  answersSeparate: boolean
  copies: number
  orientation: 'portrait' | 'landscape'
}

export interface WorksheetDraft {
  id: string
  subject: string
  grade: string
  taskCount: number
  topic: string
  wishes: string
  title: string
  intro: string
  difficulty: DifficultyMode
  showDifficulty: boolean
  showAnswers: boolean
  addIntro: boolean
  /** Лист создан вручную (без генерации) — минимальная шапка на листе. */
  createdManually?: boolean
  plan: PlanTask[]
  blocks: WorksheetBlock[]
  pages: number
  print: PrintSettings
  contextFileName?: string
  contextFileText?: string
  contextFileNote?: string
  savedAt?: string
}

export const SUBJECTS = [
  'Математика',
  'Алгебра',
  'Алгебра и начала математического анализа',
  'Вероятность и статистика',
  'Геометрия',
  'Информатика',
  'Физика',
  'Экономика',
  'Русский язык',
  'Литературное чтение',
  'Родной язык',
  'Литературное чтение на родном языке',
  'Литература',
  'Родная литература',
  'Английский язык',
  'Китайский язык',
  'Немецкий язык',
  'Испанский язык',
  'История',
  'Обществознание',
  'География',
  'Биология',
  'Химия',
  'Естествознание',
  'Экология',
  'Астрономия',
  'Окружающий мир',
  'ОБЖ',
  'Основы безопасности жизнедеятельности',
  'Основы безопасности и защиты Родины',
  'Основы религиозных культур и светской этики',
  'ОДНКР',
  'Право',
  'Россия в мире',
  'Изобразительное искусство',
  'Музыка',
  'Технология',
  'Физическая культура',
  'Другое',
]

export const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'Другое']

export const TASK_COUNTS = Array.from({ length: 15 }, (_, i) => String(i + 1))

/** Максимальная длина поля «Пожелания» (Create, перегенерация, промпты). */
export const WISHES_MAX_LENGTH = 2000

export const TASK_TYPE_META: {
  type: TaskType
  label: string
  hint: string
  category: 'task' | 'element'
}[] = [
  { type: 'short_answer', label: 'Краткий ответ', hint: 'Факт, термин, вычисление', category: 'task' },
  { type: 'single_choice', label: 'Один вариант ответа', hint: 'Выбор одного ответа', category: 'task' },
  {
    type: 'multiple_choice',
    label: 'Несколько вариантов',
    hint: 'Выбор нескольких ответов',
    category: 'task',
  },
  { type: 'fill_gaps', label: 'Заполнение пропусков', hint: 'Текст с пропусками', category: 'task' },
  { type: 'matching', label: 'Сопоставление', hint: 'Соединить пары', category: 'task' },
  { type: 'grouping', label: 'Группировка', hint: 'Классификация по признаку', category: 'task' },
  { type: 'ordering', label: 'Упорядочивание', hint: 'Восстановить порядок', category: 'task' },
  {
    type: 'extended_answer',
    label: 'Развёрнутый ответ',
    hint: 'Объяснение и аргументация',
    category: 'task',
  },
  { type: 'text', label: 'Текст', hint: 'Заголовок или абзац', category: 'element' },
  { type: 'answer_field', label: 'Поле для ответа', hint: 'Линии для письма', category: 'element' },
  { type: 'table', label: 'Таблица', hint: 'Сетка для заполнения', category: 'element' },
  { type: 'page_break', label: 'Разрыв страницы', hint: 'Новая страница', category: 'element' },
]

export const PLAN_TASK_TYPES = TASK_TYPE_META.filter((t) => t.category === 'task')

export const DIFFICULTY_OPTIONS: { value: DifficultyMode; label: string }[] = [
  { value: 'differentiated', label: 'Дифференцированная' },
  { value: 'basic', label: 'Базовая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'advanced', label: 'Повышенная' },
]

export const DEFAULT_PLAN_TYPES: TaskType[] = [
  'short_answer',
  'single_choice',
  'single_choice',
  'fill_gaps',
  'matching',
  'extended_answer',
]

export function labelForType(type: TaskType): string {
  return TASK_TYPE_META.find((t) => t.type === type)?.label ?? type
}

export function createPlan(count: number, seed: TaskType[] = DEFAULT_PLAN_TYPES): PlanTask[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `plan-${Date.now()}-${i}`,
    taskType: seed[i % seed.length] ?? 'short_answer',
    userExpectation: '',
  }))
}

export const DEFAULT_MATERIAL_TITLE = 'Закрепление материала'

/** Название материала в хлебных крошках и на листе — одна тема, которую редактирует учитель. */
export function worksheetDisplayName(draft: WorksheetDraft): string {
  return draft.topic.trim() || draft.title.trim() || 'Без названия'
}

export function breadcrumbLabel(draft: WorksheetDraft): string {
  return worksheetDisplayName(draft)
}

export function sheetTopicLabel(draft: WorksheetDraft): string {
  return worksheetDisplayName(draft)
}

export function emptyDraft(): WorksheetDraft {
  return {
    id: `ws-${Date.now()}`,
    subject: '',
    grade: '',
    taskCount: 5,
    topic: '',
    wishes: '',
    title: '',
    intro: '',
    difficulty: 'differentiated',
    showDifficulty: true,
    showAnswers: false,
    addIntro: true,
    createdManually: false,
    plan: createPlan(5),
    blocks: [],
    pages: 1,
    print: { answersSeparate: false, copies: 1, orientation: 'portrait' },
  }
}

export function filledCreateDraft(): WorksheetDraft {
  return {
    ...emptyDraft(),
    subject: 'Русский язык',
    grade: '6',
    taskCount: 5,
    topic: 'Закрепление материалов',
    title: 'Закрепление материалов',
    plan: createPlan(5),
  }
}

export function uid(prefix = 'b'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export interface SavedWorksheetMeta {
  id: string
  title: string
  subject: string
  grade: string
  savedAt: string
}

export function listSavedWorksheets(): SavedWorksheetMeta[] {
  const items: SavedWorksheetMeta[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('worksheet:')) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const draft = JSON.parse(raw) as WorksheetDraft
      items.push({
        id: draft.id,
        title: draft.title || draft.topic || 'Без названия',
        subject: draft.subject,
        grade: draft.grade,
        savedAt: draft.savedAt ?? new Date().toISOString(),
      })
    } catch {
      /* skip corrupt entries */
    }
  }
  return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function loadWorksheet(id: string): WorksheetDraft | null {
  try {
    const raw = localStorage.getItem(`worksheet:${id}`)
    if (!raw) return null
    return JSON.parse(raw) as WorksheetDraft
  } catch {
    return null
  }
}

export function deleteWorksheet(id: string): void {
  localStorage.removeItem(`worksheet:${id}`)
}

export function formatSavedAgo(iso?: string): string {
  if (!iso) return 'Не сохранено'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Сохранено только что'
  if (mins < 60) return `Сохранено ${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Сохранено ${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `Сохранено ${days} дн назад`
}

export const NAV_LABELS: Record<NavId, string> = {
  desk: 'Рабочий стол',
  ai: 'ИИ-помощник',
  materials: 'Библиотека заданий',
  schedule: 'Расписание',
  quiz: 'Викторины',
  students: 'Мои ученики',
  'ai-check': 'ИИ-проверка заданий',
  analysis: 'Анализ уроков',
  results: 'Результаты учеников',
  stats: 'Статистика',
  ratings: 'Рейтинги',
  tools: 'Инструменты',
}
