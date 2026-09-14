import { useRef, useState } from 'react'
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
  const [focused, setFocused] = useState(false)

  const preview = value.trim() ? (
    <MathText text={value} as={multiline ? 'div' : 'span'} />
  ) : placeholder ? (
    <span className="math-editable-placeholder">{placeholder}</span>
  ) : null

  const sharedInputProps = {
    className: 'math-editable-input',
    value,
    maxLength,
    'aria-label': placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onClick,
  }

  return (
    <div
      className={`math-editable ${multiline ? 'math-editable--multiline' : ''} ${
        focused ? 'math-editable--focused' : ''
      } ${className ?? ''}`}
      style={style}
    >
      {!focused ? (
        <div className="math-editable-preview" aria-hidden>
          {preview}
        </div>
      ) : null}
      {multiline ? (
        <textarea ref={textareaRef} rows={rows} {...sharedInputProps} />
      ) : (
        <input ref={inputRef} type="text" {...sharedInputProps} />
      )}
    </div>
  )
}
