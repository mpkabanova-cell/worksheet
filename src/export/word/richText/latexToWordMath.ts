import { parseMath } from '@unified-latex/unified-latex-util-parse'
import type { Argument, Macro, Node } from '@unified-latex/unified-latex-types'
import {
  Math,
  MathCurlyBrackets,
  MathRadical,
  MathRoundBrackets,
  MathSquareBrackets,
  type MathComponent,
} from 'docx'
import { renderMathToPng } from '@/export/word/richText/mathToImage'
import {
  styledMath,
  styledMathFraction,
  styledMathRun,
  styledMathSubScript,
  styledMathSubSuperScript,
  styledMathSuperScript,
  type MathRunRole,
} from '@/export/word/richText/styledMathRun'
import { repairJsonLatexEscapes } from '@/data/mathTextUtils'
import { imageRunFromPngSized } from '@/export/word/richText/toDocxContent'
import type { ExportContext, TextStyleSpec } from '@/export/word/types'
import type { ImageRun, ParagraphChild } from 'docx'

export class UnsupportedLatexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedLatexError'
  }
}

export type MathBracket = 'round' | 'square' | 'curly'

export type MathNode =
  | { kind: 'sequence'; children: MathNode[] }
  | { kind: 'text'; value: string }
  | { kind: 'sup'; base: MathNode; script: MathNode }
  | { kind: 'sub'; base: MathNode; script: MathNode }
  | { kind: 'subsup'; base: MathNode; sub: MathNode; sup: MathNode }
  | { kind: 'fraction'; numerator: MathNode; denominator: MathNode }
  | { kind: 'sqrt'; body: MathNode }
  | { kind: 'root'; degree: MathNode; body: MathNode }
  | { kind: 'group'; bracket: MathBracket; children: MathNode[] }
  | { kind: 'function'; name: string; argument: MathNode }

const UNSUPPORTED_MACROS = new Set(['sum', 'int', 'iint', 'iiint', 'oint', 'lim', 'prod', 'coprod'])

const GREEK_AND_SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  varpi: 'ϖ',
  rho: 'ρ',
  varrho: 'ϱ',
  sigma: 'σ',
  varsigma: 'ς',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'ϕ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  cdot: '·',
  times: '×',
  div: '÷',
  pm: '±',
  mp: '∓',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  degree: '°',
  circ: '°',
  bullet: '•',
  ellipsis: '…',
  ldots: '…',
  cdots: '⋯',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  supset: '⊃',
  cup: '∪',
  cap: '∩',
  emptyset: '∅',
  forall: '∀',
  exists: '∃',
  neg: '¬',
  land: '∧',
  lor: '∨',
  langle: '⟨',
  rangle: '⟩',
}

const RUSSIAN_TRIG_FUNCTIONS = new Set(['tg', 'ctg'])

const SPACE_MACROS = new Set([',', ';', ':', '!', 'quad', 'qquad', 'enspace', 'thinspace'])

const FUNCTION_NAMES = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'lg',
  'exp',
  'min',
  'max',
  'det',
  'gcd',
])

function isWhitespace(node: Node): boolean {
  return node.type === 'whitespace' || node.type === 'parbreak'
}

function coalesceDigitStrings(nodes: Node[]): Node[] {
  const result: Node[] = []
  let index = 0

  while (index < nodes.length) {
    const node = nodes[index]
    if (node.type === 'string' && /^\d$/.test(node.content)) {
      let digits = node.content
      let next = index + 1
      while (next < nodes.length) {
        const candidate = nodes[next]
        if (candidate.type !== 'string' || !/^\d$/.test(candidate.content)) break
        digits += candidate.content
        next += 1
      }
      result.push({ ...node, content: digits })
      index = next
      continue
    }
    result.push(node)
    index += 1
  }

  return result
}

function visibleNodes(nodes: Node[]): Node[] {
  return coalesceDigitStrings(nodes.filter((node) => !isWhitespace(node)))
}

function argumentContent(arg: Argument | undefined): Node[] {
  return arg?.content ?? []
}

function macroArgs(macro: Macro): Node[][] {
  return macro.args?.map((arg) => arg.content) ?? []
}

function sequenceNode(children: MathNode[]): MathNode {
  const flat = children.flatMap((child) => (child.kind === 'sequence' ? child.children : [child]))
  if (flat.length === 0) return { kind: 'text', value: '' }
  if (flat.length === 1) return flat[0]
  return { kind: 'sequence', children: flat }
}

function textNode(value: string): MathNode {
  return value ? { kind: 'text', value } : { kind: 'text', value: '' }
}

