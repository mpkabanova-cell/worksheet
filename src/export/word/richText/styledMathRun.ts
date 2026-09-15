import { BuilderElement, RunProperties, XmlComponent } from 'docx'
import { pxToHalfPoints, runFont } from '@/export/word/layoutTokens'
import type { TextStyleSpec } from '@/export/word/types'

class MathTextNode extends XmlComponent {
  constructor(text: string) {
    super('m:t')
    this.root.push(text)
  }
}

/** Math run with paragraph-matched font size and upright (non-italic) style. */
export class StyledMathRun extends XmlComponent {
  constructor(text: string, style: TextStyleSpec) {
    super('m:r')
    this.root.push(
      new BuilderElement({
        name: 'm:rPr',
        children: [
          new BuilderElement({
            name: 'm:sty',
            attributes: { val: { key: 'm:val', value: 'p' } },
          }),
          new RunProperties({
            font: runFont(),
            size: pxToHalfPoints(style.sizePx),
            italics: false,
            italicsComplexScript: false,
          }),
        ],
      }),
    )
    this.root.push(new MathTextNode(text))
  }
}

export function styledMathRun(text: string, style: TextStyleSpec): StyledMathRun {
  return new StyledMathRun(text, style)
}
