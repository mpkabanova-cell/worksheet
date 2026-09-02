import { useRef, type RefObject } from 'react'

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
  inputRef?: RefObject<HTMLTextAreaElement | null>
  floatingToolbar?: boolean
  onChange: (value: string) => void
  onClick?: (e: React.MouseEvent) => void
}

function WysiwygToolbar({
  floating,
  onWrap,
}: {
  floating: boolean
  onWrap: (mode: WrapMode) => void
}) {
  const btnClass = floating ? 'wysiwyg-btn' : undefined

  return (
    <>
      <button type="button" className={btnClass} onClick={() => onWrap('bold')} aria-label="Жирный">
        Ж
      </button>
      <button type="button" className={btnClass} onClick={() => onWrap('italic')} aria-label="Курсив">
        К
      </button>
      <button type="button" className={btnClass} onClick={() => onWrap('heading')} aria-label="Заголовок">
        H
      </button>
      {floating ? <span className="wysiwyg-divider" aria-hidden /> : null}
      <button type="button" className={btnClass} onClick={() => onWrap('code')} aria-label="Код">
        {'{ }'}
      </button>
    </>
  )
}

export function WysiwygTextarea({
  className,
  rows = 3,
  value,
  maxLength,
  placeholder,
  inputRef,
  floatingToolbar = false,
  onChange,
  onClick,
}: WysiwygTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const setTextareaRef = (node: HTMLTextAreaElement | null) => {
    ref.current = node
    if (inputRef) inputRef.current = node
  }

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

  const textarea = (
    <textarea
      ref={setTextareaRef}
      className={className}
      rows={rows}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )

  const counter =
    maxLength ? (
      <span className="wysiwyg-counter">
        {value.length}/{maxLength}
      </span>
    ) : null

  if (floatingToolbar) {
    return (
      <div className="wysiwyg-field wysiwyg-field--block" onClick={onClick}>
        <div className="block-wysiwyg" onClick={(e) => e.stopPropagation()}>
          <div className="wysiwyg-tools">
            <WysiwygToolbar floating onWrap={applyWrap} />
          </div>
        </div>
        {textarea}
        {counter}
      </div>
    )
  }

  return (
    <div className="wysiwyg-field" onClick={onClick}>
      <div className="wysiwyg-mini-tools">
        <WysiwygToolbar floating={false} onWrap={applyWrap} />
      </div>
      {textarea}
      {counter}
    </div>
  )
}