function bracketForDelimiter(open: string, close: string): MathBracket {
  if (open === '[' && close === ']') return 'square'
  if (open === '{' && close === '}') return 'curly'
  return 'round'
}

function parseGroupFromNodes(nodes: Node[], start: number): { node: MathNode; next: number } | null {
  if (start >= nodes.length) return null
  const first = nodes[start]
  if (first.type !== 'string') return null

  const open = first.content
  if (open !== '(' && open !== '[' && open !== '{') return null

  const close = open === '(' ? ')' : open === '[' ? ']' : '}'
  let depth = 1
  let index = start + 1
  const inner: Node[] = []

  while (index < nodes.length && depth > 0) {
    const node = nodes[index]
    if (node.type === 'string') {
      if (node.content === open) depth += 1
      else if (node.content === close) {
        depth -= 1
        if (depth === 0) {
          index += 1
          break
        }
      }
    }
    if (depth > 0) inner.push(node)
    index += 1
  }

  if (depth !== 0) return null

  return {
    node: {
      kind: 'group',
      bracket: bracketForDelimiter(open, close),
      children: [parseNodes(inner)],
    },
    next: index,
  }
}

function parseLeftRight(nodes: Node[], start: number): { node: MathNode; next: number } | null {
  const first = nodes[start]
  if (first.type !== 'macro' || first.content !== 'left') return null

  let index = start + 1
  while (index < nodes.length && isWhitespace(nodes[index])) index += 1
  if (index >= nodes.length || nodes[index].type !== 'string') {
    throw new UnsupportedLatexError('\\left without delimiter')
  }

  const openNode = nodes[index]
  if (openNode.type !== 'string') {
    throw new UnsupportedLatexError('\\left without delimiter')
  }
  const open = openNode.content
  index += 1
  const inner: Node[] = []

  while (index < nodes.length) {
    const node = nodes[index]
    if (node.type === 'macro' && node.content === 'right') {
      index += 1
      while (index < nodes.length && isWhitespace(nodes[index])) index += 1
      if (index >= nodes.length || nodes[index].type !== 'string') {
        throw new UnsupportedLatexError('\\right without delimiter')
      }
      const closeNode = nodes[index]
      if (closeNode.type !== 'string') {
        throw new UnsupportedLatexError('\\right without delimiter')
      }
      const close = closeNode.content
      index += 1
      return {
        node: {
          kind: 'group',
          bracket: bracketForDelimiter(open, close),
          children: [parseNodes(inner)],
        },
        next: index,
      }
    }
    inner.push(node)
    index += 1
  }

  throw new UnsupportedLatexError('unclosed \\left')
}

function scriptFromMacro(macro: Macro): MathNode {
  const argContent = argumentContent(macro.args?.[0])
  if (argContent.length === 0) {
    throw new UnsupportedLatexError('missing script argument')
  }
  return parseNodes(argContent)
}

function isArgumentStart(nodes: Node[], index: number): boolean {
  let cursor = index
  while (cursor < nodes.length && isWhitespace(nodes[cursor])) cursor += 1
  if (cursor >= nodes.length) return false

  const node = nodes[cursor]
  if (node.type === 'string') {
    return !'+-*/=,)'.includes(node.content)
  }
  if (node.type === 'macro') {
    if (node.content === '^' || node.content === '_') return false
    if (SPACE_MACROS.has(node.content)) return isArgumentStart(nodes, cursor + 1)
    return true
  }
  return true
}

function attachScriptsToFunction(
  name: string,
  argument: MathNode,
  scriptedName: MathNode,
): MathNode {
  const base: MathNode = { kind: 'function', name, argument }

  switch (scriptedName.kind) {
    case 'sup':
      if (scriptedName.base.kind === 'text' && scriptedName.base.value === name) {
        return { kind: 'sup', base, script: scriptedName.script }
      }
      break
    case 'sub':
      if (scriptedName.base.kind === 'text' && scriptedName.base.value === name) {
        return { kind: 'sub', base, script: scriptedName.script }
      }
      break
    case 'subsup':
      if (scriptedName.base.kind === 'text' && scriptedName.base.value === name) {
        return {
          kind: 'subsup',
          base,
          sub: scriptedName.sub,
          sup: scriptedName.sup,
        }
      }
      break
    default:
      break
  }

  return base
}

