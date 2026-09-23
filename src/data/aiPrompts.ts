import type { DifficultyMode, TaskType, WorksheetBlock, WorksheetDraft } from './worksheet'
import { ADDITIONAL_WISHES_MAX_LENGTH, labelForType } from './worksheet'
import { getGapsSourceText } from './blockUtils'
import { referenceFilePayload, sourceContentForDraft } from './contextFile'
import { wishesUseFullDocument } from './contextFilter'
import {
  buildAlternativeTaskGuidance,
  collectAnchorTasks,
  type AnchorTask,
} from './referenceThemes'
import { PLAN_AGENT_SYSTEM } from './planAgentPrompt'
import { normalizeDifficultyMode } from './planMechanics'
import { WORKSHEET_GENERATOR_SYSTEM } from './worksheetGeneratorPrompt'
import { agent1UserPayload, agent2UserPayload } from './worksheetSpecPayload'

const TASK_JSON_FIELDS = `Поля задания (используй только нужные для type):
{
  "type": один из: short_answer | single_choice | multiple_choice | fill_gaps | matching | grouping | ordering | extended_answer,
  "instruction": всегда "" (пустая строка) — поле НЕ показывается ученику; не пиши сюда «Выбери правильный ответ…» и аналоги,
  "question": формулировка задания (только суть: вопрос или условие, без служебных инструкций типа «Выбери…» / «Запиши…»; до 2000 символов),
  "options": string[] — 4 варианта для single_choice / multiple_choice,
  "correct_option_index": number — индекс верного (0-based) для single_choice,
  "correct_option_indexes": number[] — индексы верных для multiple_choice,
  "correct_answers": string[] — эталонные ответы / ключ для учителя,
  "answer_lines": number — высота блока ответа (клетки: 10–20; линии, блок ответа, оси, луч: 5–10),
  "gaps_text": string — текст с пропусками ___ (fill_gaps),
  "gaps_answers": string[] — ответы на пропуски по порядку,
  "left_items": string[] — левый столбец (matching),
  "right_items": string[] — правый столбец, перемешанный (matching),
  "groups": [{"title": string, "items": string[]}] — для grouping (2–3 группы),
  "order_items": string[] — элементы в ПЕРЕМЕШАННОМ порядке для ученика (ordering),
  "difficulty": 1 | 2 | 3
}`

