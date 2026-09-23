# AI-агент генерации рабочего листа

Краткая выжимка product spec (полный текст — в приложенном PDF «генерация листа»).

## Роль

Агент генерации создаёт **конкретные задания** рабочего листа по утверждённому `task_plan`. Он заполняет каркас `generated_json_template` и возвращает JSON, соответствующий `generated_json_schema`.

## Вход (user JSON)

| Поле | Смысл |
|------|--------|
| `subject`, `grade`, `topic`, `task_count` | Параметры листа (`grade` — число в JSON) |
| `difficulty` | Режим сложности листа |
| `additional_wishes` | Пожелания учителя |
| `source_content` | Отфильтрованный текст приложения |
| `show_intro` | Нужна ли вводная часть |
| `task_plan` | **Полный** план: `{ type, user_description, description, difficulty }` |
| `generated_json_template` | Пустой каркас JSON по механикам |
| `generated_json_schema` | JSON Schema для ответа |

Без `reference_file` в user JSON — только `source_content`. Сериализация: [`worksheetSpecPayload.ts`](../src/data/worksheetSpecPayload.ts).

## Выход

Заполненный `generated_json_template`:

```json
{
  "title": "…",
  "intro": "…",
  "tasks": [ { "type": "input", "question": "…", … } ]
}
```

## Orchestration (фронт)

1. `resizePlanToTaskCount` — сохранить строки при изменении `task_count`
2. `invalidateDescriptions` — сброс `description` по diff globals/строк
3. Planner — только если есть `description: null`
4. Generator — `taskPlanForAgent` + template + schema
5. `saveGenerationBaseline` — snapshot после успешной генерации листа

## Связь с кодом

| Spec | Реализация |
|------|------------|
| Промпт | [`src/data/worksheetGeneratorPrompt.ts`](../src/data/worksheetGeneratorPrompt.ts) → `promptsForWorksheet` |
| Template / schema | [`src/data/worksheetJsonTemplate.ts`](../src/data/worksheetJsonTemplate.ts) |
| Парсинг ответа | [`src/data/ai.ts`](../src/data/ai.ts) → `templateToBlocks` |
| Orchestration | [`src/data/taskPlanOrchestration.ts`](../src/data/taskPlanOrchestration.ts) |

См. также: [`PLAN_AGENT.md`](./PLAN_AGENT.md), [`PROMPTS.md`](./PROMPTS.md), [`CONTEXT_FILE.md`](./CONTEXT_FILE.md).
