// eslint-disable-next-line @typescript-eslint/camelcase
import { apply, str, tok } from 'typescript-parsec'
import { Node } from './basic'
import { TokenParser, TokenType } from './tokenizer'

export interface IncludePrefix extends Node {
  type: 'include-prefix',
  raw: 'include'
}

export interface OpenPathCurly extends Node {
  type: 'open-path-curly',
  markedAsOption: boolean,
  raw: '${?' | '${'
}

export interface OpenCurly extends Node {
  type: 'open-curly',
  raw: '{'
}

export interface CloseCurly extends Node {
  type: 'close-curly',
  raw: '}'
}

export interface OpenSquare extends Node {
  type: 'open-square',
  raw: '['
}

export interface CloseSquare extends Node {
  type: 'close-square',
  raw: ']'
}

export const includePrefixParser: TokenParser<IncludePrefix> = apply(str('include'), token => {
  return { type: 'include-prefix', pos: token.pos.index, raw: 'include' }
})

export const openPathCurlyParser: TokenParser<OpenPathCurly> = apply(tok(TokenType.OPEN_PATH_CURLY), token => {
  return { type: 'open-path-curly', pos: token.pos.index, markedAsOption: token.text.endsWith("?"), raw: token.text as ('${?' | '${') }
})

export const openCurlyParser: TokenParser<OpenCurly> = apply(tok(TokenType.OPEN_CURLY), token => {
  return { type: 'open-curly', pos: token.pos.index, raw: "{" }
})

export const closeCurlyParser: TokenParser<CloseCurly> = apply(tok(TokenType.CLOSE_CURLY), token => {
  return { type: 'close-curly', pos: token.pos.index, raw: "}" }
})

export const openSquareParser: TokenParser<OpenSquare> = apply(tok(TokenType.OPEN_SQUARE), token => {
  return { type: 'open-square', pos: token.pos.index, raw: "[" }
})

export const closeSquareParser: TokenParser<CloseSquare> = apply(tok(TokenType.CLOSE_SQUARE), token => {
  return { type: 'close-square', pos: token.pos.index, raw: "]" }
})
