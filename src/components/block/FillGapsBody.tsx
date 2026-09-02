import { useRef, useState } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
import { WysiwygTextarea } from '@/components/WysiwygTextarea'
import { Button } from '@/components/ui'
import { MathText } from '@/components/MathText'

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
  const [manualGap, setManualGap] = useState('')

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
    setManualGap('')
  }

  const addGapFromSelection = () => {
    const el = textareaRef.current
    if (el) {
      const selected = sourceText.slice(el.selectionStart, el.selectionEnd).trim()
      if (selected) {
        addGapWord(selected)
        return
      }
    }
    if (manualGap.trim()) addGapWord(manualGap)
  }

  const removeGap = (word: string) => {
    onChange({
      gapsAnswers: gapWords.filter((item) => item !== word),
      gapsSourceText: sourceText,
      gapsText: undefined,
    })
  }

  return (
    <div className="gaps-sidebar-editor">
      <WysiwygTextarea
        className="ws-inline-textarea gaps-source-textarea"
        rows={8}
        value={sourceText}
        placeholder="Введите текст с пропусками…"
        inputRef={textareaRef}
        floatingToolbar
        onChange={syncSource}
        onClick={(e) => e.stopPropagation()}
      />

      {gapWords.length > 0 ? (
        <div className="gaps-chip-list" aria-label="Пропуски">
          {gapWords.map((word) => (
            <span key={word} className="gaps-chip">
              {word}
              <button
                type="button"
                className="gaps-chip-remove"
                aria-label={`Удалить пропуск «${word}»`}
                onClick={() => removeGap(word)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="gaps-add-row">
        <input
          className="gaps-add-input"
          value={manualGap}
          placeholder="Слово для пропуска"
          onChange={(e) => setManualGap(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addGapFromSelection()
            }
          }}
        />
        <Button variant="secondary" size="sm" type="button" onClick={addGapFromSelection}>
          Добавить пропуск
        </Button>
      </div>
    </div>
  )
}

interface FillGapsStudentProps {
  text: string
  gapWords: string[]
  showAnswer: boolean
}

export function FillGapsStudent({ text, gapWords, showAnswer }: FillGapsStudentProps) {
  if (!showAnswer || !gapWords.length) {
    return (
      <p className="gaps-text">
        <MathText text={text} />
      </p>
    )
  }

  return (
    <>
      <p className="gaps-text">
        <MathText text={text} />
      </p>
      <div className="gaps-answer-bank">
        {gapWords.map((word) => (
          <span key={word} className="gaps-chip gaps-chip--answer">
            {word}
          </span>
        ))}
      </div>
    </>
  )
}
