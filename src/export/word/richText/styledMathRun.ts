import {
  BuilderElement,
  Math,
  MathDenominator,
  MathNumerator,
  RunProperties,
  XmlComponent,
  type MathComponent,
} from 'docx'
import {
  MATH_SCRIPT_SCALE,
  pxToHalfPoints,
  resolveTextColor,
  runMathFont,
} from '@/export/word/layoutTokens'
import type { TextStyleSpec } from '@/export/word/types'

export type MathRunRole = 'base' | 'sup' | 'sub'

class MathTextNode extends XmlComponent {
  constructor(text: string) {
    super('m:t')
    this.root.push(text)
  }
}

function mathRunProperties(role: MathRunRole): BuilderElement | null {
  if (role !== 'base') return null
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

function wordRunProperties(style: TextStyleSpec, role: MathRunRole = 'base'): RunProperties {
  const sizePx = role === 'base' ? style.sizePx : style.sizePx * MATH_SCRIPT_SCALE
  return new RunProperties({
    font: runMathFont(),
    size: pxToHalfPoints(sizePx),
    italics: false,
    italicsComplexScript: false,
    color: resolveTextColor(style),
  })
}

/** Math run with Cambria Math; base runs are upright, script runs are smaller without m:sty. */
export class StyledMathRun extends XmlComponent {
  constructor(text: string, style: TextStyleSpec, role: MathRunRole = 'base') {
    super('m:r')
    const rPr = mathRunProperties(role)
    if (rPr) this.root.push(rPr)
    this.root.push(wordRunProperties(style, role))
    this.root.push(new MathTextNode(text))
  }
}

/** Stacked fraction with explicit bar type — without m:fPr Word may flatten num/den to "37". */
export class StyledMathFraction extends XmlComponent {
  constructor(
    numerator: readonly MathComponent[],
    denominator: readonly MathComponent[],
  ) {
    super('m:f')
    this.root.push(
      new BuilderElement({
        name: 'm:fPr',
        children: [
          new BuilderElement({
            name: 'm:type',
            attributes: { val: { key: 'm:val', value: 'bar' } },
          }),
        ],
      }),
      new MathNumerator(numerator),
      new MathDenominator(denominator),
    )
  }
}

/** oMath wrapper — must not inject m:ctrlPr here (invalid OMML; Word shows recovery dialog). */
export class StyledMath extends XmlComponent {
  constructor(children: readonly MathComponent[]) {
    super('m:oMath')
    for (const child of children) {
      this.root.push(child)
    }
  }
}

export function styledMathRun(
  text: string,
  style: TextStyleSpec,
  role: MathRunRole = 'base',
): StyledMathRun {
  return new StyledMathRun(text, style, role)
}

export function styledMath(children: MathComponent[], _style: TextStyleSpec): Math {
  return new StyledMath(children) as unknown as Math
}

export function styledMathFraction(
  numerator: MathComponent[],
  denominator: MathComponent[],
): StyledMathFraction {
  return new StyledMathFraction(numerator, denominator)
}