/** Правила контента для текстовых полей внутри JSON (question, instruction, intro, options и т.д.). */
const CONTENT_RULES = `
[Язык и стиль]
- Язык — естественный, живой, без профессионального жаргона.
- Современный русский язык, нейтральный тон, адаптация для школьников.
- Без орфографических и пунктуационных ошибок.
- Без канцеляризмов, архаизмов, просторечий и двусмысленностей.
- Не используй личные местоимения: я, мы, ты, вы, он, она, они, мне, тебе, вам и т.п. (ни в intro, ни в question).
- Не используй привязки ко времени: сегодня, вчера, завтра, на этой неделе, сейчас и т.п.

[Фактология и этика]
- Строгое соответствие проверенным научным данным и российским школьным программам.
- Безопасность контента: без спорных политических/религиозных оценок, без травмирующих тем.

[Поле intro]
- Краткая общая информация по теме / о том, какие навыки отрабатываются на листе.
- Без приветствий, без местоимений, без «сегодня/вчера», без оценок сложности («это несложно»), без напутствий («Удачи!», «Вперёд!», «Не сдавайся!» и т.п.).
- Хорошо: «Умножение обыкновенных дробей. Числители перемножают, знаменатели перемножают; при возможности результат сокращают.»
- Плохо: «Сегодня мы будем умножать обыкновенные дроби… Удачи!»

[Поле instruction]
- Всегда оставляй instruction пустой строкой "".
- Не пиши служебные фразы перед заданием: «Выбери правильный ответ…», «Выбери правильный ответ из предложенных вариантов», «Запиши краткий ответ», «Заполни пропуски», «Дай развёрнутый ответ» и любые аналоги — они ученику не показываются и не нужны.
- Тип задания уже задан полем type; действие ученика должно быть ясно из самого question.

[Поле question]
- Только формулировка задания: вопрос или условие.
- Не дублируй в начале question служебные инструкции («Выбери…», «Реши…», «Запиши…»), если они не являются самой сутью условия.
- Не добавляй под заданием и внутри question определения, правила, теорию и пояснения («Множество … обозначается…», «Любое целое число…» и т.п.).
- Хорошо: «Чему равно произведение дробей $\\frac{2}{3} \\cdot \\frac{1}{5}$?»
- Хорошо: «Вычисли произведение дробей $\\frac{4}{9} \\cdot \\frac{3}{8}$. Опиши ход решения.»
- Плохо: «Выбери правильный ответ. Чему равно…»
- Плохо: «Вспомни правило умножения обыкновенных дробей и запиши его.»
- Плохо: «Какое число иррационально? Множество рациональных чисел обозначается буквой Q.»

[Варианты ответа options]
- Только короткий текст варианта (слово, число, формула, фраза). Без определений и теории.
- Плохо: «$\\sqrt{2}$» + абзац с определением множества Q.
- Хорошо: «$\\sqrt{2}$», «$\\frac{3}{4}$», «$\\pi$».

[Общие правила оформления текста в полях]
- Не добавляй вводных/завершающих фраз от лица модели. Запрещены, в том числе:
  · приветствия: «Привет!», «Здравствуй!», «Добрый день!» и т.п.;
  · обёртки модели: «Конечно!», «Вот ваше задание:», «Надеюсь, это поможет…»;
  · мотивационные и напутственные фразы: «Удачи!», «Это очень важный навык…», «Давай повторим и закрепим…», «Главное — внимательно считать…»;
  · мета-задания без конкретной задачи: «Вспомни правило … и запиши его», «Вспомни определение…», «Расскажи, что знаешь о…».
- Во внешних строках JSON (question, intro, options, gaps_text, body и т.п.) используй Markdown при необходимости: заголовки ###, маркированные и нумерованные списки, курсив.
- Не используй HTML, XML, YAML, Markdown-кодовые блоки (\`\`\`) и комментарии.
- В нужных местах используй только кавычки-ёлочки «».

[Математика и формулы]
- Любые дроби, произведения, уравнения и числовые выражения с дробями — только в LaTeX внутри $...$ или $$...$$. Не пиши «2/3» или «2∶3» обычным текстом, если это математическое выражение.
- Примеры корректной записи: $\\frac{2}{3} \\cdot \\frac{1}{5}$, $\\frac{4}{9} \\cdot \\frac{3}{8}$.
- Формулы и числовые значения (целые и дробные) оформляй только в LaTeX, строго в российской нотации:
  · встроенные формулы — $...$;
  · отдельные формулы — $$...$$.
- Российская нотация в формулах (обязательно):
  · десятичная дробь — через запятую: $0,5x+3$, $-2,7$; не $0.5x+3$ и не $0.5$;
  · умножение — \\cdot; деление в выражениях — двоеточие (:) или \\frac{}{}, не / и не \\div;
  · тригонометрия — \\tg, \\ctg, \\arctg (не \\tan, \\cot, \\arctan); можно $\\mathrm{tg}$, $\\mathrm{ctg}$;
  · градусы и спецсимволы — только внутри $...$ / $$...$$.
- Для масштабируемых скобок используй \\left( \\right).
- Греческие буквы в LaTeX: \\alpha, \\beta и т.д.
- Пробелы для тригонометрии: $\\sin a$, $\\cos b$.
- Аргументы функций без фигурных скобок: $\\cos 2x$.
- Производная: ^{\\prime}.
- Не используй Unicode-символы, псевдографику или обычный текст вместо математических выражений.
- Знак умножения в формулах — \\cdot (не · и не × вне LaTeX).

[Методика]
- Ответы в correct_* / gaps_answers должны быть реально верными.
- Для математики давай конкретные числа/выражения, не абстрактные «реши пример».
- Не дублируй одно и то же задание разными словами.
- Сложность: 1 — базовое узнавание, 2 — применение, 3 — анализ/перенос.
`.trim()

