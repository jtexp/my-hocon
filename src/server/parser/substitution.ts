// eslint-disable-next-line @typescript-eslint/camelcase
import { apply, opt_sc, Parser, rep_sc, seq } from 'typescript-parsec'
import { NodeSequence, Primitive, primitiveParser, toRaw, WhiteSpace, whiteSpaceParser } from './basic'
import { CloseCurly, closeCurlyParser, OpenPathCurly, openPathCurlyParser } from './delimiter'
import { Problem } from './problem'
import { Dot } from './separater'
import { TokenType } from './tokenizer'

export interface SubstitutionPath extends NodeSequence {
  type: 'substitution-path',
  parsed: string[] | undefined,
  children: (Primitive | Problem | Dot)[]
}

export interface Substitution extends NodeSequence {
  type: 'substitution',
  children: [OpenPathCurly, SubstitutionPath, CloseCurly]
}

export const substitutionPathParser: Parser<TokenType, SubstitutionPath> = apply(seq(seq(primitiveParser, rep_sc(primitiveParser)), rep_sc(seq(whiteSpaceParser, primitiveParser, rep_sc(primitiveParser)))), token => {
  const [[tokenHead, tokenTail1], tokenTail2] = token
  const flatten: (Primitive | Problem | WhiteSpace)[] = [tokenHead, ...tokenTail1]
  for (const [space, value, tokenTail3] of tokenTail2) {
    flatten.push(space, value, ...tokenTail3)
  }
  const prepared: (Primitive | Problem | Dot)[] = []
  for (const part of flatten) {
    if (part.type === 'problem') {
      prepared.push({ ...part, error: 'UNRECOGNIZED_PATH_EXPRESSION' })
    } else if (part.type === 'whitespace') {
      prepared.push({ type: 'problem', pos: part.pos, raw: part.raw, error: 'WHITESPACE_IN_PATH_EXPRESSION' })
    } else if (part.raw.startsWith('"""')) {
      prepared.push({ type: 'problem', pos: part.pos, raw: part.raw, error: 'MULTILINE_STRING_IN_PATH_EXPRESSION' })
    } else if (part.raw.startsWith('"')) {
      prepared.push(part)
    } else {
      let currentIndex = part.pos
      const [head, ...tail] = part.raw.split('.')
      prepared.push({ type: 'primitive', pos: currentIndex, raw: head, parsed: head })
      currentIndex += head.length
      for (const elem of tail) {
        prepared.push({ type: 'dot', pos: currentIndex, raw: '.' }, { type: 'primitive', pos: ++currentIndex, raw: elem, parsed: elem })
        currentIndex += elem.length
      }
    }
  }
  let parsed: string[] | undefined = ['']
  const children: (Primitive | Problem | Dot)[] = []
  for (const part of prepared) {
    if (part.type == 'dot') {
      if (children.length <= 0) {
        parsed = undefined
        const pos = part.pos, raw = part.raw
        children.push({ type: 'problem', pos, raw, error: 'PATH_EXPRESSION_SEPARATOR_AT_THE_BEGINNING' })
      } else if (children[children.length - 1].type == 'dot') {
        parsed = undefined
        const pos = part.pos, raw = part.raw
        children.push({ type: 'problem', pos, raw, error: 'PATH_EXPRESSION_SEPARATOR_USED_CONSECUTIVELY' })
      } else {
        parsed?.push('')
        children.push(part)
      }
    } else if (part.type === 'problem') {
      parsed = undefined
      children.push(part)
    } else if (part.raw.length > 0) {
      parsed?.push((parsed?.pop() ?? '') + part.parsed)
      children.push(part)
    }
  }
  const part = children[children.length - 1]
  if (part.type == 'dot') {
    parsed = undefined
    const raw = part.raw, pos = part.pos
    children[children.length - 1] = { type: 'problem', pos, raw, error: 'PATH_EXPRESSION_SEPARATOR_AT_THE_END' }
  }
  return { type: 'substitution-path', parsed, children }
})

export const substitutionParser: Parser<TokenType, Substitution | Problem> = apply(seq(openPathCurlyParser, opt_sc(whiteSpaceParser), opt_sc(substitutionPathParser), opt_sc(whiteSpaceParser), opt_sc(closeCurlyParser)), token => {
  const [open, space1, path, space2, close] = token
  if (space1 !== undefined || space2 !== undefined) {
    const pos = open.pos, raw = toRaw(open) + toRaw(space1) + toRaw(path) + toRaw(space2) + toRaw(close)
    return { type: 'problem', pos, raw, error: 'WHITESPACE_IN_PATH_EXPRESSION' }
  }
  if (close === undefined) {
    const pos = open.pos, raw = toRaw(open) + toRaw(path)
    return { type: 'problem', pos, raw, error: 'UNMATCHED_BRACE_IN_SUBSTITUTION' }
  }
  if (path === undefined) {
    const pos = open.pos, raw = toRaw(open) + toRaw(close)
    return { type: 'problem', pos, raw, error: 'EMPTY_PATH_IN_SUBSTITUTION' }
  }
  return { type: 'substitution', children: [open, path, close] }
})
