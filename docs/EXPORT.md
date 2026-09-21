# Экспорт в Word (DOCX)

Здесь описано, как устроен экспорт, какие файлы за что отвечают и что нужно платформе, чтобы подключить выгрузку.

Код лежит в `src/export/word/`, типы данных — в `src/data/worksheet.ts`, подготовка JSON перед экспортом — в `src/data/blockUtils.ts`.

---

## В двух словах

Экспорт работает **в браузере**, сервер для сборки Word не нужен. На вход подаётся JSON `WorksheetDraft` с блоками заданий, на выходе — файл `.docx`.

Запустить можно двумя способами (оба в `exportWorksheetDocx.ts`):

| Функция | Что получится |
|---------|----------------|
| `exportWorksheetDocx(draft)` | Файл сразу скачается пользователю |
| `exportWorksheetDocxBlob(draft)` | Вернёт `{ blob, fileName }` — удобно, если файл нужно отправить на сервер или в хранилище |

До самого последнего шага логика у них одинаковая.

---

## Что происходит по шагам

Схема ниже — это та же последовательность, что в коде. У каждого шага указан файл.

```
WorksheetDraft (JSON с платформы)
       │
       ▼ 1. Подготовка (лучше сделать до экспорта)
   blockUtils.ts
   · syncPagesFromBreaks — пересчитывает, на какой странице каждый блок
   · normalizeWorksheetDraft — чинит старые форматы, подставляет дефолты
       │
       ▼ 2. Старт экспорта
   exportWorksheetDocx.ts → exportWorksheetDocxBlob
       │
       ├─ ещё раз normalizeWorksheetDraft
       ├─ из draft собираются настройки (ответы, сложность, ориентация…)
       ├─ создаётся ExportContext — draft + настройки + кэши картинок
       ├─ ensureExportFontsLoaded — ждём загрузки Arial и Cambria Math
       │
       ▼ 3. Сборка содержимого Word
   build/buildSheet.ts → buildWorksheetDocumentChildren
       │
       ├─ buildSheetBody: шапка, страницы, блоки
       │     ├─ buildHeader — «Ученик», название темы, вводный текст
       │     └─ на каждой странице: buildPageBlocks → buildBlockContent
       │
       └─ если включено «ответы отдельным листом»:
             второй раз buildSheetBody, уже с ответами
       │
       ▼ 4. Упаковка в файл
   exportWorksheetDocx.ts
   · Document + Packer.toBlob
       │
       ▼
   скачивание или upload
```

### 1. Подготовка данных (`blockUtils.ts`)

Экспорт рассчитывает, что JSON уже более-менее в порядке. Редактор перед сохранением делает больше проверок, чем сам экспорт. Если отдать «сырой» draft, могут сломаться matching, остаться старый `type: 'table'`, сбиться номера страниц.

| Функция | Что делает |
|---------|------------|
| `syncPagesFromBreaks` | Проходит по блокам, смотрит на `page_break`, проставляет `block.page` и `draft.pages` |
| `normalizeWorksheetDraft` | Миграции, дефолты для grouping и fill_gaps, отсеивает мусор, проверяет matching |

Обе функции стоит вызвать **до** экспорта. Внутри `exportWorksheetDocxBlob` normalize вызывается ещё раз — так и задумано.

### 2. Настройки и контекст (`types.ts`, `exportWorksheetDocx.ts`)

Из draft собирается **ExportOptions** — четыре переключателя:

- `showAnswers` — показывать ответы (зелёный текст, линии в matching и т.д.)
- `showDifficulty` — строка «Сложность» и звёзды
- `answersSeparate` — в одном файле два листа: сначала для ученика, потом «Ответы»
- `orientation` — книжная или альбомная ориентация

**ExportContext** — всё, что нужно на время одного экспорта:

| Поле | Зачем |
|------|-------|
| `draft` | Подготовленный лист |
| `options` | Флаги выше |
| `subject` | Предмет — от него зависит, будут линии или клеточка в поле ответа |
| `mathCache` | Уже отрисованные формулы (PNG) |
| `imageCache` | Загруженные картинки (варианты ответа, QR) |
| `domImageCache` | Снимки виджетов (matching, grouping…) |

