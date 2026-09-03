import { useRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { MathText } from '@/components/MathText'

type SharedProps = {
  value: string
  onChange: (value: string) => void
  onClick?: (e: React.MouseEvent) => void
}

type SingleLineProps = SharedProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
    multiline?: false
  }

type MultiLineProps = SharedProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
    multiline: true
  }

export function MathEditableInput(props: SingleLineProps | MultiLineProps) {
  const { value, onChange, className, placeholder, onClick } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const preview = value.trim() ? (
    <MathText text={value} as={props.multiline ? 'div' : 'span'} />
  ) : (
    <span className="math-editable-placeholder">{placeholder}</span>
  )

  return (
    <div
      className={`math-editable ${props.multiline ? 'math-editable--multiline' : ''} ${className ?? ''}`}
    >
      <div className="math-editable-preview" aria-hidden>
        {preview}
      </div>
      {props.multiline ? (
        <textarea
          {...props}
          ref={textareaRef}
          className="math-editable-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={onClick}
        />
      ) : (
        <input
          {...props}
          ref={inputRef}
          type="text"
          className="math-editable-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={onClick}
        />
      )}
    </div>
  )
}
