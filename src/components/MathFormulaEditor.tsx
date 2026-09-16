import { useEffect, useMemo, useState } from 'react'
import { Button, ModalShell } from '@/components/ui'
import { MathText } from '@/components/MathText'

type EditorMode = 'expression' | 'fraction'

interface MathFormulaEditorProps {
  open: boolean
  initialLatex: string
  onClose: () => void
  onConfirm: (latex: string) => void
}

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0']

const EXPRESSION_KEYS: { label: string; latex: string }[] = [
  { label: '+', latex: '+' },
  { label: '−', latex: '-' },
  { label: '×', latex: '\\times ' },
  { label: '÷', latex: '\\div ' },
  { label: '=', latex: '=' },
  { label: '(', latex: '(' },
  { label: ')', latex: ')' },
  { label: '√', latex: '\\sqrt{}' },
  { label: 'x²', latex: '^{2}' },
  { label: 'x₂', latex: '_{}' },
  { label: 'π', latex: '\\pi ' },
  { label: '°', latex: '^{\\circ}' },
]

function buildFractionLatex(numerator: string, denominator: string): string {
  const num = numerator.trim() || '1'
  const den = denominator.trim() || '2'
  return `\\frac{${num}}{${den}}`
}

export function MathFormulaEditor({ open, initialLatex, onClose, onConfirm }: MathFormulaEditorProps) {
  const [mode, setMode] = useState<EditorMode>('expression')
  const [latex, setLatex] = useState(initialLatex)
  const [numerator, setNumerator] = useState('')
  const [denominator, setDenominator] = useState('')
  const [fractionTarget, setFractionTarget] = useState<'numerator' | 'denominator'>('numerator')

  useEffect(() => {
    if (!open) return
    setLatex(initialLatex)
    setMode('expression')
    setNumerator('')
    setDenominator('')
    setFractionTarget('numerator')
  }, [open, initialLatex])

  const preview = useMemo(() => {
    if (mode === 'fraction') {
      return wrapInline(buildFractionLatex(numerator, denominator))
    }
    return wrapInline(latex.trim() || 'x')
  }, [mode, latex, numerator, denominator])

  const append = (chunk: string) => {
    setLatex((prev) => prev + chunk)
  }

  const appendDigit = (digit: string) => {
    if (mode === 'fraction') {
      if (fractionTarget === 'numerator') {
        setNumerator((prev) => prev + digit)
      } else {
        setDenominator((prev) => prev + digit)
      }
      return
    }
    append(digit)
  }

  const backspace = () => {
    if (mode === 'fraction') {
      setDenominator((prev) => prev.slice(0, -1))
      return
    }
    setLatex((prev) => prev.slice(0, -1))
  }

  const confirm = () => {
    const result =
      mode === 'fraction' ? buildFractionLatex(numerator, denominator) : latex.trim() || 'x'
    onConfirm(result)
    onClose()
  }

  return (
    <ModalShell open={open} onClose={onClose} width={420} className="math-formula-modal">
      <div className="math-formula-editor">
        <div className="math-formula-editor__head">
          <h3>Формула</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="math-formula-editor__preview">
          <MathText text={preview} as="div" />
        </div>

        <div className="math-formula-editor__modes">
          <button
            type="button"
            className={mode === 'expression' ? 'on' : ''}
            onClick={() => setMode('expression')}
          >
            Выражение
          </button>
          <button
            type="button"
            className={mode === 'fraction' ? 'on' : ''}
            onClick={() => setMode('fraction')}
          >
            Дробь
          </button>
        </div>

        {mode === 'fraction' ? (
          <div className="math-formula-editor__fraction">
            <button
              type="button"
              className={`math-formula-editor__fraction-field ${fractionTarget === 'numerator' ? 'is-active' : ''}`}
              onClick={() => setFractionTarget('numerator')}
            >
              <span>Числитель</span>
              <div className="math-formula-editor__fraction-value">{numerator || '1'}</div>
            </button>
            <button
              type="button"
              className={`math-formula-editor__fraction-field ${fractionTarget === 'denominator' ? 'is-active' : ''}`}
              onClick={() => setFractionTarget('denominator')}
            >
              <span>Знаменатель</span>
              <div className="math-formula-editor__fraction-value">{denominator || '2'}</div>
            </button>
          </div>
        ) : null}

        <div className="math-formula-editor__keys">
          {mode === 'expression'
            ? EXPRESSION_KEYS.map((key) => (
                <button key={key.label} type="button" onClick={() => append(key.latex)}>
                  {key.label}
                </button>
              ))
            : null}
          {DIGITS.map((digit) => (
            <button key={digit} type="button" onClick={() => appendDigit(digit)}>
              {digit}
            </button>
          ))}
          <button type="button" onClick={backspace} aria-label="Стереть">
            ⌫
          </button>
        </div>

        <div className="math-formula-editor__actions">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="brand" size="sm" onClick={confirm}>
            Вставить
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}

function wrapInline(latex: string): string {
  return `$${latex}$`
}