Кэши создаются заново при каждом экспорте.

### 3. Сборка листа (`buildSheet.ts`)

Главная функция здесь — **`buildWorksheetDocumentChildren`**. Она решает, сколько раз собирать лист.

**Если ответы не на отдельном листе** (`answersSeparate = false`): один проход, ответы показываются или нет — как в `draft.showAnswers`.

**Если ответы на отдельном листе** (`answersSeparate = true`):

1. Сначала лист **без** ответов — даже если в draft ответы включены.
2. Разрыв страницы и заголовок «Ответы».
3. Потом тот же лист **с** ответами.

**`buildSheetBody`** на каждом проходе:

1. Рисует шапку (`buildHeader`).
2. Обходит страницы от 0 до `draft.pages - 1`.
3. На странице берёт только блоки с нужным `block.page`.
4. Каждый блок отдаёт в `buildBlockContent`.
5. Если страниц несколько — добавляет номер внизу.

**Нумерация заданий:** блоки `text`, `answer_field` и `page_break` номер не получают. У остальных номер считает `countTaskBlocksBefore` в `blockUtils.ts`.

### 4. Один блок (`buildBlock.ts`)

**`buildBlockContent`** смотрит на `block.type` и решает, что рисовать.

Для обычного задания (не `text` и не `answer_field`) порядок такой:

1. Берётся текст вопроса — `getBlockQuestion`, при необходимости подставляется placeholder.
2. Собирается **шапка задания** — таблица с номером, вопросом и опционально сложностью (`buildTaskHeadTable`).
3. Часть типов (matching, choice с текстом…) рисуется **внутри** этой шапки.
4. Остальное — **под** шапкой: варианты с картинками, поле ответа, текст с пропусками.
5. В конце — отступ до следующего задания.

**Куда попадает контент:**

| type | В шапке задания | Под шапкой |
|------|-----------------|------------|
| `text` | — | текст из `body` |
| `answer_field` | — | QR-код или подпись к медиа |
| choice (только текст) | варианты ответа | — |
| choice (картинки) | вопрос | таблица с картинками |
| `short_answer`, `extended_answer` | вопрос; в ключе ещё и ответ | поле для ответа (PNG) |
| `fill_gaps` | вопрос | текст с пропусками или с подставленными словами |
| `matching`, `ordering`, `grouping` | вопрос + картинка виджета | — |
| `page_break` | — | разрыв страницы Word |

---

## Как рисуется содержимое

React-компоненты редактора экспорт **не** использует. Вместо них два подхода.

### Текст и простые элементы — прямо в Word

Цепочка:

```
строка (Markdown, LaTeX)
  → parseRichText.ts
  → toDocxContent.ts
  → абзацы, runs, формулы Word
  → библиотека docx
```

| Файл | Задача |
|------|--------|
| `parseRichText.ts` | жирный, курсив, абзацы, формулы в `$...$` |
| `toDocxContent.ts` | превращает разбор в элементы docx |
| `latexToWordMath.ts` | LaTeX → формула Word (можно править в Word) |
| `mathToImage.ts` | если LaTeX не разобрался — рисует PNG через KaTeX |
| `layoutTokens.ts` | шрифты, цвета, отступы (как в Worksheet.css) |

Так оформляются intro, вопросы, блок `text`, fill_gaps, текстовые варианты ответа.

### Сложные виджеты — снимок экрана в PNG

Цепочка:

```
блок + флаг «показывать ответы»
  → render*Dom.ts (HTML в памяти)
  → domToPng.ts (html-to-image)
  → картинка вставляется в Word
```

| Файл | Что рисует |
|------|------------|
| `renderMatchingDom.ts` | сопоставление |
| `renderOrderingDom.ts` | упорядочивание |
| `renderGroupingDom.ts` | таблица группировки и слова под ней |
| `renderAnswerAreaDom.ts` | поле для ответа (линии, клетки, оси…) |
| `domToPng.ts` | общая логика: невидимый div, KaTeX, снимок |

Matching и grouping в Word сложно сверстать вручную так же, как на экране. PNG даёт тот же вид, что в прототипе.