function parseRussianTrigFunction(
  nodes: Node[],
  index: number,
  name: string,
): { node: MathNode; next: number } {
  const scriptedName = applyScripts(textNode(name), nodes, index + 1)

  if (!isArgumentStart(nodes, scriptedName.next)) {
    if (scriptedName.node.kind === 'text' && scriptedName.node.value === name) {
      return {
        node: { kind: 'function', name, argument: textNode('') },
        next: scriptedName.next,
      }
    }
    return scriptedName
  }

  const argument = parseExpression(nodes, scriptedName.next)
  return {
    node: attachScriptsToFunction(name, argument.node, scriptedName.node),
    next: argument.next,
  }
}

function parsePrimary(nodes: Node[], start: number): { node: MathNode; next: number } {
  let index = start
  while (index < nodes.length && isWhitespace(nodes[index])) index += 1
  if (index >= nodes.length) {
    throw new UnsupportedLatexError('unexpected end of expression')
  }

  const leftRight = parseLeftRight(nodes, index)
  if (leftRight) return leftRight

  const group = parseGroupFromNodes(nodes, index)
  if (group) return group

  const node = nodes[index]

  if (node.type === 'string') {
    return { node: textNode(node.content), next: index + 1 }
  }

  if (node.type !== 'macro') {
    throw new UnsupportedLatexError(`unsupported node type: ${node.type}`)
  }

  const name = node.content

  if (name === '^' || name === '_') {
    throw new UnsupportedLatexError(`unexpected ${name} without base`)
  }

  if (UNSUPPORTED_MACROS.has(name)) {
    throw new UnsupportedLatexError(`unsupported macro: \\${name}`)
  }

  if (SPACE_MACROS.has(name)) {
    return { node: textNode(' '), next: index + 1 }
  }

  if (RUSSIAN_TRIG_FUNCTIONS.has(name)) {
    return parseRussianTrigFunction(nodes, index, name)
  }

  if (name === 'frac') {
    const args = macroArgs(node)
    if (args.length < 2) throw new UnsupportedLatexError('\\frac requires two arguments')
    return {
      node: {
        kind: 'fraction',
        numerator: parseNodes(args[0]),
        denominator: parseNodes(args[1]),
      },
      next: index + 1,
    }
  }

  if (name === 'sqrt') {
    const args = macroArgs(node)
    const degreeContent = argumentContent(node.args?.[0])
    const bodyContent = argumentContent(node.args?.[1]) ?? args[1] ?? args[0]
    if (degreeContent.length > 0) {
      return {
        node: {
          kind: 'root',
          degree: parseNodes(degreeContent),
          body: parseNodes(bodyContent),
        },
        next: index + 1,
      }
    }
    return {
      node: { kind: 'sqrt', body: parseNodes(bodyContent) },
      next: index + 1,
    }
  }

  if (FUNCTION_NAMES.has(name)) {
    const argument = parsePrimary(nodes, index + 1)
    return {
      node: { kind: 'function', name, argument: argument.node },
      next: argument.next,
    }
  }

  if (name in GREEK_AND_SYMBOLS) {
    return { node: textNode(GREEK_AND_SYMBOLS[name]), next: index + 1 }
  }

  if (name === 'text' || name === 'mathrm' || name === 'operatorname') {
    const args = macroArgs(node)
    const contentNodes =
      name === 'operatorname' && args.length > 1 && args[0].length === 0 ? args[1] : args[0]
    const text =
      contentNodes?.map((part) => (part.type === 'string' ? part.content : '')).join('') ?? ''
    return { node: textNode(text), next: index + 1 }
  }

  if (name === 'left' || name === 'right') {
    throw new UnsupportedLatexError(`malformed delimiter command: \\${name}`)
  }

  throw new UnsupportedLatexError(`unsupported macro: \\${name}`)
}

function applyScripts(base: MathNode, nodes: Node[], start: number): { node: MathNode; next: number } {
  let currentBase = base
  let pendingSub: MathNode | undefined
  let index = start

  while (index < nodes.length) {
    while (index < nodes.length && isWhitespace(nodes[index])) index += 1
    if (index >= nodes.length) break

    const node = nodes[index]
    if (node.type !== 'macro' || (node.content !== '^' && node.content !== '_')) break

    const script = scriptFromMacro(node)
    if (node.content === '_') {
      if (pendingSub) {
        currentBase = { kind: 'sub', base: currentBase, script: pendingSub }
      }
      pendingSub = script
    } else if (pendingSub) {
      currentBase = {
        kind: 'subsup',
        base: currentBase,
        sub: pendingSub,
        sup: script,
      }
      pendingSub = undefined
    } else {
      currentBase = { kind: 'sup', base: currentBase, script }
    }
    index += 1
  }

  if (pendingSub) {
    currentBase = { kind: 'sub', base: currentBase, script: pendingSub }
  }

  return { node: currentBase, next: index }
}

