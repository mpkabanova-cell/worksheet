import { BuilderElement, Math, RunProperties, XmlComponent, type MathComponent } from 'docx'
import { pxToHalfPoints, runFont } from '@/export/word/layoutTokens'
import type { TextStyleSpec } from '@/export/word/types'

class MathTextNode extends XmlComponent {
  constructor(text: string) {
    super('m:t')
    this.root.push(text)
  }
}

function wordRunProperties(style: TextStyleSpec): RunProperties {
  const size = pxToHalfPoints(style.sizePx)
  return new RunProperties({
    font: runFont(),
    size,
    italics: false,
    italicsComplexScript: false,
  })
}

function mathRunProperties(): BuilderElement {
  return new BuilderElement({
    name: 'm:rPr',
    children: [
      new BuilderElement({
        name: 'm:sty',
        attributes: { val: { key: 'm:val', value: 'p' } },
      }),
    ],
  })
}

/** Default ctrl properties for structural math elements (fractions, scripts, etc.). */
function mathCtrlProperties(style: TextStyleSpec): BuilderElement {
  return new BuilderElement({
    name: 'm:ctrlPr',
    children: [wordRunProperties(style)],
  })
}

/** Math run with paragraph-matched font size and upright (non-italic) style. */
export class StyledMathRun extends XmlComponent {
  constructor(text: string, style: TextStyleSpec) {
    super('m:r')
    // OMML schema: m:rPr and w:rPr are siblings under m:r (w:rPr must NOT be nested in m:rPr).
    this.root.push(mathRunProperties())
    this.root.push(wordRunProperties(style))
    this.root.push(new MathTextNode(text))
  }
}

/** oMath wrapper with default ctrlPr so nested constructs inherit size and upright style. */
export class StyledMath extends XmlComponent {
  constructor(children: readonly MathComponent[], style: TextStyleSpec) {
    super('m:oMath')
    this.root.push(mathCtrlProperties(style))
    for (const child of children) {
      this.root.push(child)
    }
  }
}

export function styledMathRun(text: string, style: TextStyleSpec): StyledMathRun {
  return new StyledMathRun(text, style)
}

export function styledMath(children: MathComponent[], style: TextStyleSpec): Math {
  return new StyledMath(children, style) as unknown as Math
}
