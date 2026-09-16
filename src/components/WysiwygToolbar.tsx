import { FigmaIcon } from '@/components/ui'
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

export type WrapMode = 'bold' | 'italic' | 'strike' | 'underline' | 'heading' | 'code'

export const WRAP: Record<WrapMode, { before: string; after: string }> = {
  bold: { before: '**', after: '**' },
  italic: { before: '*', after: '*' },
  strike: { before: '~~', after: '~~' },
  underline: { before: '<u>', after: '</u>' },
  heading: { before: '### ', after: '' },
  code: { before: '`', after: '`' },
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

export function WysiwygToolbar({
  floating = true,
  compact = false,
  onWrap,
  onInsert,
  onOpenFormula,
}: {
  floating?: boolean
  compact?: boolean
  onWrap: (mode: WrapMode) => void
  onInsert: (before: string, after: string, placeholder?: string) => void
  onOpenFormula?: () => void
}) {
  if (compact) {
    return (
      <>
        <ToolButton floating={false} icon={iconBold} label="Жирный" onClick={() => onWrap('bold')} />
        <ToolButton floating={false} icon={iconItalic} label="Курсив" onClick={() => onWrap('italic')} />
        <ToolButton floating={false} icon={iconStrike} label="Зачёркнутый" onClick={() => onWrap('strike')} />
        <ToolButton floating={false} icon={iconCode} label="Код" onClick={() => onWrap('code')} />
      </>
    )
  }

  return (
    <>
      <ToolButton floating={floating} icon={iconBold} label="Жирный" onClick={() => onWrap('bold')} />
      <ToolButton floating={floating} icon={iconItalic} label="Курсив" onClick={() => onWrap('italic')} />
      <ToolButton floating={floating} icon={iconStrike} label="Зачёркнутый" onClick={() => onWrap('strike')} />
      <ToolButton floating={floating} icon={iconUnderline} label="Подчёркнутый" onClick={() => onWrap('underline')} />
      <ToolButton
        floating={floating}
        icon={iconMath}
        label="Формула"
        onClick={() => (onOpenFormula ? onOpenFormula() : onInsert('$', '$', 'x'))}
      />
      <ToolButton floating={floating} icon={iconCode} label="Код" onClick={() => onWrap('code')} />
      <ToolButton
        floating={floating}
        icon={iconSubscript}
        label="Подстрочный"
        onClick={() => onInsert('$_{', '}$', 'x')}
      />
      <ToolButton
        floating={floating}
        icon={iconSuperscript}
        label="Надстрочный"
        onClick={() => onInsert('$^{', '}$', 'x')}
      />
      <ToolButton
        floating={floating}
        icon={iconImage}
        label="Изображение"
        onClick={() => onInsert('![', '](ссылка)', 'описание')}
      />
      <span className="wysiwyg-divider" aria-hidden />
      <ToolButton
        floating={floating}
        icon={iconMore}
        label="Разделитель"
        onClick={() => onInsert('\n\n---\n\n', '', '')}
      />
    </>
  )
}
