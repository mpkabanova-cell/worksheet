# Расхождения: DOCX «Рабочие_листы_промпты_v4_20261013_084829» ↔ код

**Источник:** `/Users/kabanovamaria/Downloads/Telegram Desktop/Рабочие_листы_промпты_v4_20261013_084829.docx`  
**Дата сверки:** 2026-10-13  
**Код:** `src/data/planAgentPrompt.ts`, `src/data/worksheetGeneratorPrompt.ts`, `src/data/aiPrompts.ts`, `server/visionOcr.js`, `src/data/worksheetSpecPayload.ts`

## Краткий вывод

| Промпт в DOCX | Используется в коде? | Совпадение |
|---------------|----------------------|------------|
| **Prompt_0_V0** (vision OCR) | Да, но **текст не из DOCX** | DOCX: только заголовок, без текста |
| **Prompt_1_V0** (план) | Да | **~совпадает** с оговорками по JSON и доп. блокам в `aiPrompts.ts` |
| **Prompt_2_V0** (лист) | **Частично** | DOCX — полный product spec (~51k символов); в рантайме — укороченный system + отдельные блоки в `aiPrompts.ts`, **без** большой части «контентного наполнения» из DOCX |
| Одно задание | Да | **В DOCX v4 отдельного промпта нет** — только `promptsForSingleTask` в коде |

Промпты **не идентичны** документу v4 целиком. Ближе всего к DOCX **агент планирования**; **агент листа** в коде заметно короче и по составу правил отличается.

---

## Prompt_0_V0 — распознавание файлов (vision)

### DOCX

- В разделе «Промпты, текущие версии» есть только строка **`Prompt_0_V0`**, без текста промпта.
- В теле документа **нет** фразы «Распознай текст на изображении…».

### Код

- **`server/visionOcr.js`** → `USER_PROMPT_VISION` (используется для PDF/DOCX-картинок/изображений, `POST /api/extract-context`).
- Расширенные правила для графиков/схем, запрет `[РИС:1]`, без markdown-картинок — **есть в коде**, в DOCX v4 **не приложены**.

### Расхождение

- Документ v4 **не фиксирует** актуальный текст Prompt_0; фактический источник — репозиторий (`visionOcr.js`, см. также `docs/CONTEXT_FILE.md`).
- Старый прототип `ocr_to_doc_project-main/backend/app/openrouter_client.py` содержит **более короткий** вариант vision-промпта (другие формулировки про иллюстрации) — это **не** то же самое, что текущий `visionOcr.js`.

---

## Prompt_1_V0 — агент планирования

### Где в коде

- System: **`src/data/planAgentPrompt.ts`** (`PLAN_AGENT_SYSTEM`).
- Сборка вызова: **`promptsForPlan`** в `src/data/aiPrompts.ts` (добавляет `OUTPUT_FORMAT`, `PLAN_STANDALONE_RULES`, при необходимости `PLAN_FULL_MATERIAL_RULES`, `IMAGE_DESCRIPTION_RULES`, блок «Дополнительно» про `task_count`).
- User JSON: **`agent1UserPayload`** в `src/data/worksheetSpecPayload.ts`.

### Что совпадает

- Роль агента, запрет генерировать готовые задания, блоки ADDITIONAL_WISHES, SOURCE_CONTENT, приоритеты, сложность, **«Доступные механики»** (input, single_choice, …, media), общая структура листа, работа с `task_plan`, сценарии заполнения полей, ограничения AI на изображения, формат ответа `{ task_plan: [...] }` и чеклист перед выдачей — **содержательно совпадают** с DOCX (после замены имён полей, см. ниже).

### Расхождения (имена полей и JSON)

| DOCX Prompt_1 | Код (system + user JSON) | Комментарий |
|---------------|--------------------------|-------------|
| `plan_difficulty` | `difficulty` | В user JSON всегда **`difficulty`** (`normalizeDifficultyMode`). В system-промпте в коде везде **`difficulty`**, не `plan_difficulty`. |
| `grade — параллель` (без уточнения) | `grade — параллель (число в JSON)` + **`task_count`** | В **`agent1UserPayload`** явно: `grade: number \| null`, `task_count: number`. В DOCX **`task_count` в блоке ВХОД отсутствует** (количество задаётся длиной `task_plan`). |
| Маркированные списки с `*` | Списки без `*` | Только оформление. |

### Расхождения (дополнительный system-текст только в коде)

