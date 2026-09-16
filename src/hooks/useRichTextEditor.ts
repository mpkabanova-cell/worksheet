import { useCallback, useRef, useState, type RefObject } from 'react'
import type { WrapMode } from '@/components/WysiwygToolbar'
import { WRAP } from '@/components/WysiwygToolbar'
import {
  getInlineFormulaRange,
  insertAtCursor,
  replaceRange,
  wrapInlineFormula,
} from '@/data/mathFormulaUtils'
import { looksLikeMathPlainText } from '@/data/mathTextUtils'

type TextControl = HTMLInputElement | HTMLTextAreaElement

export function useRichTextEditor(
  value: string,
  onChange: (value: string) => void,
  inputRef: RefObject<TextControl | null>,
  maxLength?: number,
) {
  const formulaRangeRef = useRef<{ start: number; end: number } | null>(null)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [formulaInitial, setFormulaInitial] = useState('')

  const applyEdit = useCallback(
    (next: string, cursor: number) => {
      const trimmed = maxLength ? next.slice(0, maxLength) : next
      onChange(trimmed)
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        const pos = Math.min(cursor, trimmed.length)
        el.setSelectionRange(pos, pos)
      })
    },
    [inputRef, maxLength, onChange],
  )

  const applyWrap = useCallback(
    (mode: WrapMode) => {
      const el = inputRef.current
      if (!el) return
      const { before, after } = WRAP[mode]
      const start = el.selectionStart ?? 0
      const end = el.selectionEnd ?? 0
      const selected = value.slice(start, end) || 'текст'
      const next = value.slice(0, start) + before + selected + after + value.slice(end)
      applyEdit(next, start + before.length + selected.length + after.length)
    },
    [applyEdit, inputRef, value],
  )

  const applyInsert = useCallback(
    (before: string, after: string, placeholder = '') => {
      const el = inputRef.current
      if (!el) return
      const start = el.selectionStart ?? 0
      const end = el.selectionEnd ?? 0
      const selected = value.slice(start, end) || placeholder
      const next = value.slice(0, start) + before + selected + after + value.slice(end)
      applyEdit(next, start + before.length + selected.length)
    },
    [applyEdit, inputRef, value],
  )

  const openFormulaEditor = useCallback(() => {
    const el = inputRef.current
    const cursor = el?.selectionStart ?? value.length
    const range = getInlineFormulaRange(value, cursor)
    if (range) {
      formulaRangeRef.current = { start: range.start, end: range.end }
      setFormulaInitial(range.latex)
    } else if (looksLikeMathPlainText(value.trim()) && !value.includes('$')) {
      formulaRangeRef.current = { start: 0, end: value.length }
      setFormulaInitial(value.trim())
    } else {
      formulaRangeRef.current = null
      setFormulaInitial('')
    }
    setFormulaOpen(true)
  }, [inputRef, value])

  const closeFormulaEditor = useCallback(() => {
    setFormulaOpen(false)
    formulaRangeRef.current = null
  }, [])

  const confirmFormula = useCallback(
    (latex: string) => {
      const wrapped = wrapInlineFormula(latex)
      const range = formulaRangeRef.current
      if (range) {
        const { next, cursor } = replaceRange(value, range.start, range.end, wrapped)
        applyEdit(next, cursor)
      } else {
        const el = inputRef.current
        const start = el?.selectionStart ?? value.length
        const end = el?.selectionEnd ?? start
        if (end > start) {
          const { next, cursor } = replaceRange(value, start, end, wrapped)
          applyEdit(next, cursor)
        } else if (looksLikeMathPlainText(value.trim())) {
          const { next, cursor } = replaceRange(value, 0, value.length, wrapped)
          applyEdit(next, cursor)
        } else {
          const { next, cursor: nextCursor } = insertAtCursor(value, start, wrapped)
          applyEdit(next, nextCursor)
        }
      }
      closeFormulaEditor()
    },
    [applyEdit, closeFormulaEditor, inputRef, value],
  )

  return {
    applyWrap,
    applyInsert,
    openFormulaEditor,
    closeFormulaEditor,
    confirmFormula,
    formulaOpen,
    formulaInitial,
  }
}
