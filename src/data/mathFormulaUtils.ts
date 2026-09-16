/** Find inline `$...$` range containing cursor (single-dollar only). */
export function getInlineFormulaRange(
  text: string,
  cursor: number,
): { start: number; end: number; latex: string } | null {
  let searchFrom = Math.min(cursor, text.length)

  while (searchFrom >= 0) {
    const open = text.lastIndexOf('$', searchFrom)
    if (open < 0) break
    if (open > 0 && text[open - 1] === '$') {
      searchFrom = open - 2
      continue
    }

    const close = text.indexOf('$', open + 1)
    if (close < 0) break
    if (text[close + 1] === '$') {
      searchFrom = open - 1
      continue
    }

    if (cursor >= open && cursor <= close + 1) {
      return {
        start: open,
        end: close + 1,
        latex: text.slice(open + 1, close),
      }
    }

    searchFrom = open - 1
  }

  return null
}

export function insertAtCursor(
  text: string,
  cursor: number,
  insert: string,
): { next: string; cursor: number } {
  const next = text.slice(0, cursor) + insert + text.slice(cursor)
  return { next, cursor: cursor + insert.length }
}

export function replaceRange(
  text: string,
  start: number,
  end: number,
  replacement: string,
): { next: string; cursor: number } {
  const next = text.slice(0, start) + replacement + text.slice(end)
  return { next, cursor: start + replacement.length }
}

export function wrapInlineFormula(latex: string): string {
  return `$${latex}$`
}