const OUTPUT_FORMAT = `Формат ответа:
- Верни ТОЛЬКО валидный JSON-объект (без текста вокруг, без markdown-обёртки всего ответа).
- Правила языка, Markdown и LaTeX применяются к содержимому строковых полей JSON, а не к оболочке ответа.
- В строковых полях JSON каждый символ \\ в LaTeX должен быть удвоен: "$\\\\frac{1}{2}$", "$\\\\tg 30^{\\\\circ}$", "$\\\\sin x$". Одинарный \\frac или \\sin делает JSON невалидным.`

const CONTEXT_USAGE_RULES = `
[Контекст учителя и сложность]
- Если additional_wishes / teacher_wishes не null — обязательно учитывай акценты, ограничения и пожелания из этого поля.
- Поле difficulty у каждого задания выставляй строго по difficulty_guidance или по difficulty элемента task_plan.
- Если reference_file / source_content не null и content не пустой — используй его как основной опорный материал. Не копируй дословно большие фрагменты; адаптируй под класс и тему.
- Фрагменты в [квадратных скобках] в reference_file.content — описания иллюстраций из файла. Используй их смысл при планировании и генерации, но не показывай [скобки] ученику в question/options.
- Если reference_file.content null, но reference_file.note не null — учитывай note только когда content недоступен.
- Из content уже убраны решения, ответы, ключи — не восстанавливай их. Если в additional_wishes указан раздел или блок файла — используй только его.`

const REFERENCE_MATERIAL_RULES = `
[Опора на reference_file — обязательно, если content не пустой]
- reference_file.content — главный источник задач: бери разные фрагменты, блоки и сюжеты из файла (разные задачи, разделы, классы).
- Минимум половина заданий листа должна явно опираться на материал файла (условия, персонажи, числа, сюжеты из content).
- Не придумывай посторонние задачи про магазин, склад, поезд и т.п., если их нет в reference_file.
- Каждое задание — самостоятельное: полное условие в question, без отсылок к другим заданиям листа.
- Не дроби одну задачу из файла на несколько заданий (найти → упорядочить → объяснить); одна задача файла = одно задание листа с полным условием.
- Решения и ответы из файла не используй — только условия и постановки.`.trim()

const REFERENCE_RELEVANCE_RULES = `
[Релевантность reference_file.content]
- content содержит только условия задач и учебный материал, пригодный для формулировки новых заданий.
- Запрещено использовать или цитировать из файла: готовые решения, ответы, ключи, разборы, пошаговые решения, «18 минут» и т.п., если они были в решении исходной задачи.
- Не переноси в question/correct_* числа-ответы из решения исходника — формулируй новые задания или бери только условие без ответа.
- Иллюстрации из секции решения игнорируй полностью.`.trim()

const IMAGE_DESCRIPTION_RULES = `
[Иллюстрации в reference_file — описания в [квадратных скобках]]
- Это не текст задания, а замена картинок из приложенного файла.
- При планировании и генерации сам реши: можно ли сформулировать задание по теме/тексту БЕЗ опоры на иллюстрацию.
- Если задание можно выполнить без визуала — включай его.
- Если задание требует график, схему, «по рисунку» и описание в [скобках] слишком громоздкое или недостаточное — не используй этот фрагмент; замени другим заданием из reference_file, сюжетно и логически близким к уже удачным заданиям листа (см. anchor_tasks / alternative_task_guidance).
- Не копируй [описания картинок] в question, options, gaps_text и другие поля для ученика.
- В плане и листе — ровно task_count заданий: замена непригодных элементов, не уменьшение количества.`.trim()