В DOCX **нет** (или не входят в Prompt_1_V0), но **уходит в модель** при планировании:

- `OUTPUT_FORMAT` (LaTeX `\\` в JSON, обёртка ответа).
- `PLAN_STANDALONE_RULES`, `PLAN_FULL_MATERIAL_RULES` (если пожелание «весь документ»).
- `IMAGE_DESCRIPTION_RULES` (замена непригодных фрагментов с иллюстрациями, ровно `task_count`).
- «Дополнительно»: явное «Ровно N элементов», запрет CONTENT_RULES для question.

### User JSON vs описание в DOCX

- DOCX логически опирается на **`plan_difficulty`**; код и [`docs/PROMPTS.md`](./PROMPTS.md) описывают **`difficulty`** + **`task_count`** — это **целевое** API агентов 1–2, не опечатка кода.

### Вердict Prompt_1

**Используется тот же product spec**, что в DOCX, с **намеренными** отличиями: имена полей JSON (`difficulty`, `task_count`, числовой `grade`) и **расширениями** оркестрации в `aiPrompts.ts`. Дословное совпадение system-сообщения с DOCX **нет** из‑за этих дополнений и блока ВХОД.

---

## Prompt_2_V0 — агента генерации листа

### Где в коде

- База system: **`src/data/worksheetGeneratorPrompt.ts`** (`WORKSHEET_GENERATOR_SYSTEM`, ~3,5k символов).
- Полная сборка: **`promptsForWorksheet`** в `aiPrompts.ts` — добавляет `CONTENT_RULES`, `STANDALONE_TASK_RULES`, `ALTERNATIVE_TASK_RULES`, `REFERENCE_MATERIAL_RULES`, `REFERENCE_RELEVANCE_RULES`, `IMAGE_DESCRIPTION_RULES`, `CONTEXT_USAGE_RULES`, режим create/regenerate, блок «Дополнительно» (fill_gaps-шаблон, table 2–6 групп и т.д.).
- User JSON: **`agent2UserPayload`** (`generated_json_template`, `generated_json_schema`, `show_intro`, полный `task_plan` через `planRowToSpec`).

### Масштаб расхождения

| | DOCX Prompt_2_V0 | Код (WORKSHEET_GENERATOR + aiPrompts) |
|--|------------------|----------------------------------------|
| Объём system | ~51k символов | ~3,5k + блоки из `aiPrompts.ts` (десятки KB, но **другой состав**) |
| Заголовок роли | «AI-агент генерации **школьного** рабочего листа» | «AI-агент генерации рабочего листа **для школьного обучения**» |

### Что есть в DOCX, но **не** перенесено в промпт листа в коде

Крупные разделы Prompt_2 из DOCX **отсутствуют** в `worksheetGeneratorPrompt.ts` и **не** дублируются целиком в `aiPrompts.ts`:

1. **«КОНТЕНТНОЕ НАПОЛНЕНИЕ МЕХАНИК»** — детальные правила по каждому типу (input, single_choice, multiple_choice, matching, ordering, fill_gaps, table, text_block, media): порядок «сначала реши — потом ключ», требования к дистракторам, fill_gaps «сначала полный текст — потом пропуски», table 4–6 элементов в группе, media без вопросов к ресурсу и т.д.
2. **`answer_area_type`** (`lines` / `grid` / `answer_box` / `axes`) — в DOCX; в JSON листа в коде — **`answer_lines`** и типы **`short_answer` / `extended_answer`**, без поля `answer_area_type` в промпте generator.
3. **«КОРРЕКТНОСТЬ ОТВЕТА»**, **«ВВОДНАЯ ЧАСТЬ»** (развёрнутые), **«ОТСУТСТВУЮЩИЕ МАТЕРИАЛЫ»**, **«Проверка математических заданий»** (пошаговая) — в DOCX подробно; в коде частично перекрыты **`CONTENT_RULES`**, но **короче и иначе структурированы**.
4. **«СООТВЕТСТВИЕ description»**, **«СЛОЖНОСТЬ КОНКРЕТНОГО ЗАДАНИЯ»** (повтор уровней basic/medium/advanced) — в DOCX; в generator — кратко через `task_plan` / `difficulty: 1|2|3`.
5. **«Предлагаемая структура хранения Generation Rules»** (JSON с `content_generation` по механикам) — **концепция DOCX**; в коде правила **не** хранятся в такой структуре, а размазаны по TS-константам и постобработке (`taskContent.ts`, `blockUtils.ts`).

