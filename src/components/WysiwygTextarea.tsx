import { useRef } from 'react'

type WrapMode = 'bold' | 'italic' | 'heading' | 'code'

const WRAP: Record<WrapMode, { before: string; after: string }> = {
  bold: { before: '**', after: '**' },
  italic: { before: '*', after: '*' },
  heading: { before: '### ', after: '' },
  code: { before: '`', after: '`' },
}

interface WysiwygTextareaProps {
  className?: string
  rows?: number
  value: string
  maxLength?: number
  placeholder?: string
  onChange: (value: string) => void
  onClick?: (e: React.MouseEvent) => void
}

export function WysiwygTextarea({
  className,
  rows = 3,
  value,
  maxLength,
  placeholder,
  onChange,
  onClick,
}: WysiwygTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const applyWrap = (mode: WrapMode) => {
    const el = ref.current
    if (!el) return
    const { before, after } = WRAP[mode]
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || 'текст'
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    const trimmed = maxLength ? next.slice(0, maxLength) : next
    onChange(trimmed)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + before.length + selected.length + after.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="wysiwyg-field" onClick={onClick}>
      <div className="wysiwyg-mini-tools">
        <button type="button" onClick={() => applyWrap('bold')} aria-label="Жирный">
          B
        </button>
        <button type="button" onClick={() => applyWrap('italic')} aria-label="Курсив">
          I
        </button>
        <button type="button" onClick={() => applyWrap('heading')} aria-label="Заголовок">
          H
        </button>
        <button type="button" onClick={() => applyWrap('code')} aria-label="Код">
          {'</>'}
        </button>
      </div>
      <textarea
        ref={ref}
        className={className}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {maxLength ? (
        <span className="wysiwyg-counter">
          {value.length}/{maxLength}
        </span>
      ) : null}
    </div>
  )
}