const STANDALONE_TASK_RULES = `
[Самостоятельность заданий — обязательно]
- Каждое задание решается БЕЗ других заданий листа: ученик видит только question и поля своего типа (options, gaps_text, order_items и т.д.).
- В question каждого задания — полное условие: все числа, имена, ограничения и данные, нужные для ответа. Не отсылай к «из условия выше», «как в предыдущем задании», «из текста листа», intro или reference_file.
- intro — общая справка по теме, не замена условия; в question не должно быть пробелов, которые intro заполняет.
- Не дроби одну задачу из reference_file на несколько заданий листа (сначала найти время, потом упорядочить, потом объяснить стратегию — это одна задача, не три).
- Если в reference_file несколько разных задач/блоков — возьми разные фрагменты; каждый с полным условием в question.
- Каждое задание — отдельная задача; ответ к заданию 1 не используется при решении задания 2.
- Если из reference_file берётся сюжет — в question продублируй кратко, но полностью все данные для ЭТОГО задания.
- fill_gaps: gaps_text обязателен и содержит ___; question не заменяет gaps_text.
- Запрещены формулировки «запишите время каждого персонажа» без перечисления персонажей и их данных в том же question.
- Поле question — НЕ копия teacher_expectation. «Определите…», «Выберите…» без сюжета и чисел — ошибка; сначала полное условие из reference_file, затем вопрос.
- Запрещено в question: «Задача на выбор персонажа», «Требуется выбрать один вариант ответа», «исходя из предоставленных данных», «на основе предоставленной информации» — это description для автора, не текст для ученика.

Плохо (нельзя выполнить, задания связаны):
- З1 question: «Запишите время прохождения пещеры для каждого персонажа.»
- З2 question: «Упорядочьте персонажей по времени прохождения пещеры.»

Хорошо (каждое задание самостоятельно, из разных фрагментов файла):
- З1 по блоку «5-6 классы»: полное условие про пещеру с временами всех персонажей и вопрос «Какое наименьшее суммарное время…?»
- З2 по блоку «7-8 классы»: полное условие логической задачи про Правдинск/Лжеград с вопросом по сюжету`.trim()

const ALTERNATIVE_TASK_RULES = `
[Альтернативные и заменяющие задания]
- Если фрагмент reference_file непригоден (иллюстрация, неполное условие, ошибка формулировки) — замени задание другим из того же reference_file.
- Альтернатива должна быть сюжетно и по логике близка к заданиям, которые уже удалось взять из файла (anchor_tasks), но оставаться самостоятельной: полное условие в question, без отсылок к другим заданиям листа.
- Сохраняй тип задания, сложность и педагогическую цель expectation; меняй только содержание и формулировку.
- Не подставляй посторонние шаблоны (магазин, поезд, мастер и ученик), если их нет в reference_file и anchor_tasks.
- Для задач про пещеру/персонажей, логику Правдинск/Лжеград, маршруты доставки — используй те же персонажи, числа и правила из reference_file, но другой вопрос или другой акцент (выбор, упорядочивание, краткий ответ и т.д.).`.trim()

const PLAN_STANDALONE_RULES = `
[План — независимые задания]
- Каждый пункт плана — отдельная самостоятельная задача, не этап многошагового решения одной и той же задачи.
- Не планируй серию «найти данные → упорядочить → заполнить пропуски → объяснить» по одному сюжету из source_content, если additional_wishes не просят развернуть одну задачу по шагам.
- Если additional_wishes требуют использовать весь материал документа — бери задания из разных блоков/фрагментов source_content (все классы и сюжеты файла).
- Если уникальных фрагментов в source_content меньше, чем task_count — дополняй план аналогами в том же сюжете, с теми же персонажами, числами и правилами файла; не придумывай посторонние шаблоны (магазин, поезд, склад), если их нет в source_content.
- Разнообразь учебные действия и механики; ответ одного задания не должен быть входом для другого.`.trim()

const PLAN_FULL_MATERIAL_RULES = `
[Пожелание «использовать весь материал документа»]
- source_content уже содержит все блоки файла (не только параллель формы).
- Распредели task_plan по разным фрагментам и сюжетам из source_content.
- Недостающие пункты плана — новые задания-аналоги по уже взятым сюжетам файла, а не выдуманные темы вне файла.`.trim()

