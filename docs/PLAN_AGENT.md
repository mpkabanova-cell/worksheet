# AI-агент планирования рабочего листа

Краткая выжимка product spec (полный текст — в приложенном PDF «AI-агент планирования»).

## Роль

Агент планирования **не создаёт конкретные задания** (числа, варианты, ответы). Он формирует или нормализует `task_plan` — упорядоченный список элементов с полями:

| Поле | Смысл |
|------|--------|
| `type` | Механика: `input`, `single_choice`, `multiple_choice`, `matching`, `table`, `ordering`, `fill_gaps` |
| `user_description` | Краткий замысел (до 100 символов у AI) |
| `description` | Нормализованное описание для агента генерации |
| `difficulty` | `basic` \| `medium` \| `advanced` |

## Вход (user JSON)

- `subject`, `grade`, `topic`
- `plan_difficulty` — `basic` \| `medium` \| `advanced` \| `differentiated`
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
| Парсинг ответа | [`src/data/ai.ts`](../src/data/ai.ts) → `generatePlanAI` |
| Маппинг механик | [`src/data/planMechanics.ts`](../src/data/planMechanics.ts) (`input`→`short_answer`/`extended_answer`, `table`→`grouping`) |
| Модель UI | [`PlanTask`](../src/data/worksheet.ts): `userExpectation`, `description`, `planDifficulty` |
| Генерация листа | [`promptsForWorksheet`](../src/data/aiPrompts.ts) — опирается на `description` |

## Ограничения (из spec)

- Не планировать задания, зависящие от изображений.
- Элементы с заполненным `description` не изменять.
- Сохранять количество и порядок `task_plan`.

См. также: [`PROMPTS.md`](./PROMPTS.md), [`CONTEXT_FILE.md`](./CONTEXT_FILE.md).
