import { describe, expect, it } from 'vitest'
import {
  annotateExtractRelevance,
  inferBlockFromGrade,
  listContextBlockTitles,
  prepareReferenceContent,
  prepareReferenceContentDetailed,
  selectContextBlockByLines,
  segmentContextText,
  splitContextBlocks,
  stripIrrelevantSections,
} from './contextFilter'
import { referenceFilePayload } from './contextFile'

const CAVE_SAMPLE = `5-6 классы

Бараш, Крош, Совунья отправились в поход. Какое наименьшее суммарное время затратили друзья для преодоления пещеры, если

Совунья пересекла пещеру за 3 минуты,
Пин затратил 1 минуту?

Решение:

[картинка пингвина]

18 минут.

1 минута = 2 минуты
+1 минута = 12 минут

7-8 классы

Другая задача про магазин. Сколько стоят 2 кг яблок?`

const PYTHON_SAMPLE = `# Оформим рекурсивную функцию нахождения НОД двух чисел
def nod(a,b):
    if b==0:
        return a
    return nod(b,a%b)
sp=[]
for x in range(1,1001):
    if nod(x,y)+x*y/nod(x,y)==x*y:
        sp.append([x,y])
print(len(res))`

const LOGIC_MILK_SAMPLE = `7-8 классы

В городе Правдинске жители всегда говорят правду, а жители города Лжеграда всегда лгут. Однажды в Правдинске произошло дерзкое ограбление ювелирного магазина. Полиция задержала двух подозреваемых – Джона и Лео. Кто ограбил магазин? Жителем какого города был грабитель?

Решение:

Судья как житель Правдинска всегда говорит правду. Значит импликация прокурора была ложна.

Ответ: Джон, Правдинск

Менеджер молочного комбината начинает работать в 8.00 утра. Он получает задание развезти молочную продукцию по торговым точкам. Имеется карта расположения торговых точек и время, затрачиваемое на проезд. Как ему объехать все торговые точки за минимальное время? Когда закончится рабочий день менеджера, если время разгрузки товара составляет 20 минут?

Молочный комбинат – «Продуктовая лавка» - 10 минут

Молочный комбинат – ТЦ «Рим» - 20 минут

Решение:

Создаем нагруженный граф с цифровой нумерацией вершин.

Программа "Графоанализатор" 1.3`

