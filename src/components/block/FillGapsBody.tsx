import { useEffect, useRef } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
import { gapWordOccursOutsideMath, hasGapMarkersInMath, isSelectionInsideMath, sanitizeGapsSourceText } from '@/data/mathTextUtils'
import { markGapAnswersInText, sanitizeGapAnswers } from '@/data/blockUtils'
import { MathText } from '@/components/MathText'
import { WysiwygTextarea } from '@/components/WysiwygTextarea'
import { Button } from '@/components/ui'

interface FillGapsEditorProps {
  sourceText: string
  gapWords: string[]
  onChange: (patch: Partial<WorksheetBlock>) => void
}

export function FillGapsEditor({
  sourceText,
  gapWords,
  onChange,
}: FillGapsEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const sanitizedSource = sanitizeGapsSourceText(sourceText)
    const valid = sanitizeGapAnswers(sanitizedSource, gapWords)
    const sourceChanged = sanitizedSource !== sourceText
    const answersChanged =
      valid.length !== gapWords.length || valid.some((word, index) => word !== gapWords[index])

    if (sourceChanged || answersChanged) {
      onChange({
        gapsAnswers: valid,
        gapsSourceText: sanitizedSource,
        gapsText: undefined,
      })
    }
  }, [sourceText, gapWords, onChange])

  const validGapWords = sanitizeGapAnswers(sourceText, gapWords)
  const mathGapsRemoved = hasGapMarkersInMath(sourceText)

  const syncSource = (nextSource: string) => {
    const sanitizedSource = sanitizeGapsSourceText(nextSource)
    onChange({
      gapsSourceText: sanitizedSource,
      gapsText: undefined,
      gapsAnswers: sanitizeGapAnswers(sanitizedSource, gapWords),
    })
  }

  const addGapWord = (word: string) => {
    const trimmed = word.trim()
    if (!trimmed || gapWords.includes(trimmed)) return
    if (!gapWordOccursOutsideMath(sourceText, trimmed)) return
    onChange({
      gapsAnswers: [...gapWords, trimmed],
      gapsSourceText: sourceText,
      gapsText: undefined,
    })
  }

  const addGapFromSelection = () => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (isSelectionInsideMath(sourceText, start, end)) return
    const selected = sourceText.slice(start, end).trim()
    if (selected) addGapWord(selected)
  }

  const removeGap = (word: string) => {
    onChange({
      gapsAnswers: gapWords.filter((item) => item !== word),
      gapsSourceText: sourceText,
      gapsText: undefined,
    })
  }

  return (
    <div className="gaps-editor">
      <WysiwygTextarea
        className="ws-inline-textarea gaps-source-textarea"
        rows={8}
        value={sourceText}
        placeholder="Текст с пропусками"
        inputRef={textareaRef}
        floatingToolbar
        mathPreview
        onChange={syncSource}
        onClick={(e) => e.stopPropagation()}
      />

      {validGapWords.length > 0 ? (
        <div className="gaps-words-bank" aria-label="Пропущенные слова">
          <span className="gaps-words-bank-label">Пропущенные слова:</span>
          {validGapWords.map((word, index) => (
            <span key={word} className="gaps-words-bank-item">
              <button
                type="button"
                className="gaps-words-bank-word"
                onClick={() => removeGap(word)}
                title="Удалить из пропусков"
              >
                <MathText text={word} as="span" />
              </button>
              {index < validGapWords.length - 1 ? <span className="gaps-words-bank-sep">,</span> : null}
            </span>
          ))}
        </div>
      ) : null}

      <Button variant="secondary" size="sm" type="button" onClick={addGapFromSelection}>
        Добавить в пропуски
      </Button>

      {mathGapsRemoved ? (
        <p className="gaps-editor-hint">Пропуски внутри формул не поддерживаются и будут удалены.</p>
      ) : null}
    </div>
  )
}

interface FillGapsStudentProps {
  text: string
  gapWords?: string[]
  showWordBank?: boolean
  shuffledWords?: string[]
  showAnswer?: boolean
}

export function FillGapsStudent({
  text,
  gapWords = [],
  showWordBank = false,
  shuffledWords = [],
  showAnswer = false,
}: FillGapsStudentProps) {
  if (!text.trim()) {
    return <p className="gaps-empty-label">Текст с пропусками</p>
  }

  const words = showWordBank && shuffledWords.length > 0 ? shuffledWords : gapWords
  const displayText = showAnswer ? markGapAnswersInText(text, gapWords) : text

  return (
    <div className="gaps-student">
      <p className="gaps-text">
        <MathText text={displayText} />
      </p>
      {words.length > 0 ? (
        <div className="gaps-words-bank gaps-words-bank--student">
          <span className="gaps-words-bank-label">Пропущенные слова:</span>
          {words.map((word, index) => (
            <span key={`${word}-${index}`} className="gaps-words-bank-item">
              <MathText text={word} as="span" />
              {index < words.length - 1 ? <span className="gaps-words-bank-sep">,</span> : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
