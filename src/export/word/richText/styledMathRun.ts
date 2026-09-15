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
  })
}

/** Default ctrl properties for structural math elements (fractions, scripts, etc.). */
function mathCtrlProperties(style: TextStyleSpec): BuilderElement {
  return new BuilderElement({
    name: 'm:ctrlPr',
    children: [wordRunProperties(style, 'base')],
  })
}

function mathArgument(name: 'm:e' | 'm:sup' | 'm:sub', children: readonly MathComponent[]): BuilderElement {
  return new BuilderElement({
    name,
    children: [...children],
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
    style: TextStyleSpec,
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
      mathCtrlProperties(style),
      new MathNumerator(numerator),
      new MathDenominator(denominator),
    )
  }
}

export class StyledMathSuperScript extends XmlComponent {
  constructor(
    base: readonly MathComponent[],
    superScript: readonly MathComponent[],
    style: TextStyleSpec,
  ) {
    super('m:sSup')
    this.root.push(
      new BuilderElement({
        name: 'm:sSupPr',
        children: [mathCtrlProperties(style)],
      }),
      mathArgument('m:e', base),
      mathArgument('m:sup', superScript),
    )
  }
}

export class StyledMathSubScript extends XmlComponent {
  constructor(
    base: readonly MathComponent[],
    subScript: readonly MathComponent[],
    style: TextStyleSpec,
  ) {
    super('m:sSub')
    this.root.push(
      new BuilderElement({
        name: 'm:sSubPr',
        children: [mathCtrlProperties(style)],
      }),
      mathArgument('m:e', base),
      mathArgument('m:sub', subScript),
    )
  }
}

export class StyledMathSubSuperScript extends XmlComponent {
  constructor(
    base: readonly MathComponent[],
    subScript: readonly MathComponent[],
    superScript: readonly MathComponent[],
    style: TextStyleSpec,
  ) {
    super('m:sSubSup')
    this.root.push(
      new BuilderElement({
        name: 'm:sSubSupPr',
        children: [mathCtrlProperties(style)],
      }),
      mathArgument('m:e', base),
      mathArgument('m:sub', subScript),
      mathArgument('m:sup', superScript),
    )
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

export function styledMathRun(
  text: string,
  style: TextStyleSpec,
  role: MathRunRole = 'base',
): StyledMathRun {
  return new StyledMathRun(text, style, role)
}

export function styledMath(children: MathComponent[], style: TextStyleSpec): Math {
  return new StyledMath(children, style) as unknown as Math
}

export function styledMathFraction(
  numerator: MathComponent[],
  denominator: MathComponent[],
  style: TextStyleSpec,
): StyledMathFraction {
  return new StyledMathFraction(numerator, denominator, style)
}

export function styledMathSuperScript(
  base: MathComponent[],
  superScript: MathComponent[],
  style: TextStyleSpec,
): StyledMathSuperScript {
  return new StyledMathSuperScript(base, superScript, style)
}

export function styledMathSubScript(
  base: MathComponent[],
  subScript: MathComponent[],
  style: TextStyleSpec,
): StyledMathSubScript {
  return new StyledMathSubScript(base, subScript, style)
}

export function styledMathSubSuperScript(
  base: MathComponent[],
  subScript: MathComponent[],
  superScript: MathComponent[],
  style: TextStyleSpec,
): StyledMathSubSuperScript {
  return new StyledMathSubSuperScript(base, subScript, superScript, style)
}
