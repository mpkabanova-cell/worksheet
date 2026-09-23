# AI-агент планирования рабочего листа

Краткая выжимка product spec (полный текст — в приложенном PDF «генерация плана»).

## Роль

Агент планирования **не создаёт конкретные задания** (числа, варианты, ответы). Он формирует или нормализует `task_plan` — упорядоченный список элементов с полями:

| Поле | Смысл |
|------|--------|
| `type` | Механика: `input`, `single_choice`, `multiple_choice`, `matching`, `table`, `ordering`, `fill_gaps` |
| `user_description` | Краткий замысел (до 100 символов у AI) |
| `description` | Нормализованное описание для агента генерации |
| `difficulty` | `basic` \| `medium` \| `advanced` |

## Инициализация и UI

- Новый лист: `createPlan(count)` — строки с `description: null`, `type` не выбран (placeholder «—»).
- Изменение `task_count`: `resizePlanToTaskCount` — trim/add с конца, существующие строки сохраняются.

## Snapshot и invalidation

После генерации плана или листа в `WorksheetDraft.generationBaseline` сохраняются globals + `task_plan`.

Перед вызовом Planner/Generator:

1. Если изменился любой global (`subject`, `grade`, `topic`, `difficulty`, `additional_wishes`, `source_content`) → `description = null` у **всех** строк.
2. Иначе построчно: изменились `type` или `user_description` → `description = null` только у этой строки.
3. Новая строка без пары в baseline → `description = null`.

Planner вызывается **только** если `planNeedsPlanner` — есть строка с пустым `description`.

## Вход (user JSON)

- `subject`, `grade` (число в JSON), `topic`, `task_count`
- `difficulty` — `basic` \| `medium` \| `advanced` \| `differentiated`
- `additional_wishes` — пожелания учителя (в т.ч. выбор блока файла)
- `source_content` — отфильтрованный текст приложения
- `task_plan` — текущий план (количество и порядок фиксированы)

## Выход

```json
{
  "task_plan": [
    {
      "type": "input",
      "user_description": "Текстовая задача на проценты",
      "description": "Простая текстовая задача на нахождение процента от числа с кратким числовым ответом",
      "difficulty": "basic"
    }
  ]
}
```

## Связь с кодом

| Spec | Реализация |
|------|------------|
| Промпт | [`src/data/planAgentPrompt.ts`](../src/data/planAgentPrompt.ts) → `promptsForPlan` |
| Orchestration | [`src/data/taskPlanOrchestration.ts`](../src/data/taskPlanOrchestration.ts) |
| Парсинг ответа | [`src/data/ai.ts`](../src/data/ai.ts) → `generatePlanAIWithMeta` |
| Маппинг механик | [`src/data/planMechanics.ts`](../src/data/planMechanics.ts) |
| Модель UI | [`PlanTask`](../src/data/worksheet.ts): `type`, `userDescription`, `description`, `difficulty` |
| Генерация листа | [`WORKSHEET_GENERATOR.md`](./WORKSHEET_GENERATOR.md) |

## Ограничения (из spec)

- Не планировать задания, зависящие от изображений.
- Элементы с заполненным `description` не изменять (prompt + pre-check invalidation).
- Сохранять количество и порядок `task_plan`.

См. также: [`PROMPTS.md`](./PROMPTS.md), [`CONTEXT_FILE.md`](./CONTEXT_FILE.md).