function difficultyHint(mode: DifficultyMode): string {
  switch (normalizeDifficultyMode(mode)) {
    case 'basic':
      return 'Все задания сложности basic (уровень 1).'
    case 'medium':
      return 'Все задания сложности medium (уровень 2).'
    case 'advanced':
      return 'Все задания сложности advanced (уровень 3).'
    default:
      return 'Дифференцированная сложность: basic → medium → advanced по ходу листа.'
  }
}

function contextPayload(draft: WorksheetDraft) {
  const ref = referenceFilePayload(draft)
  const sourceContent = sourceContentForDraft(draft)
  return {
    subject: draft.subject,
    grade: `${draft.grade} класс`,
    topic: draft.topic,
    teacher_wishes: draft.additionalWishes?.trim().slice(0, ADDITIONAL_WISHES_MAX_LENGTH) || null,
    additional_wishes: draft.additionalWishes?.trim().slice(0, ADDITIONAL_WISHES_MAX_LENGTH) || null,
    task_count: draft.taskCount,
    difficulty_mode: normalizeDifficultyMode(draft.difficulty),
    difficulty: normalizeDifficultyMode(draft.difficulty),
    difficulty_guidance: difficultyHint(draft.difficulty),
    show_intro: draft.showIntro,
    reference_file: ref,
    source_content: sourceContent,
    reference_usage_hint: sourceContent
      ? 'source_content / reference_file.content — основной источник задач. Бери разные фрагменты/блоки файла; каждое задание — самостоятельное с полным условием в question. Решения из файла не используй.'
      : null,
  }
}

function blockBriefText(block: WorksheetBlock): string {
  if (block.type === 'fill_gaps') {
    return block.question || getGapsSourceText(block) || ''
  }
  return block.question || block.body || ''
}

function existingTasksBrief(blocks: WorksheetBlock[]) {
  return blocks
    .filter((b) => !['page_break', 'text', 'answer_field', 'table'].includes(b.type))
    .map((b, i) => ({
      index: i + 1,
      type: b.type,
      question: blockBriefText(b),
    }))
}

export function promptsForPlan(draft: WorksheetDraft) {
  const useFullMaterial = Boolean(draft.additionalWishes?.trim() && wishesUseFullDocument(draft.additionalWishes))
  const system = `${PLAN_AGENT_SYSTEM}

${OUTPUT_FORMAT}

${PLAN_STANDALONE_RULES}
${useFullMaterial ? `\n\n${PLAN_FULL_MATERIAL_RULES}` : ''}

${IMAGE_DESCRIPTION_RULES}

Дополнительно:
- Ровно ${draft.taskCount} элементов в task_plan (не уменьшай количество).
- Если фрагмент source_content опирается на непригодную иллюстрацию — замени description другим из source_content, близким по сюжету к другим пунктам; count не уменьшай.
- Не включай CONTENT_RULES для question — ты не генерируешь конкретные задания.`

  const user = JSON.stringify(agent1UserPayload(draft), null, 2)
  return { system, user }
}

