import { buildLexer, Lexer, Parser, Rule } from 'typescript-parsec'

export enum TokenType {
  NEWLINE, WHITESPACE, COMMENT,
  PUNC_COMMA, PUNC_COLON, PUNC_EQUALS, PUNC_PLUS_EQUALS,
  OPEN_PATH_CURLY, OPEN_CURLY, CLOSE_CURLY, OPEN_SQUARE, CLOSE_SQUARE,
  MULTILINE_TEXT_STRING, QUOTED_TEXT_STRING, UNQUOTED_TEXT_STRING, PROBLEM,
}

const regexp: { [key: string]: RegExp } = {
  [TokenType.NEWLINE]: /^\n/g,
  [TokenType.WHITESPACE]: /^([\u00a0\u2007\u202f\ufeff]|[^\n\S])+/g,
  [TokenType.COMMENT]: /^(#|\/\/).*/g,
  [TokenType.PUNC_COMMA]: /^,/g,
  [TokenType.PUNC_COLON]: /^:/g,
  [TokenType.PUNC_EQUALS]: /^=/g,
  [TokenType.PUNC_PLUS_EQUALS]: /^\+=/g,
  [TokenType.OPEN_PATH_CURLY]: /^(\$\{\?|\$\{)/g,
  [TokenType.OPEN_CURLY]: /^\{/g,
  [TokenType.CLOSE_CURLY]: /^\}/g,
  [TokenType.OPEN_SQUARE]: /^\[/g,
  [TokenType.CLOSE_SQUARE]: /^\]/g,
  [TokenType.MULTILINE_TEXT_STRING]: /^"""([^"]+|"(?!")||""(?!"))*"{3,}/g,
  [TokenType.QUOTED_TEXT_STRING]: /^"([^"\\\n]|\\["\\bfnrt/]|\\u[0-9a-fA-F]{4})*"/g,
  [TokenType.UNQUOTED_TEXT_STRING]: /^[^\s\u00a0\u2007\u202f\ufeff$"{}[\]:=,+#`^?!@*&]+/g,
  [TokenType.PROBLEM]: /^[^\s\u00a0\u2007\u202f\ufeff]/g,
}

export type TokenLexer = Lexer<TokenType>

export type TokenRule<T> = Rule<TokenType, T>

export type TokenParser<T> = Parser<TokenType, T>

export const tokenizer: TokenLexer = buildLexer(Object.keys(regexp).map(k => [true, regexp[k], +k as TokenType]))