Размеры виджетов — в `layoutSpec.ts`. Картинки в вариантах ответа подгружаются через `imageUtils.ts` (`fetchImageBytes`): нужен `data:` URL или адрес с CORS.

---

## Шапка задания (`buildTaskHeadTable.ts`)

У всех нумерованных заданий одна и та же рамка:

```
┌──────┬─────────────────────────────────────────┐
│  1   │  Вопрос (текст, формулы)                │
│      │  при необходимости: сложность ★★☆       │
├──────┴─────────────────────────────────────────┤
│  виджет или варианты ответа                    │
└────────────────────────────────────────────────┘
```

Слева — номер, справа — вопрос и звёзды сложности. В нижнюю часть (`extraRows`) попадают текстовые choice, matching, ordering, grouping. Ширины колонок — в `layoutSpec.ts` и `layoutTokens.ts`.

---

## Поле для ответа (`buildAnswerArea.ts`, `blockUtils.ts`)

Вид поля зависит не только от блока, но и от **предмета**:

| answerAreaStyle | Когда | Как рисуется |
|-----------------|-------|--------------|
| `lines` | не точные науки | горизонтальные линии (PNG) |
| `cells` | математика, физика и др. | клетчатая тетрадь |
| `block` | задано явно | пустой прямоугольник |
| `axes`, `number_line`, `ray` | математика | сетка и оси |

Списки предметов — `STEM_GRID_SUBJECTS` и `MATH_GRAPH_SUBJECTS` в `blockUtils.ts`.

На листе для ученика поле пустое. В ключе поверх поля зелёным пишется правильный ответ.

---

## Лист для ученика и ключ (`showAnswers`)

Один флаг «показывать ответы» проходит через все функции сборки. При «ответах на отдельном листе» первый проход всегда без ответов, второй — с ответами.

| Тип | Без ответов | С ответами |
|-----|-------------|------------|
| choice | пустые кружки / квадраты | отмечены верные, зелёным |
| fill_gaps | пропуски `___` | слова на месте пропусков |
| matching | пары без линий | линии и подсветка |
| ordering | элементы без номеров | зелёные номера |
| grouping | пустые ячейки и банк слов | ответы в ячейках зелёным |
| short_answer | пустое поле | текст ответа в поле |

Цвет ответов — `COLORS.textPositive` (`0DB56C`) в `layoutTokens.ts`.

---

## Какие файлы за что отвечают

| Часть | Файлы | Смысл |
|-------|-------|-------|
| Запуск | `exportWorksheetDocx.ts` | две публичные функции, упаковка в .docx |
| Лист целиком | `build/buildSheet.ts` | страницы, два варианта с ответами / без |
| Шапка листа | `build/buildHeader.ts` | ученик, название, intro |
| Блоки | `build/buildBlock.ts` | разбор по типу, связка шапки и тела |
| Рамка задания | `build/buildTaskHeadTable.ts` | номер, вопрос, виджет внутри |
| Поле ответа | `build/buildAnswerArea.ts` | вызов отрисовки поля |
| Текст | `richText/*` | Markdown, LaTeX |
| Виджеты | `rasterize/*` | HTML → PNG |
| Картинки | `imageUtils.ts`, `assets/uiAssets.ts` | загрузка, звёзды, маркеры choice |
| Вёрстка | `layoutTokens.ts`, `layoutSpec.ts` | размеры и цвета |
| Шрифты | `loadExportFonts.ts` | перед экспортом ждём шрифты |
| Данные | `worksheet.ts`, `blockUtils.ts`, `taskContent.ts` | типы, normalize, текст вопроса |
| Типы | `types.ts` | ExportContext, ExportOptions |

---

## Что нужно платформе

1. Отдавать JSON в формате `WorksheetDraft`.
2. Перед экспортом вызвать `syncPagesFromBreaks`, затем `normalizeWorksheetDraft`.
3. Запускать `exportWorksheetDocx` или `exportWorksheetDocxBlob` **в браузере**.
4. Заполнить `subject`, массив `blocks` и флаги `showAnswers`, `print.*`.

**npm:** `docx`, `katex`, `html-to-image`, `@unified-latex/unified-latex-util-parse`.