### Что есть в коде, но **нет** в DOCX Prompt_2

| Блок в коде | Суть |
|-------------|------|
| `REFERENCE_MATERIAL_RULES` | «Минимум **половина** заданий явно из source_content», запрет «магазин/поезд» вне файла |
| `REFERENCE_RELEVANCE_RULES` | Запрет переноса ответов/решений из файла |
| `ALTERNATIVE_TASK_RULES` | Замена непригодных фрагментов, `anchor_tasks` |
| `STANDALONE_TASK_RULES` | Развёрнутые примеры «плохо/хорошо» (пещера, Правдинск) |
| Regenerate | `previous_tasks`, `anchor_tasks`, `alternative_task_guidance` в user JSON |
| «Дополнительно» | Запрет шаблона fill_gaps «По теме «…» важно помнить…»; `grouping` vs DOCX `table` в naming |

### Имена типов и полей JSON

| DOCX (логика / mechanics) | Код (template / blocks) |
|---------------------------|-------------------------|
| `input` в плане | `short_answer`, `extended_answer` в `generated_json_template` |
| `table` (группы) | `grouping` + `groups[]` |
| `text_block`, `media` | `text`, `answer_field` (медиа) — маппинг в шаблоне, не в полном виде Prompt_2 DOCX |

### task_plan в user JSON

- DOCX: «готовый **нормализованный** план» (все поля строки).
- `worksheetGeneratorPrompt.ts` (комментарий в system): «**сокращённый** план: type, description, difficulty».
- **Фактически** `agent2UserPayload` передаёт **полные** строки `type`, `user_description`, `description`, `difficulty` — ближе к DOCX, чем к комментарию в `worksheetGeneratorPrompt.ts` (комментарий в коде **устарел** относительно payload).

### LaTeX / тригонометрия

- DOCX Prompt_2: `\operatorname{tg} x` вместо `\tan x`.
- `CONTENT_RULES` в коде: **`\tg`, `\ctg`, `\arctg`** (без `\operatorname{tg}`).

### Вердict Prompt_2

**В рантайме не используется текст Prompt_2_V0 из DOCX.** Используется **сокращённая** спецификация + **другой** набор дополнительных правил (reference/standalone/alternative). Большая методическая часть DOCX (контентное наполнение по механикам) **не отправляется** модели — частично компенсируется постобработкой на фронте, но это **не эквивалент** полного промпта из документа.

---

## Промпт «одно задание» (не в DOCX v4)

- **`promptsForSingleTask`** в `aiPrompts.ts`: роль «методист», `TASK_JSON_FIELDS`, те же `CONTENT_RULES` / reference / standalone / image / context, user с `requested_type`, `teacher_expectation`, `existing_tasks`, опционально `repair_note`, `anchor_tasks`.
- В DOCX v4 **нет** Prompt_3 / отдельного раздела под этот сценарий.

---

## Связанная документация в репозитории

- [`docs/PROMPTS.md`](./PROMPTS.md) описывает **фактическую** сборку промптов в коде, а не DOCX v4 целиком.
- Для Prompt_0 ориентир — [`docs/CONTEXT_FILE.md`](./CONTEXT_FILE.md) + `server/visionOcr.js`.

---

## Рекомендации (если нужно выровнять DOCX и прод)

1. **Prompt_0:** вставить в DOCX актуальный текст из `USER_PROMPT_VISION` (`visionOcr.js`) или сослаться на файл в репозитории.
2. **Prompt_1:** в DOCX заменить `plan_difficulty` → `difficulty`, добавить `task_count` и числовой `grade` в описание ВХОД; отдельным приложением перечислить блоки из `promptsForPlan` (`PLAN_STANDALONE`, `IMAGE_DESCRIPTION`, …).
3. **Prompt_2:** либо **импортировать** полный текст DOCX в `worksheetGeneratorPrompt.ts` (или модуль Generation Rules), либо **зафиксировать в DOCX**, что в проде сознательно используется укороченный промпт + `CONTENT_RULES` + постобработка — и приложить таблицу «раздел DOCX → код / не реализовано в LLM».
4. Обновить комментарий в `worksheetGeneratorPrompt.ts` про «сокращённый task_plan» — payload уже полный.
5. Согласовать нотацию LaTeX (`\tg` vs `\operatorname{tg}`) между DOCX, `CONTENT_RULES` и vision OCR.
