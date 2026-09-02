import { useMemo, useState } from 'react'
import type { WorksheetBlock } from '@/data/worksheet'
import { tokenizeGapText } from '@/data/blockUtils'
import { MathText } from '@/components/MathText'

interface FillGapsEditorProps {
  sourceText: string
  gapWords: string[]
  showAnswer: boolean
  onChange: (patch: Partial<WorksheetBlock>) => void
}

export function FillGapsEditor({ sourceText, gapWords, showAnswer, onChange }: FillGapsEditorProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const tokens = useMemo(() => tokenizeGapText(sourceText), [sourceText])

  const toggleGap = (word: string) => {
    if (!word.trim() || /^\s+$/.test(word)) return
    const exists = gapWords.includes(word)
    const next = exists ? gapWords.filter((w) => w !== word) : [...gapWords, word]
    onChange({
      gapsAnswers: next,
      gapsSourceText: sourceText,
      gapsText: undefined,
    })
  }

  return (
    <div className="gaps-slot">
      <label className="side-field">
        <span>Текст с пропусками</span>
        <textarea
          className="side-field-textarea gaps-source-textarea"
          rows={6}
          value={sourceText}
          placeholder="Введите текст задания…"
          onChange={(e) =>
            onChange({
              gapsSourceText: e.target.value,
              gapsText: undefined,
            })
          }
        />
      </label>
      <p className="side-hint">Выделите слово в тексте ниже и отметьте его как пропуск.</p>
      <div className="gaps-interactive">
        {tokens.map((token, i) => {
          if (/^\s+$/.test(token)) {
            return <span key={`${i}-ws`}>{token}</span>
          }
          const isGap = gapWords.includes(token)
          return (
            <span
              key={`${i}-${token}`}
              className={`gaps-word-token ${isGap ? 'is-gap' : ''} ${selectedWord === token ? 'selected' : ''}`}
              onClick={() => setSelectedWord(token)}
            >
              {token}
            </span>
          )
        })}
      </div>
      {selectedWord ? (
        <div className="gaps-word-actions">
          <button type="button" className="gaps-action-btn" onClick={() => toggleGap(selectedWord)}>
            {gapWords.includes(selectedWord) ? 'Убрать пропуск' : 'Сделать пропуском'}
          </button>
        </div>
      ) : null}
      {(gapWords.length > 0 || showAnswer) && (
        <div className="gaps-words">
          <span className="gaps-words-label">Пропущенные слова:</span>
          {gapWords.map((word, i) => (
            <button
              key={`${word}-${i}`}
              type="button"
              className={`gaps-word ${showAnswer ? 'revealed' : ''}`}
              onClick={() => setSelectedWord(word)}
            >
              {word}
              {i < gapWords.length - 1 ? ',' : ''}
            </button>
          ))}
        </div>
      )}
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
      <div className="gaps-words">
        <span className="gaps-words-label">Пропущенные слова:</span>
        {gapWords.map((word, i) => (
          <span key={`${word}-${i}`} className="gaps-word revealed">
            {word}
            {i < gapWords.length - 1 ? ',' : ''}
          </span>
        ))}
      </div>
    </>
  )
}