describe('contextFilter', () => {
  it('removes solution sections and tails', () => {
    const filtered = stripIrrelevantSections(CAVE_SAMPLE)
    expect(filtered).toContain('Совунья пересекла пещеру за 3 минуты')
    expect(filtered).not.toContain('Решение:')
    expect(filtered).not.toContain('18 минут')
    expect(filtered).not.toContain('[картинка пингвина]')
    expect(filtered).not.toContain('1 минута = 2 минуты')
    expect(filtered).toContain('Другая задача про магазин')
  })

  it('selects block by title and strips its solution', () => {
    const filtered = prepareReferenceContent(CAVE_SAMPLE, { block: '5-6 классы' })
    expect(filtered).toContain('преодоления пещеры')
    expect(filtered).not.toContain('Решение:')
    expect(filtered).not.toContain('7-8 классы')
    expect(filtered).not.toContain('магазин')
  })

  it('lists block titles without solution sections', () => {
    const titles = listContextBlockTitles(CAVE_SAMPLE)
    expect(titles).toContain('5-6 классы')
    expect(titles).toContain('7-8 классы')
    expect(titles.some((t) => /решение/i.test(t))).toBe(false)
    expect(titles.some((t) => /минут\s*=/.test(t))).toBe(false)
  })

  it('infers block from grade when wishes are empty', () => {
    expect(inferBlockFromGrade('6', CAVE_SAMPLE)).toBe('5-6 классы')
    expect(inferBlockFromGrade('7', CAVE_SAMPLE)).toBe('7-8 классы')
    const filtered = prepareReferenceContent(CAVE_SAMPLE, { grade: '6' })
    expect(filtered).toContain('преодоления пещеры')
    expect(filtered).not.toContain('7-8 классы')
    expect(filtered).not.toContain('магазин')
  })

  it('prefers wishes over grade for block selection', () => {
    const filtered = prepareReferenceContent(CAVE_SAMPLE, {
      grade: '6',
      wishes: 'Использовать блок 7-8 классы',
    })
    expect(filtered).toContain('магазин')
    expect(filtered).not.toContain('преодоления пещеры')
  })

  it('annotates relevant and irrelevant lines', () => {
    const annotated = annotateExtractRelevance(CAVE_SAMPLE)
    expect(annotated).toContain('ctx-relevant')
    expect(annotated).toContain('ctx-irrelevant')
    expect(annotated).toContain('Совунья пересекла пещеру')
    expect(annotated).toContain('18 минут')
    expect(annotated).toContain('ctx-irrelevant">Решение:')
  })

  it('keeps milk routing task after logic puzzle solution in the same grade block', () => {
    const filtered = stripIrrelevantSections(LOGIC_MILK_SAMPLE)
    expect(filtered).toContain('Кто ограбил магазин')
    expect(filtered).toContain('Менеджер молочного комбината')
    expect(filtered).toContain('Молочный комбинат – «Продуктовая лавка» - 10 минут')
    expect(filtered).not.toContain('Судья как житель')
    expect(filtered).not.toContain('Ответ: Джон')
    expect(filtered).not.toContain('Графоанализатор')
  })

  it('marks milk task condition as relevant after logic answer', () => {
    const annotated = annotateExtractRelevance(LOGIC_MILK_SAMPLE)
    expect(annotated).toContain('ctx-relevant">Менеджер молочного комбината')
    expect(annotated).toContain('ctx-relevant">Молочный комбинат – «Продуктовая лавка» - 10 минут')
    expect(annotated).toContain('ctx-irrelevant">Ответ: Джон, Правдинск')
  })

  it('does not split route lines into separate blocks', () => {
    const blocks = splitContextBlocks(LOGIC_MILK_SAMPLE)
    const routeTitles = blocks.map((b) => b.title).filter((t) => /молочный комбинат/i.test(t))
    expect(routeTitles).toHaveLength(0)
  })

  it('uses the same filter for reference_file payload and prepareReferenceContent', () => {
    const raw = LOGIC_MILK_SAMPLE
    const filtered = prepareReferenceContent(raw, { wishes: '7-8 классы' })
    const payload = referenceFilePayload({
      contextFileName: 'proba.pdf',
      contextFileText: raw,
      wishes: '7-8 классы',
    })
    expect(payload?.content).toBe(filtered)
  })

  it('respects wishes in annotateExtractRelevance scope', () => {
    const full = annotateExtractRelevance(CAVE_SAMPLE, { fullExtract: true })
    const scoped = annotateExtractRelevance(CAVE_SAMPLE, { wishes: '5-6 классы' })
    expect(full).toContain('магазин')
    expect(scoped).not.toContain('магазин')
    expect(scoped).toContain('преодоления пещеры')
  })

  it('annotates full extract even when grade selects a block', () => {
    const full = annotateExtractRelevance(CAVE_SAMPLE, { grade: '6', fullExtract: true })
    const scoped = annotateExtractRelevance(CAVE_SAMPLE, { grade: '6' })
    expect(full).toContain('магазин')
    expect(scoped).not.toContain('магазин')
  })

  it('falls back when block body is only solution tails', () => {
    const sample = `5-6 классы

Решение:

[картинка]

18 минут.

1 минута = 2 минуты

7-8 классы

Задача про магазин.`
    const result = prepareReferenceContentDetailed(sample, { grade: '6' })
    expect(result.content).toContain('5-6 классы')
    expect(result.content).not.toContain('18 минут')
  })

  it('selectContextBlock includes block title in filtered reference', () => {
    const picked = prepareReferenceContent(CAVE_SAMPLE, { block: '5-6 классы' })
    expect(picked).toContain('5-6 классы')
    expect(picked).toContain('пещер')
  })

  it('recovers section when OCR puts grade heading after task text', () => {
    const ocrOrder = `Бараш, Крош, Совунья отправились в поход. Какое наименьшее суммарное время затратили друзья для преодоления пещеры, если

Совунья пересекла пещеру за 3 минуты,
Пин затратил 1 минуту?

5-6 классы

Решение:

18 минут.

7-8 классы

Задача про магазин.`
    const scoped = selectContextBlockByLines(ocrOrder, '5-6 классы')
    expect(scoped).toContain('Бараш')
    expect(scoped).toContain('5-6 классы')

    const result = prepareReferenceContentDetailed(ocrOrder, { grade: '6' })
    expect(result.content).toContain('Совунья')
    expect(result.content.length).toBeGreaterThan(50)
    expect(result.content).not.toContain('магазин')
    expect(result.content).not.toContain('18 минут')
  })

  it('classifies roles via segmentContextText', () => {
    const caveRoles = segmentContextText(CAVE_SAMPLE).map((line) => line.role)
    expect(caveRoles).toContain('heading')
    expect(caveRoles).toContain('condition')
    expect(caveRoles).toContain('solution')
    expect(caveRoles).toContain('answer_key')

    const milkRoles = segmentContextText(LOGIC_MILK_SAMPLE).map((line) => line.role)
    expect(milkRoles).toContain('data_table')

    const pythonRoles = segmentContextText(PYTHON_SAMPLE)
    expect(pythonRoles.every((line) => line.role === 'noise')).toBe(true)
    expect(stripIrrelevantSections(PYTHON_SAMPLE)).toBe('')

    const fenced = annotateExtractRelevance('```python\n' + PYTHON_SAMPLE + '\n```')
    expect(fenced).not.toContain('ctx-relevant')
    expect(fenced).toContain('ctx-irrelevant')
  })
})
