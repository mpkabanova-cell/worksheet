import { useRef } from 'react'
import { MathText } from '@/components/MathText'

interface MathEditableInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  maxLength?: number
  rows?: number
  multiline?: boolean
  style?: React.CSSProperties
  onClick?: (e: React.MouseEvent) => void
}

export function MathEditableInput({
  value,
  onChange,
  className,
  placeholder,
  maxLength,
  rows = 1,
  multiline = false,
  style,
  onClick,
}: MathEditableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const preview = value.trim() ? (
    <MathText text={value} as={multiline ? 'div' : 'span'} />
  ) : placeholder ? (
    <span className="math-editable-placeholder">{placeholder}</span>
  ) : null

  return (
    <div
      className={`math-editable ${multiline ? 'math-editable--multiline' : ''} ${className ?? ''}`}
      style={style}
    >
      <div className="math-editable-preview" aria-hidden>
        {preview}
      </div>
      {multiline ? (
        <textarea
          ref={textareaRef}
          className="math-editable-input"
          value={value}
          rows={rows}
          maxLength={maxLength}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onClick={onClick}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          className="math-editable-input"
          value={value}
          maxLength={maxLength}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onClick={onClick}
        />
      )}
    </div>
  )
}
