import { useRef, useState } from 'react'
import { MathText } from '@/components/MathText'
import { MathFormulaEditor } from '@/components/MathFormulaEditor'
import { WysiwygToolbar } from '@/components/WysiwygToolbar'
import { useRichTextEditor } from '@/hooks/useRichTextEditor'

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
  showToolbar?: boolean
  floatingToolbar?: boolean
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
  showToolbar = false,
  floatingToolbar = false,
}: MathEditableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const controlRef = multiline ? textareaRef : inputRef
  const [focused, setFocused] = useState(false)

  const {
    applyWrap,
    applyInsert,
    openFormulaEditor,
    closeFormulaEditor,
    confirmFormula,
    formulaOpen,
    formulaInitial,
  } = useRichTextEditor(value, onChange, controlRef, maxLength)

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

  const toolbar =
    showToolbar && focused ? (
      <div
        className={floatingToolbar ? 'field-wysiwyg field-wysiwyg--floating' : 'field-wysiwyg'}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="wysiwyg-tools">
          <WysiwygToolbar
            floating={floatingToolbar}
            onWrap={applyWrap}
            onInsert={applyInsert}
            onOpenFormula={openFormulaEditor}
          />
        </div>
      </div>
    ) : null

  return (
    <>
      <div
        className={`math-editable ${multiline ? 'math-editable--multiline' : ''} ${
          focused ? 'math-editable--focused' : ''
        } ${showToolbar ? 'math-editable--with-toolbar' : ''} ${className ?? ''}`}
        style={style}
      >
        {toolbar}
        <div className="math-editable-preview" aria-hidden>
          {preview}
        </div>
        {multiline ? (
          <textarea ref={textareaRef} rows={rows} {...sharedInputProps} />
        ) : (
          <input ref={inputRef} type="text" {...sharedInputProps} />
        )}
      </div>

      <MathFormulaEditor
        open={formulaOpen}
        initialLatex={formulaInitial}
        onClose={closeFormulaEditor}
        onConfirm={confirmFormula}
      />
    </>
  )
}
