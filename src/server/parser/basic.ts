// eslint-disable-next-line @typescript-eslint/camelcase
import { alt, apply, rep_sc, seq, tok } from 'typescript-parsec'
import { Problem } from './problem'
import { TokenParser, TokenType } from './tokenizer'

export interface Node {
  type: string,
  pos: number,
  raw: string
}

export interface WhiteSpace extends Node {
  type: 'whitespace',
  count: number
}

export interface Comment extends Node {
  type: 'comment',
  start: '#' | '//'
}

export interface Primitive extends Node {
  type: 'primitive',
  parsed: string | number | boolean | null,
  raw: string
}

export interface NodeSequence {
  type: string,
  raw?: undefined, // check children
  children: (Node | NodeSequence)[]
}

export function toRaw(node: Node | NodeSequence | undefined): string {
  return node === undefined ? '' : node.raw === undefined ? ''.concat(...node.children.map(toRaw)) : node.raw
}

export function toDebugOutput(node: Node | NodeSequence): string {
  if (node.raw === undefined) {
    const rawChildren = node.children.map(elem => toDebugOutput(elem)).join(', ')
    return node.type + '(' + rawChildren + ')'
  }
  if (node.type == 'problem') {
    const rawProblem = (node as Problem).error.toLowerCase().replace('_', '-')
    return 'problem[' + rawProblem + '](' + JSON.stringify(node.raw) + ')'
  }
  return node.type + '(' + JSON.stringify(node.raw) + ')'
}

export const whiteSpaceParser: TokenParser<WhiteSpace> = apply(tok(TokenType.WHITESPACE), token => {
  return { type: 'whitespace', pos: token.pos.index, count: token.text.length, raw: token.text }
})

export const commentParser: TokenParser<Comment> = apply(tok(TokenType.COMMENT), token => {
  return { type: 'comment', pos: token.pos.index, start: token.text.startsWith('#') ? '#' : '//', raw: token.text }
})

export const multilineTextParser: TokenParser<Primitive> = apply(tok(TokenType.MULTILINE_TEXT_STRING), token => {
  return { type: 'primitive', pos: token.pos.index, parsed: token.text.substring(3, token.text.length - 3), raw: token.text }
})

export const quotedTextParser: TokenParser<Primitive> = apply(tok(TokenType.QUOTED_TEXT_STRING), token => {
  return { type: 'primitive', pos: token.pos.index, parsed: '' + JSON.parse(token.text), raw: token.text }
})

export const unquotedTextParser: TokenParser<Primitive> = apply(tok(TokenType.UNQUOTED_TEXT_STRING), token => {
  const raw = token.text, pos = token.pos.index
  if (raw === 'null') {
    return { type: 'primitive', pos, parsed: null, raw }
  }
  if (['true', 'yes', 'on'].indexOf(raw) >= 0) {
    return { type: 'primitive', pos, parsed: true, raw }
  }
  if (['false', 'off', 'no'].indexOf(raw) >= 0) {
    return { type: 'primitive', pos, parsed: false, raw }
  }
  if (/^(-?(0|[1-9]\d*)((\.\d+)?([eE][+-]?\d+)?)?)$/.test(raw)) {
    return { type: 'primitive', pos, parsed: +JSON.parse(raw), raw }
  }
  return { type: 'primitive', pos, parsed: raw, raw }
})

export const primitiveProblemParser: TokenParser<Problem> = apply(seq(tok(TokenType.PROBLEM), rep_sc(tok(TokenType.PROBLEM))), token => {
  const [head, tail] = token, pos = head.pos.index, raw = ''.concat(head.text, ...tail.map(elem => elem.text))
  return { type: 'problem', error: 'UNRECOGNIZED_VALUE', pos, raw }
})

export const primitiveParser: TokenParser<Primitive | Problem> = alt(multilineTextParser, quotedTextParser, unquotedTextParser, primitiveProblemParser)