**Из репозитория:** `src/export/word/**`, `src/data/worksheet.ts`, `blockUtils.ts`, `taskContent.ts`, `mathTextUtils.ts`, картинки из `src/assets/worksheet/`.

**Ограничения:**

- без DOM (чистый Node на сервере) не заработает — нужен браузер или headless Chrome;
- картинки — `data:` или URL с CORS;
- `print.copies` на DOCX не влияет, только на печать в интерфейсе.

---

## Какие поля нужны в `WorksheetDraft`

Подробные типы — в `src/data/worksheet.ts`. Минимум для нормального экспорта:

| Поле | Зачем |
|------|-------|
| `subject` | вид поля ответа |
| `topic` / `title` | заголовок и имя файла |
| `blocks[]` | задания |
| `pages` | число страниц (согласовано с `block.page`) |
| `showAnswers`, `showDifficulty` | что показывать |
| `print.answersSeparate`, `print.orientation` | отдельный лист ответов, ориентация |

По типам блоков — главное:

| type | Поля |
|------|------|
| `short_answer` | `question`, `correctAnswers`, `answerAreaStyle`, `answerLines` |
| choice | `options[]`, `correctOptionId(s)`, `choiceOptionFormat` |
| `fill_gaps` | `gapsSourceText`, `gapsAnswers[]` |
| `matching` | `leftItems`, `rightItems`, `correctAnswers` (строки `"A → B"`) |
| `grouping` | `tableRows/Cols`, `tableHeaders`, `tableCells`, `tableAnswerBank` |
| `ordering` | `orderItems[]`, `correctAnswers[]` |
| `text` | `body` |
| `answer_field` | `mediaUrl` или `mediaFileData` |
| `page_break` | только разрыв страницы |

Старый `type: 'table'` при normalize превращается в `grouping`.

---

## Пример: блок matching

1. Платформа передаёт draft с блоком matching на странице 0.
2. `buildPageBlocks` находит его и считает номер задания (например, 1).
3. `buildBlockContent` вызывает `buildMatching` с нужным флагом ответов.
4. `renderMatchingDom.ts` собирает HTML — с линиями или без, в зависимости от режима.
5. `domToPng.ts` делает PNG и кладёт в кэш.
6. Картинка вставляется в шапку задания через `buildWidgetBodyRow`.
7. `buildTaskHeadTable` возвращает таблицу для docx.
8. Блоки страницы склеиваются в секцию документа.
9. `Packer.toBlob` — готовый `.docx`.

---

## Если что-то не так

| Что видите | Куда смотреть | Что проверить |
|------------|---------------|---------------|
| пустой или битый Word | `normalizeWorksheetDraft` | вызывалась ли подготовка |
| сбились номера заданий | `syncPagesFromBreaks` | `block.page` и `page_break` |
| нет картинок в choice | `fetchImageBytes` | CORS или data URL |
| формулы картинками | `latexToWordMath` → `mathToImage` | сложный LaTeX — так и задумано |
| matching «едет» | `renderMatchingDom` | данные после normalize |
| падает на сервере | `domToPng` | экспорт только в браузере |
| у grouping нет вопроса | `questionPlaceholderForBlock` | normalize и placeholder |

---

## Тесты

При переносе на платформу имеет смысл гонять `npm test`:

- `latexToWordMath.test.ts`
- `buildTaskHeadTable.test.ts`
- `layoutTokens.test.ts`, `layoutSpec.test.ts`

---

## Структура папки

```
src/export/word/
├── exportWorksheetDocx.ts     ← exportWorksheetDocx, exportWorksheetDocxBlob
├── types.ts
├── loadExportFonts.ts
├── layoutTokens.ts
├── layoutSpec.ts
├── imageUtils.ts
├── build/
│   ├── buildSheet.ts
│   ├── buildHeader.ts
│   ├── buildBlock.ts
│   ├── buildTaskHeadTable.ts
│   └── buildAnswerArea.ts
├── richText/                  ← текст и формулы
└── rasterize/                 ← виджеты как PNG
```

Если что-то в документе не сходится с поведением — ориентируйтесь на код и тесты.