function parseExpression(nodes: Node[], start: number): { node: MathNode; next: number } {
  const primary = parsePrimary(nodes, start)
  return applyScripts(primary.node, nodes, primary.next)
}

function parseNodes(nodes: Node[]): MathNode {
  const items = visibleNodes(nodes)
  if (items.length === 0) return textNode('')

  const children: MathNode[] = []
  let index = 0

  while (index < items.length) {
    const expr = parseExpression(items, index)
    children.push(expr.node)
    index = expr.next
  }

  return sequenceNode(children)
}

export function parseLatex(latex: string): MathNode {
  const trimmed = repairJsonLatexEscapes(latex.trim())
  if (!trimmed) return textNode('')
  try {
    return parseNodes(parseMath(trimmed))
  } catch (error) {
    if (error instanceof UnsupportedLatexError) throw error
    throw new UnsupportedLatexError(
      error instanceof Error ? error.message : 'failed to parse LaTeX',
    )
  }
}

function mathRun(text: string, style: TextStyleSpec, role: MathRunRole = 'base') {
  return styledMathRun(text, style, role)
}

function mathComponentsFromNode(
  node: MathNode,
  style: TextStyleSpec,
  role: MathRunRole = 'base',
): MathComponent[] {
  switch (node.kind) {
    case 'sequence':
      return node.children.flatMap((child) => mathComponentsFromNode(child, style, role))
    case 'text':
      return node.value ? [mathRun(node.value, style, role)] : []
    case 'sup':
      return [
        styledMathSuperScript(
          mathComponentsFromNode(node.base, style, 'base'),
          mathComponentsFromNode(node.script, style, 'sup'),
          style,
        ),
      ]
    case 'sub':
      return [
        styledMathSubScript(
          mathComponentsFromNode(node.base, style, 'base'),
          mathComponentsFromNode(node.script, style, 'sub'),
          style,
        ),
      ]
    case 'subsup':
      return [
        styledMathSubSuperScript(
          mathComponentsFromNode(node.base, style, 'base'),
          mathComponentsFromNode(node.sub, style, 'sub'),
          mathComponentsFromNode(node.sup, style, 'sup'),
          style,
        ),
      ]
    case 'fraction':
      return [
        styledMathFraction(
          mathComponentsFromNode(node.numerator, style),
          mathComponentsFromNode(node.denominator, style),
          style,
        ),
      ]
    case 'sqrt':
      return [
        new MathRadical({
          children: mathComponentsFromNode(node.body, style),
        }),
      ]
    case 'root':
      return [
        new MathRadical({
          children: mathComponentsFromNode(node.body, style),
          degree: mathComponentsFromNode(node.degree, style),
        }),
      ]
    case 'group': {
      const children = mathComponentsFromNode(sequenceNode(node.children), style)
      if (node.bracket === 'square') return [new MathSquareBrackets({ children })]
      if (node.bracket === 'curly') return [new MathCurlyBrackets({ children })]
      return [new MathRoundBrackets({ children })]
    }
    case 'function':
      return [
        mathRun(node.name, style),
        ...mathComponentsFromNode(node.argument, style),
      ]
    default:
      return []
  }
}

export function wordMathFromNode(node: MathNode, style: TextStyleSpec): Math {
  return styledMath(mathComponentsFromNode(node, style), style)
}

export function latexToWordMath(latex: string, style: TextStyleSpec): Math {
  return wordMathFromNode(parseLatex(latex), style)
}

function inlineMathImageRun(img: Awaited<ReturnType<typeof renderMathToPng>>): ImageRun {
  return imageRunFromPngSized(img.data, img.width, img.height)
}

export async function mathSegmentToParagraphChild(
  tex: string,
  display: boolean,
  style: TextStyleSpec,
  ctx: ExportContext,
): Promise<ParagraphChild> {
  try {
    return latexToWordMath(tex, style)
  } catch (error) {
    console.warn('[docx-math] fallback to PNG', {
      latex: tex,
      error,
    })
    return inlineMathImageRun(await renderMathToPng(tex, display, style.sizePx, ctx))
  }
}

/** Test helper: extract OMML XML for a LaTeX expression. */
export async function ommlXmlFromLatex(latex: string, style: TextStyleSpec): Promise<string> {
  const { Document, Packer, Paragraph } = await import('docx')
  const JSZip = (await import('jszip')).default
  const math = latexToWordMath(latex, style)
  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [math] })] }],
  })
  const buf = await Packer.toBuffer(doc)
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('word/document.xml')!.async('string')
  const match = xml.match(/<m:oMath>[\s\S]*?<\/m:oMath>/)
  return match?.[0] ?? xml
}
