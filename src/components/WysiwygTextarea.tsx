import { useEffect, useRef, useState, type RefObject } from 'react'
import { FigmaIcon } from '@/components/ui'
import chevronIcon from '@/assets/create/chevron.svg'
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

const FORMAT_OPTIONS: { id: 'paragraph' | 'heading'; label: string }[] = [
  { id: 'paragraph', label: 'Абзац' },
  { id: 'heading', label: 'Заголовок' },
]

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

function FormatDropdown({
  onParagraph,
  onHeading,
}: {
  onParagraph: () => void
  onHeading: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="wysiwyg-format" ref={rootRef}>
      <button
        type="button"
        className="wysiwyg-format-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>Абзац</span>
        <FigmaIcon src={chevronIcon} size={18} />
      </button>
      {open ? (
        <div className="wysiwyg-format-menu" role="listbox">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              className="wysiwyg-format-option"
              onClick={() => {
                if (option.id === 'heading') onHeading()
                else onParagraph()
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function WysiwygToolbar({
  floating,
  onWrap,
  onInert,
  onParagraph,
  onHeading,
}: {
  floating: boolean
  onWrap: (mode: WrapMode) => void
  onInert: () => void
  onParagraph: () => void
  onHeading: () => void
}) {
  if (floating) {
    return (
      <>
        <FormatDropdown onParagraph={onParagraph} onHeading={onHeading} />
        <span className="wysiwyg-divider" aria-hidden />
        <ToolButton floating icon={iconBold} label="Жирный" onClick={() => onWrap('bold')} />
        <ToolButton floating icon={iconItalic} label="Курсив" onClick={() => onWrap('italic')} />
        <ToolButton floating icon={iconStrike} label="Зачёркнутый" onClick={() => onWrap('strike')} />
        <ToolButton floating icon={iconUnderline} label="Подчёркнутый" onClick={() => onWrap('underline')} />
        <ToolButton floating icon={iconMath} label="Формула" onClick={onInert} />
        <ToolButton floating icon={iconCode} label="Код" onClick={() => onWrap('code')} />
        <ToolButton floating icon={iconSubscript} label="Подстрочный" onClick={onInert} />
        <ToolButton floating icon={iconSuperscript} label="Надстрочный" onClick={onInert} />
        <span className="wysiwyg-hr" aria-hidden />
        <ToolButton floating icon={iconImage} label="Изображение" onClick={onInert} />
        <span className="wysiwyg-divider" aria-hidden />
        <ToolButton floating icon={iconMore} label="Ещё" onClick={onInert} />
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

  const applyParagraph = () => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    if (value.slice(lineStart, lineStart + 4) !== '### ') return
    const next = value.slice(0, lineStart) + value.slice(lineStart + 4)
    onChange(maxLength ? next.slice(0, maxLength) : next)
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
            <WysiwygToolbar
              floating
              onWrap={applyWrap}
              onInert={() => undefined}
              onParagraph={applyParagraph}
              onHeading={() => applyWrap('heading')}
            />
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
        <WysiwygToolbar
          floating={false}
          onWrap={applyWrap}
          onInert={() => undefined}
          onParagraph={applyParagraph}
          onHeading={() => applyWrap('heading')}
        />
      </div>
      {textarea}
      {counter}
    </div>
  )
}
