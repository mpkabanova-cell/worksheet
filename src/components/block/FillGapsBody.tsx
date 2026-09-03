import { useRef } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
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

  const syncSource = (nextSource: string) => {
    onChange({
      gapsSourceText: nextSource,
      gapsText: undefined,
    })
  }

  const addGapWord = (word: string) => {
    const trimmed = word.trim()
    if (!trimmed || gapWords.includes(trimmed)) return
    onChange({
      gapsAnswers: [...gapWords, trimmed],
      gapsSourceText: sourceText,
      gapsText: undefined,
    })
  }

  const addGapFromSelection = () => {
    const el = textareaRef.current
    if (!el) return
    const selected = sourceText.slice(el.selectionStart, el.selectionEnd).trim()
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

      {gapWords.length > 0 ? (
        <div className="gaps-words-bank" aria-label="Пропущенные слова">
          <span className="gaps-words-bank-label">Пропущенные слова:</span>
          {gapWords.map((word, index) => (
            <span key={word} className="gaps-words-bank-item">
              <button
                type="button"
                className="gaps-words-bank-word"
                onClick={() => removeGap(word)}
                title="Удалить из пропусков"
              >
                <MathText text={word} as="span" />
              </button>
              {index < gapWords.length - 1 ? <span className="gaps-words-bank-sep">,</span> : null}
            </span>
          ))}
        </div>
      ) : null}

      <Button variant="secondary" size="sm" type="button" onClick={addGapFromSelection}>
        Добавить в пропуски
      </Button>
    </div>
  )
}

interface FillGapsStudentProps {
  text: string
  gapWords?: string[]
  showWordBank?: boolean
  shuffledWords?: string[]
}

export function FillGapsStudent({
  text,
  gapWords = [],
  showWordBank = false,
  shuffledWords = [],
}: FillGapsStudentProps) {
  if (!text.trim()) {
    return <p className="gaps-empty-label">Текст с пропусками</p>
  }

  const words = showWordBank && shuffledWords.length > 0 ? shuffledWords : gapWords

  return (
    <div className="gaps-student">
      <p className="gaps-text">
        <MathText text={text} />
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
