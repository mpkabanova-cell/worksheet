import { useRef, type RefObject } from 'react'
import { MathText } from '@/components/MathText'
import { MathFormulaEditor } from '@/components/MathFormulaEditor'
import { WysiwygToolbar } from '@/components/WysiwygToolbar'
import { useRichTextEditor } from '@/hooks/useRichTextEditor'

interface WysiwygTextareaProps {
  className?: string
  rows?: number
  value: string
  maxLength?: number
  placeholder?: string
  inputRef?: RefObject<HTMLTextAreaElement | null>
  floatingToolbar?: boolean
  mathPreview?: boolean
  onChange: (value: string) => void
  onClick?: (e: React.MouseEvent) => void
}

export function WysiwygTextarea({
  className,
  rows = 3,
  value,
  maxLength,
  placeholder,
  inputRef,
  floatingToolbar = false,
  mathPreview = false,
  onChange,
  onClick,
}: WysiwygTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const setTextareaRef = (node: HTMLTextAreaElement | null) => {
    ref.current = node
    if (inputRef) inputRef.current = node
  }

  const {
    applyWrap,
    applyInsert,
    openFormulaEditor,
    closeFormulaEditor,
    confirmFormula,
    formulaOpen,
    formulaInitial,
  } = useRichTextEditor(value, onChange, ref, maxLength)

  const textarea = mathPreview ? (
    <div className={`math-editable math-editable--multiline ${className ?? ''}`}>
      <div className="math-editable-preview" aria-hidden>
        {value.trim() ? (
          <MathText text={value} as="div" />
        ) : (
          <span className="math-editable-placeholder">{placeholder}</span>
        )}
      </div>
      <textarea
        ref={setTextareaRef}
        className="math-editable-input"
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onClick={onClick}
      />
    </div>
  ) : (
    <textarea
      ref={setTextareaRef}
      className={className}
      rows={rows}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onClick={onClick}
    />
  )

  const counter =
    maxLength && !floatingToolbar ? (
      <span className="wysiwyg-counter">
        {value.length}/{maxLength}
      </span>
    ) : null

  const formulaEditor = (
    <MathFormulaEditor
      open={formulaOpen}
      initialLatex={formulaInitial}
      onClose={closeFormulaEditor}
      onConfirm={confirmFormula}
    />
  )

  if (floatingToolbar) {
    return (
      <>
        <div className="wysiwyg-field wysiwyg-field--block" onClick={onClick}>
          <div className="block-wysiwyg" onClick={(e) => e.stopPropagation()}>
            <div className="wysiwyg-tools">
              <WysiwygToolbar
                floating
                onWrap={applyWrap}
                onInsert={applyInsert}
                onOpenFormula={openFormulaEditor}
              />
            </div>
          </div>
          {textarea}
          {counter}
        </div>
        {formulaEditor}
      </>
    )
  }

  return (
    <>
      <div className="wysiwyg-field" onClick={onClick}>
        <div className="wysiwyg-mini-tools">
          <WysiwygToolbar
            floating={false}
            compact
            onWrap={applyWrap}
            onInsert={applyInsert}
            onOpenFormula={openFormulaEditor}
          />
        </div>
        {textarea}
        {counter}
      </div>
      {formulaEditor}
    </>
  )
}
