// eslint-disable-next-line @typescript-eslint/camelcase
import { apply, tok } from "typescript-parsec"
import { Node } from "./basic"
import { TokenParser, TokenType } from "./tokenizer"

export interface NewLine extends Node {
  type: 'new-line',
  raw: '\n'
}

export interface Dot extends Node {
  type: 'dot',
  raw: '.'
}

export interface Comma extends Node {
  type: 'comma',
  raw: ','
}

export interface Equals extends Node {
  type: 'equals',
  raw: '='
}

export interface PlusEquals extends Node {
  type: 'plus-equals',
  raw: '+='
}

export interface Colon extends Node {
  type: 'colon',
  raw: ':'
}

export const newLineParser: TokenParser<NewLine> = apply(tok(TokenType.NEWLINE), token => ({ type: 'new-line', pos: token.pos.index, raw: '\n' }))

export const commaParser: TokenParser<Comma> = apply(tok(TokenType.PUNC_COMMA), token => ({ type: 'comma', pos: token.pos.index, raw: ',' }))

export const equalsParser: TokenParser<Equals> = apply(tok(TokenType.PUNC_EQUALS), token => ({ type: 'equals', pos: token.pos.index, raw: '=' }))

export const plusEqualsParser: TokenParser<PlusEquals> = apply(tok(TokenType.PUNC_PLUS_EQUALS), token => ({ type: 'plus-equals', pos: token.pos.index, raw: '+=' }))

export const colonParser: TokenParser<Colon> = apply(tok(TokenType.PUNC_COLON), token => ({ type: 'colon', pos: token.pos.index, raw: ':' }))
