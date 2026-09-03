import { useRef, type RefObject } from 'react'
import { FigmaIcon } from '@/components/ui'
import { MathText } from '@/components/MathText'
import iconBold from '@/assets/worksheet/tools/wysiwyg-bold.svg'
import iconItalic from '@/assets/worksheet/tools/wysiwyg-italic.svg'
import iconStrike from '@/assets/worksheet/tools/wysiwyg-strike.svg'
import iconUnderline from '@/assets/worksheet/tools/wysiwyg-underline.svg'
import iconMath from '@/assets/worksheet/tools/wysiwyg-math.svg'
import iconCode from '@/assets/worksheet/tools/wysiwyg-code.svg'
import iconSubscript from '@/assets/worksheet/tools/wysiwyg-subscript.svg'
import iconSuperscript from '@/assets/worksheet/tools/wysiwyg-superscript.svg'
import iconImage from '@/assets/worksheet/tools/wysiwyg-image.svg'
import iconMore from '@/assets/worksheet/tools/wysiwyg-more.svg'

type WrapMode = 'bold' | 'italic' | 'strike' | 'underline' | 'heading' | 'code'

const WRAP: Record<WrapMode, { before: string; after: string }> = {
  bold: { before: '**', after: '**' },
  italic: { before: '*', after: '*' },
  strike: { before: '~~', after: '~~' },
  underline: { before: '<u>', after: '</u>' },
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
  mathPreview?: boolean
  onChange: (value: string) => void
  onClick?: (e: React.MouseEvent) => void
}

function ToolButton({
  floating,
  label,
  icon,
  onClick,
}: {
  floating: boolean
  label: string
  icon: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={floating ? 'wysiwyg-btn' : undefined}
      onClick={onClick}
      aria-label={label}
    >
      <FigmaIcon src={icon} size={18} />
    </button>
  )
}

function WysiwygToolbar({
  floating,
  onWrap,
  onInsert,
}: {
  floating: boolean
  onWrap: (mode: WrapMode) => void
  onInsert: (before: string, after: string, placeholder?: string) => void
}) {
  if (floating) {
    return (
      <>
        <ToolButton floating icon={iconBold} label="Жирный" onClick={() => onWrap('bold')} />
        <ToolButton floating icon={iconItalic} label="Курсив" onClick={() => onWrap('italic')} />
        <ToolButton floating icon={iconStrike} label="Зачёркнутый" onClick={() => onWrap('strike')} />
        <ToolButton floating icon={iconUnderline} label="Подчёркнутый" onClick={() => onWrap('underline')} />
        <ToolButton floating icon={iconMath} label="Формула" onClick={() => onInsert('$', '$', 'x')} />
        <ToolButton floating icon={iconCode} label="Код" onClick={() => onWrap('code')} />
        <ToolButton
          floating
          icon={iconSubscript}
          label="Подстрочный"
          onClick={() => onInsert('$_{', '}$', 'x')}
        />
        <ToolButton
          floating
          icon={iconSuperscript}
          label="Надстрочный"
          onClick={() => onInsert('$^{', '}$', 'x')}
        />
        <span className="wysiwyg-hr" aria-hidden />
        <ToolButton
          floating
          icon={iconImage}
          label="Изображение"
          onClick={() => onInsert('![', '](ссылка)', 'описание')}
        />
        <span className="wysiwyg-divider" aria-hidden />
        <ToolButton
          floating
          icon={iconMore}
          label="Ещё"
          onClick={() => onInsert('\n\n---\n\n', '', '')}
        />
      </>
    )
  }

  return (
    <>
      <ToolButton floating={false} icon={iconBold} label="Жирный" onClick={() => onWrap('bold')} />
      <ToolButton floating={false} icon={iconItalic} label="Курсив" onClick={() => onWrap('italic')} />
      <ToolButton floating={false} icon={iconStrike} label="Зачёркнутый" onClick={() => onWrap('strike')} />
      <ToolButton floating={false} icon={iconCode} label="Код" onClick={() => onWrap('code')} />
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
  mathPreview = false,
  onChange,
  onClick,
}: WysiwygTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const setTextareaRef = (node: HTMLTextAreaElement | null) => {
    ref.current = node
    if (inputRef) inputRef.current = node
  }

  const applyEdit = (next: string, cursor: number) => {
    const trimmed = maxLength ? next.slice(0, maxLength) : next
    onChange(trimmed)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      const pos = Math.min(cursor, trimmed.length)
      el.setSelectionRange(pos, pos)
    })
  }

  const applyWrap = (mode: WrapMode) => {
    const el = ref.current
    if (!el) return
    const { before, after } = WRAP[mode]
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || 'текст'
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    applyEdit(next, start + before.length + selected.length + after.length)
  }

  const applyInsert = (before: string, after: string, placeholder = '') => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    applyEdit(next, start + before.length + selected.length)
  }

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
        className="math-editable-input ws-inline-textarea"
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
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
            <WysiwygToolbar floating onWrap={applyWrap} onInsert={applyInsert} />
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
        <WysiwygToolbar floating={false} onWrap={applyWrap} onInsert={applyInsert} />
      </div>
      {textarea}
      {counter}
    </div>
  )
}