export function promptsForWorksheet(
  draft: WorksheetDraft,
  mode: 'create' | 'regenerate',
) {
  const modeBlock =
    mode === 'regenerate'
      ? `Режим: ПЕРЕГЕНЕРАЦИЯ. Создай НОВЫЕ задания по тому же task_plan.
Не копируй формулировки из previous_tasks. Сохрани type и педагогическую цель description, замени содержание.
Альтернативы — сюжетно близки к previous_tasks и source_content, но каждое question — самостоятельное полное условие.`
      : `Режим: ПЕРВИЧНАЯ ГЕНЕРАЦИЯ рабочего листа по task_plan.`

  const system = `${WORKSHEET_GENERATOR_SYSTEM}

${modeBlock}

${CONTENT_RULES}

${STANDALONE_TASK_RULES}

${ALTERNATIVE_TASK_RULES}

${REFERENCE_MATERIAL_RULES}

${REFERENCE_RELEVANCE_RULES}

${IMAGE_DESCRIPTION_RULES}

${CONTEXT_USAGE_RULES}

${OUTPUT_FORMAT}

Дополнительно:
- Заполни generated_json_template; ответ должен соответствовать generated_json_schema.
- Строго соблюдай type каждого задания из template / task_plan.
- Поле instruction у каждого задания — всегда "".
- order_items: перемешанный порядок; correct_answers — правильная последовательность.
- matching: right_items перемешай; correct_answers — пары «лево → право», биекция 1:1.
- fill_gaps: gaps_text с ___; question — короткая формулировка, не дублируй gaps_text.
- table: 2–6 групп; элементы — короткие слова/числа без теории в question.`

  const regenerateAnchors =
    mode === 'regenerate'
      ? collectAnchorTasks(
          draft.blocks,
          draft.taskPlan?.map((item) => item.description || item.userDescription),
        )
      : []
  const alternativeGuidance =
    mode === 'regenerate'
      ? buildAlternativeTaskGuidance(
          regenerateAnchors,
          referenceFilePayload(draft)?.content ?? undefined,
        )
      : null

  const user = JSON.stringify(
    agent2UserPayload(draft, {
      previous_tasks: mode === 'regenerate' ? existingTasksBrief(draft.blocks) : undefined,
      anchor_tasks: regenerateAnchors.length ? regenerateAnchors : undefined,
      alternative_task_guidance: alternativeGuidance || undefined,
    }),
    null,
    2,
  )

  return { system, user }
}

export function promptsForSingleTask(
  draft: WorksheetDraft,
  taskType: TaskType,
  expectation: string,
  repairNote?: string,
  anchorTasks?: AnchorTask[],
  planDescription?: string | null,
) {
  const anchors = anchorTasks ?? collectAnchorTasks(
    draft.blocks,
    draft.taskPlan?.map((item) => item.description || item.userDescription),
  )
  const alternativeGuidance = buildAlternativeTaskGuidance(
    anchors,
    referenceFilePayload(draft)?.content ?? undefined,
    planDescription || expectation,
  )
  const system = `Ты — методист. Сгенерируй ОДНО школьное задание для рабочего листа.

Тип: ${taskType} (${labelForType(taskType)}).

${TASK_JSON_FIELDS}

${OUTPUT_FORMAT}

Верни JSON:
{ "task": { ...поля одного задания с type="${taskType}" } }

${CONTENT_RULES}

- Не повторяй формулировки из existing_tasks.
- Поле instruction — всегда "".
- Если есть description — разверни его в question с полным условием; не копируй description дословно.
- user_description / teacher_expectation — краткий замысел; не копируй в question.
- repair_note — служебная подсказка для исправления; не включай её текст в question.
- fill_gaps: question — короткое задание; gaps_text — только строки с пропусками ___, без теории и определений. Пропуски только в обычном тексте, не внутри формул ($...$). Запрещено: «(a+b)^2 = a^2 + ___ + b^2» с gaps_answers: ["2ab"].
- matching: question обязателен и понятен ученику. Биекция 1:1: каждый left_item → свой right_item. Запрещены matching с числовыми множествами N/Z/Q и формулировкой «наименьшее множество».

${STANDALONE_TASK_RULES}

${ALTERNATIVE_TASK_RULES}

${REFERENCE_MATERIAL_RULES}

${REFERENCE_RELEVANCE_RULES}

${IMAGE_DESCRIPTION_RULES}

${CONTEXT_USAGE_RULES}`

  const user = JSON.stringify(
    {
      ...contextPayload(draft),
      requested_type: taskType,
      description: planDescription?.trim() || expectation.trim() || null,
      user_description: expectation.trim() || null,
      teacher_expectation: expectation.trim() || null,
      repair_note: repairNote?.trim() || null,
      anchor_tasks: anchors.length ? anchors : undefined,
      alternative_task_guidance: alternativeGuidance || undefined,
      existing_tasks: existingTasksBrief(draft.blocks),
    },
    null,
    2,
  )

  return { system, user }
}
