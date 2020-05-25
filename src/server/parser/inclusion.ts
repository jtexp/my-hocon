// eslint-disable-next-line @typescript-eslint/camelcase
import { alt, apply, opt_sc, rule, seq } from 'typescript-parsec'
import { NodeSequence, Primitive, primitiveProblemParser, quotedTextParser, toRaw, unquotedTextParser, WhiteSpace, whiteSpaceParser } from './basic'
import { IncludePrefix, includePrefixParser } from './delimiter'
import { Problem } from './problem'
import { TokenParser, TokenRule } from './tokenizer'

export interface WrappedInclude extends NodeSequence {
  type: 'wrapped-include',
  markedAsRequired: boolean,
  inner: (WrappedInclude | Primitive | Problem),
  children: (WrappedInclude | Primitive | WhiteSpace | Problem)[]
}

export interface Inclusion extends NodeSequence {
  type: 'inclusion',
  children: [IncludePrefix, WhiteSpace, Primitive | WrappedInclude | Problem]
}

const wrappedIncludeRule: TokenRule<WrappedInclude | Problem> = rule()

export const wrappedIncludeParser: TokenParser<Primitive | WrappedInclude | Problem> = alt(quotedTextParser, wrappedIncludeRule, primitiveProblemParser)

export const inclusionParser: TokenParser<Inclusion> = apply(seq(includePrefixParser, whiteSpaceParser, wrappedIncludeParser), token => {
  return { type: 'inclusion', children: token }
})

wrappedIncludeRule.setPattern(apply(seq(unquotedTextParser, opt_sc(whiteSpaceParser), wrappedIncludeParser, opt_sc(whiteSpaceParser), unquotedTextParser), token => {
  const [open, ws1, inner, ws2, close] = token
  if (close.raw !== ')' || !open.raw.endsWith('(')) {
    const pos = open.pos, raw = toRaw(open) + toRaw(ws1) + toRaw(inner) + toRaw(ws2) + toRaw(close)
    return { type: 'problem', error: 'UNRECOGNIZED_INCLUSION_PATH', pos, raw }
  }
  if (['required(', 'url(', 'file(', 'classpath('].indexOf(open.raw) < 0) {
    const pos = open.pos, raw = toRaw(open) + toRaw(ws1) + toRaw(inner) + toRaw(ws2) + toRaw(close)
    return { type: 'problem', error: 'UNRECOGNIZED_INCLUSION_PARENTHESES', pos, raw }
  }
  const markedAsRequired = open.raw.startsWith('required')
  if (markedAsRequired && inner.type == 'wrapped-include' && inner.markedAsRequired) {
    const pos = open.pos, raw = toRaw(open) + toRaw(ws1) + toRaw(inner) + toRaw(ws2) + toRaw(close)
    return { type: 'problem', error: 'DUPLICATE_REQUIRED_IN_INCLUSION', pos, raw }
  }
  if (!markedAsRequired && inner.type == 'wrapped-include') {
    const pos = open.pos, raw = toRaw(open) + toRaw(ws1) + toRaw(inner) + toRaw(ws2) + toRaw(close)
    return { type: 'problem', error: 'DUPLICATE_PARENTHESES_IN_INCLUSION', pos, raw }
  }
  const wrapped1 = ws1 === undefined ? [] : [ws1], wrapped2 = ws2 === undefined ? [] : [ws2]
  return { type: 'wrapped-include', markedAsRequired, inner, children: [open, ...wrapped1, inner, ...wrapped2, close] }
}))
